import { makeInsert, fadeGain, dbToGain, identityCurve, createLimCeilingCurve } from './moduleUtils.js';

// Brickwall Limiter — linked OR dual-mono topology, an oversampled soft-clip
// ceiling for inter-sample-peak control, lookahead pre-delay and a parallel
// dry/wet blend. Topology switches use gain toggles (no graph rebuild →
// click-free). Exposes limiterNode / limLookahead + getReduction() for engine
// compat (nodes memo + prepareMorphChain).
export function buildLimiter(ctx) {
  const ins = makeInsert(ctx);
  const limSet = (n) => { n.threshold.value = -0.1; n.knee.value = 0; n.ratio.value = 20; n.attack.value = 0; n.release.value = 0.05; };
  const limiterNode = ctx.createDynamicsCompressor();  limSet(limiterNode);  // linked (stereo)
  const limiterNodeL = ctx.createDynamicsCompressor(); limSet(limiterNodeL); // unlink L
  const limiterNodeR = ctx.createDynamicsCompressor(); limSet(limiterNodeR); // unlink R
  const limSplitter = ctx.createChannelSplitter(2);
  const limMerger = ctx.createChannelMerger(2);
  const limLinkGain = ctx.createGain();   limLinkGain.gain.value = 1;   // linked path level
  const limUnlinkGain = ctx.createGain(); limUnlinkGain.gain.value = 0; // dual-mono path level
  const limInputGain = ctx.createGain();   limInputGain.gain.value = 1;   // input drive into the core
  const limOutputGain = ctx.createGain();  limOutputGain.gain.value = 1;  // output trim after the limiter
  let limLinked = true;
  // Oversampled soft-clip ceiling — catches inter-sample peaks above the ceiling.
  const limClip = ctx.createWaveShaper();
  limClip.oversample = 'none';
  limClip.channelCount = 2;
  limClip.channelCountMode = 'explicit';
  limClip.channelInterpretation = 'speakers';
  limClip.curve = identityCurve();
  const limLookahead = ctx.createDelay(0.05);
  limLookahead.delayTime.value = 0;
  // DC blocker — 1st-order high-pass at ~10 Hz before the drive stage, so no
  // subsonic offset eats into the limiter's headroom. Toggleable via the
  // `dcBlocker` param (default on).
  const limDC = ctx.createBiquadFilter();
  limDC.type = 'highpass';
  limDC.frequency.value = 10;
  limDC.Q.value = 0.707;
  ins.input.connect(limDC);
  limDC.connect(limInputGain);
  // Worklet limiter core (true-peak / program-dependent release / M/S). Falls
  // back to the native DynamicsCompressor+WaveShaper core below if the worklet
  // module didn't load on this context.
  const useWorklet = !!ctx.__limiterWorkletReady;
  const limWorklet = useWorklet ? new AudioWorkletNode(ctx, 'limiter-processor') : null;
  let _workletGR = 0;
  if (limWorklet) {
    limWorklet.channelCount = 2;
    limWorklet.channelCountMode = 'explicit';
    limWorklet.channelInterpretation = 'speakers';
    limWorklet.port.onmessage = (e) => { if (e?.data && typeof e.data.gr === 'number') _workletGR = e.data.gr; };
  }
  // Wet gain is shared by both paths so the external mix blend (wet/dry) is
  // identical whether the core is the worklet or the native fallback.
  const limWetGain = ctx.createGain(); limWetGain.gain.value = 1;
  if (useWorklet) {
    limInputGain.connect(limWorklet);
    limWorklet.connect(limWetGain);
  } else {
    limInputGain.connect(limiterNode);
    limInputGain.connect(limSplitter);
    limSplitter.connect(limiterNodeL, 0);
    limSplitter.connect(limiterNodeR, 1);
    limiterNode.connect(limLinkGain);
    limiterNodeL.connect(limMerger, 0, 0);
    limiterNodeR.connect(limMerger, 0, 1);
    limMerger.connect(limUnlinkGain);
    limLinkGain.connect(limClip);
    limUnlinkGain.connect(limClip);
    limClip.connect(limLookahead);
    limLookahead.connect(limWetGain);
  }
  limWetGain.connect(limOutputGain);
  // Dry (parallel-limiting) path follows the input gain so the wet/dry blend
  // stays gain-matched when driving into the limiter.
  try { ins.input.disconnect(ins.dry); } catch {}
  limInputGain.connect(ins.dry);
  try { ins.dry.disconnect(ins.output); } catch {}
  ins.dry.connect(limOutputGain);
  // Dither + noise shaping — the ABSOLUTE last stage, after the output trim, so
  // it only colours the signal when reducing bit depth (16/24-bit delivery).
  // AudioWorklet if loaded, else a transparent Gain passthrough fallback.
  const limDither = ctx.__limiterDitherReady
    ? new AudioWorkletNode(ctx, 'limiter-dither-processor')
    : ctx.createGain();
  if (limDither.port) {
    limDither.channelCount = 2;
    limDither.channelCountMode = 'explicit';
    limDither.channelInterpretation = 'speakers';
  }
  limOutputGain.connect(limDither);
  limDither.connect(ins.output);
  ins.dry.gain.value = 0; // full-wet by default; mix control raises dry for parallel limiting
  let _enabled = false, _limAuto = false, _limLinked = true;
  // Native-fallback program-dependent auto-release. The worklet core runs its
  // own per-sample program-dependent release; this polling limiter is only for
  // the native DynamicsCompressor fallback path (useWorklet = false).
  let _grPrev = 0, _grVel = 0;
  const _limInterval = useWorklet ? null : setInterval(() => {
    if (!_limAuto || !ctx) return;
    const gr = Math.abs(limiterNode.reduction || 0);
    const dv = gr - _grPrev; _grPrev = gr;
    _grVel = _grVel * 0.7 + Math.abs(dv) * 0.3; // smoothed transient activity
    let r;
    if (_grVel > 0.8)      r = 0.02; // transient burst → fast
    else if (gr > 6)      r = 0.06; // heavy sustained GR → medium-slow
    else if (gr > 2)      r = 0.12; // moderate → medium
    else                  r = 0.25; // light → slow
    const now = ctx.currentTime;
    [limiterNode, limiterNodeL, limiterNodeR].forEach((n) => { try { n.release.setTargetAtTime(r, now, 0.05); } catch {} });
  }, 120);
  return {
    input: ins.input,
    inputPost: limInputGain, // post-drive tap for the IN meter (reflects the IN slider)
    output: ins.output,
    limiterNode, limLookahead, // compat: engine nodes memo + prepareMorphChain
    getReduction() {
      if (useWorklet) return _workletGR;
      if (limLinked) return Math.abs(limiterNode?.reduction || 0);
      return Math.max(Math.abs(limiterNodeL?.reduction || 0), Math.abs(limiterNodeR?.reduction || 0));
    },
    update(lim = {}) {
      const now = ctx.currentTime;
      const enabled = !!lim.enabled;
      const lChanged = _enabled !== enabled; _enabled = enabled;
      // Pro-limiter gain staging: input drive into the core, output trim after.
      limInputGain.gain.setValueAtTime(dbToGain(lim.inputGain ?? 0), now);
      limOutputGain.gain.setValueAtTime(dbToGain(lim.outputGain ?? 0), now);
      const ceiling = lim.ceiling ?? lim.threshold ?? -0.1;
      if (useWorklet) {
        // Worklet core — post the full state; it does its own true-peak /
        // program-dependent release / M/S DSP per sample.
        try {
          limWorklet.port.postMessage({
            enabled,
            ceiling,
            lookahead: lim.lookahead ?? 0,
            release: lim.release ?? 0.1,
            releaseMode: lim.releaseMode ?? 'auto',
            releaseShape: lim.releaseShape ?? 'exp',
            attack: lim.attack ?? 0,
            style: lim.style ?? 'transparent',
            stereoLink: lim.stereoLink ?? 100,
            msMode: !!lim.msMode,
            truePeak: !!lim.truePeak,
            oversampling: lim.oversampling ?? 1,
          });
        } catch {}
      } else {
        // Native fallback core.
        const STYLE = {
          // Web Audio clamps DynamicsCompressor.ratio to [1, 20]; 20:1 is the
          // hardest brickwall the API allows. The oversampled soft-clip ceiling
          // enforces the true brickwall above this.
          transparent: { ratio: 20, knee: 0, attack: 0, release: 0.05 },
          punchy: { ratio: 20, knee: 0, attack: 0.002, release: 0.09 },
          modern: { ratio: 20, knee: 1, attack: 0, release: 0.03 },
          warm: { ratio: 20, knee: 5, attack: 0.001, release: 0.16 },
          classical: { ratio: 20, knee: 0, attack: 0, release: 0.4 },
        };
        const st = STYLE[lim.style] || STYLE.transparent;
        const tpOffset = lim.truePeak ? 0.3 : 0; // extra headroom for inter-sample peaks
        const effCeiling = enabled ? ceiling - tpOffset : 0;
        _limAuto = enabled && lim.releaseMode === 'auto';
        const rel = _limAuto ? st.release : (lim.release ?? st.release);
        const atk = lim.attack ?? st.attack;
        [limiterNode, limiterNodeL, limiterNodeR].forEach((n) => {
          n.threshold.setValueAtTime(effCeiling, now);
          n.ratio.setValueAtTime(st.ratio, now);
          n.knee.setValueAtTime(st.knee, now);
          n.attack.setValueAtTime(atk, now);
          n.release.setValueAtTime(rel, now);
        });
        // Stereo link: ≥50 = linked (one stereo compressor), <50 = dual-mono.
        const linked = (lim.stereoLink ?? 100) >= 50;
        const linkChanged = _limLinked !== linked; _limLinked = linked;
        limLinked = linked;
        fadeGain(limLinkGain, enabled && linked ? 1 : 0, now, lChanged || linkChanged);
        fadeGain(limUnlinkGain, enabled && !linked ? 1 : 0, now, lChanged || linkChanged);
        // Oversampled soft-clip ceiling for ISP control.
        const os = lim.oversampling ?? 1;
        limClip.oversample = os >= 4 ? '4x' : os >= 2 ? '2x' : 'none';
        limClip.curve = os >= 2 ? createLimCeilingCurve(effCeiling) : identityCurve();
        // Lookahead pre-delay.
        limLookahead.delayTime.setValueAtTime(Math.max(0, (lim.lookahead ?? 0) / 1000), now);
      }
      // Parallel limiting blend (mix). Disabled = pure dry bypass.
      const mix = enabled ? Math.max(0, Math.min(1, (lim.mix ?? 100) / 100)) : 0;
      fadeGain(limWetGain, mix, now, lChanged);
      fadeGain(ins.dry, enabled ? 1 - mix : 1, now, lChanged);
      // DC blocker toggle (default on). "Off" pushes the corner well below
      // audio so the filter is effectively flat across the band.
      limDC.frequency.setTargetAtTime(lim.dcBlocker === false ? 0.0001 : 10, now, 0.02);
      // Dither + noise shaping (final stage). Legacy 'tpdf' toggle → 16-bit.
      let bd = lim.dither;
      if (bd === 'tpdf') bd = '16';
      const bitDepth = bd === '16' ? 16 : bd === '24' ? 24 : 0;
      if (limDither.port) {
        try { limDither.port.postMessage({ bitDepth, noiseShape: lim.noiseShape || 'none' }); } catch {}
      }
    },
    dispose() { if (_limInterval) clearInterval(_limInterval); },
  };
}