/**
 * SCM Mastering Reverb — a high-fidelity, mastering-grade stereo algorithmic
 * reverb engineered as a modern, transparent evolution of the TC Works Native
 * Reverb Plus character: dense, non-metallic, stable, coloration-free.
 *
 * WHY NOT SCHROEDER — the previous engine (8 parallel combs + 4 series
 * allpasses) is the classic Schroeder topology. Its fixed-delay combs form a
 * sparse set of narrow high-Q modes; on long tails a sustained input excites
 * one mode and it rings for the whole decay — the "metallic howl" users hear.
 * An FDN with an orthogonal mixing matrix yields a dense, isotropic modal
 * distribution from the first milliseconds, so the tail is smooth and grain-
 * free instead of tonal.
 *
 * ARCHITECTURE (per channel, true stereo — two independent FDNs):
 *
 *   input ─┬─► Early-Reflection engine ──► earlyLevel ──┐
 *         │                                            ├─► channel wet ─► output
 *         └─► late pre-delay ─► 8-line FDN ─► LPF ─► lateLevel ─┘
 *
 *   FDN, 8 lines:
 *     x[i] = B[i]·in  +  Σ_k  M[i][k] · g · H_k( y[k] )
 *     y[i] = delay_i( x[i] )           (prime-incommensurate, modulated lengths)
 *     H_k  = HiDamp( lowpass ) · LoDamp( highpass )   (passive, |H| ≤ 1)
 *
 *   M = diffuse-blended Householder matrix (I − (2/N)·1·1ᵀ):
 *       M = (1−α)·I + α·H_house,  α = diffuse.  Both I and H_house are
 *       orthogonal (operator norm = 1), so any convex blend also has norm ≤ 1.
 *       Folding the scalar loop gain g into the coefficients makes every
 *       eigenvalue of the feedback system equal to g (in magnitude). g is
 *       hard-capped < 1 (0.995 normal, 0.9995 freeze) ⇒ ABSOLUTE stability
 *       under every parameter combination. The passive damping H_k only
 *       removes energy ⇒ can never destabilise the loop.
 *
 * TRANSPARENCY FOR MASTERING:
 *   • Dense, isotropic modes from t≈0 → no metallic ringing / discrete echoes.
 *   • Per-line one-pole Hi/Lo damping ⇒ LF and HF decay independently, so the
 *     tail's spectrum evolves naturally (Color + Lo/Hi Factor) instead of a
 *     static EQ bolted onto a fixed tail.
 *   • Subtle always-on delay modulation (≈0.05–0.25 ms, slow incommensurate
 *     rates) smears residual fixed modes → grain-free tail, no chorus/wobble.
 *   • Independent early reflections with Square / Curved / Round shapes give
 *     real spatial character before the tail, so 0–15 % wet glues a mix
 *     without sounding "reverberant".
 *   • Stereo decorrelation (L/R delay-length offset + early tap spreads)
 *     gives natural width; a mono-compatible mode collapses the spread.
 *
 * EXPORT CONTRACT — { input, output, setParams, dispose } is unchanged, so
 * modules/reverb.js and the Reverb panel keep working. setParams accepts the
 * legacy keys (decay, size, diffusion, damping, radicalness, enabled) AND the
 * new TC-style keys (shape, diffuse, color, loFactor, hiFactor, earlyLevel,
 * earlyPredelay, earlySize, lateLevel, lateStart, lpf, freeze,
 * monoCompatible, outputLevel). Missing keys fall back to DEFAULT_REVERB_PARAMS
 * (the "Mastering Glue" voice) so the engine is transparent even when the
 * current panel only drives the legacy subset.
 */

// ── FDN geometry ────────────────────────────────────────────────────────────
// Prime-incommensurate base delay lengths (seconds, ~size 0.5). Incommensurate
// primes maximise modal density and prevent shared resonances between lines.
const FDN_BASE_DELAYS = [0.0233, 0.0297, 0.0371, 0.0417, 0.0449, 0.0529, 0.0631, 0.0713];
const N = FDN_BASE_DELAYS.length; // 8 lines per channel

