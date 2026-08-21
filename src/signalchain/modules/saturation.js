import { makeInsert, fadeGain, createSatCurve } from './moduleUtils.js';

// Saturation — harmonic distortion (tube / tape / transistor / clean).
// Per-instance factory: a self-contained node-set + update(state).
//
// Grit: looping white noise injected straight into the shaper input so the
// static waveshaper curve gets per-sample variation — a convincing, gritty
// texture rather than a sterile perfect transfer.
export function buildSaturation(ctx) {
  const sat = makeInsert(ctx);
  const satDrive = ctx.createGain(); satDrive.gain.value = 1;
  const satShaper = ctx.createWaveShaper();
  satShaper.curve = createSatCurve('tube', 0);
  satShaper.oversample = '4x';
  satShaper.channelCount = 2;
  satShaper.channelCountMode = 'explicit';
  satShaper.channelInterpretation = 'speakers';
  const satTone = ctx.createBiquadFilter();
  satTone.type = 'lowpass';
  satTone.frequency.value = 12000;
  satTone.Q.value = 0.5;
  const satMakeup = ctx.createGain(); satMakeup.gain.value = 1;
  sat.input.connect(sat.dry);
  sat.input.connect(satDrive);
  satDrive.connect(satShaper);
  const noiseBuf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * 2), ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const satNoise = ctx.createBufferSource();
  satNoise.buffer = noiseBuf;
  satNoise.loop = true;
  const satNoiseGain = ctx.createGain(); satNoiseGain.gain.value = 0;
  satNoise.connect(satNoiseGain);
  satNoiseGain.connect(satShaper);
  satNoise.start();
  satShaper.connect(satTone);
  satTone.connect(satMakeup);
  satMakeup.connect(sat.wet);
  let _enabled = false;
  return {
    input: sat.input,
    output: sat.output,
    update({ enabled = false, mode = 'tube', drive = 0.4, grit = 0, mix = 0.5, tone = 12000, output = 1 } = {}) {
      const now = ctx.currentTime;
      const ramp = _enabled !== enabled; _enabled = enabled;
      fadeGain(sat.wet, enabled ? mix : 0, now, ramp);
      sat.dry.gain.setValueAtTime(1, now);
      // Pre-gain into the shaper. The curve already embeds its own drive (k in
      // satTransfer), so this is a subtle input push only.
      satDrive.gain.setValueAtTime(1 + drive * 0.5, now);
      satTone.frequency.setValueAtTime(tone, now);
      satMakeup.gain.setValueAtTime(output, now);
      // Grit — log (audio) taper: spans ~-80 dB (silent) → -40 dB (full, 0.01).
      const g = Math.max(0, Math.min(1, grit || 0));
      const noiseGain = g <= 0 ? 0 : 0.01 * Math.pow(10, (g - 1) * 2);
      fadeGain(satNoiseGain, enabled ? noiseGain : 0, now, ramp);
      satShaper.curve = createSatCurve(mode, enabled ? drive : 0);
    },
  };
}