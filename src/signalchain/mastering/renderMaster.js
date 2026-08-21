import { SignalChain } from '@/signalchain/SignalChain.js';
import { integratedLufs } from './loudness.js';
import { applyRecipeToChain } from './applyRecipeToChain.js';
import { DEFAULT_ANALOGUE_DENSITY } from '@/signalchain/useSignalChainEngine';

// Compressor AudioWorklet URL — resolved as an asset URL via new URL (Vite's
// recommended Worker/Worklet pattern) instead of a `?url` default import, which
// broke because the worklet file has no ES exports.
const workletUrl = new URL('../compressorWorklet.js', import.meta.url).href;
// Limiter dither + noise-shaping worklet — loaded on the offline context so the
// rendered file carries the same final-stage bit-depth reduction as the live
// preview (and the export actually dithers when 16/24-bit is selected).
const ditherUrl = new URL('../limiterDitherWorklet.js', import.meta.url).href;
const limiterWorkletUrl = new URL('../limiterWorklet.js', import.meta.url).href;

/**
 * Apply the live engine's full module state onto a fresh SignalChain so an
 * offline render matches what the user hears live. Shared by the single-pass
 * master render and the per-section section-mastering render.
 */
function applyStateToChain(chain, state) {
  if (state?.fxOrder) chain.setFxOrder(state.fxOrder);
  if (state?.eq) chain.updateEQ(state.eq);
  if (state?.dynamics) chain.updateDynamics(state.dynamics);
  if (state?.effects) chain.updateEffects(state.effects, state?.bpm ?? 120);
  if (state?.saturation) chain.updateSaturation(state.saturation);
  if (state?.clip) chain.updateClip(state.clip);
  if (state?.tape) chain.updateTape(state.tape);
  if (state?.dynamicEq) chain.updateDynamicEQ(state.dynamicEq);
  if (state?.mbc) chain.updateMultiBandComp(state.mbc);
  if (state?.stereoImager) {
    // The engine stores the stereo window as two extents (spreadLo = left edge,
    // width = right edge, both on a -3…+3 rail). The DSP wants a per-band width
    // multiplier (0…3, 1 = original) — collapse the window the same way the live
    // engine does in handleStereoImagerChange, otherwise the offline render
    // drives the imager with the raw extents and diverges from the preview.
    const si = { ...state.stereoImager };
    const lo = si.spreadLo ?? -1;
    const hi = si.width ?? 1;
    const w = Math.max(0, Math.min(3, (hi - lo) / 2));
    si.width = w;
    si.spreadLo = w;
    chain.updateStereoImager(si);
  }
  // analogueDensity MUST be applied — at construction its dry path gain is 0,
  // so an un-updated analogueDensity outputs literal silence.
  if (state?.analogueDensity) chain.updateAnalogueDensity(state.analogueDensity);
  if (state?.mon8) chain.updateMon8(state.mon8);
  if (typeof state?.bypass === 'boolean') chain.setBypass(state.bypass);
}

/**
 * Apply one section's mastering recipe onto a chain, mirroring applyRecipe()
 * (the live engine version). applyRecipeToChain covers the mastering modules;
 * analogueDensity is handled here because applyRecipeToChain omits it.
 */
function applySectionRecipe(chain, recipe) {
  applyRecipeToChain(chain, recipe);
  if (recipe?.analogueDensity) {
    chain.updateAnalogueDensity({ ...DEFAULT_ANALOGUE_DENSITY, enabled: true, ...recipe.analogueDensity });
  } else {
    chain.updateAnalogueDensity({ ...DEFAULT_ANALOGUE_DENSITY, enabled: false });
  }
}

/**
 * Render the full source buffer through a single chain (optionally with a
 * recipe override applied after the base state). Returns a time-aligned
 * AudioBuffer the same length as the source.
 */