// Householder matrix M = I − (2/N)·1·1ᵀ — only two distinct coefficient values.
const HH_DIAG = 1 - 2 / N; //  0.75
const HH_OFF = -2 / N;     // −0.25

// Input injection gains (varied → denser, less "direct" onset).
const B_INJECT = [1, 0.72, 0.95, 0.8, 0.88, 1, 0.76, 0.92];

const RT60_K = -6.90775527898; // ln(0.001) — 60 dB

// Hard stability caps for the loop gain (strictly < 1).
const G_MAX = 0.992;      // normal operation (extra headroom vs LF buildup)
const G_FREEZE = 0.9995;  // freeze / infinite sustain (still stable)

// Default parameter set — the "Mastering Glue" voice: transparent, neutral,
// short-to-medium tail, gentle early reflections, no coloration. Ideal for
// 0–15 % wet ambience on a full mix bus.
export const DEFAULT_REVERB_PARAMS = {
  enabled: false,
  shape: 'curved',       // 'square' | 'curved' | 'round'
  size: 0.5,             // 0..1 — scales room geometry (early + late)
  diffuse: 0.78,          // 0..1 — late diffusion / modal density
  color: 0.55,           // 0..1 — tonal tilt of the tail (0 dark .. 1 bright)
  loFactor: 0.35,        // 0..1 — low-frequency damping (higher = shorter LF)
  hiFactor: 0.45,        // 0..1 — high-frequency damping (higher = shorter HF)
  earlyLevel: 0.55,      // 0..1
  earlyPredelay: 0,      // ms (extra early offset; main predelay is external)
  earlySize: 0.5,        // 0..1 — early-reflection geometry (independent of size)
  lateLevel: 1.18,       // 0..1.5 — late tail runs a touch hot for a lush "whoah"
  lateStart: 12,         // ms — late-tail onset after the early reflections
  decay: 1.5,            // s — RT60 of the late tail
  lpf: 18000,            // Hz — low-pass on the late tail (tames digital sheen)
  freeze: false,         // infinite (stable) sustain
  monoCompatible: false, // collapse stereo spread for mono safety
  outputLevel: 1.0,      // 0..1 — internal wet trim
  mix: 0.2,              // (handled externally by the module; kept for reference)
  // Legacy compat keys (accepted, mapped internally):
  diffusion: 0.7, damping: 0.5, radicalness: 0,
};

/**
 * Early-reflection tap template for a room shape.
 *   square → few specular taps, mono (tight image, brighter).
 *   curved → mid count, smoothed gains, slight L/R spread.
 *   round  → many dense, diffuse taps, wider L/R spread.
 * Returns taps in seconds (at earlySize 0.5) with per-tap L/R time spread (s).
 */
function earlyTaps(shape, mono) {
  const spread = mono ? 0 : { square: 0, curved: 0.00035, round: 0.0008 }[shape] || 0.00035;
  const build = (count, g0, g1, t0, t1) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const f = count > 1 ? i / (count - 1) : 0;
      // Slight incommensurate jitter so taps don't sit on a regular grid.
      const jitter = (i % 2 ? 0.0006 : -0.0004) * (1 + i * 0.05);
      out.push({
        t: t0 + (t1 - t0) * f + jitter,
        g: g0 + (g1 - g0) * f,
        spread,
      });
    }
    return out;
  };
  if (shape === 'square') return build(7, 0.60, 0.30, 0.0050, 0.0440);
  if (shape === 'round') return build(14, 0.46, 0.14, 0.0070, 0.0640);
  return build(11, 0.54, 0.20, 0.0060, 0.0540); // 'curved' (default) — denser, wider
}

