import { makeInsert, fadeGain } from './moduleUtils.js';
import { createReverbEngine, DEFAULT_REVERB_PARAMS } from '../reverbEngine.js';

// Reverb — mastering-grade FDN engine (8-line Householder feedback network +
// dedicated early reflections) + external pre-delay + wet EQ. The engine owns
// the tail (FDN, damping, diffusion, early/late, shape, color, lo/hi factor,
// freeze). Pre-delay → engine → low-cut → high-shelf shape the wet before mix.
// The full reverbState is forwarded to the engine so legacy keys
// (decay/size/diffusion/damping/radicalness) map automatically and any new
// TC-style keys (shape, color, loFactor, hiFactor, early/late …, freeze) pass
// straight through when the panel exposes them.
export function buildReverb(ctx) {
  const rev = makeInsert(ctx);
  const reverb = createReverbEngine(ctx);
  reverb.setParams({ ...DEFAULT_REVERB_PARAMS, enabled: false });
  const reverbPreDelay = ctx.createDelay(1.0);
  reverbPreDelay.delayTime.value = 0;
  const reverbLowCut = ctx.createBiquadFilter();
  reverbLowCut.type = 'highpass';
  reverbLowCut.frequency.value = 20;
  const reverbHighShelf = ctx.createBiquadFilter();
  reverbHighShelf.type = 'highshelf';
  reverbHighShelf.frequency.value = 8000;
  reverbHighShelf.gain.value = 0;
  rev.input.connect(rev.dry);
  rev.input.connect(reverbPreDelay);
  reverbPreDelay.connect(reverb.input);
  reverb.output.connect(reverbLowCut);
  reverbLowCut.connect(reverbHighShelf);
  reverbHighShelf.connect(rev.wet);
  let _enabled = false;
  return {
    input: rev.input,
    output: rev.output,
    update(reverbState) {
      const now = ctx.currentTime;
      if (!reverbState) return;
      const r = reverbState;
      const rOn = !!r.enabled;
      const ramp = _enabled !== rOn; _enabled = rOn;
      const mix = rOn ? (r.mix ?? 0.2) : 0;
      fadeGain(rev.wet, mix, now, ramp);
      rev.dry.gain.setValueAtTime(1, now);
      // Forward the full state — the engine maps legacy keys (diffusion→diffuse,
      // damping→hiFactor, radicalness→size/decay/mod boost) and accepts new
      // TC-style keys when present. setTargetAtTime everywhere ⇒ zipper-free.
      reverb.setParams({ ...r, enabled: rOn });
      reverbPreDelay.delayTime.setTargetAtTime((r.predelay ?? 0) / 1000, now, 0.04);
      reverbLowCut.frequency.setTargetAtTime(r.lowCut ?? 20, now, 0.04);
      reverbHighShelf.frequency.setTargetAtTime(r.highShelfFreq ?? 8000, now, 0.04);
      reverbHighShelf.gain.setTargetAtTime(r.highShelfGain ?? 0, now, 0.04);
    },
    dispose() { try { reverb?.dispose?.(); } catch {} },
  };
}