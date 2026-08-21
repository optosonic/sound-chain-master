import { makeInsert, fadeGain, dbToGain } from './moduleUtils.js';
import {
  buildCurve,
  pentodeTransfer,
  triodeTransfer,
  parallelTubeTransfer,
  transformerTransfer,
  densityMapping,
  DRIVE_COEFF,
} from '../analogueDensityModel.js';

// Analogue Density — HG-2-style tube density engine.
//
// Signal flow:
//   input → inputGain → inputTransformer → inputLowShelf
//      ├─ parallel sat path (freq-selective 12AX7, normal/alt) ─┐
//      └─ main → sum → pentode → triode → air shelf → calib → outTransformer → outAtten → wet
//   dry (post inputGain) → dry gain
//   output = dry + wet
//
// All waveshapers oversample 4× to suppress aliasing on strong saturation.
export function buildAnalogueDensity(ctx) {
  const ins = makeInsert(ctx); // gives input, output, dry, wet — we rewire below

  // Reuse ins.input / ins.output; control dry/wet manually for true wet/dry mix.
  const inputGain = ctx.createGain(); inputGain.gain.value = 1;
  ins.input.disconnect();
  ins.input.connect(inputGain);

  // Dry path (clean, post input-gain).
  const dry = ctx.createGain(); dry.gain.value = 0; // bypass default
  inputGain.connect(dry);
  dry.connect(ins.output);

  // ── Mid/Side encode + per-channel drive scaling ──
  // In MS mode the signal is encoded to M/S, Mid & Side are driven independently
  // (midDensity / sideDensity), then decoded back to L/R. Routing is gain-gated
  // (no graph rewire on toggle): the stereo path carries L/R straight through;
  // the MS path runs encode → drive → decode.
  const encSplitter = ctx.createChannelSplitter(2);
  const midEncL = ctx.createGain(); midEncL.gain.value = 0.5;
  const midEncR = ctx.createGain(); midEncR.gain.value = 0.5;
  const sideEncL = ctx.createGain(); sideEncL.gain.value = 0.5;
  const sideEncR = ctx.createGain(); sideEncR.gain.value = -0.5;
  const encMerger = ctx.createChannelMerger(2);
  inputGain.connect(encSplitter);
  encSplitter.connect(midEncL, 0); midEncL.connect(encMerger, 0, 0);
  encSplitter.connect(midEncR, 1); midEncR.connect(encMerger, 0, 0);
  encSplitter.connect(sideEncL, 0); sideEncL.connect(encMerger, 0, 1);
  encSplitter.connect(sideEncR, 1); sideEncR.connect(encMerger, 0, 1);
  const driveSplitter = ctx.createChannelSplitter(2);
  const midDriveGain = ctx.createGain(); midDriveGain.gain.value = 1;
  const sideDriveGain = ctx.createGain(); sideDriveGain.gain.value = 1;
  const driveMerger = ctx.createChannelMerger(2);
  encMerger.connect(driveSplitter);
  driveSplitter.connect(midDriveGain, 0); midDriveGain.connect(driveMerger, 0, 0);
  driveSplitter.connect(sideDriveGain, 1); sideDriveGain.connect(driveMerger, 0, 1);
  const msInGain = ctx.createGain(); msInGain.gain.value = 0;          // 0 stereo, 1 MS
  driveMerger.connect(msInGain);
  const stereoInGain = ctx.createGain(); stereoInGain.gain.value = 1;  // 1 stereo, 0 MS
  inputGain.connect(stereoInGain);

  // ── Input transformer colouration ──
  const inTransformer = ctx.createWaveShaper();
  inTransformer.curve = buildCurve((x) => transformerTransfer(x));
  inTransformer.oversample = '4x';
  inTransformer.channelCount = 2;
  inTransformer.channelCountMode = 'explicit';
  inTransformer.channelInterpretation = 'speakers';
  const inLowShelf = ctx.createBiquadFilter();
  inLowShelf.type = 'lowshelf';
  inLowShelf.frequency.value = 140;
  inLowShelf.gain.value = 1.4; // subtle transformer low-end weight

  stereoInGain.connect(inTransformer);
  msInGain.connect(inTransformer);
  inTransformer.connect(inLowShelf);

  // ── Parallel saturation path (12AX7, freq-selective) ──
  const parFilter = ctx.createBiquadFilter();
  parFilter.type = 'allpass'; parFilter.frequency.value = 1000; // flat default
  const parDrive = ctx.createGain(); parDrive.gain.value = 1;
  const parShaper = ctx.createWaveShaper();
  parShaper.curve = buildCurve((x) => parallelTubeTransfer(0, false, x));
  parShaper.oversample = '4x';
  parShaper.channelCount = 2; parShaper.channelCountMode = 'explicit'; parShaper.channelInterpretation = 'speakers';
  const parMakeup = ctx.createGain(); parMakeup.gain.value = 1;
  const parWet = ctx.createGain(); parWet.gain.value = 0; // saturation in/out + amount
  inLowShelf.connect(parFilter);
  parFilter.connect(parDrive);
  parDrive.connect(parShaper);
  parShaper.connect(parMakeup);
  parMakeup.connect(parWet);

  // ── Sum (main + parallel) → pentode → triode ──
  const sum = ctx.createGain(); sum.gain.value = 1;
  inLowShelf.connect(sum);
  parWet.connect(sum);

  const pentodeDrive = ctx.createGain(); pentodeDrive.gain.value = 1;
  const pentodeShaper = ctx.createWaveShaper();
  pentodeShaper.curve = buildCurve((x) => pentodeTransfer(0, x));
  pentodeShaper.oversample = '4x';
  pentodeShaper.channelCount = 2; pentodeShaper.channelCountMode = 'explicit'; pentodeShaper.channelInterpretation = 'speakers';

  const triodeDrive = ctx.createGain(); triodeDrive.gain.value = 1;
  const triodeShaper = ctx.createWaveShaper();
  triodeShaper.curve = buildCurve((x) => triodeTransfer(0, x));
  triodeShaper.oversample = '4x';
  triodeShaper.channelCount = 2; triodeShaper.channelCountMode = 'explicit'; triodeShaper.channelInterpretation = 'speakers';

  sum.connect(pentodeDrive);
  pentodeDrive.connect(pentodeShaper);
  pentodeShaper.connect(triodeDrive);
  triodeDrive.connect(triodeShaper);

  // ── Air shelf + calibration trim ──
  const airShelf = ctx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = 10000;
  airShelf.gain.value = 0;
  const calibShelf = ctx.createBiquadFilter();
  calibShelf.type = 'highshelf';
  calibShelf.frequency.value = 5000;
  calibShelf.gain.value = 0;

  // ── Output transformer + attenuation ──
  const outTransformer = ctx.createWaveShaper();
  outTransformer.curve = buildCurve((x) => transformerTransfer(x));
  outTransformer.oversample = '4x';
  outTransformer.channelCount = 2; outTransformer.channelCountMode = 'explicit'; outTransformer.channelInterpretation = 'speakers';
  const outAtten = ctx.createGain(); outAtten.gain.value = 1;

  triodeShaper.connect(airShelf);
  airShelf.connect(calibShelf);
  calibShelf.connect(outTransformer);
  outTransformer.connect(outAtten);
  // ── Mid/Side decode + output routing ──
  // L = M + S, R = M − S. Gain-gated alongside the encode so toggling msMode
  // never rewires the graph.
  const decSplitter = ctx.createChannelSplitter(2);
  const decML = ctx.createGain(); decML.gain.value = 1;
  const decSL = ctx.createGain(); decSL.gain.value = 1;
  const decMR = ctx.createGain(); decMR.gain.value = 1;
  const decSR = ctx.createGain(); decSR.gain.value = -1;
  const decMerger = ctx.createChannelMerger(2);
  outAtten.connect(decSplitter);
  decSplitter.connect(decML, 0); decML.connect(decMerger, 0, 0);
  decSplitter.connect(decSL, 1); decSL.connect(decMerger, 0, 0);
  decSplitter.connect(decMR, 0); decMR.connect(decMerger, 0, 1);
  decSplitter.connect(decSR, 1); decSR.connect(decMerger, 0, 1);
  const msOutGain = ctx.createGain(); msOutGain.gain.value = 0;          // 0 stereo, 1 MS
  decMerger.connect(msOutGain);
  const stereoOutGain = ctx.createGain(); stereoOutGain.gain.value = 1; // 1 stereo, 0 MS
  outAtten.connect(stereoOutGain);
  stereoOutGain.connect(ins.wet);
  msOutGain.connect(ins.wet);

  let _enabled = false;

  return {
    input: ins.input,
    output: ins.output,
    update(state = {}) {
      const now = ctx.currentTime;
      const s = {
        enabled: false, bypass: false,
        inputGain: 0, density: 0,
        saturation: 0, satFreq: 'flat', satIn: true, altTube: false,
        pentode: 0, triode: 0,
        air: false, airAmount: 0,
        output: 5, calibration: 'normal', mix: 100,
        msMode: false, midDensity: 0, sideDensity: 0,
        ...state,
      };
      const active = s.enabled && !s.bypass;
      const ramp = _enabled !== active; _enabled = active;

      inputGain.gain.setTargetAtTime(dbToGain(s.inputGain), now, 0.02);

      // Density → drive push + output compensation. In Mid/Side mode the Mid
      // and Side components are driven independently (midDensity / sideDensity);
      // the shaper curve + output comp follow the harder-driven channel and a
      // per-channel pre-gain scales the softer channel so it saturates less.
      let dm;
      if (s.msMode) {
        const midDm = densityMapping((s.midDensity ?? 0) / 100, s.pentode / 10, s.triode / 10);
        const sideDm = densityMapping((s.sideDensity ?? 0) / 100, s.pentode / 10, s.triode / 10);
        dm = Math.abs(midDm.pentodeDrive) >= Math.abs(sideDm.pentodeDrive) ? midDm : sideDm;
        const maxPent = 1 + dm.pentodeDrive * 1.1;
        midDriveGain.gain.setTargetAtTime(maxPent > 0 ? (1 + midDm.pentodeDrive * 1.1) / maxPent : 1, now, 0.02);
        sideDriveGain.gain.setTargetAtTime(maxPent > 0 ? (1 + sideDm.pentodeDrive * 1.1) / maxPent : 1, now, 0.02);
      } else {
        dm = densityMapping((s.density || 0) / 100, s.pentode / 10, s.triode / 10);
        midDriveGain.gain.setTargetAtTime(1, now, 0.02);
        sideDriveGain.gain.setTargetAtTime(1, now, 0.02);
      }
      const pentDrive = 1 + dm.pentodeDrive * 1.1;     // pre-gain into pentode shaper
      const triDrive = 1 + dm.triodeDrive * 1.1;       // pre-gain into triode shaper

      pentodeDrive.gain.setTargetAtTime(pentDrive, now, 0.02);
      triodeDrive.gain.setTargetAtTime(triDrive, now, 0.02);
      pentodeShaper.curve = buildCurve((x) => pentodeTransfer(dm.pentodeDrive, x));
      triodeShaper.curve = buildCurve((x) => triodeTransfer(dm.triodeDrive, x));

      // Parallel saturation path.
      const satAmt = Math.max(0, Math.min(10, s.saturation)) / 10;
      const satDrive = satAmt * DRIVE_COEFF;   // tone down the parallel-sat drive
      if (s.satFreq === 'low') { parFilter.type = 'lowpass'; parFilter.frequency.setTargetAtTime(800, now, 0.02); }
      else if (s.satFreq === 'high') { parFilter.type = 'highpass'; parFilter.frequency.setTargetAtTime(2000, now, 0.02); }
      else { parFilter.type = 'allpass'; }
      parDrive.gain.setTargetAtTime(1 + satDrive * 2, now, 0.02);
      parMakeup.gain.setTargetAtTime(1 / (1 + satAmt * 1.6), now, 0.02);
      parShaper.curve = buildCurve((x) => parallelTubeTransfer(satDrive, !!s.altTube, x));
      const parWetVal = active && s.satIn ? satAmt : 0;
      fadeGain(parWet, parWetVal, now, ramp);

      // Air + calibration shelves.
      airShelf.gain.setTargetAtTime(active && s.air ? (Math.max(0, Math.min(10, s.airAmount)) / 10) * 4 : 0, now, 0.02);
      const calib = s.calibration === 'dark' ? -1.5 : s.calibration === 'bright' ? 1.5 : 0;
      calibShelf.gain.setTargetAtTime(calib, now, 0.05);

      // Output attenuation (knob 0..10 → gain 0..2, unity at 5) + density comp.
      const outGain = (Math.max(0, Math.min(10, s.output)) / 5) * dm.outputComp;
      outAtten.gain.setTargetAtTime(outGain, now, 0.02);

      // Mid/Side routing — gain-gated so toggling msMode never rewires the graph.
      const msOn = !!s.msMode;
      stereoInGain.gain.setTargetAtTime(msOn ? 0 : 1, now, 0.02);
      msInGain.gain.setTargetAtTime(msOn ? 1 : 0, now, 0.02);
      stereoOutGain.gain.setTargetAtTime(msOn ? 0 : 1, now, 0.02);
      msOutGain.gain.setTargetAtTime(msOn ? 1 : 0, now, 0.02);

      // Wet / dry mix. active → wet=mix, dry=(1-mix); bypass/off → dry only.
      const mix = Math.max(0, Math.min(100, s.mix)) / 100;
      fadeGain(ins.wet, active ? mix : 0, now, ramp);
      fadeGain(dry, active ? (1 - mix) : 1, now, ramp);
    },
  };
}