import { makeInsert, fadeGain, dbToGain, createTapeCurve, identityCurve } from './moduleUtils.js';

// Tape Machine — analog tape simulation. Per-instance factory.
export function buildTape(ctx) {
  const tape = makeInsert(ctx);
  const tapeInputGain = ctx.createGain(); tapeInputGain.gain.value = 1;
  const tapeDelay = ctx.createDelay(0.05); tapeDelay.delayTime.value = 0.003;
  const tapeHysteresis = ctx.createBiquadFilter();
  tapeHysteresis.type = 'allpass'; tapeHysteresis.frequency.value = 1500; tapeHysteresis.Q.value = 0.7;
  const tapePreGain = ctx.createGain(); tapePreGain.gain.value = 1;
  const tapeShaper = ctx.createWaveShaper();
  tapeShaper.oversample = '4x';
  tapeShaper.channelCount = 2;
  tapeShaper.channelCountMode = 'explicit';
  tapeShaper.channelInterpretation = 'speakers';
  tapeShaper.curve = identityCurve();
  const tapeHeadLoss = ctx.createBiquadFilter();
  tapeHeadLoss.type = 'lowpass'; tapeHeadLoss.frequency.value = 12000; tapeHeadLoss.Q.value = 0.7;
  const tapeHeadBump = ctx.createBiquadFilter();
  tapeHeadBump.type = 'lowshelf'; tapeHeadBump.frequency.value = 90; tapeHeadBump.gain.value = 0;
  const tapeOutputGain = ctx.createGain(); tapeOutputGain.gain.value = 1;
  // Tape hiss — pink-ish noise via a summed white buffer.
  const tNoiseBuf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * 2), ctx.sampleRate);
  const tnd = tNoiseBuf.getChannelData(0);
  let tLast = 0;
  for (let i = 0; i < tnd.length; i++) { const w = Math.random() * 2 - 1; tLast = (tLast + 0.02 * w) / 1.02; tnd[i] = tLast * 3.5; }
  const tapeNoise = ctx.createBufferSource(); tapeNoise.buffer = tNoiseBuf; tapeNoise.loop = true;
  const tapeNoiseFilter = ctx.createBiquadFilter();
  tapeNoiseFilter.type = 'bandpass'; tapeNoiseFilter.frequency.value = 4000; tapeNoiseFilter.Q.value = 0.4;
  const tapeNoiseGain = ctx.createGain(); tapeNoiseGain.gain.value = 0;
  tapeNoise.connect(tapeNoiseFilter);
  tapeNoiseFilter.connect(tapeNoiseGain);
  tapeNoiseGain.connect(tape.wet);
  tapeNoise.start();
  // Wow & flutter — two LFOs modulating the delay time (Doppler pitch wobble).
  const tapeWowOsc = ctx.createOscillator(); tapeWowOsc.type = 'sine'; tapeWowOsc.frequency.value = 0.7;
  const tapeWowGain = ctx.createGain(); tapeWowGain.gain.value = 0;
  const tapeFlutterOsc = ctx.createOscillator(); tapeFlutterOsc.type = 'sine'; tapeFlutterOsc.frequency.value = 6;
  const tapeFlutterGain = ctx.createGain(); tapeFlutterGain.gain.value = 0;
  tapeWowOsc.connect(tapeWowGain); tapeWowGain.connect(tapeDelay.delayTime);
  tapeFlutterOsc.connect(tapeFlutterGain); tapeFlutterGain.connect(tapeDelay.delayTime);
  tapeWowOsc.start(); tapeFlutterOsc.start();
  // Signal path.
  tape.input.connect(tape.dry);
  tape.input.connect(tapeInputGain);
  tapeInputGain.connect(tapeDelay);
  tapeDelay.connect(tapeHysteresis);
  tapeHysteresis.connect(tapePreGain);
  tapePreGain.connect(tapeShaper);
  tapeShaper.connect(tapeHeadLoss);
  tapeHeadLoss.connect(tapeHeadBump);
  tapeHeadBump.connect(tapeOutputGain);
  tapeOutputGain.connect(tape.wet);
  let _enabled = false;
  let _tapeKey = null;
  return {
    input: tape.input,
    output: tape.output,
    update(state = {}) {
      const now = ctx.currentTime;
      const enabled = !!state.enabled;
      const ramp = _enabled !== enabled; _enabled = enabled;
      fadeGain(tape.wet, enabled ? (state.mix ?? 0.5) : 0, now, ramp);
      tape.dry.gain.setValueAtTime(1, now);
      tapeInputGain.gain.setValueAtTime(dbToGain(state.inputGain ?? 0), now);
      const drive = state.drive ?? 0.4;
      const bias = state.bias ?? 0.55;
      const saturation = state.saturation ?? 0.5;
      const hysteresis = state.hysteresis ?? 0.25;
      tapeHysteresis.frequency.setValueAtTime(400 + hysteresis * 4000, now);
      tapeHysteresis.Q.setValueAtTime(0.5 + hysteresis * 3, now);
      // Tape speed sets the HF bandwidth ceiling; hfLoss pulls it down.
      const speed = state.speed ?? 15;
      const baseHf = speed >= 30 ? 18000 : speed >= 15 ? 12000 : 8000;
      const hfLoss = state.hfLoss ?? 0.3;
      tapeHeadLoss.frequency.setValueAtTime(Math.max(2000, baseHf - hfLoss * (baseHf - 2500)), now);
      tapeHeadBump.gain.setValueAtTime((state.headBump ?? 0.2) * 10, now);
      tapeOutputGain.gain.setValueAtTime(dbToGain(state.outputGain ?? 0), now);
      fadeGain(tapeNoiseGain, enabled ? (state.noise ?? 0.1) * 0.04 : 0, now, ramp);
      // Wow & flutter depth (seconds of delay modulation) — slower tape = slower wobble.
      tapeWowGain.gain.setValueAtTime((state.wow ?? 0.15) * 0.0025, now);
      tapeFlutterGain.gain.setValueAtTime((state.flutter ?? 0.08) * 0.0006, now);
      tapeWowOsc.frequency.setValueAtTime(speed >= 30 ? 0.9 : speed >= 15 ? 0.7 : 0.5, now);
      tapeFlutterOsc.frequency.setValueAtTime(speed >= 30 ? 8 : speed >= 15 ? 6 : 4.5, now);
      // Rebuild the saturation curve only when drive/bias/saturation change (cached).
      const tkey = `${enabled ? 'on' : 'off'}:${drive.toFixed(2)}:${bias.toFixed(2)}:${saturation.toFixed(2)}`;
      if (_tapeKey !== tkey) {
        _tapeKey = tkey;
        tapeShaper.curve = enabled ? createTapeCurve(drive, bias, saturation) : identityCurve();
      }
    },
  };
}