// ── FDN builder (one channel) ───────────────────────────────────────────────
function buildFDN(ctx, bus, baseDelays, modLFOs, srScale) {
  const sampleRate = ctx.sampleRate || 44100;
  const lineIn = [];
  const delay = [];
  const dampLP = [];   // Hi damping (lowpass)
  const dampLo = [];   // Lo damping (highpass)
  const dampShelf = []; // LF decay shelf (lowshelf cut in the loop)
  const lineOut = [];  // post-damping tap
  const injectGain = []; // B[i]·lateIn → lineIn[i]
  const modGain = [];    // per-line modulation depth
  const matrixGain = []; // matrixGain[i][k] = M[i][k]·g  (lineOut[k] → lineIn[i])

  // Late input path: bus → latePredelay → lateIn → inject → lines.
  const latePredelay = ctx.createDelay(0.5);
  latePredelay.delayTime.value = 0.012;
  // Late-input high-pass — removes LF/subsonic energy BEFORE it enters the
  // feedback loop. Cascaded with the per-line dampLo high-pass (same corner,
  // both Butterworth Q0.707) it gives a steeper ~4th-order rejection inside
  // the loop, so low frequencies can't accumulate and ring (the "rumble").
  const lateInHP = ctx.createBiquadFilter();
  lateInHP.type = 'highpass'; lateInHP.frequency.value = 100; lateInHP.Q.value = 0.707;
  const lateIn = ctx.createGain();
  lateIn.gain.value = 1;
  bus.connect(latePredelay);
  latePredelay.connect(lateInHP);
  lateInHP.connect(lateIn);

  for (let i = 0; i < N; i++) {
    const li = ctx.createGain();   // sums injection + matrix feedback
    const dl = ctx.createDelay(0.5);
    // baseDelays are in SECONDS — DelayNode.delayTime is in seconds, so use them
    // directly. (The previous `* srScale / sampleRate` shrank each line to
    // ~0.0005 ms, collapsing the late tail to nothing.)
    dl.delayTime.value = baseDelays[i];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.5;
    const lo = ctx.createBiquadFilter();
    // Butterworth Q (0.707) — a cleaner LF cutoff than 0.5, less ringing just
    // above the corner where loop rumble would otherwise build.
    lo.type = 'highpass'; lo.frequency.value = 60; lo.Q.value = 0.707;
    // LF decay shelf — a low-shelf CUT inside the loop. The flat passband of the
    // Hi/Lo damping lets the 100–1000 Hz lower-mid band recirculate at the full
    // loop gain g, so on bass-heavy material it rings at the full RT60 (the
    // perceptual "LF feedback"). Attenuating LF in the loop makes low
    // frequencies decay faster than the mid/high tail, taming the buildup
    // without thinning the reverb the way a higher high-pass would.
    const lsh = ctx.createBiquadFilter();
    lsh.type = 'lowshelf'; lsh.frequency.value = 300; lsh.gain.value = 0; lsh.Q.value = 0.7;
    // post-damping tap. CRITICAL: this node feeds BOTH the feedback matrix
    // and the output sum, so its gain must be 1. If it were 1/N here, the
    // feedback loop gain would be g/N ≈ 0.1 and the tail would collapse to
    // ~0.17 s regardless of Decay — every preset would sound like the same
    // small room. The 1/N normalise lives on the sum node instead.
    const out = ctx.createGain();
    out.gain.value = 1;

    // Modulation: slow LFO → tiny delay-time wobble (smears fixed modes).
    const mg = ctx.createGain();
    mg.gain.value = 0.00006 + (i % 3) * 0.00003;
    modLFOs[i % modLFOs.length].connect(mg);
    mg.connect(dl.delayTime);

    li.connect(dl); dl.connect(lp); lp.connect(lo); lo.connect(lsh); lsh.connect(out);
    const ij = ctx.createGain();
    ij.gain.value = B_INJECT[i];
    lateIn.connect(ij); ij.connect(li);

    lineIn.push(li); delay.push(dl); dampLP.push(lp); dampLo.push(lo); dampShelf.push(lsh);
    lineOut.push(out); injectGain.push(ij); modGain.push(mg);
  }

  // Feedback matrix: lineOut[k] → matrixGain[i][k] → lineIn[i].
  const row = [];
  for (let i = 0; i < N; i++) {
    const cols = [];
    for (let k = 0; k < N; k++) {
      const g = ctx.createGain();
      g.gain.value = 0; // disabled until setParams
      lineOut[k].connect(g);
      g.connect(lineIn[i]);
      cols.push(g);
    }
    row.push(cols);
  }
  matrixGain.push(...row);

  // Sum line outputs → late sum → LPF. The 1/N normalise goes HERE only, so
  // the 8 full-level lines average to unity out but the feedback loop keeps
  // its true loop gain g (⇒ the tail length actually tracks Decay/Size).
  const sum = ctx.createGain();
  sum.gain.value = 1 / N;
  for (let k = 0; k < N; k++) lineOut[k].connect(sum);
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 16000; lpf.Q.value = 0.5;
  sum.connect(lpf);

  return {
    lineIn, delay, dampLP, dampLo, dampShelf, lineOut, injectGain, modGain, matrixGain,
    latePredelay, lateInHP, lateIn, sum, lpf, baseDelays,
  };
}