async function renderThroughChain(audioBuffer, state, recipeFn) {
  const nch = Math.max(2, audioBuffer.numberOfChannels);
  const offline = new OfflineAudioContext(nch, audioBuffer.length, audioBuffer.sampleRate);
  try {
    await offline.audioWorklet.addModule(workletUrl);
    offline.__characterCompressorReady = true;
  } catch (e) {
    console.warn('[renderThroughChain] compressor worklet failed to load on offline context — using stock fallback', e);
  }
  try {
    await offline.audioWorklet.addModule(ditherUrl);
    offline.__limiterDitherReady = true;
  } catch (e) {
    console.warn('[renderThroughChain] limiter-dither worklet failed to load on offline context — using passthrough fallback', e);
  }
  try {
    await offline.audioWorklet.addModule(limiterWorkletUrl);
    offline.__limiterWorkletReady = true;
  } catch (e) {
    console.warn('[renderThroughChain] limiter core worklet failed to load on offline context — using native fallback', e);
  }
  const chain = new SignalChain(offline);
  applyStateToChain(chain, state);
  if (recipeFn) recipeFn(chain);

  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(chain.input);
  chain.connect(offline.destination);
  src.start(0);

  const rendered = await offline.startRendering();
  // Clear the limiter's auto-release interval so the offline context's nodes
  // can be garbage-collected (the constructor starts a setInterval that is
  // never cleared otherwise — a leak across repeated renders).
  try { chain.dispose(); } catch {}
  return rendered;
}

/**
 * Render the live signal chain (with the current mastered parameters) through
 * the user's decoded audio buffer offline, so the downloaded file is the actual
 * mastered output — not a simulation.
 *
 * `state` mirrors the engine's full module states plus fxOrder/bypass/stereo
 * imager so the render matches exactly what the user hears live.
 */
export async function renderMastered({ audioBuffer, state }) {
  const rendered = await renderThroughChain(audioBuffer, state, null);
  console.log('[renderMastered] chain peak =', bufferPeakDb(rendered).toFixed(1), 'dB', {
    fxOrder: state?.fxOrder, bypass: state?.bypass,
    cmp: !!state?.dynamics?.compressor?.enabled, lim: !!state?.dynamics?.limiter?.enabled,
    sat: !!state?.saturation?.enabled, mbc: !!state?.mbc?.enabled, imager: !!state?.stereoImager?.enabled,
  });
  return rendered;
}

/**
 * Render with Section Mastering — each section of the file is processed
 * through its own assigned mastering preset, and adjacent sections are blended
 * across the glide zones with an equal-power crossfade (the same glide widths
 * the live preview uses). Each section renders the FULL source through its
 * chain (so filter transients ring naturally and there are no click artifacts
 * at the slice edges), then the relevant regions are spliced.
 *
 * Loudness: because every section can have a different limiter, the target
 * LUFS is hit with a single uniform post-trim (not by driving one limiter) —
 * the coherent choice for a multi-preset master.
 */
