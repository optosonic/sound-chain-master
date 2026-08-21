import { makeInsert, fadeGain, dbToGain } from './moduleUtils.js';
import { createCharacterCompressor } from '../CompressorNode.js';

// Compressor — character compressor with stereo-linked + M/S topologies.
// A gain pair (compStereoGain / compMSGain) selects the active topology without
// rebuilding the graph (click-free toggle). Exposes compressorNode / compMid /
// compSide so the engine's `nodes` memo and the panel metering keep working.
export function buildCompressor(ctx) {
  const cmp = makeInsert(ctx);
  // dry/wet mix handled in update() (parallel compression). Default mix = 100%
  // (full-wet) preserves the original behaviour.
  const compressorNode = createCharacterCompressor(ctx, { channels: 2 });
  compressorNode.setParams({ type: 'platinum', enabled: false, threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30, link: 1 });
  const makeupGainNode = ctx.createGain(); makeupGainNode.gain.value = 1;
  // M/S compressor path — encode L/R → M/S, compress Mid & Side independently, decode.
  const msSplitter = ctx.createChannelSplitter(2);
  const msMidEncL = ctx.createGain(); msMidEncL.gain.value = 0.5;
  const msMidEncR = ctx.createGain(); msMidEncR.gain.value = 0.5;
  const msSideEncL = ctx.createGain(); msSideEncL.gain.value = 0.5;
  const msSideEncR = ctx.createGain(); msSideEncR.gain.value = -0.5;
  const msMidSum = ctx.createGain(); msMidSum.gain.value = 1;
  const msSideSum = ctx.createGain(); msSideSum.gain.value = 1;
  const compMid = createCharacterCompressor(ctx, { channels: 1 });
  const compSide = createCharacterCompressor(ctx, { channels: 1 });
  compMid.setParams({ type: 'platinum', enabled: false });
  compSide.setParams({ type: 'platinum', enabled: false });
  const compMidMakeup = ctx.createGain(); compMidMakeup.gain.value = 1;
  const compSideMakeup = ctx.createGain(); compSideMakeup.gain.value = 1;
  const msDecML = ctx.createGain(); msDecML.gain.value = 1;
  const msDecMR = ctx.createGain(); msDecMR.gain.value = 1;
  const msDecSL = ctx.createGain(); msDecSL.gain.value = 1;
  const msDecSR = ctx.createGain(); msDecSR.gain.value = -1;
  const msMerger = ctx.createChannelMerger(2);
  const compStereoGain = ctx.createGain(); compStereoGain.gain.value = 1;
  const compMSGain = ctx.createGain(); compMSGain.gain.value = 0;
  // stereo (linked) path
  cmp.input.connect(compressorNode);
  compressorNode.connect(makeupGainNode);
  makeupGainNode.connect(compStereoGain);
  compStereoGain.connect(cmp.wet);
  // M/S path
  cmp.input.connect(msSplitter);
  msSplitter.connect(msMidEncL, 0); msMidEncL.connect(msMidSum);
  msSplitter.connect(msMidEncR, 1); msMidEncR.connect(msMidSum);
  msSplitter.connect(msSideEncL, 0); msSideEncL.connect(msSideSum);
  msSplitter.connect(msSideEncR, 1); msSideEncR.connect(msSideSum);
  msMidSum.connect(compMid); compMid.connect(compMidMakeup);
  msSideSum.connect(compSide); compSide.connect(compSideMakeup);
  compMidMakeup.connect(msDecML); msDecML.connect(msMerger, 0, 0);
  compMidMakeup.connect(msDecMR); msDecMR.connect(msMerger, 0, 1);
  compSideMakeup.connect(msDecSL); msDecSL.connect(msMerger, 0, 0);
  compSideMakeup.connect(msDecSR); msDecSR.connect(msMerger, 0, 1);
  msMerger.connect(compMSGain);
  compMSGain.connect(cmp.wet);
  let _enabled = false, _ms = false;
  return {
    input: cmp.input,
    output: cmp.output,
    compressorNode, compMid, compSide, // compat: engine `nodes` memo
    update(c = {}) {
      const now = ctx.currentTime;
      const cOn = !!c.enabled;
      const ms = !!c.msMode;
      const cChanged = _enabled !== cOn;
      const msChanged = _ms !== ms;
      _enabled = cOn; _ms = ms;
      const topoRamp = cChanged || msChanged;
      const cType = c.type || 'platinum';
      if (cOn) {
        // Mid params (also drive the stereo-linked compressorNode).
        const mThr = c.threshold ?? -24, mRat = c.ratio ?? 4, mAtk = c.attack ?? 0.003, mRel = c.release ?? 0.25, mKn = c.knee ?? 30;
        const mMk = dbToGain(c.makeupGain ?? 0);
        // Side params (independent in M/S mode; fall back to Mid values when unset).
        const sThr = c.sideThreshold ?? mThr, sRat = c.sideRatio ?? mRat, sAtk = c.sideAttack ?? mAtk, sRel = c.sideRelease ?? mRel, sKn = c.sideKnee ?? mKn;
        const sMk = dbToGain(c.sideMakeupGain ?? c.makeupGain ?? 0);
        compressorNode.setParams({ enabled: true, type: cType, threshold: mThr, ratio: mRat, attack: mAtk, release: mRel, knee: mKn, link: 1, model: c.model ?? 1 });
        compMid.setParams({ enabled: true, type: cType, threshold: mThr, ratio: mRat, attack: mAtk, release: mRel, knee: mKn, link: 0, model: c.model ?? 1 });
        compSide.setParams({ enabled: true, type: cType, threshold: sThr, ratio: sRat, attack: sAtk, release: sRel, knee: sKn, link: 0, model: c.sideModel ?? c.model ?? 1 });
        fadeGain(makeupGainNode, ms ? 1 : mMk, now, topoRamp);
        fadeGain(compMidMakeup, mMk, now, topoRamp);
        fadeGain(compSideMakeup, sMk, now, topoRamp);
      } else {
        compressorNode.setParams({ enabled: false, type: cType, threshold: c.threshold ?? -24, ratio: c.ratio ?? 4, attack: c.attack ?? 0.003, release: c.release ?? 0.25, knee: c.knee ?? 30, link: 1, model: c.model ?? 1 });
        compMid.setParams({ enabled: false, type: cType, model: c.model ?? 1 });
        compSide.setParams({ enabled: false, type: cType, model: c.sideModel ?? c.model ?? 1 });
        fadeGain(makeupGainNode, 1, now, cChanged);
        fadeGain(compMidMakeup, 1, now, cChanged);
        fadeGain(compSideMakeup, 1, now, cChanged);
      }
      // Topology toggle: stereo-linked vs M/S (disabled → stereo path passes unity).
      fadeGain(compStereoGain, cOn && ms ? 0 : 1, now, topoRamp);
      fadeGain(compMSGain, cOn && ms ? 1 : 0, now, topoRamp);
      // Per-module MIX (parallel compression): dry = 1−mix, wet = mix. Disabled
      // → full dry (unity bypass). Default mix = 100% = full-wet (original).
      const mix = Math.max(0, Math.min(1, (c.mix ?? 100) / 100));
      fadeGain(cmp.dry, cOn ? (1 - mix) : 1, now, cChanged);
      fadeGain(cmp.wet, cOn ? mix : 0, now, cChanged);
    },
  };
}