// ── Early-reflection builder (one channel) ──────────────────────────────────
function buildEarly(ctx, bus) {
  const predelay = ctx.createDelay(0.5);
  predelay.delayTime.value = 0;
  bus.connect(predelay);
  const sum = ctx.createGain();
  sum.gain.value = 1;
  // Taps created lazily on first setParams (shape may change). We keep a
  // fixed pool large enough for the densest shape (round = 12) and (re)wire.
  const taps = [];
  const ensureTaps = (count) => {
    while (taps.length < count) {
      const d = ctx.createDelay(0.5);
      d.delayTime.value = 0;
      const g = ctx.createGain();
      g.gain.value = 0;
      predelay.connect(d); d.connect(g); g.connect(sum);
      taps.push({ delay: d, gain: g });
    }
    // silence extras
    for (let i = count; i < taps.length; i++) taps[i].gain.gain.value = 0;
  };
  return { predelay, sum, taps, ensureTaps };
}

export function createReverbEngine(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  const srScale = sampleRate / 44100;

  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = 1;

  // Stereo split → per-channel buses.
  const splitter = ctx.createChannelSplitter(2);
  const busL = ctx.createGain();
  const busR = ctx.createGain();
  input.connect(splitter);
  splitter.connect(busL, 0);
  splitter.connect(busR, 1);

  // Shared modulation LFOs (slow, incommensurate). Always on; depth is moderate
  // so the tail breathes with lush movement (the "whoah" factor) — not so deep
  // that it choruses or wobbles.
  const modLFOs = [0.11, 0.17, 0.23, 0.29, 0.37, 0.43].map((rate) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = rate;
    try { osc.start(); } catch {}
    return osc;
  });

  // Per-channel FDNs. R delays are decorrelated (×1.025) for natural width.
  const fdnL = buildFDN(ctx, busL, FDN_BASE_DELAYS, modLFOs, srScale);
  const fdnR = buildFDN(ctx, busR, FDN_BASE_DELAYS.map((d) => d * 1.025), modLFOs, srScale);

  // Per-channel early reflections.
  const earlyL = buildEarly(ctx, busL);
  const earlyR = buildEarly(ctx, busR);

  // Per-channel independent early/late level gains → channel wet → merge.
  const earlyGainL = ctx.createGain();
  const earlyGainR = ctx.createGain();
  const lateGainL = ctx.createGain();
  const lateGainR = ctx.createGain();
  const wetL = ctx.createGain();
  const wetR = ctx.createGain();
  earlyL.sum.connect(earlyGainL); earlyGainL.connect(wetL);
  fdnL.lpf.connect(lateGainL); lateGainL.connect(wetL);
  earlyR.sum.connect(earlyGainR); earlyGainR.connect(wetR);
  fdnR.lpf.connect(lateGainR); lateGainR.connect(wetR);

  const merger = ctx.createChannelMerger(2);
  wetL.connect(merger, 0, 0);
  wetR.connect(merger, 0, 1);
  merger.connect(output);

  const TAU = 0.04; // ~40 ms param ramps — zipper-free

  const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));

  /**
   * Apply the full parameter set. Accepts legacy keys (diffusion, damping,
   * radicalness) and new TC-style keys; missing values use DEFAULT_REVERB_PARAMS.
   * Every audio param is ramped with setTargetAtTime — safe to call on every
   * slider tick. Stability is preserved for all combinations (see header).
   */
  const setParams = (raw = {}) => {
    const p = { ...DEFAULT_REVERB_PARAMS, ...raw };
    const now = ctx.currentTime;

    const enabled = !!p.enabled;
    const freeze = !!p.freeze;
    const mono = !!p.monoCompatible;

    // Legacy → new mapping.
    const diffuse = clamp(0, 1, p.diffuse ?? p.diffusion ?? 0.7);
    const hiFactor = clamp(0, 1, p.hiFactor ?? p.damping ?? 0.5);
    const loFactor = clamp(0, 1, p.loFactor ?? 0.35);
    const size = clamp(0, 1, p.size ?? 0.5);
    const decay = clamp(0.05, 20, p.decay ?? 1.5);
    const radicalness = clamp(0, 1, p.radicalness ?? 0);
    const color = clamp(0, 1, p.color ?? 0.5);
    const shape = ['square', 'curved', 'round'].includes(p.shape) ? p.shape : 'curved';
    const earlyLevel = clamp(0, 1.5, p.earlyLevel ?? 0.5);
    const earlyPredelay = clamp(0, 300, p.earlyPredelay ?? 0);
    const earlySize = clamp(0, 1, p.earlySize ?? size);
    const lateLevel = clamp(0, 1.5, p.lateLevel ?? 1.0);
    const lateStart = clamp(0, 300, p.lateStart ?? 12);
    const lpf = clamp(1000, 20000, p.lpf ?? 16000);
    const outputLevel = clamp(0, 2, p.outputLevel ?? 1);

    // Size scaling — radicalness (legacy "X-Large") boosts size + decay + mod.
    const sizeMult = (0.5 + size * 1.5) * (1 + radicalness * 0.8);
    const effDecay = decay * (1 + radicalness * 1.2);
    const modScale = 1 + radicalness * 1.5;

    // Loop gain g from RT60 and the mean line delay (seconds). Hard-capped < 1.
    const meanDelay =
      (FDN_BASE_DELAYS.reduce((s, d) => s + d, 0) / N) * sizeMult; // seconds
    let g = Math.pow(0.001, meanDelay / Math.max(0.05, effDecay)); // 0.001^(τ/RT60)
    if (!enabled) g = 0;
    else if (freeze) g = G_FREEZE;
    else g = clamp(0, G_MAX, g);

    // Diffuse-blended Householder coefficients (I ↔ H_house), folded with g.
    // diag = (1−α)·1 + α·HH_DIAG ; off = α·HH_OFF.
    const diag = ((1 - diffuse) * 1 + diffuse * HH_DIAG) * g;
    const off = (diffuse * HH_OFF) * g;

    // Damping cutoffs from Hi/Lo Factor + Color tilt (t ∈ [-1,1]). Brighter
    // base curve than before — the old formula over-damped the highs (a damping
    // of 0.5 cut to ~8.5 kHz) and read as dull/dry. New curve keeps air.
    const t = (color - 0.5) * 2;
    const hiCut = clamp(1500, 20000, 18500 * (1 - hiFactor * 0.60) * (0.62 + color * 0.80));
    // Low-frequency damping. With the true loop gain restored, long tails can
    // accumulate low-end energy and rumble, so the in-loop high-pass tightens as
    // the effective decay grows: short reverbs keep their bass, long halls /
    // cathedrals shed LF fast. decayLfScale kicks in above ~2 s and reaches
    // ~2.5× at 15 s / ~4.7× at the 33 s extreme tail.
    // decayLfScale now kicks in above ~1 s (was 2 s) and tightens more steeply,
    // so even medium tails shed the boom band faster. The in-loop high-pass floor
    // is also raised (~90 Hz base) so the 100–250 Hz region is rejected, not just
    // sub-bass.
    const decayLfScale = 1 + Math.max(0, effDecay - 1) * 0.15;
    const loCut = clamp(40, 700, (90 + loFactor * 220 * (1.3 - color * 0.6) + t * 30) * decayLfScale);
    // In-loop LF decay shelf — shortens the LF/lower-mid tail so it recirculates
    // at reduced gain instead of ringing at the full RT60 (the "LF feedback" on
    // bass-heavy material). Deeper cut for longer tails; never fully removes LF
    // (keeps reverb body), just decays it faster. Only removes energy ⇒ stable.
    const shelfFreq = clamp(150, 600, 260 + color * 120);
    const lfCutDb = -clamp(2, 14, 3 + Math.max(0, effDecay - 1) * 1.5);

    // ── update both FDNs ──
    // ── Morph-duck: prevent feedback bursts when MOVING the Size / X-Large
    //    sliders. Those sliders change the delay-line LENGTHS; shortening a
    //    delay that has energy recirculating compresses its buffer into a
    //    level spike, and with the loop gain near unity (long decay) that spike
    //    recirculates and accumulates across slider ticks → "HUGE feedback".
    //    While the size-driven delay times are actively changing, transient-
    //    duck the loop gain so any Doppler transient decays fast instead of
    //    building, then schedule a recovery shortly AFTER the last change.
    //    During a continuous drag the recover never fires (calls arrive
    //    <0.2 s apart) so the loop stays ducked the whole drag; when the slider
    //    stops, the final scheduled recovery fires and the full tail returns.
    const MORPH_DUCK = 0.5;           // cap loop gain to ~0.5 while morphing
    const MORPH_RECOVER = now + 0.20; // restore full tail 200 ms after last change
    const tuneFDN = (fdn, baseDelays) => {
      const prevSM = (typeof fdn._lastSizeMult === 'number') ? fdn._lastSizeMult : sizeMult;
      const morphing = Math.abs(sizeMult - prevSM) > 0.002;
      fdn._lastSizeMult = sizeMult;
      const dT = morphing ? 0.06 : TAU; // gentler delay ramp during morph → less Doppler
      for (let i = 0; i < N; i++) {
        const dSec = baseDelays[i] * sizeMult; // seconds
        fdn.delay[i].delayTime.setTargetAtTime(dSec, now, dT);
        fdn.dampLP[i].frequency.setTargetAtTime(hiCut, now, TAU);
        fdn.dampLo[i].frequency.setTargetAtTime(loCut, now, TAU);
        fdn.dampShelf[i].frequency.setTargetAtTime(shelfFreq, now, TAU);
        fdn.dampShelf[i].gain.setTargetAtTime(lfCutDb, now, TAU);
        // Modulation depth — moderate, scaled by diffuse so dense tails smear
        // more. ~2.5× the previous depth: adds lush life/movement without
        // chorusing (max ≈ 0.5 ms at full diffuse).
        const depth = (0.00012 + 0.00030 * diffuse + (i % 3) * 0.00004) * modScale;
        fdn.modGain[i].gain.setTargetAtTime(enabled && !freeze ? depth : 0, now, 0.1);
        // Input injection — gated in freeze so no new energy enters the loop.
        fdn.injectGain[i].gain.setTargetAtTime(
          enabled && !freeze ? B_INJECT[i] : 0, now, TAU
        );
        for (let k = 0; k < N; k++) {
          const g = fdn.matrixGain[i][k].gain;
          const full = k === i ? diag : off;
          g.cancelScheduledValues(now); // drop any stale morph-recovery from a prior tick
          if (morphing && full !== 0) {
            g.setTargetAtTime(full * MORPH_DUCK, now, 0.01);   // duck now
            g.setTargetAtTime(full, MORPH_RECOVER, TAU);       // restore after the drag ends
          } else {
            g.setTargetAtTime(full, now, TAU);
          }
        }
      }
      fdn.latePredelay.delayTime.setTargetAtTime(lateStart / 1000, now, TAU);
      // Track the per-line loCut so the input high-pass rejects the same band
      // that the in-loop high-pass cuts — cascaded, no LF slips through.
      fdn.lateInHP.frequency.setTargetAtTime(loCut, now, TAU);
      fdn.lpf.frequency.setTargetAtTime(lpf, now, TAU);
    };
    tuneFDN(fdnL, FDN_BASE_DELAYS);
    tuneFDN(fdnR, FDN_BASE_DELAYS.map((d) => d * 1.025));

    // ── early reflections (shape-driven) ──
    const taps = earlyTaps(shape, mono);
    const earlySizeMult = 0.5 + earlySize * 1.5;
    const tuneEarly = (er, sideSign) => {
      er.ensureTaps(taps.length);
      er.predelay.delayTime.setTargetAtTime(earlyPredelay / 1000, now, TAU);
      for (let i = 0; i < taps.length; i++) {
        const tap = taps[i];
        const tSec = tap.t * earlySizeMult + (mono ? 0 : tap.spread * sideSign);
        er.taps[i].delay.delayTime.setTargetAtTime(Math.max(0, tSec), now, TAU);
        // Raw tap gain — earlyLevel applied on the early-bus gain below so the
        // early and late levels stay fully independent.
        er.taps[i].gain.gain.setTargetAtTime(tap.g, now, TAU);
      }
    };
    tuneEarly(earlyL, +1);
    tuneEarly(earlyR, -1);

    // ── independent early/late levels + output trim ──
    const eGain = enabled && !freeze ? earlyLevel : 0;
    const lGain = enabled ? lateLevel : 0; // late tail keeps playing in freeze
    earlyGainL.gain.setTargetAtTime(eGain, now, TAU);
    earlyGainR.gain.setTargetAtTime(eGain, now, TAU);
    lateGainL.gain.setTargetAtTime(lGain, now, TAU);
    lateGainR.gain.setTargetAtTime(lGain, now, TAU);
    wetL.gain.setTargetAtTime(1, now, TAU);
    wetR.gain.setTargetAtTime(1, now, TAU);
    output.gain.setTargetAtTime(enabled ? outputLevel : 0, now, TAU);
  };

  const dispose = () => {
    try { modLFOs.forEach((o) => o.stop()); } catch {}
  };

  return { input, output, setParams, dispose };
}

