/**
 * Glide-zone blend — given two factory-preset recipes (left/right of a section
 * boundary) and a crossfade position t (0..1), produce one blended "recipe" in
 * the FULL shape the SignalChain update methods expect, plus an MBC crossfade
 * weight.
 *
 * Crossfade strategy per module:
 *  • EQ / Compressor (full-wet, no dry blend): interpolate parameters, using a
 *    NEUTRAL state (flat EQ / ratio-1 compressor) for the side that has the
 *    module off, so the effect ramps in/out rather than hard-switching.
 *  • Limiter / Tape / Saturation (have a wet/dry `mix`): use the ON side's
 *    parameters and scale `mix` by that side's presence (1-t for left, t for
 *    right). Both on → lerp params + lerp mix.
 *  • Multi-Band Comp (gain-gated, no mix): use the ON side's params (or lerp
 *    when both on) and return a continuous `weight` (0..1) the engine applies
 *    via setMbcCrossfade — passthrough ↔ processing, no graph rewire.
 *
 * Presence: left = 1-t, right = t. At the zone edges (t=0 / t=1) the blend
 * equals the pure preset, so the hand-off to the next stable section is
 * continuous (no audible snap).
 */
import { DEFAULT_EQ, DEFAULT_DYNAMICS, DEFAULT_MULTIBAND_COMP, DEFAULT_TAPE, DEFAULT_SATURATION } from '@/signalchain/useSignalChainEngine';

const lerp = (a, b, t) => a + (b - a) * t;
const dbToLin = (db) => Math.pow(10, (db || 0) / 20);

// ratio 1 + threshold 0 + makeup 0 = no compression (unity). Used when a side
// has the compressor off so the glide ramps compression in/out, not jumps it.
const NEUTRAL_COMP = { threshold: 0, ratio: 1, attack: 0.003, release: 0.25, knee: 30, makeupGain: 0 };

// Flat EQ (all gains 0, no cuts) — DEFAULT_EQ is already flat.
function flatEq() {
  return {
    enabled: false, bandCount: DEFAULT_EQ.bandCount, msMode: false,
    low: { ...DEFAULT_EQ.low },
    mids: DEFAULT_EQ.mids.map((m) => ({ ...m })),
    high: { ...DEFAULT_EQ.high },
  };
}

function normEq(preset) {
  const r = preset?.recipe?.eq;
  if (!r || r.enabled === false) return flatEq();
  const mids = Array.isArray(r.mids) ? r.mids : DEFAULT_EQ.mids;
  return {
    enabled: true,
    bandCount: r.bandCount || DEFAULT_EQ.bandCount,
    msMode: false,
    low: { ...DEFAULT_EQ.low, ...r.low },
    mids: mids.map((m, i) => ({ ...DEFAULT_EQ.mids[Math.min(i, DEFAULT_EQ.mids.length - 1)], ...m })),
    high: { ...DEFAULT_EQ.high, ...r.high },
  };
}

function normComp(preset) {
  const r = preset?.recipe?.compressor;
  return r ? { ...NEUTRAL_COMP, ...r } : { ...NEUTRAL_COMP };
}

function normLimiter(preset) {
  const r = preset?.recipe?.limiter;
  return r ? { ...DEFAULT_DYNAMICS.limiter, ...r, enabled: true } : { ...DEFAULT_DYNAMICS.limiter, mix: 0 };
}

// mix-based module (tape / saturation): ON side's params, mix scaled by presence.
function blendMixModule(key, presetA, presetB, t, defaults) {
  const onA = !!presetA?.recipe?.[key];
  const onB = !!presetB?.recipe?.[key];
  const pA = 1 - t, pB = t;
  if (!onA && !onB) return { ...defaults, enabled: false, mix: 0 };
  const a = onA ? { ...defaults, ...presetA.recipe[key], enabled: true } : null;
  const b = onB ? { ...defaults, ...presetB.recipe[key], enabled: true } : null;
  let base;
  if (a && b) {
    base = {};
    for (const k of Object.keys(defaults)) {
      const av = a[k], bv = b[k];
      base[k] = (typeof av === 'number' && typeof bv === 'number') ? lerp(av, bv, t) : (t < 0.5 ? av : bv);
    }
  } else {
    base = a || b;
  }
  const mix = (a ? a.mix * pA : 0) + (b ? b.mix * pB : 0);
  return { ...base, mix, enabled: true };
}