export async function renderSectionMastered({ audioBuffer, baseState, recipes, cues, glides, targetLufs, onProgress }) {
  const report = (index, total) => { try { onProgress?.({ index, total }); } catch {} };
  const nch = Math.max(2, audioBuffer.numberOfChannels);
  const len = audioBuffer.length;
  const sr = audioBuffer.sampleRate;
  const N = recipes.length;

  // Render the full source through each section's chain.
  const segs = [];
  for (let i = 0; i < N; i++) {
    report(i + 1, N);
    const recipe = recipes[i];
    segs.push(await renderThroughChain(audioBuffer, baseState, (chain) => applySectionRecipe(chain, recipe)));
  }

  // Section boundaries (samples) and per-boundary glide half-widths.
  const B = [0];
  for (const c of cues) B.push(Math.min(len, Math.max(0, Math.round(c * len))));
  B.push(len);
  const H = new Array(N + 1).fill(0);
  for (let k = 1; k < N; k++) {
    const leftSpan = B[k] - B[k - 1];
    const rightSpan = B[k + 1] - B[k];
    const maxZone = Math.min(leftSpan, rightSpan, Math.round(0.18 * len));
    const g = Math.max(0, Math.min(1, glides[k - 1] ?? 0));
    H[k] = Math.round(g * maxZone);
  }
  // Prevent adjacent glide zones from overlapping inside a section.
  for (let k = 1; k < N; k++) {
    const spanPrev = B[k] - B[k - 1];
    const room = spanPrev - H[k - 1];
    if (H[k] > room) H[k] = Math.max(0, room);
  }
  for (let k = N - 1; k >= 1; k--) {
    const spanCur = B[k + 1] - B[k];
    const room = spanCur - H[k + 1];
    if (H[k] > room) H[k] = Math.max(0, room);
  }

  // Stitch into one full-length buffer.
  const tmpCtx = new OfflineAudioContext(nch, Math.max(1, len), sr);
  const out = tmpCtx.createBuffer(nch, len, sr);
  const outCh = [];
  for (let c = 0; c < nch; c++) outCh.push(out.getChannelData(c));

  // Clean (non-crossfade) regions — each section owns its middle.
  for (let i = 0; i < N; i++) {
    const cs = B[i] + H[i];
    const ce = B[i + 1] - H[i + 1];
    if (ce <= cs) continue;
    for (let c = 0; c < nch; c++) {
      const seg = segs[i].getChannelData(c);
      const o = outCh[c];
      for (let s = cs; s < ce; s++) o[s] = seg[s];
    }
  }
  // Equal-power crossfades at interior glide zones.
  for (let k = 1; k < N; k++) {
    const h = H[k];
    if (h <= 0) continue;
    const a = B[k] - h, b = B[k] + h;
    const prev = segs[k - 1], cur = segs[k];
    for (let c = 0; c < nch; c++) {
      const sp = prev.getChannelData(c), sc = cur.getChannelData(c), o = outCh[c];
      for (let s = a; s < b; s++) {
        const t = (s - a) / (2 * h);
        const cf = Math.cos(t * Math.PI / 2);
        const sf = Math.sin(t * Math.PI / 2);
        o[s] = sp[s] * cf + sc[s] * sf;
      }
    }
  }

  // Loudness — uniform trim to target (each section has its own limiter, so a
  // single post-trim is the coherent way to hit a global LUFS target).
  const measured = integratedLufs(out);
  const gainDb = isFinite(measured) && measured > -70 ? targetLufs - measured : 0;
  const gain = Math.pow(10, gainDb / 20);
  const trimmed = tmpCtx.createBuffer(nch, len, sr);
  for (let c = 0; c < nch; c++) {
    const src = outCh[c];
    const dst = trimmed.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = (isFinite(src[i]) ? src[i] : 0) * gain;
  }
  return { buffer: trimmed, measuredLufs: isFinite(measured) ? measured : -70, appliedInputGainDb: gainDb, drove: false };
}

/**
 * Hit the target LUFS the professional way — by gain-staging the signal INTO
 * the limiter, not by trimming the master afterwards.
 *
 * The limiter is the final stage; its ceiling is the true-peak ceiling. We
 * measure the limiter output's LUFS, compute the delta to the target, and add
 * it to the limiter's `inputGain` (the drive feeding the brickwall), then
 * re-render. The limiter clamps peaks to its ceiling while the average level
 * (LUFS) tracks the drive — exactly how a real mastering limiter (Pro-L,
 * Oxford Limiter) is driven to a loudness target. No post-limiter trim: the
 * limiter stays the authority on both peak and loudness.
 *
 * Two iterations converge: the first render's gain reduction shifts LUFS a
 * little, so a second render with the corrected drive nails the target
 * (typically within ~0.2 dB). If the limiter is disabled there is no brickwall
 * to drive into, so we fall back to a uniform LUFS trim (rare — the mastering
 * recipe always enables the limiter).
 */
