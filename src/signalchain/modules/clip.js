import { makeInsert, fadeGain, dbToGain, createClipCurve, identityCurve } from './moduleUtils.js';

// Clip Distortion — asymmetric soft-clip + tone shaping. Per-instance factory.
export function buildClip(ctx) {
  const clip = makeInsert(ctx);
  const clipInputGain = ctx.createGain(); clipInputGain.gain.value = 1;
  const clipFilter = ctx.createBiquadFilter();
  clipFilter.type = 'lowpass'; clipFilter.frequency.value = 4400; clipFilter.Q.value = 0.707;
  const clipShaper = ctx.createWaveShaper();
  clipShaper.oversample = '4x';
  clipShaper.channelCount = 2;
  clipShaper.channelCountMode = 'explicit';
  clipShaper.channelInterpretation = 'speakers';
  clipShaper.curve = identityCurve();
  const clipTone = ctx.createBiquadFilter();
  clipTone.type = 'highpass'; clipTone.frequency.value = 170; clipTone.Q.value = 0.707;
  const clipHighShelf = ctx.createBiquadFilter();
  clipHighShelf.type = 'highshelf'; clipHighShelf.frequency.value = 980; clipHighShelf.gain.value = 0;
  const clipLP = ctx.createBiquadFilter();
  clipLP.type = 'lowpass'; clipLP.frequency.value = 6600; clipLP.Q.value = 0.707;
  const clipOutputGain = ctx.createGain(); clipOutputGain.gain.value = 1;
  clip.input.connect(clip.dry);
  clip.input.connect(clipInputGain);
  clipInputGain.connect(clipFilter);
  clipFilter.connect(clipShaper);
  clipShaper.connect(clipTone);
  clipTone.connect(clipHighShelf);
  clipHighShelf.connect(clipLP);
  clipLP.connect(clipOutputGain);
  clipOutputGain.connect(clip.wet);
  let _enabled = false;
  let _clipKey = null;
  return {
    input: clip.input,
    output: clip.output,
    update(state = {}) {
      const now = ctx.currentTime;
      const enabled = !!state.enabled;
      const ramp = _enabled !== enabled; _enabled = enabled;
      fadeGain(clip.wet, enabled ? (state.mix ?? 0) : 0, now, ramp);
      clip.dry.gain.setValueAtTime(1, now);
      clipInputGain.gain.setValueAtTime(dbToGain(state.inputGain ?? 0), now);
      clipFilter.type = state.clipFilterType === 'highpass' ? 'highpass' : 'lowpass';
      clipFilter.frequency.setValueAtTime(state.clipFilterFreq ?? 4400, now);
      clipTone.frequency.setValueAtTime(state.tone ?? 170, now);
      clipHighShelf.frequency.setValueAtTime(state.highShelfFreq ?? 980, now);
      clipHighShelf.gain.setValueAtTime(state.highShelfGain ?? 0, now);
      clipLP.frequency.setValueAtTime(state.lpFilterFreq ?? 6600, now);
      clipOutputGain.gain.setValueAtTime(dbToGain(state.outputGain ?? 0), now);
      // Rebuild the shaper curve only when drive/symmetry change (cached).
      const key = `${enabled ? 'on' : 'off'}:${(state.drive ?? 0).toFixed(2)}:${(state.symmetry ?? 0).toFixed(1)}`;
      if (_clipKey !== key) {
        _clipKey = key;
        clipShaper.curve = enabled ? createClipCurve(state.drive ?? 0, state.symmetry ?? 0) : identityCurve();
      }
    },
  };
}