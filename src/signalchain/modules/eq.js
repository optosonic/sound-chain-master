import { makeInsert, fadeGain } from './moduleUtils.js';
import { midShapeBand } from '../eqModel.js';

// N-Band Parametric EQ — hybrid shelves (low shelf + N−2 mid bells + high shelf).
// Fixed pool of 14 biquads in series (4 low · 6 mid · 4 high) per channel. Unused
// filters are set to a flat peaking (gain 0) so the chain stays intact without
// rewiring when the band count changes. Stereo + M/S topology.
export function buildEQ(ctx) {
  const eqMod = makeInsert(ctx);
  // dry/wet mix handled in update() (parallel EQ). Default mix = 100% = full-wet.
  const EQ_FILTERS = 14;
  const eqFilters = [];
  const eqFiltersSide = [];
  for (let i = 0; i < EQ_FILTERS; i++) {
    const f = ctx.createBiquadFilter();
    f.type = 'peaking'; f.frequency.value = 1000; f.Q.value = 1; f.gain.value = 0;
    eqFilters.push(f);
    const fs = ctx.createBiquadFilter();
    fs.type = 'peaking'; fs.frequency.value = 1000; fs.Q.value = 1; fs.gain.value = 0;
    eqFiltersSide.push(fs);
  }
  for (let i = 0; i < EQ_FILTERS - 1; i++) { eqFilters[i].connect(eqFilters[i + 1]); eqFiltersSide[i].connect(eqFiltersSide[i + 1]); }
  // Stereo path: input → eqStereoInGain → eqFilters → eqStereoOutGain → output
  const eqStereoInGain = ctx.createGain(); eqStereoInGain.gain.value = 1;
  const eqStereoOutGain = ctx.createGain(); eqStereoOutGain.gain.value = 1;
  eqMod.input.connect(eqStereoInGain);
  eqStereoInGain.connect(eqFilters[0]);
  eqFilters[EQ_FILTERS - 1].connect(eqStereoOutGain);
  eqStereoOutGain.connect(eqMod.wet);
  // M/S encode: M = (L+R)/2, S = (L−R)/2
  const eqMSSplitter = ctx.createChannelSplitter(2);
  const eqMSEncML = ctx.createGain(); eqMSEncML.gain.value = 0.5;
  const eqMSEncMR = ctx.createGain(); eqMSEncMR.gain.value = 0.5;
  const eqMSEncSL = ctx.createGain(); eqMSEncSL.gain.value = 0.5;
  const eqMSEncSR = ctx.createGain(); eqMSEncSR.gain.value = -0.5;
  const eqMSMidSum = ctx.createGain(); eqMSMidSum.gain.value = 1;
  const eqMSSideSum = ctx.createGain(); eqMSSideSum.gain.value = 1;
  eqMod.input.connect(eqMSSplitter);
  eqMSSplitter.connect(eqMSEncML, 0); eqMSEncML.connect(eqMSMidSum);
  eqMSSplitter.connect(eqMSEncMR, 1); eqMSEncMR.connect(eqMSMidSum);
  eqMSSplitter.connect(eqMSEncSL, 0); eqMSEncSL.connect(eqMSSideSum);
  eqMSSplitter.connect(eqMSEncSR, 1); eqMSEncSR.connect(eqMSSideSum);
  const eqMSMidIn = ctx.createGain(); eqMSMidIn.gain.value = 0;
  eqMSMidSum.connect(eqMSMidIn);
  eqMSMidIn.connect(eqFilters[0]);
  eqMSSideSum.connect(eqFiltersSide[0]);
  // M/S decode: L = M + S, R = M − S
  const eqMSDecML = ctx.createGain(); eqMSDecML.gain.value = 1;
  const eqMSDecMR = ctx.createGain(); eqMSDecMR.gain.value = 1;
  const eqMSDecSL = ctx.createGain(); eqMSDecSL.gain.value = 1;
  const eqMSDecSR = ctx.createGain(); eqMSDecSR.gain.value = -1;
  const eqMSMerger = ctx.createChannelMerger(2);
  const eqMidOutGain = ctx.createGain(); eqMidOutGain.gain.value = 0;
  const eqSideOutGain = ctx.createGain(); eqSideOutGain.gain.value = 0;
  eqFilters[EQ_FILTERS - 1].connect(eqMidOutGain);
  eqMidOutGain.connect(eqMSDecML); eqMSDecML.connect(eqMSMerger, 0, 0);
  eqMidOutGain.connect(eqMSDecMR); eqMSDecMR.connect(eqMSMerger, 0, 1);
  eqFiltersSide[EQ_FILTERS - 1].connect(eqSideOutGain);
  eqSideOutGain.connect(eqMSDecSL); eqMSDecSL.connect(eqMSMerger, 0, 0);
  eqSideOutGain.connect(eqMSDecSR); eqMSDecSR.connect(eqMSMerger, 0, 1);
  eqMSMerger.connect(eqMod.wet);
  let _enabled = false, _ms = false;
  return {
    input: eqMod.input,
    output: eqMod.output,
    update(eq) {
      const now = ctx.currentTime;
      // Topology toggle (independent of enabled): stereo vs M/S.
      const ms = !!eq?.msMode;
      const eqRamp = (_enabled !== !!eq?.enabled) || (_ms !== ms);
      _enabled = !!eq?.enabled; _ms = ms;
      fadeGain(eqStereoInGain, ms ? 0 : 1, now, eqRamp);
      fadeGain(eqStereoOutGain, ms ? 0 : 1, now, eqRamp);
      fadeGain(eqMSMidIn, ms ? 1 : 0, now, eqRamp);
      fadeGain(eqMidOutGain, ms ? 1 : 0, now, eqRamp);
      fadeGain(eqSideOutGain, ms ? 1 : 0, now, eqRamp);

      const flat = (f) => {
        f.type = 'peaking';
        f.frequency.setValueAtTime(1000, now);
        f.gain.setValueAtTime(0, now);
        f.Q.setValueAtTime(1, now);
      };
      // Apply a band set ({ enabled, low, mids, high }) to one filter chain.
      // In M/S mode the Mid chain (eqFilters) gets the Mid bands and the Side
      // chain (eqFiltersSide) gets the Side bands — so the two channels can be
      // shaped independently. In stereo mode both chains mirror the same bands.
      const applyBands = (filterArr, bands) => {
        if (!bands?.enabled) { for (let i = 0; i < filterArr.length; i++) flat(filterArr[i]); return; }
        const allBands = [bands.low, ...(bands.mids || []), bands.high];
        const anySolo = allBands.some((b) => b && b.solo);
        const isActive = (b) => !!b && b.enabled !== false && (!anySolo || !!b.solo);
        let idx = 0;
        const setF = (type, freq, gain, q) => {
          const f = filterArr[idx++];
          f.type = type;
          f.frequency.setValueAtTime(freq, now);
          f.gain.setValueAtTime(gain, now);
          f.Q.setValueAtTime(q, now);
        };
        const skipSlots = (n) => { for (let i = 0; i < n; i++) { flat(filterArr[idx]); idx++; } };
        // Low section (4 slots): cascaded highpass for cuts, single lowshelf otherwise.
        if (isActive(bands.low)) {
          if (bands.low.cut) {
            const count = (bands.low.slope || 12) / 12;
            for (let i = 0; i < 4; i++) setF('highpass', i < count ? (bands.low.freq || 200) : 20, 0, 0.707);
          } else {
            setF('lowshelf', bands.low.freq || 200, bands.low.gain || 0, 0.707);
            skipSlots(3);
          }
        } else {
          skipSlots(4);
        }
        // Mid section (6 slots): one bell per mid band (shape → biquad type).
        const mids = bands.mids || [];
        for (let i = 0; i < 6; i++) {
          if (i < mids.length && isActive(mids[i])) {
            const s = midShapeBand(mids[i]);
            setF(s.type, s.freq, s.gain, s.q);
          } else { flat(filterArr[idx]); idx++; }
        }
        // High section (4 slots): cascaded lowpass for cuts, single highshelf otherwise.
        if (isActive(bands.high)) {
          if (bands.high.cut) {
            const count = (bands.high.slope || 12) / 12;
            for (let i = 0; i < 4; i++) setF('lowpass', i < count ? (bands.high.freq || 5000) : 20000, 0, 0.707);
          } else {
            setF('highshelf', bands.high.freq || 5000, bands.high.gain || 0, 0.707);
            skipSlots(3);
          }
        } else {
          skipSlots(4);
        }
      };

      const midBands = { enabled: !!eq?.enabled, low: eq?.low, mids: eq?.mids, high: eq?.high };
      const sideBands = ms
        ? { enabled: !!eq?.enabled, low: eq?.sideLow || eq?.low, mids: eq?.sideMids || eq?.mids, high: eq?.sideHigh || eq?.high }
        : midBands;
      applyBands(eqFilters, midBands);
      applyBands(eqFiltersSide, sideBands);
      // Per-module MIX (parallel EQ): dry = 1−mix, wet = mix. Disabled → dry.
      const eqMix = Math.max(0, Math.min(1, (eq?.mix ?? 100) / 100));
      const en = !!eq?.enabled;
      fadeGain(eqMod.dry, en ? (1 - eqMix) : 1, now, eqRamp);
      fadeGain(eqMod.wet, en ? eqMix : 0, now, eqRamp);
    },
  };
}