export async function renderToTargetLufs({ audioBuffer, state, targetLufs, iterations = 2, onProgress }) {
  const report = (index, total) => { try { onProgress?.({ index, total }); } catch {} };
  const lim = state?.dynamics?.limiter;
  if (!lim?.enabled) {
    report(1, 1);
    const rendered = await renderMastered({ audioBuffer, state });
    const measured = integratedLufs(rendered);
    const gainDb = isFinite(measured) && measured > -70 ? targetLufs - measured : 0;
    const gain = Math.pow(10, gainDb / 20);
    const nch = rendered.numberOfChannels;
    const trimmed = rendered.context.createBuffer(nch, rendered.length, rendered.sampleRate);
    for (let c = 0; c < nch; c++) {
      const src = rendered.getChannelData(c);
      const out = trimmed.getChannelData(c);
      for (let i = 0; i < src.length; i++) out[i] = (isFinite(src[i]) ? src[i] : 0) * gain;
    }
    return { buffer: trimmed, measuredLufs: isFinite(measured) ? measured : -70, appliedInputGainDb: gainDb, drove: false };
  }

  const total = 1 + iterations;
  report(1, total);
  let inputGainDb = lim.inputGain ?? 0;
  let rendered = await renderMastered({ audioBuffer, state });
  let measured = integratedLufs(rendered);
  for (let i = 0; i < iterations; i++) {
    if (!isFinite(measured) || measured <= -70) break;
    const delta = targetLufs - measured;
    if (Math.abs(delta) < 0.2) break;
    inputGainDb += delta;
    const s = { ...state, dynamics: { ...state.dynamics, limiter: { ...lim, inputGain: inputGainDb } } };
    report(i + 2, total);
    rendered = await renderMastered({ audioBuffer, state: s });
    measured = integratedLufs(rendered);
  }
  return { buffer: rendered, measuredLufs: measured, appliedInputGainDb: inputGainDb - (lim.inputGain ?? 0), drove: true };
}

/**
 * Render the source with NO processing — the dry fallback used when the chain
 * renders to silence, so the user always gets audible audio out.
 */
export async function renderDry({ audioBuffer }) {
  const nch = Math.max(2, audioBuffer.numberOfChannels);
  const offline = new OfflineAudioContext(nch, audioBuffer.length, audioBuffer.sampleRate);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  return await offline.startRendering();
}

/** Peak level of a rendered buffer in dBFS (−120 for true silence). */
export function bufferPeakDb(buffer) {
  let p = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; }
  }
  return p > 0 ? 20 * Math.log10(p) : -120;
}

/**
 * Normalize the rendered buffer to the target LUFS, then brickwall-limit so the
 * result never clips (true peak held to ≤ -1 dBFS). Returns the per-channel
 * Float32 arrays ready for WAV encoding plus measurement readouts.
 */
export function finalizeMaster(buffer, { measuredLufs, appliedGainDb } = {}) {
  // The target LUFS was already hit by driving the limiter input (see
  // renderToTargetLufs) — the limiter is the authority on both peak and
  // loudness. Here we only enforce a true-peak safety ceiling (≤ -1 dBFS) so
  // no overshoot or downstream intersample peak can clip the encoded file. No
  // loudness trim: that would undo the limiter's ceiling and is not mastering.
  const measured = (isFinite(measuredLufs) && measuredLufs > -70) ? measuredLufs : integratedLufs(buffer);
  const gainDb = isFinite(appliedGainDb) ? appliedGainDb : 0;
  console.log('[finalizeMaster] in peak', bufferPeakDb(buffer).toFixed(1), 'dB · measured', measured.toFixed(1), 'LUFS · drive', gainDb.toFixed(2), 'dB');
  const nch = buffer.numberOfChannels;
  const channels = [];
  let maxPeak = 0;

  for (let c = 0; c < nch; c++) {
    const src = buffer.getChannelData(c);
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      // Sanitize non-finite samples (Infinity/NaN) to silence.
      const s = isFinite(src[i]) ? src[i] : 0;
      out[i] = s;
      const a = Math.abs(s);
      if (a > maxPeak) maxPeak = a;
    }
    channels.push(out);
  }

  // Brickwall limit: if any peak exceeds -1 dBFS, scale the whole master down.
  const ceil = 0.891; // -1 dBFS
  if (maxPeak > ceil) {
    const s = ceil / maxPeak;
    for (let c = 0; c < nch; c++) {
      const d = channels[c];
      for (let i = 0; i < d.length; i++) d[i] *= s;
    }
    maxPeak = ceil;
  }
  // Hard safety clip (no distortion should reach here, but guarantee no overflow).
  for (let c = 0; c < nch; c++) {
    const d = channels[c];
    for (let i = 0; i < d.length; i++) {
      if (d[i] > 0.99) d[i] = 0.99;
      else if (d[i] < -0.99) d[i] = -0.99;
    }
  }

  return {
    channels,
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    measuredLufs: measured,
    appliedGainDb: gainDb,
    peakDb: 20 * Math.log10(Math.max(maxPeak, 1e-9)),
  };
}