// MBC: ON side's params (lerp if both on), plus a continuous crossfade weight.
function blendMbc(presetA, presetB, t) {
  const onA = !!presetA?.recipe?.mbc?.enabled;
  const onB = !!presetB?.recipe?.mbc?.enabled;
  const pA = 1 - t, pB = t;
  const weight = (onA ? pA : 0) + (onB ? pB : 0);
  if (!onA && !onB) return { state: { ...DEFAULT_MULTIBAND_COMP, enabled: false }, weight: 0, globalMakeup: 0 };
  const a = onA ? presetA.recipe.mbc : null;
  const b = onB ? presetB.recipe.mbc : null;
  const bandCount = Math.max(a?.bandCount || DEFAULT_MULTIBAND_COMP.bandCount, b?.bandCount || DEFAULT_MULTIBAND_COMP.bandCount);
  const xA = a?.crossovers || DEFAULT_MULTIBAND_COMP.crossovers;
  const xB = b?.crossovers || DEFAULT_MULTIBAND_COMP.crossovers;
  const crossovers = [];
  for (let i = 0; i < bandCount - 1; i++) {
    crossovers.push(lerp(xA[i] ?? xA[xA.length - 1] ?? 1000, xB[i] ?? xB[xB.length - 1] ?? 1000, t));
  }
  const bA = a?.bands || [], bB = b?.bands || [];
  const bands = [];
  for (let i = 0; i < bandCount; i++) {
    const def = DEFAULT_MULTIBAND_COMP.bands[Math.min(i, DEFAULT_MULTIBAND_COMP.bands.length - 1)];
    const ba = { ...def, ...(bA[i] || {}) };
    const bb = { ...def, ...(bB[i] || {}) };
    if (onA && onB) {
      bands.push({
        threshold: lerp(ba.threshold, bb.threshold, t),
        ratio: lerp(ba.ratio, bb.ratio, t),
        attack: lerp(ba.attack, bb.attack, t),
        release: lerp(ba.release, bb.release, t),
        knee: lerp(ba.knee, bb.knee, t),
        makeupGain: lerp(ba.makeupGain, bb.makeupGain, t),
      });
    } else {
      bands.push(onA ? ba : bb);
    }
  }
  const globalMakeup = onA && onB
    ? lerp(a.globalMakeup || 0, b.globalMakeup || 0, t)
    : (onA ? (a.globalMakeup || 0) : (b.globalMakeup || 0));
  return { state: { enabled: weight > 0.001, bandCount, msMode: false, crossovers, bands, globalMakeup }, weight, globalMakeup };
}

export function buildGlideBlend(recipeA, recipeB, t) {
  const pA = 1 - t, pB = t;
  const A = { recipe: recipeA }, B = { recipe: recipeB };

  const eqA = normEq(A), eqB = normEq(B);
  const eq = {
    enabled: true,
    bandCount: Math.max(eqA.bandCount, eqB.bandCount),
    msMode: false,
    low: {
      freq: lerp(eqA.low.freq, eqB.low.freq, t),
      gain: eqA.low.gain * pA + eqB.low.gain * pB,
      q: lerp(eqA.low.q, eqB.low.q, t),
      cut: pA >= pB ? !!eqA.low.cut : !!eqB.low.cut,
      slope: eqA.low.slope * pA + eqB.low.slope * pB,
    },
    mids: [],
    high: {
      freq: lerp(eqA.high.freq, eqB.high.freq, t),
      gain: eqA.high.gain * pA + eqB.high.gain * pB,
      q: lerp(eqA.high.q, eqB.high.q, t),
      cut: pA >= pB ? !!eqA.high.cut : !!eqB.high.cut,
      slope: eqA.high.slope * pA + eqB.high.slope * pB,
    },
  };
  const maxMids = Math.max(eqA.mids.length, eqB.mids.length);
  for (let i = 0; i < maxMids; i++) {
    const ma = eqA.mids[i] || eqA.mids[eqA.mids.length - 1] || { freq: 1000, gain: 0, q: 1 };
    const mb = eqB.mids[i] || eqB.mids[eqB.mids.length - 1] || { freq: 1000, gain: 0, q: 1 };
    eq.mids.push({ freq: lerp(ma.freq, mb.freq, t), gain: ma.gain * pA + mb.gain * pB, q: lerp(ma.q, mb.q, t), enabled: true });
  }

  const cA = normComp(A), cB = normComp(B);
  const compressor = {
    enabled: true,
    threshold: cA.threshold * pA + cB.threshold * pB,
    ratio: cA.ratio * pA + cB.ratio * pB,
    attack: cA.attack * pA + cB.attack * pB,
    release: cA.release * pA + cB.release * pB,
    knee: cA.knee * pA + cB.knee * pB,
    makeupGain: cA.makeupGain * pA + cB.makeupGain * pB,
  };

  const lA = normLimiter(A), lB = normLimiter(B);
  const limiter = {
    ...DEFAULT_DYNAMICS.limiter,
    enabled: true,
    ceiling: lerp(lA.ceiling, lB.ceiling, t),
    release: lerp(lA.release, lB.release, t),
    attack: lerp(lA.attack ?? 0, lB.attack ?? 0, t),
    lookahead: lerp(lA.lookahead ?? 0, lB.lookahead ?? 0, t),
    stereoLink: lerp(lA.stereoLink, lB.stereoLink, t),
    oversampling: t < 0.5 ? lA.oversampling : lB.oversampling,
    style: t < 0.5 ? lA.style : lB.style,
    truePeak: t < 0.5 ? !!lA.truePeak : !!lB.truePeak,
    mix: lA.mix * pA + lB.mix * pB,
    inputGain: lerp(lA.inputGain ?? 0, lB.inputGain ?? 0, t),
    outputGain: lerp(lA.outputGain ?? 0, lB.outputGain ?? 0, t),
    releaseMode: t < 0.5 ? lA.releaseMode : lB.releaseMode,
  };
  const dynamics = { compressor, limiter };

  const tape = blendMixModule('tape', A, B, t, DEFAULT_TAPE);
  const saturation = blendMixModule('saturation', A, B, t, DEFAULT_SATURATION);
  const mbcBlend = blendMbc(A, B, t);

  return {
    eq, dynamics, tape, saturation,
    mbc: mbcBlend.state,
    mbcWeight: mbcBlend.weight,
    mbcMakeup: dbToLin(mbcBlend.globalMakeup),
    mbcMs: false,
  };
}