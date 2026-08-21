import { dbToGain, FADE_TAU } from './moduleUtils.js';

// Multi-Band Compressor — 1–5 bands, Linkwitz-Riley crossovers, stereo or M/S.
// Fixed pool of 5 band compressors + 4 LR4 crossover pairs (Mid + Side trees).
// rebuild() rewires the internal tree on band-count / topology change; enable
// is gated by gain ramps (mbcPassGain / mbcSum) so toggling is click-free (no
// graph rewire). Exposes mbcComp / mbcSideComp for the engine `mbcNodes` memo
// and setCrossfade() for the Section-Mastering glide (chain.setMbcCrossfade).
export function buildMultiBandComp(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sum = ctx.createGain(); sum.gain.value = 0; // gated to 0 when disabled (passthrough carries the dry)
  const passGain = ctx.createGain(); passGain.gain.value = 1; // stereo passthrough — 1 when disabled, 0 when enabled
  input.connect(passGain);
  passGain.connect(output);
  let bandCount = 4, msMode = false, enabled = false;

  // Mid tree (also the stereo tree when M/S is off).
  const comp = [], makeup = [], lp = [], hp = [];
  for (let i = 0; i < 5; i++) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = 0; c.knee.value = 6; c.ratio.value = 2.5;
    c.attack.value = 0.01; c.release.value = 0.15;
    const m = ctx.createGain(); m.gain.value = 1;
    comp.push(c); makeup.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const l = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    const h = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    l.forEach((b) => { b.type = 'lowpass'; b.frequency.value = 1000; b.Q.value = 0.7071; });
    h.forEach((b) => { b.type = 'highpass'; b.frequency.value = 1000; b.Q.value = 0.7071; });
    lp.push(l); hp.push(h);
  }
  // Side band tree (M/S mode) — mirrors the Mid tree.
  const sideComp = [], sideMakeup = [], sideLP = [], sideHP = [];
  for (let i = 0; i < 5; i++) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = 0; c.knee.value = 6; c.ratio.value = 2.5;
    c.attack.value = 0.01; c.release.value = 0.15;
    const m = ctx.createGain(); m.gain.value = 1;
    sideComp.push(c); sideMakeup.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const l = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    const h = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    l.forEach((b) => { b.type = 'lowpass'; b.frequency.value = 1000; b.Q.value = 0.7071; });
    h.forEach((b) => { b.type = 'highpass'; b.frequency.value = 1000; b.Q.value = 0.7071; });
    sideLP.push(l); sideHP.push(h);
  }
  const sideSum = ctx.createGain(); sideSum.gain.value = 0;
  // M/S encode: M = (L+R)/2, S = (L−R)/2. Permanent taps off the input.
  const msSplit = ctx.createChannelSplitter(2);
  const midEncL = ctx.createGain(); midEncL.gain.value = 0.5;
  const midEncR = ctx.createGain(); midEncR.gain.value = 0.5;
  const sideEncL = ctx.createGain(); sideEncL.gain.value = 0.5;
  const sideEncR = ctx.createGain(); sideEncR.gain.value = -0.5;
  const midSrc = ctx.createGain(); midSrc.gain.value = 1;
  const sideSrc = ctx.createGain(); sideSrc.gain.value = 1;
  input.connect(msSplit);
  msSplit.connect(midEncL, 0); midEncL.connect(midSrc);
  msSplit.connect(midEncR, 1); midEncR.connect(midSrc);
  msSplit.connect(sideEncL, 0); sideEncL.connect(sideSrc);
  msSplit.connect(sideEncR, 1); sideEncR.connect(sideSrc);
  // M/S decode: L = M + S, R = M − S. msOut → output is permanent; the
  // sum→decode wiring is made in rebuild().
  const msMerger = ctx.createChannelMerger(2);
  const decML = ctx.createGain(); decML.gain.value = 1;
  const decMR = ctx.createGain(); decMR.gain.value = 1;
  const decSL = ctx.createGain(); decSL.gain.value = 1;
  const decSR = ctx.createGain(); decSR.gain.value = -1;
  const msOut = ctx.createGain(); msOut.gain.value = 1;
  msOut.connect(output);

  const dis = (n) => { try { n.disconnect(); } catch {} };
  function rebuild() {
    // Disconnect only the processing tree's fan-out — keep the passGain
    // passthrough (input → passGain → output) intact so toggling enable never
    // rewires the graph (the click source). input's downstream fan-out is
    // rebuilt below; the passthrough + M/S encode taps are reconnected after.
    dis(input);
    input.connect(msSplit);
    input.connect(passGain);
    comp.forEach(dis); makeup.forEach(dis);
    lp.forEach((p) => p.forEach(dis)); hp.forEach((p) => p.forEach(dis));
    dis(sum);
    sideComp.forEach(dis); sideMakeup.forEach(dis);
    sideLP.forEach((p) => p.forEach(dis)); sideHP.forEach((p) => p.forEach(dis));
    dis(sideSum);
    dis(midSrc); dis(sideSrc);
    dis(decML); dis(decMR); dis(decSL); dis(decSR);
    dis(msMerger);

    // Always build the tree for the current band count / topology. Enable is
    // gated purely by gain ramps in update() — no rewire on toggle.
    const buildTree = (src, lpArr, hpArr, compArr, mkArr, s) => {
      const k = bandCount;
      let cur = src;
      for (let i = 0; i < k - 1; i++) {
        cur.connect(lpArr[i][0]); lpArr[i][0].connect(lpArr[i][1]);
        lpArr[i][1].connect(compArr[i]); compArr[i].connect(mkArr[i]); mkArr[i].connect(s);
        cur.connect(hpArr[i][0]); hpArr[i][0].connect(hpArr[i][1]);
        cur = hpArr[i][1];
      }
      cur.connect(compArr[k - 1]); compArr[k - 1].connect(mkArr[k - 1]); mkArr[k - 1].connect(s);
    };

    if (!msMode) {
      // Stereo (linked): input → Mid tree → sum → output.
      buildTree(input, lp, hp, comp, makeup, sum);
      sum.connect(output);
    } else {
      // M/S: encoded Mid & Side sources feed independent trees, decoded at output.
      buildTree(midSrc, lp, hp, comp, makeup, sum);
      buildTree(sideSrc, sideLP, sideHP, sideComp, sideMakeup, sideSum);
      sum.connect(decML); decML.connect(msMerger, 0, 0);
      sum.connect(decMR); decMR.connect(msMerger, 0, 1);
      sideSum.connect(decSL); decSL.connect(msMerger, 0, 0);
      sideSum.connect(decSR); decSR.connect(msMerger, 0, 1);
      msMerger.connect(msOut);
      // msOut → output is permanent (built once).
    }
  }

  // Section-mastering MBC crossfade — drives the passthrough ↔ processing
  // balance directly (passGain = 1-w, sum = w·makeup). `instant` =
  // setValueAtTime (per-frame glide tracking); false = 12 ms ramp (manual
  // enable toggle, click-free). Sole authority for those two gains.
  function setCrossfade(weight, gm, ms, instant) {
    const now = ctx.currentTime;
    const w = Math.max(0, Math.min(1, weight));
    const set = (node, val) => { if (instant) node.gain.setValueAtTime(val, now); else node.gain.setTargetAtTime(val, now, FADE_TAU); };
    set(passGain, 1 - w);
    set(sum, w * gm);
    set(sideSum, (ms ? w : 0) * gm);
  }

  rebuild();

  return {
    input, output,
    mbcComp: comp, mbcSideComp: sideComp, // compat: engine `mbcNodes` memo
    rebuild,
    setCrossfade,
    update(state) {
      const now = ctx.currentTime;
      const en = !!state?.enabled;
      const k = Math.max(1, Math.min(5, state?.bandCount || 4));
      const ms = !!state?.msMode;
      // Rebuild the tree ONLY on band-count / topology changes — NOT on enable
      // toggles. Enable is gated by gain ramps so toggling is click-free.
      if (k !== bandCount || ms !== msMode) { bandCount = k; msMode = ms; rebuild(); }
      const enabledChanged = enabled !== en; enabled = en;
      // Crossover frequencies are shared between the Mid and Side trees.
      const xovers = state?.crossovers || [];
      for (let i = 0; i < k - 1; i++) {
        const f = Math.max(40, Math.min(18000, xovers[i] || 1000));
        [lp[i][0], lp[i][1], hp[i][0], hp[i][1],
         sideLP[i][0], sideLP[i][1], sideHP[i][0], sideHP[i][1]].forEach((b) => {
          b.frequency.setValueAtTime(f, now); b.Q.setValueAtTime(0.7071, now);
        });
      }
      const setBandComp = (c, m, band, on, anySolo) => {
        if (on) {
          if (band.enabled !== false) {
            c.threshold.setValueAtTime(band.threshold ?? -20, now);
            c.ratio.setValueAtTime(band.ratio ?? 2.5, now);
            c.attack.setValueAtTime(band.attack ?? 0.01, now);
            c.release.setValueAtTime(band.release ?? 0.15, now);
            c.knee.setValueAtTime(band.knee ?? 6, now);
          } else {
            c.threshold.setValueAtTime(0, now);
            c.ratio.setValueAtTime(1, now);
          }
          const muted = anySolo && !band.solo;
          m.gain.setValueAtTime(muted ? 0 : dbToGain(band.makeupGain ?? 0), now);
        } else {
          c.threshold.setValueAtTime(0, now);
          m.gain.setValueAtTime(0, now);
        }
      };
      const bands = state?.bands || [];
      const sideBands = state?.sideBands || bands;
      const anySoloMid = bands.some((b) => b?.solo);
      const anySoloSide = sideBands.some((b) => b?.solo);
      for (let i = 0; i < 5; i++) {
        // Mid tree (also the stereo tree when M/S is off) — active when enabled.
        setBandComp(comp[i], makeup[i], bands[i] || {}, en && i < k, anySoloMid);
        // Side tree — active only in M/S mode.
        setBandComp(sideComp[i], sideMakeup[i], sideBands[i] || {}, en && ms && i < k, anySoloSide);
      }
      const gm = dbToGain(state?.globalMakeup ?? 0);
      const mix = Math.max(0, Math.min(1, (state?.mix ?? 100) / 100));
      setCrossfade(en ? mix : 0, gm, ms, !enabledChanged);
    },
  };
}