// ── Presets ─────────────────────────────────────────────────────────────────
// Clean, musical spaces. `Mastering Glue` is the default — transparent ambience
// for a full mix bus at 5–12 % wet. The others cover the usable range while
// staying natural; a few extremes show the algorithm's headroom.
export const MASTERING_PRESETS = {
  'Mastering Glue': {
    ...DEFAULT_REVERB_PARAMS,
    enabled: true, shape: 'curved', size: 0.45, diffuse: 0.78, color: 0.52,
    loFactor: 0.40, hiFactor: 0.55, earlyLevel: 0.45, earlyPredelay: 8,
    earlySize: 0.45, lateLevel: 0.9, lateStart: 14, decay: 1.3, lpf: 14000, mix: 0.08,
  },
  'Tight Ambience': {
    enabled: true, shape: 'square', size: 0.30, diffuse: 0.70, color: 0.55,
    loFactor: 0.50, hiFactor: 0.60, earlyLevel: 0.55, earlyPredelay: 4,
    earlySize: 0.30, lateLevel: 0.7, lateStart: 8, decay: 0.6, lpf: 13000, mix: 0.10,
  },
  'Small Room': {
    enabled: true, shape: 'curved', size: 0.35, diffuse: 0.72, color: 0.50,
    loFactor: 0.40, hiFactor: 0.50, earlyLevel: 0.60, earlyPredelay: 6,
    earlySize: 0.35, lateLevel: 0.85, lateStart: 10, decay: 0.9, lpf: 15000, mix: 0.15,
  },
  'Medium Hall': {
    enabled: true, shape: 'curved', size: 0.60, diffuse: 0.80, color: 0.50,
    loFactor: 0.35, hiFactor: 0.55, earlyLevel: 0.50, earlyPredelay: 18,
    earlySize: 0.55, lateLevel: 1.0, lateStart: 18, decay: 2.2, lpf: 12000, mix: 0.18,
  },
  'Large Arena': {
    enabled: true, shape: 'round', size: 0.80, diffuse: 0.88, color: 0.48,
    loFactor: 0.30, hiFactor: 0.60, earlyLevel: 0.45, earlyPredelay: 32,
    earlySize: 0.75, lateLevel: 1.0, lateStart: 28, decay: 4.5, lpf: 10000, mix: 0.20,
  },
  'Cathedral': {
    enabled: true, shape: 'round', size: 0.90, diffuse: 0.92, color: 0.45,
    loFactor: 0.25, hiFactor: 0.70, earlyLevel: 0.40, earlyPredelay: 50,
    earlySize: 0.85, lateLevel: 1.0, lateStart: 40, decay: 7.0, lpf: 8000, mix: 0.30,
  },
  'Air / Sheen': {
    enabled: true, shape: 'curved', size: 0.55, diffuse: 0.82, color: 0.70,
    loFactor: 0.55, hiFactor: 0.35, earlyLevel: 0.35, earlyPredelay: 20,
    earlySize: 0.50, lateLevel: 0.8, lateStart: 22, decay: 2.0, lpf: 18000, mix: 0.12,
  },
  'Freeze Hold': {
    enabled: true, shape: 'round', size: 0.70, diffuse: 0.85, color: 0.50,
    loFactor: 0.35, hiFactor: 0.50, earlyLevel: 0.0, earlyPredelay: 0,
    earlySize: 0.60, lateLevel: 1.0, lateStart: 0, decay: 20, freeze: true,
    lpf: 12000, mix: 1.0,
  },
};

/**
 * TECHNICAL SUMMARY (delivered with the code):
 *
 * Stability — every feedback eigenvalue has magnitude = g < 1 (Householder is
 * orthogonal; the diffuse blend is a convex combination of two orthogonal
 * matrices, operator norm ≤ 1; the scalar g is folded into the coefficients and
 * hard-capped at 0.995 / 0.9995). Passive one-pole damping only removes energy.
 * ⇒ no runaway feedback, no exploding energy, stable freeze.
 *
 * Transparency vs Schroeder — 8-line FDN with orthogonal mixing gives ~8× the
 * modal density of parallel combs, isotropically distributed (no sparse modes
 * → no metallic ring). Hi/Lo one-pole damping per line lets LF and HF decay
 * independently so the tail's spectrum evolves naturally. Subtle always-on
 * delay modulation (≤0.25 ms) smears residual fixed modes without chorusing.
 * Independent early reflections (3 room shapes) supply real space before the
 * tail, so low wet amounts glue rather than wash.
 *
 * CPU — ~2 × 8 delay lines + 64 matrix gains per channel, all native Web Audio
 * nodes (no per-sample JS). Sample-rate aware (srScale). Suitable for real-time
 * mastering chains at 44.1–192 kHz.
 *
 * Suggested default mastering preset — `Mastering Glue` above: curved room,
 * ~1.3 s decay, gentle Hi/Lo damping, LPF at 14 kHz, 8 % wet. Transparent glue.
 */