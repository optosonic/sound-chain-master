import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { setMeterStandby } from './meterStandby.js';
import { SignalChain } from '@/signalchain/SignalChain.js';
import { DEFAULT_FX_ORDER, FX_SLOT, defaultInstanceOrder, defaultInstanceId, normalizeInstanceOrder, instanceType, instanceIndex, isInstanceId } from '@/signalchain/fxSlots.js';

// Compressor AudioWorklet URL. Using new URL(..., import.meta.url) (the
// Vite-recommended pattern for Worker/Worklet assets) so the worklet file is
// resolved as an asset URL — not imported as a module (it has no ES exports,
// which broke the previous `?url` default import).
const workletUrl = new URL('./compressorWorklet.js', import.meta.url).href;
// Dual-tap crossfading delay worklet — click-free delay-time changes.
const delayXfadeUrl = new URL('./delayXfadeWorklet.js', import.meta.url).href;
// Limiter dither + noise-shaping worklet — final-stage bit-depth reduction.
const limiterDitherUrl = new URL('./limiterDitherWorklet.js', import.meta.url).href;
// Limiter core worklet — true-peak / program-dependent release / M/S.
const limiterWorkletUrl = new URL('./limiterWorklet.js', import.meta.url).href;
const signalUtilityUrl = new URL('./signalUtility/signalUtilityWorklet.js', import.meta.url).href;
import { defaultEQ, defaultDynamicEQ } from '@/signalchain/eqModel.js';
import { defaultMultiBandComp } from '@/signalchain/multiBandCompModel.js';
import { defaultClip } from '@/signalchain/clipModel.js';
import { defaultTape } from '@/signalchain/tapeModel.js';
import { applyRecipeToChain } from '@/signalchain/mastering/applyRecipeToChain.js';
import { decodeAiffToAudioBuffer, isAiffFile } from '@/signalchain/aiffDecoder.js';
import { createSignalUtility } from './signalUtility/signalUtilityEngine.js';

// Map the stereo-imager UI window (spreadLo = left edge, width = right edge,
// both on a -3…+3 rail) to the DSP width multiplier + rotation direction the
// stereoImager module.update expects.
function imagerDspState(next) {
  const lo = next.spreadLo ?? -1;
  const hi = next.width ?? 1;
  const w = Math.max(0, Math.min(3, (hi - lo) / 2));
  const direction = Math.max(-180, Math.min(180, next.direction ?? 0));
  return { ...next, width: w, spreadLo: w, direction };
}

function peakDb(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; }
  return p > 0 ? 20 * Math.log10(p) : -100;
}
function rmsDb(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  const rms = Math.sqrt(s / buf.length);
  return rms > 0 ? 20 * Math.log10(rms) : -100;
}

// ── Mastering Effect macro ────────────────────────────────────────────
// Which module types the "Mastering Effect" macro knob scales, and the
// dry/wet field + scale each stores. The limiter is EXCLUDED so it always
// stays full-wet (brickwall peak protection — the macro must never reduce
// safety). Mon8 is EXCLUDED (its "width" is a stereo control, not a wet/dry).
const MACRO_MIX = {
  compressor:     { field: 'mix', max: 100 },
  saturation:     { field: 'mix', max: 1 },
  analogueDensity:{ field: 'mix', max: 100 },
  clip:           { field: 'mix', max: 1 },
  tape:           { field: 'mix', max: 1 },
  delay:          { field: 'mix', max: 1 },
  reverb:         { field: 'mix', max: 1 },
  eq:             { field: 'mix', max: 100 },
  dynamicEq:      { field: 'mix', max: 100 },
  multiBandComp:  { field: 'mix', max: 100 },
  stereoImager:   { field: 'mix', max: 100 },
};

export const DEFAULT_EQ = { ...defaultEQ(3), mix: 100 };
export const DEFAULT_DYNAMIC_EQ = defaultDynamicEQ(4);
export const DEFAULT_MULTIBAND_COMP = defaultMultiBandComp(4);
export const DEFAULT_EFFECTS = {
  delay: { enabled: false, syncNote: null, time: 0.25, feedback: 0.3, mix: 0.2, xfadeMs: 15 },
  reverb: { enabled: false, decay: 1.5, damping: 0.5, mix: 0.2, predelay: 0, size: 0.5, diffusion: 0.7, radicalness: 0, lowCut: 20, highShelfFreq: 8000, highShelfGain: 0 },
};
export const DEFAULT_DYNAMICS = {
  compressor: { type: 'platinum', enabled: false, threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30, makeupGain: 0, mix: 100, msMode: false, msChannel: 'mid', sideThreshold: -24, sideRatio: 4, sideAttack: 0.003, sideRelease: 0.25, sideKnee: 30, sideMakeupGain: 0, model: 1, sideModel: 1 },
  limiter: {
    enabled: true,
    ceiling: -0.1,
    release: 0.05,
    releaseMode: 'manual',
    attack: 0,
    lookahead: 0,
    stereoLink: 100,
    style: 'transparent',
    truePeak: false,
    oversampling: 1,
    mix: 100,
    dither: 'off',
    dcBlocker: true,
    noiseShape: 'none',
    msMode: false,
    releaseShape: 'exp',
    scale: '24',
    inputGain: 0,
    outputGain: 0,
  },
};
export const DEFAULT_SATURATION = { enabled: false, mode: 'tube', drive: 0.4, grit: 0, mix: 0.5, tone: 12000, output: 1 };
export const DEFAULT_ANALOGUE_DENSITY = {
  enabled: false, bypass: false,
  inputGain: 0, density: 0,
  saturation: 0, satFreq: 'flat', satIn: true, altTube: false,
  pentode: 0, triode: 0,
  air: false, airAmount: 0,
  output: 5, calibration: 'normal', mix: 20,
  msMode: false, midDensity: 0, sideDensity: 0,
};
export const DEFAULT_CLIP = defaultClip();
export const DEFAULT_TAPE = defaultTape();
export const DEFAULT_STEREO_IMAGER = { enabled: false, width: 1, spreadLo: -1, direction: 0, inputMs: false, split: true, crossover: 200, mix: 100 };
export const DEFAULT_MON8 = { enabled: false, frequency: 120, width: 0, slope: 24 };

// Parallel-loop defaults — every effect DISABLED so the loop starts EMPTY.
// The user builds the parallel chain themselves via the + / − controls.
const LOOP_DEFAULT_EQ = { ...DEFAULT_EQ, enabled: false };
const LOOP_DEFAULT_DYNAMIC_EQ = { ...DEFAULT_DYNAMIC_EQ, enabled: false };
const LOOP_DEFAULT_MBC = { ...DEFAULT_MULTIBAND_COMP, enabled: false };
const LOOP_DEFAULT_EFFECTS = {
  delay: { ...DEFAULT_EFFECTS.delay, enabled: false },
  reverb: { ...DEFAULT_EFFECTS.reverb, enabled: false },
};
const LOOP_DEFAULT_DYNAMICS = {
  compressor: { ...DEFAULT_DYNAMICS.compressor, enabled: false },
  limiter: { ...DEFAULT_DYNAMICS.limiter, enabled: false },
};
const LOOP_DEFAULT_SATURATION = { ...DEFAULT_SATURATION, enabled: false };
const LOOP_DEFAULT_ANALOGUE_DENSITY = { ...DEFAULT_ANALOGUE_DENSITY, enabled: false };
const LOOP_DEFAULT_CLIP = { ...DEFAULT_CLIP, enabled: false };
const LOOP_DEFAULT_TAPE = { ...DEFAULT_TAPE, enabled: false };
const LOOP_DEFAULT_STEREO_IMAGER = { ...DEFAULT_STEREO_IMAGER, enabled: false };
const LOOP_DEFAULT_MON8 = { ...DEFAULT_MON8, enabled: false };

/**
 * The shared audio brain for every Sound Chain Master view (Full / Medium /
 * Large / Mini). Instantiated ONCE at the top level so the AudioContext and
 * signal chain survive view-mode switches — switching layouts never rebuilds
 * the graph or interrupts playback.
 */
export function useSignalChainEngine() {
  const ctxRef = useRef(null);
  const chainRef = useRef(null);
  const masterGainRef = useRef(null);
  const monoRef = useRef(null);
  const inputGainLRef = useRef(null);
  const inputGainRRef = useRef(null);
  const outputGainLRef = useRef(null);
  const outputGainRRef = useRef(null);
  const inputUpmixRef = useRef(null);
  const signalUtilityRef = useRef(null);
  // Dual-chain morph crossfade (Section Mastering preset transitions).
  const morphChainRef = useRef(null);
  const morphBypassTimerRef = useRef(null);
  const morphGainARef = useRef(null);
  const morphGainBRef = useRef(null);
  const morphSumRef = useRef(null);
  const audioElRef = useRef(null);
  const fileRef = useRef(null);
  const mediaElSourceRef = useRef(null);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const analyzersRef = useRef(null);
  // Buffer-source playback (AIFF / JS-decoded formats). Browsers can't decode
  // AIFF via the <audio> element or decodeAudioData, so AIFF is parsed in JS
  // into an AudioBuffer and played through a looped AudioBufferSourceNode.
  // Transport dispatches on playerModeRef ('media' | 'buffer').
  const playerModeRef = useRef('media');
  const bufferRef = useRef(null);
  const bufferSourceRef = useRef(null);
  const bufferStartCtxTimeRef = useRef(0);
  const bufferOffsetRef = useRef(0);
  const [ready, setReady] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  // ── Instance-based chain state (Stage 2) ───────────────────────────────
  // `instanceStates` is the single source of truth for every effect instance's
  // parameters, keyed by instance id ("<type>#<n>"). The default chain seeds
  // one instance per type (#1). The per-type slices below (eq, dynamics, …)
  // are DERIVED views onto the #1 instances so every existing panel, preset
  // recipe, section-mastering glide and capture/restore flow keeps working
  // unchanged. Non-default instances (#2+) live ONLY in instanceStates and
  // are edited via handleInstanceUpdate.
  const seedInstances = () => {
    const s = {};
    s[defaultInstanceId('eq')] = DEFAULT_EQ;
    s[defaultInstanceId('dynamicEq')] = DEFAULT_DYNAMIC_EQ;
    s[defaultInstanceId('multiBandComp')] = DEFAULT_MULTIBAND_COMP;
    s[defaultInstanceId('compressor')] = DEFAULT_DYNAMICS.compressor;
    s[defaultInstanceId('limiter')] = DEFAULT_DYNAMICS.limiter;
    s[defaultInstanceId('delay')] = DEFAULT_EFFECTS.delay;
    s[defaultInstanceId('reverb')] = DEFAULT_EFFECTS.reverb;
    s[defaultInstanceId('saturation')] = DEFAULT_SATURATION;
    s[defaultInstanceId('analogueDensity')] = DEFAULT_ANALOGUE_DENSITY;
    s[defaultInstanceId('clip')] = DEFAULT_CLIP;
    s[defaultInstanceId('tape')] = DEFAULT_TAPE;
    s[defaultInstanceId('stereoImager')] = DEFAULT_STEREO_IMAGER;
    s[defaultInstanceId('mon8')] = DEFAULT_MON8;
    return s;
  };
  const [fxOrder, setFxOrder] = useState(defaultInstanceOrder());
  const [instanceStates, setInstanceStates] = useState(seedInstances);
  // Derived #1 views (backward-compat for panels / presets / recipes).
  const eq = instanceStates[defaultInstanceId('eq')] ?? DEFAULT_EQ;
  const dynamicEq = instanceStates[defaultInstanceId('dynamicEq')] ?? DEFAULT_DYNAMIC_EQ;
  const mbc = instanceStates[defaultInstanceId('multiBandComp')] ?? DEFAULT_MULTIBAND_COMP;
  const saturation = instanceStates[defaultInstanceId('saturation')] ?? DEFAULT_SATURATION;
  const analogueDensity = instanceStates[defaultInstanceId('analogueDensity')] ?? DEFAULT_ANALOGUE_DENSITY;
  const clip = instanceStates[defaultInstanceId('clip')] ?? DEFAULT_CLIP;
  const tape = instanceStates[defaultInstanceId('tape')] ?? DEFAULT_TAPE;
  const stereoImager = instanceStates[defaultInstanceId('stereoImager')] ?? DEFAULT_STEREO_IMAGER;
  const mon8 = instanceStates[defaultInstanceId('mon8')] ?? DEFAULT_MON8;
  const dynamics = useMemo(() => ({
    compressor: instanceStates[defaultInstanceId('compressor')] ?? DEFAULT_DYNAMICS.compressor,
    limiter: instanceStates[defaultInstanceId('limiter')] ?? DEFAULT_DYNAMICS.limiter,
  }), [instanceStates]);
  const effects = useMemo(() => ({
    delay: instanceStates[defaultInstanceId('delay')] ?? DEFAULT_EFFECTS.delay,
    reverb: instanceStates[defaultInstanceId('reverb')] ?? DEFAULT_EFFECTS.reverb,
  }), [instanceStates]);
  const [bypass, setBypass] = useState(false);
  const [mono, setMono] = useState(false);
  // Mastering Effect macro knob (-100..+100). A non-destructive overlay that
  // scales the effective dry/wet MIX of every used module (except the limiter)
  // by (1 + value/100), clamped 0..1. Applied via the effect below.
  const [masterEffect, setMasterEffectState] = useState(0);
  // Tracks whether the Signal Utility oscillator is currently enabled, so the
  // always-on meters/visualizers stay awake (out of standby) while a test tone
  // is flowing through the chain — not just on Play / Mic.
  const [signalUtilityOn, setSignalUtilityOn] = useState(false);
  // Section Mastering config — registered by SectionMasteringPanel so the
  // offline Render bakes each section's assigned preset (with glide
  // crossfades) into the exported file instead of a single live snapshot.
  const [sectionMastering, setSectionMastering] = useState(null);
  const [inputGainL, setInputGainL] = useState(0);
  const [inputGainR, setInputGainR] = useState(0);
  const [outputGainL, setOutputGainL] = useState(0);
  const [outputGainR, setOutputGainR] = useState(0);
  const [linkLR, setLinkLR] = useState(true);
  const [layout, setLayout] = useState('wide');
  const [meterOrient, setMeterOrient] = useState('horizontal');
  const [meterPro, setMeterPro] = useState(false);
  const [meteringMode, setMeteringMode] = useState('dBFS');
  const [bpm, setBpm] = useState(120);

  // Send/return loop routing + the loop's own independent chain state.
  const [routingMode, setRoutingModeState] = useState('serial');
  // Which chain the editor carousel is editing: 'main' (serial) or 'loop'
  // (parallel / insert). Set by clicking a chain header in the signal path.
  const [target, setTarget] = useState('main');
  const [sendPosition, setSendPositionState] = useState(0);
  const [returnPosition, setReturnPositionState] = useState(DEFAULT_FX_ORDER.length);
  const [loopWet, setLoopWetState] = useState(0.25);
  // Loop chain state — multi-instance, mirroring the main chain. `loopInstances`
  // (keyed by instance id) is the source of truth; the per-type slices below are
  // DERIVED from the #1 instances so the existing loop handlers/panels keep
  // working. `loopFxOrder` holds instance ids.
  const seedLoopInstances = () => ({
    [defaultInstanceId('eq')]: LOOP_DEFAULT_EQ,
    [defaultInstanceId('dynamicEq')]: LOOP_DEFAULT_DYNAMIC_EQ,
    [defaultInstanceId('multiBandComp')]: LOOP_DEFAULT_MBC,
    [defaultInstanceId('delay')]: LOOP_DEFAULT_EFFECTS.delay,
    [defaultInstanceId('reverb')]: LOOP_DEFAULT_EFFECTS.reverb,
    [defaultInstanceId('compressor')]: LOOP_DEFAULT_DYNAMICS.compressor,
    [defaultInstanceId('limiter')]: LOOP_DEFAULT_DYNAMICS.limiter,
    [defaultInstanceId('saturation')]: LOOP_DEFAULT_SATURATION,
    [defaultInstanceId('analogueDensity')]: LOOP_DEFAULT_ANALOGUE_DENSITY,
    [defaultInstanceId('clip')]: LOOP_DEFAULT_CLIP,
    [defaultInstanceId('tape')]: LOOP_DEFAULT_TAPE,
    [defaultInstanceId('stereoImager')]: LOOP_DEFAULT_STEREO_IMAGER,
    [defaultInstanceId('mon8')]: LOOP_DEFAULT_MON8,
  });
  const [loopFxOrder, setLoopFxOrder] = useState(defaultInstanceOrder());
  const [loopInstances, setLoopInstances] = useState(seedLoopInstances);
  // Derived #1 views (backward-compat for loop handlers / panels).
  const loopEq = loopInstances[defaultInstanceId('eq')] ?? LOOP_DEFAULT_EQ;
  const loopDynamicEq = loopInstances[defaultInstanceId('dynamicEq')] ?? LOOP_DEFAULT_DYNAMIC_EQ;
  const loopMbc = loopInstances[defaultInstanceId('multiBandComp')] ?? LOOP_DEFAULT_MBC;
  const loopSaturation = loopInstances[defaultInstanceId('saturation')] ?? LOOP_DEFAULT_SATURATION;
  const loopAnalogueDensity = loopInstances[defaultInstanceId('analogueDensity')] ?? LOOP_DEFAULT_ANALOGUE_DENSITY;
  const loopClip = loopInstances[defaultInstanceId('clip')] ?? LOOP_DEFAULT_CLIP;
  const loopTape = loopInstances[defaultInstanceId('tape')] ?? LOOP_DEFAULT_TAPE;
  const loopStereoImager = loopInstances[defaultInstanceId('stereoImager')] ?? LOOP_DEFAULT_STEREO_IMAGER;
  const loopMon8 = loopInstances[defaultInstanceId('mon8')] ?? LOOP_DEFAULT_MON8;
  const loopDynamics = useMemo(() => ({
    compressor: loopInstances[defaultInstanceId('compressor')] ?? LOOP_DEFAULT_DYNAMICS.compressor,
    limiter: loopInstances[defaultInstanceId('limiter')] ?? LOOP_DEFAULT_DYNAMICS.limiter,
  }), [loopInstances]);
  const loopEffects = useMemo(() => ({
    delay: loopInstances[defaultInstanceId('delay')] ?? LOOP_DEFAULT_EFFECTS.delay,
    reverb: loopInstances[defaultInstanceId('reverb')] ?? LOOP_DEFAULT_EFFECTS.reverb,
  }), [loopInstances]);

  // Per-instance enabled map (keyed by instance id) — drives the main-chain
  // module boxes' on/off state and the "Only Used" carousel filter. Defined
  // early (before the handlers) so handler deps arrays can read it without a
  // temporal-dead-zone violation.
  const enabledMap = useMemo(() => {
    const m = {};
    for (const [id, st] of Object.entries(instanceStates)) m[id] = !!st?.enabled;
    return m;
  }, [instanceStates]);

  // Loop enabled map — keyed by instance id (mirrors the main chain), drives the
  // loop lane module boxes' on/off state.
  const loopEnabledMap = useMemo(() => {
    const m = {};
    for (const [id, st] of Object.entries(loopInstances)) m[id] = !!st?.enabled;
    return m;
  }, [loopInstances]);

  // "Used" membership — sticky per-instance flag for the "Only Used" view.
  // A module becomes "used" the instant it's enabled (or added) and STAYS used
  // when toggled off (bypass / A–B testing); it leaves "used" only when the
  // instance is removed (click-and-hold) or the chain is reset. This decouples
  // "in my chain" from "currently on" so bypassing no longer hides a module.
  const [usedMap, setUsedMap] = useState({});
  const [loopUsedMap, setLoopUsedMap] = useState({});
  useEffect(() => {
    setUsedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, st] of Object.entries(instanceStates)) {
        if (st?.enabled && !next[id]) { next[id] = true; changed = true; }
      }
      for (const id of Object.keys(next)) {
        if (!instanceStates[id]) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [instanceStates]);
  useEffect(() => {
    setLoopUsedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, st] of Object.entries(loopInstances)) {
        if (st?.enabled && !next[id]) { next[id] = true; changed = true; }
      }
      for (const id of Object.keys(next)) {
        if (!loopInstances[id]) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [loopInstances]);

  const nodes = useMemo(
    () =>
      ready && chainRef.current
        ? {
            compressor: chainRef.current.compressorNode,
            compressorMid: chainRef.current.compMid,
            compressorSide: chainRef.current.compSide,
            limiter: chainRef.current.limiterNode,
            // Limiter GR that respects the active (linked vs dual-mono) topology.
            limiterGR: () => chainRef.current?.getLimiterReduction?.() ?? 0,
          }
        : undefined,
    [ready]
  );
  const dynNodes = useMemo(
    () =>
      ready && chainRef.current
        ? {
            // Stereo (linked) tree — used when msMode is off.
            low: chainRef.current.dynLow.comp,
            mids: chainRef.current.dynMids.map((b) => b.comp),
            high: chainRef.current.dynHigh.comp,
            // Independent Mid / Side trees — used in M/S mode.
            mid: {
              low: chainRef.current.dynMidLow.comp,
              mids: chainRef.current.dynMidMids.map((b) => b.comp),
              high: chainRef.current.dynMidHigh.comp,
            },
            side: {
              low: chainRef.current.dynSideLow.comp,
              mids: chainRef.current.dynSideMids.map((b) => b.comp),
              high: chainRef.current.dynSideHigh.comp,
            },
          }
        : undefined,
    [ready]
  );

  const mbcNodes = useMemo(
    () =>
      ready && chainRef.current
        ? { mid: chainRef.current.mbcComp, side: chainRef.current.mbcSideComp }
        : undefined,
    [ready]
  );

  const levelEngine = useMemo(() => {
    let lBuf = null, rBuf = null, liBuf = null, riBuf = null;
    const ensure = (a, prev) => (prev && prev.length === a.fftSize ? prev : new Float32Array(a.fftSize));
    return {
      // Post-chain (OUT) — final master output level.
      getLevels: () => {
        const L = analyzersRef.current?.levelLeft, R = analyzersRef.current?.levelRight;
        if (!L || !R) return [-100, -100];
        lBuf = ensure(L, lBuf); rBuf = ensure(R, rBuf);
        L.getFloatTimeDomainData(lBuf); R.getFloatTimeDomainData(rBuf);
        return [peakDb(lBuf), peakDb(rBuf)];
      },
      getDetail: () => {
        const L = analyzersRef.current?.levelLeft, R = analyzersRef.current?.levelRight;
        if (!L || !R) return null;
        lBuf = ensure(L, lBuf); rBuf = ensure(R, rBuf);
        L.getFloatTimeDomainData(lBuf); R.getFloatTimeDomainData(rBuf);
        return { left: { peak: peakDb(lBuf), rms: rmsDb(lBuf) }, right: { peak: peakDb(rBuf), rms: rmsDb(rBuf) } };
      },
      // Pre-chain (IN) — source level before any effects, for gain-staging A/B.
      getLevelsIn: () => {
        const L = analyzersRef.current?.levelInLeft, R = analyzersRef.current?.levelInRight;
        if (!L || !R) return [-100, -100];
        liBuf = ensure(L, liBuf); riBuf = ensure(R, riBuf);
        L.getFloatTimeDomainData(liBuf); R.getFloatTimeDomainData(riBuf);
        return [peakDb(liBuf), peakDb(riBuf)];
      },
      getDetailIn: () => {
        const L = analyzersRef.current?.levelInLeft, R = analyzersRef.current?.levelInRight;
        if (!L || !R) return null;
        liBuf = ensure(L, liBuf); riBuf = ensure(R, riBuf);
        L.getFloatTimeDomainData(liBuf); R.getFloatTimeDomainData(riBuf);
        return { left: { peak: peakDb(liBuf), rms: rmsDb(liBuf) }, right: { peak: peakDb(riBuf), rms: rmsDb(riBuf) } };
      },
      // Parallel-loop input level — the signal entering the loop branch (send
      // tap) so the user can verify audio is reaching the parallel chain.
      getLoopLevels: () => {
        const L = analyzersRef.current?.loopInLeft, R = analyzersRef.current?.loopInRight;
        const OL = analyzersRef.current?.loopOutLeft, OR = analyzersRef.current?.loopOutRight;
        if (!L || !R) return [-100, -100, -100, -100];
        lBuf = ensure(L, lBuf); rBuf = ensure(R, rBuf);
        L.getFloatTimeDomainData(lBuf); R.getFloatTimeDomainData(rBuf);
        const inL = peakDb(lBuf), inR = peakDb(rBuf);
        let outL = -100, outR = -100;
        if (OL) { ensure(OL, lBuf); OL.getFloatTimeDomainData(lBuf); outL = peakDb(lBuf); }
        if (OR) { ensure(OR, rBuf); OR.getFloatTimeDomainData(rBuf); outR = peakDb(rBuf); }
        return [inL, inR, outL, outR];
      },
    };
  }, [ready]);

  const wireAnalyzers = useCallback(() => {
    const chain = chainRef.current;
    const ctx = ctxRef.current;
    if (!chain || !ctx) return;
    const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 2048; return a; };
    // High-resolution spectrum analyzer — 8192-point FFT (4096 bins ≈ 5.4 Hz/bin
    // at 44.1 kHz) so the low end has real bin resolution instead of one bin
    // stretched across the whole sub-100 Hz region. Level/scope analyzers stay
    // at 2048 to keep their time-domain windows short and responsive.
    const mkSpec = () => { const a = ctx.createAnalyser(); a.fftSize = 8192; return a; };
    if (!analyzersRef.current) {
      analyzersRef.current = {
        compressorInput: mk(), compressorOutput: mk(),
        limiterInput: mk(), limiterOutput: mk(),
        // Stereo (L/R) taps at the limiter input & output for the dual LED meters.
        limiterInSplitter: ctx.createChannelSplitter(2), limiterInLeft: mk(), limiterInRight: mk(),
        limiterOutSplitter: ctx.createChannelSplitter(2), limiterOutLeft: mk(), limiterOutRight: mk(),
        spectrum: mkSpec(), spectrumIn: mkSpec(),
        // Stereo imager output taps for the goniometer / vectorscope.
        imagerSplitter: ctx.createChannelSplitter(2), imagerLeft: mk(), imagerRight: mk(),
      };
    }
    const an = analyzersRef.current;
    // Backfill stereo limiter taps for analyzers objects created before the
    // dual-LED meter wiring existed (e.g. across a hot reload) — without this
    // the limiter panel's metering loop reads null analyser nodes.
    if (!an.limiterInSplitter) an.limiterInSplitter = ctx.createChannelSplitter(2);
    if (!an.limiterInLeft) an.limiterInLeft = mk();
    if (!an.limiterInRight) an.limiterInRight = mk();
    if (!an.limiterOutSplitter) an.limiterOutSplitter = ctx.createChannelSplitter(2);
    if (!an.limiterOutLeft) an.limiterOutLeft = mk();
    if (!an.limiterOutRight) an.limiterOutRight = mk();
    if (!an.imagerSplitter) an.imagerSplitter = ctx.createChannelSplitter(2);
    if (!an.imagerLeft) an.imagerLeft = mk();
    if (!an.imagerRight) an.imagerRight = mk();
    try { an.compressorInput.disconnect(); } catch {}
    try { an.compressorOutput.disconnect(); } catch {}
    try { an.limiterInput.disconnect(); } catch {}
    try { an.limiterOutput.disconnect(); } catch {}
    try { an.limiterInSplitter?.disconnect(); } catch {}
    try { an.limiterInLeft?.disconnect(); } catch {}
    try { an.limiterInRight?.disconnect(); } catch {}
    try { an.limiterOutSplitter?.disconnect(); } catch {}
    try { an.limiterOutLeft?.disconnect(); } catch {}
    try { an.limiterOutRight?.disconnect(); } catch {}
    try { an.spectrum.disconnect(); } catch {}
    try { an.spectrumIn.disconnect(); } catch {}
    try { an.levelSplitter?.disconnect(); } catch {}
    try { an.levelLeft?.disconnect(); } catch {}
    try { an.levelRight?.disconnect(); } catch {}
    chain.modules[FX_SLOT.compressor].input.connect(an.compressorInput);
    chain.modules[FX_SLOT.compressor].output.connect(an.compressorOutput);
    // The limiter's IN meter taps AFTER the input-gain drive (the module's
    // `input` node is pre-drive, so it wouldn't reflect the IN slider).
    const limIn = chain.modules[FX_SLOT.limiter].inputPost || chain.modules[FX_SLOT.limiter].input;
    limIn.connect(an.limiterInput);
    chain.modules[FX_SLOT.limiter].output.connect(an.limiterOutput);
    // Stereo L/R taps for the limiter's dual LED meters.
    limIn.connect(an.limiterInSplitter);
    an.limiterInSplitter.connect(an.limiterInLeft, 0);
    an.limiterInSplitter.connect(an.limiterInRight, 1);
    chain.modules[FX_SLOT.limiter].output.connect(an.limiterOutSplitter);
    an.limiterOutSplitter.connect(an.limiterOutLeft, 0);
    an.limiterOutSplitter.connect(an.limiterOutRight, 1);
    if (morphSumRef.current) morphSumRef.current.connect(an.spectrum); else chain.output.connect(an.spectrum);
    // Stereo imager output taps (guarded for HMR-stale chains without the module).
    if (chain.modules[FX_SLOT.stereoImager]) {
      try { an.imagerSplitter.disconnect(); } catch {}
      try { an.imagerLeft.disconnect(); } catch {}
      try { an.imagerRight.disconnect(); } catch {}
      chain.modules[FX_SLOT.stereoImager].output.connect(an.imagerSplitter);
      an.imagerSplitter.connect(an.imagerLeft, 0);
      an.imagerSplitter.connect(an.imagerRight, 1);
    }
    // Mon8 bass-goniometer taps — pre & post the module, low-passed to 500 Hz
    // so only the sub/bass band Mon8 acts on is plotted in the panel's two
    // goniometers. Reconnected here (after every reorder / bypass-off) like the
    // imager tap, since rebuildChain disconnects module outputs.
    if (chain.modules[FX_SLOT.mon8]) {
      if (!an.mon8InSplitter) {
        an.mon8InSplitter = ctx.createChannelSplitter(2);
        an.mon8InLPLeft = ctx.createBiquadFilter(); an.mon8InLPLeft.type = 'lowpass'; an.mon8InLPLeft.frequency.value = 500; an.mon8InLPLeft.Q.value = 0.7071;
        an.mon8InLPRight = ctx.createBiquadFilter(); an.mon8InLPRight.type = 'lowpass'; an.mon8InLPRight.frequency.value = 500; an.mon8InLPRight.Q.value = 0.7071;
        an.mon8InLeft = mk(); an.mon8InRight = mk();
        an.mon8OutSplitter = ctx.createChannelSplitter(2);
        an.mon8OutLPLeft = ctx.createBiquadFilter(); an.mon8OutLPLeft.type = 'lowpass'; an.mon8OutLPLeft.frequency.value = 500; an.mon8OutLPLeft.Q.value = 0.7071;
        an.mon8OutLPRight = ctx.createBiquadFilter(); an.mon8OutLPRight.type = 'lowpass'; an.mon8OutLPRight.frequency.value = 500; an.mon8OutLPRight.Q.value = 0.7071;
        an.mon8OutLeft = mk(); an.mon8OutRight = mk();
      }
      try { an.mon8InSplitter.disconnect(); } catch {}
      try { an.mon8InLPLeft.disconnect(); } catch {}
      try { an.mon8InLPRight.disconnect(); } catch {}
      try { an.mon8OutSplitter.disconnect(); } catch {}
      try { an.mon8OutLPLeft.disconnect(); } catch {}
      try { an.mon8OutLPRight.disconnect(); } catch {}
      chain.modules[FX_SLOT.mon8].input.connect(an.mon8InSplitter);
      an.mon8InSplitter.connect(an.mon8InLPLeft, 0); an.mon8InSplitter.connect(an.mon8InLPRight, 1);
      an.mon8InLPLeft.connect(an.mon8InLeft); an.mon8InLPRight.connect(an.mon8InRight);
      chain.modules[FX_SLOT.mon8].output.connect(an.mon8OutSplitter);
      an.mon8OutSplitter.connect(an.mon8OutLPLeft, 0); an.mon8OutSplitter.connect(an.mon8OutLPRight, 1);
      an.mon8OutLPLeft.connect(an.mon8OutLeft); an.mon8OutLPRight.connect(an.mon8OutRight);
    }
    if (!an.levelSplitter) an.levelSplitter = ctx.createChannelSplitter(2);
    if (!an.levelLeft) an.levelLeft = mk();
    if (!an.levelRight) an.levelRight = mk();
    if (masterGainRef.current) {
      masterGainRef.current.connect(an.levelSplitter);
      an.levelSplitter.connect(an.levelLeft, 0);
      an.levelSplitter.connect(an.levelRight, 1);
    }
    // Pre-chain (IN) level tap — reads the source before any processing.
    if (!an.levelInSplitter) an.levelInSplitter = ctx.createChannelSplitter(2);
    if (!an.levelInLeft) an.levelInLeft = mk();
    if (!an.levelInRight) an.levelInRight = mk();
    try { an.levelInSplitter.disconnect(); } catch {}
    chain.input.connect(an.levelInSplitter);
    an.levelInSplitter.connect(an.levelInLeft, 0);
    an.levelInSplitter.connect(an.levelInRight, 1);
    // Dry-source (pre-chain) spectrum tap — feeds the Final Output ghost trace.
    chain.input.connect(an.spectrumIn);
    // Parallel-loop input level tap (connected once — chain.loop.input is a
    // persistent node, so reconnecting on every wireAnalyzers call would
    // duplicate the connection and double the metered level).
    if (chain.loop && !an.loopInTap) {
      const tap = ctx.createGain();
      const sp = ctx.createChannelSplitter(2);
      an.loopInTap = tap; an.loopInSplitter = sp; an.loopInLeft = mk(); an.loopInRight = mk();
      an.loopSpectrum = mkSpec();
      chain.loop.input.connect(tap);
      tap.connect(sp);
      sp.connect(an.loopInLeft, 0);
      sp.connect(an.loopInRight, 1);
      chain.loop.input.connect(an.loopSpectrum);
    }
    // Parallel-loop OUTPUT level tap — reads the wet signal leaving the loop
    // (post loop-chain processing, pre return-sum) so the user can verify the
    // parallel branch is actually producing output. loopOutMonitor is a
    // persistent node; rebuildChain recreates only its incoming edge, so this
    // fan-out connection survives chain reorders.
    if (chain.loopOutMonitor && !an.loopOutTap) {
      const sp = ctx.createChannelSplitter(2);
      an.loopOutTap = sp; an.loopOutLeft = mk(); an.loopOutRight = mk();
      chain.loopOutMonitor.connect(sp);
      sp.connect(an.loopOutLeft, 0);
      sp.connect(an.loopOutRight, 1);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      // Prioritise audio stability over latency: a larger render quantum
      // (latencyHint 'playback') tolerates main-thread hiccups from the
      // visualizers' requestAnimationFrame loops without clicking, while the
      // audio render thread keeps full DSP accuracy. Visuals are decoupled
      // from the audio thread and never reduce processing precision.
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      // Load the per-character compressor worklet before building the chain so
      // the compressor slots can create AudioWorkletNodes synchronously. If it
      // fails (e.g. a build/serve issue) the CompressorNode factory falls back
      // to the stock DynamicsCompressorNode so the app still works.
      try {
        await ctx.audioWorklet.addModule(workletUrl);
        ctx.__characterCompressorReady = true;
      } catch (e) {
        console.warn('[SignalChain] character-compressor worklet failed to load — using stock DynamicsCompressor fallback', e);
      }
      try {
        await ctx.audioWorklet.addModule(delayXfadeUrl);
        ctx.__delayXfadeReady = true;
      } catch (e) {
        console.warn('[SignalChain] delay-xfade worklet failed to load — using native DelayNode fallback', e);
      }
      try {
        await ctx.audioWorklet.addModule(limiterDitherUrl);
        ctx.__limiterDitherReady = true;
      } catch (e) {
        console.warn('[SignalChain] limiter-dither worklet failed to load — using passthrough fallback', e);
      }
      try {
        await ctx.audioWorklet.addModule(limiterWorkletUrl);
        ctx.__limiterWorkletReady = true;
      } catch (e) {
        console.warn('[SignalChain] limiter core worklet failed to load — using native fallback', e);
      }
      try {
        await ctx.audioWorklet.addModule(signalUtilityUrl);
        ctx.__signalUtilityReady = true;
      } catch (e) {
        console.warn('[SignalChain] signal-utility worklet failed to load', e);
      }
      if (disposed) { try { ctx.close(); } catch {} return; }
      const chain = new SignalChain(ctx);
      const masterGain = ctx.createGain();
      masterGain.gain.value = volume;
    // Input trim — per-channel (L/R) gain stage between every source and the
    // chain input. An explicit stereo upmix node feeds a 2-way splitter so a
    // mono mic source is upmixed to L=R before the independent gains apply. The
    // IN meter taps chain.input, so it reads the trimmed level. When L/R are
    // linked both gains track one value; unlinked, L and R trim independently.
    const inputUpmix = ctx.createGain();
    inputUpmix.channelCount = 2;
    inputUpmix.channelCountMode = 'explicit';
    inputUpmix.channelInterpretation = 'speakers';
    const inputSplitter = ctx.createChannelSplitter(2);
    const inputGL = ctx.createGain(); inputGL.gain.value = 1;
    const inputGR = ctx.createGain(); inputGR.gain.value = 1;
    const inputMerger = ctx.createChannelMerger(2);
    inputUpmix.connect(inputSplitter);
    inputSplitter.connect(inputGL, 0);
    inputSplitter.connect(inputGR, 1);
    inputGL.connect(inputMerger, 0, 0);
    inputGR.connect(inputMerger, 0, 1);
    inputMerger.connect(chain.input);
    // Output trim — per-channel (L/R) gain stage between the mono sum and the
    // monitor volume. Same splitter/merger topology; the OUT meter taps
    // masterGain, so it reads the trimmed output.
    const outputUpmix = ctx.createGain();
    outputUpmix.channelCount = 2;
    outputUpmix.channelCountMode = 'explicit';
    outputUpmix.channelInterpretation = 'speakers';
    const outputSplitter = ctx.createChannelSplitter(2);
    const outputGL = ctx.createGain(); outputGL.gain.value = 1;
    const outputGR = ctx.createGain(); outputGR.gain.value = 1;
    const outputMerger = ctx.createChannelMerger(2);
    outputUpmix.connect(outputSplitter);
    outputSplitter.connect(outputGL, 0);
    outputSplitter.connect(outputGR, 1);
    outputGL.connect(outputMerger, 0, 0);
    outputGR.connect(outputMerger, 0, 1);
    outputMerger.connect(masterGain);
    // Mono sum node — channelCount=1 / explicit downmixes L+R to mono; set back
    // to 2 / max for transparent stereo passthrough. Toggled at runtime.
    const monoNode = ctx.createGain();
    monoNode.gain.value = 1;
    monoNode.channelCount = 2;
    monoNode.channelCountMode = 'max';
    // ── Dual-chain morph crossfade (Section Mastering preset transitions) ──
    // A second independent SignalChain runs in parallel; two equal-power
    // crossfade gains blend the outgoing (primary chain) and incoming (morph
    // chain) preset outputs into a single sum. Both chains share the identical
    // node topology → identical latency → the sum is comb-free. At rest
    // morphGainA = 1 / morphGainB = 0, so the primary chain is the sole audible
    // path (and remains the editor / meter / analyzer target); the morph chain
    // is silent until a preset transition ramps its gain in.
    const morphChain = new SignalChain(ctx, false);
    const morphGainA = ctx.createGain(); morphGainA.gain.value = 1;
    const morphGainB = ctx.createGain(); morphGainB.gain.value = 0;
    const morphSum = ctx.createGain();
    inputMerger.connect(morphChain.input);
    chain.output.connect(morphGainA); morphGainA.connect(morphSum);
    morphChain.output.connect(morphGainB); morphGainB.connect(morphSum);
    morphSum.connect(monoNode);
    morphChain.updateEQ(DEFAULT_EQ);
    morphChain.updateEffects(DEFAULT_EFFECTS, 120);
    morphChain.updateDynamics(DEFAULT_DYNAMICS);
    morphChain.updateSaturation(DEFAULT_SATURATION);
    morphChain.updateAnalogueDensity(DEFAULT_ANALOGUE_DENSITY);
    morphChain.updateClip(DEFAULT_CLIP);
    morphChain.updateTape(DEFAULT_TAPE);
    morphChain.updateStereoImager(DEFAULT_STEREO_IMAGER);
    morphChain.updateMon8(DEFAULT_MON8);
    morphChain.updateDynamicEQ(DEFAULT_DYNAMIC_EQ);
    morphChain.updateMultiBandComp(DEFAULT_MULTIBAND_COMP);
    // At rest the morph chain is BYPASSED. It is a full second copy of every
    // effect (built for zero-latency section-mastering crossfades); running it
    // continuously doubles the audio-thread load (reverb/MBC/EQ + worklets) and
    // causes dropouts whenever the main chain is active. It is engaged only for
    // the duration of an actual preset transition (prepareMorphChain →
    // rampMorphToChain), then bypassed again.
    morphChain.setBypass(true);
    morphChainRef.current = morphChain;
    morphGainARef.current = morphGainA;
    morphGainBRef.current = morphGainB;
    morphSumRef.current = morphSum;
    monoNode.connect(outputUpmix);
    masterGain.connect(ctx.destination);
    ctxRef.current = ctx;
    chainRef.current = chain;
    masterGainRef.current = masterGain;
    monoRef.current = monoNode;
    inputGainLRef.current = inputGL;
    inputGainRRef.current = inputGR;
    outputGainLRef.current = outputGL;
    outputGainRRef.current = outputGR;
    inputUpmixRef.current = inputUpmix;

    const _su = createSignalUtility(ctx, inputUpmix);
    if (_su) {
      const _origUpdate = _su.update;
      _su.update = (next) => {
        _origUpdate(next);
        if (next && typeof next.enabled === 'boolean') setSignalUtilityOn(next.enabled);
      };
    }
    signalUtilityRef.current = _su;

    const audioEl = new Audio();
    audioEl.crossOrigin = 'anonymous';
    audioEl.loop = true;
    audioElRef.current = audioEl;
    mediaElSourceRef.current = ctx.createMediaElementSource(audioEl);
    mediaElSourceRef.current.connect(inputUpmix);

    wireAnalyzers();
    chain.updateEQ(DEFAULT_EQ);
    chain.updateEffects(DEFAULT_EFFECTS, 120);
    chain.updateDynamics(DEFAULT_DYNAMICS);
    chain.updateSaturation(DEFAULT_SATURATION);
    chain.updateAnalogueDensity(DEFAULT_ANALOGUE_DENSITY);
    chain.updateClip(DEFAULT_CLIP);
    chain.updateTape(DEFAULT_TAPE);
    chain.updateStereoImager(DEFAULT_STEREO_IMAGER);
    chain.updateMon8(DEFAULT_MON8);
    chain.updateDynamicEQ(DEFAULT_DYNAMIC_EQ);
    chain.updateMultiBandComp(DEFAULT_MULTIBAND_COMP);
    // Initialise the parallel loop chain with the same defaults.
    if (chain.loop) {
      chain.loop.updateEQ(LOOP_DEFAULT_EQ);
      chain.loop.updateEffects(LOOP_DEFAULT_EFFECTS, 120);
      chain.loop.updateDynamics(LOOP_DEFAULT_DYNAMICS);
      chain.loop.updateSaturation(LOOP_DEFAULT_SATURATION);
      chain.loop.updateClip(LOOP_DEFAULT_CLIP);
      chain.loop.updateTape(LOOP_DEFAULT_TAPE);
      chain.loop.updateStereoImager(LOOP_DEFAULT_STEREO_IMAGER);
      chain.loop.updateMon8(LOOP_DEFAULT_MON8);
      chain.loop.updateDynamicEQ(LOOP_DEFAULT_DYNAMIC_EQ);
      chain.loop.updateMultiBandComp(LOOP_DEFAULT_MBC);
    }
      setReady(true);
    })();
    return () => { disposed = true; if (morphBypassTimerRef.current) clearTimeout(morphBypassTimerRef.current); analyzersRef.current = null; try { signalUtilityRef.current?.dispose?.(); } catch {} try { morphChainRef.current?.dispose?.(); } catch {} try { chainRef.current?.dispose?.(); } catch {} try { ctxRef.current?.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-type handlers — delegate to instanceStates (the #1 instance) for the
  // derived slices, and drive the #1 module via the chain's typed update
  // methods (which resolve to modules['<type>#1'] through the instance alias).
  const handleEQChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('eq')]: next })); chainRef.current?.updateEQ(next); }, []);
  const handleEffectsChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('delay')]: next.delay, [defaultInstanceId('reverb')]: next.reverb })); chainRef.current?.updateEffects(next, 120); }, []);
  const handleDynamicsChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('compressor')]: next.compressor, [defaultInstanceId('limiter')]: next.limiter })); chainRef.current?.updateDynamics(next); }, []);
  const handleSaturationChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('saturation')]: next })); chainRef.current?.updateSaturation(next); }, []);
  const handleAnalogueDensityChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('analogueDensity')]: next })); chainRef.current?.updateAnalogueDensity(next); }, []);
  const handleClipChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('clip')]: next })); chainRef.current?.updateClip(next); }, []);
  const handleTapeChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('tape')]: next })); chainRef.current?.updateTape(next); }, []);
  const handleStereoImagerChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('stereoImager')]: next })); chainRef.current?.updateStereoImager(imagerDspState(next)); }, []);
  const handleMon8Change = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('mon8')]: next })); chainRef.current?.updateMon8(next); }, []);
  const handleDynamicEQChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('dynamicEq')]: next })); chainRef.current?.updateDynamicEQ(next); }, []);
  const handleMbcChange = useCallback((next) => { setInstanceStates((s) => ({ ...s, [defaultInstanceId('multiBandComp')]: next })); chainRef.current?.updateMultiBandComp(next); }, []);

  // ── Instance-level handlers (multi-instance chain) ──────────────────────
  // handleInstanceUpdate edits one instance's state and drives that instance's
  // module update() directly (per-instance factory). delay needs the current
  // BPM; stereoImager needs the window→width mapping. Used by the carousel
  // inspector for every instance (#1 included).
  const handleInstanceUpdate = useCallback((id, next) => {
    if (!id) return;
    setInstanceStates((s) => ({ ...s, [id]: next }));
    const type = instanceType(id);
    const applyTo = (mod) => {
      if (!mod?.update) return;
      if (type === 'delay') mod.update(next, bpm);
      else if (type === 'stereoImager') mod.update(imagerDspState(next));
      else mod.update(next);
    };
    if (chainRef.current?.modules?.[id]) applyTo(chainRef.current.modules[id]);
    if (morphChainRef.current?.modules?.[id]) applyTo(morphChainRef.current.modules[id]);
  }, [bpm]);
  const handleInstanceToggle = useCallback((id) => {
    const cur = instanceStates[id];
    if (!cur) return;
    handleInstanceUpdate(id, { ...cur, enabled: !cur.enabled });
  }, [instanceStates, handleInstanceUpdate]);
  const handleAddInstance = useCallback((type) => {
    const chain = chainRef.current;
    if (!chain || !FX_SLOT[type]) return null;
    const id = chain.addInstance(type);
    if (!id) return null;
    let seed;
    switch (type) {
      case 'eq': seed = DEFAULT_EQ; break;
      case 'dynamicEq': seed = DEFAULT_DYNAMIC_EQ; break;
      case 'multiBandComp': seed = DEFAULT_MULTIBAND_COMP; break;
      case 'compressor': seed = DEFAULT_DYNAMICS.compressor; break;
      case 'limiter': seed = DEFAULT_DYNAMICS.limiter; break;
      case 'delay': seed = DEFAULT_EFFECTS.delay; break;
      case 'reverb': seed = DEFAULT_EFFECTS.reverb; break;
      case 'saturation': seed = DEFAULT_SATURATION; break;
      case 'analogueDensity': seed = DEFAULT_ANALOGUE_DENSITY; break;
      case 'clip': seed = DEFAULT_CLIP; break;
      case 'tape': seed = DEFAULT_TAPE; break;
      case 'stereoImager': seed = DEFAULT_STEREO_IMAGER; break;
      case 'mon8': seed = DEFAULT_MON8; break;
      default: seed = { enabled: false };
    }
    // Spawn enabled so the new instance is immediately visible in the chain
    // and active in the carousel (a disabled spawn would be invisible in
    // "Only Used" mode and silent in the audio path).
    seed = { ...seed, enabled: true };
    setInstanceStates((s) => ({ ...s, [id]: seed }));
    // Apply the seed to the new module so its DSP matches the stored state.
    const mod = chain.modules[id];
    if (mod?.update) {
      if (type === 'delay') mod.update(seed, bpm);
      else if (type === 'stereoImager') mod.update(imagerDspState(seed));
      else mod.update(seed);
    }
    const next = normalizeInstanceOrder([...fxOrder, id]);
    chain.setInstanceOrder(next);
    const mc = morphChainRef.current;
    if (mc) { const mcInst = mc.instances; mc.setInstanceOrder(mcInst ? next.filter((id) => mcInst[id]) : next); }
    wireAnalyzers();
    setFxOrder(next);
    return id;
  }, [fxOrder, bpm, wireAnalyzers]);
  const handleRemoveInstance = useCallback((id) => {
    if (!id || id.endsWith('#1')) return; // keep the default instances
    const chain = chainRef.current;
    chain?.removeInstance(id);
    setInstanceStates((s) => { const n = { ...s }; delete n[id]; return n; });
    const next = fxOrder.filter((x) => x !== id);
    chain?.setInstanceOrder(next);
    const mc = morphChainRef.current;
    if (mc) { const mcInst = mc.instances; mc.setInstanceOrder(mcInst ? next.filter((id) => mcInst[id]) : next); }
    wireAnalyzers();
    setFxOrder(next);
  }, [fxOrder, wireAnalyzers]);
  // Section-mastering glide: apply a blended recipe DIRECTLY to the chain (no
  // React setState) so the 60 fps glide loop doesn't re-render the UI. The MBC
  // crossfade weight is applied via setMbcCrossfade.
  const applyGlideBlend = useCallback((blend) => {
    const chain = chainRef.current;
    if (!chain || !blend) return;
    try { if (blend.eq) chain.updateEQ(blend.eq); } catch {}
    try { if (blend.dynamics) chain.updateDynamics(blend.dynamics); } catch {}
    try { if (blend.tape) chain.updateTape(blend.tape); } catch {}
    try { if (blend.saturation) chain.updateSaturation(blend.saturation); } catch {}
    try { if (blend.mbc) chain.updateMultiBandComp(blend.mbc); } catch {}
    try { if (typeof blend.mbcWeight === 'number') chain.setMbcCrossfade(blend.mbcWeight, blend.mbcMakeup ?? 1, !!blend.mbcMs, true); } catch {}
  }, []);
  const setMbcCrossfade = useCallback((weight, gm, ms, instant) => { chainRef.current?.setMbcCrossfade(weight, gm, ms, instant); }, []);

  // ── Dual-chain morph (Section Mastering preset crossfade) ──
  // prepareMorphChain: load an incoming preset onto the silent morph chain
  // (audio-only — no React state churn) so its filters / envelope followers
  // have settled by the time the crossfade reaches it. The morph chain's FX
  // order, bypass and limiter lookahead are matched to the primary chain so
  // the two share identical latency (zero relative delay → comb-free sum), and
  // the user's creative delay/reverb are mirrored so both chains carry them
  // identically through the transition.
  const prepareMorphChain = useCallback((recipe) => {
    const mc = morphChainRef.current; const ctx = ctxRef.current; const ch = chainRef.current;
    if (!mc || !ctx || !ch) return;
    // Cancel any pending rest-bypass so a new transition can't be silenced mid-glide.
    if (morphBypassTimerRef.current) { clearTimeout(morphBypassTimerRef.current); morphBypassTimerRef.current = null; }
    applyRecipeToChain(mc, recipe);
    try { mc.updateEffects(effects, bpm); } catch {}
    try { mc.setFxOrder(ch.getFxOrder()); } catch {}
    try { mc.setBypass(false); } catch {} // engage the morph chain for this transition only
    try { mc.limLookahead.delayTime.setValueAtTime(ch.limLookahead.delayTime.value, ctx.currentTime); } catch {}
  }, [effects, bpm]);
  // setMorphT: equal-power crossfade position t (0 = outgoing / primary chain,
  // 1 = incoming / morph chain), driven by the triangle-handle glide position.
  // Gains are smoothed per-sample via setTargetAtTime (one-pole, ~6 ms) → the
  // crossfade is click / zipper-free even though the target updates once per
  // animation frame. Equal-power (cos² + sin² = 1) holds the total power
  // constant, so two differently-processed versions of the same source sum
  // with no level dip and no comb filtering (identical latency ⇒ no phase
  // offset).
  const setMorphT = useCallback((t) => {
    const ctx = ctxRef.current; if (!ctx) return;
    const v = Math.max(0, Math.min(1, t));
    const gA = Math.cos(v * Math.PI * 0.5);
    const gB = Math.sin(v * Math.PI * 0.5);
    morphGainARef.current.gain.setTargetAtTime(gA, ctx.currentTime, 0.006);
    morphGainBRef.current.gain.setTargetAtTime(gB, ctx.currentTime, 0.006);
  }, []);
  // rampMorphToChain: promote the incoming chain to primary. Called AFTER the
  // panel has copied the incoming preset onto the primary chain (whose gain is
  // ~0 at the end of the glide, so the parameter switch is inaudible). Ramps
  // the crossfade back to the primary chain over ~30 ms; both chains hold the
  // incoming preset during the ramp ⇒ zero discontinuity, and the primary
  // chain (editor / meter target) ends up holding the current preset.
  const rampMorphToChain = useCallback(() => {
    const ctx = ctxRef.current; if (!ctx) return;
    morphGainARef.current.gain.setTargetAtTime(1, ctx.currentTime, 0.008);
    morphGainBRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.008);
    // Once the crossfade back to the primary chain has completed (~40 ms), bypass
    // the morph chain again so it stops processing at rest.
    if (morphBypassTimerRef.current) clearTimeout(morphBypassTimerRef.current);
    morphBypassTimerRef.current = setTimeout(() => { try { morphChainRef.current?.setBypass(true); } catch {} morphBypassTimerRef.current = null; }, 60);
  }, []);
  const handleFxOrderChange = useCallback((next) => {
    // Normalise bare types → "#1" instance ids, then drop any id whose module
    // doesn't exist (e.g. a stale #2 id from an old preset) so rebuildChain
    // never wires a missing module.
    const norm = (Array.isArray(next) ? next : []).map((x) => (isInstanceId(x) ? x : defaultInstanceId(instanceType(x))));
    const inst = chainRef.current?.instances;
    const safe = inst ? norm.filter((id) => inst[id]) : norm;
    setFxOrder(safe);
    chainRef.current?.setFxOrder(safe);
    // The morph chain only owns the #1 instances, so strip any #2 ids it has no
    // module for before rewiring (else rebuildChain would wire a missing module).
    const mc = morphChainRef.current;
    if (mc) { const mcInst = mc.instances; mc.setFxOrder(mcInst ? safe.filter((id) => mcInst[id]) : safe); }
    wireAnalyzers();
  }, [wireAnalyzers]);

  // Parallel / Insert routing was removed — the chain is serial-only now. These
  // handlers are kept as no-ops so captured snapshots that reference them still
  // restore without crashing.
  const handleRoutingModeChange = useCallback(() => {}, []);
  const handleSendPositionChange = useCallback((p) => { setSendPositionState(p); }, []);
  const handleReturnPositionChange = useCallback((p) => { setReturnPositionState(p); }, []);
  const handleLoopWetChange = useCallback((w) => { setLoopWetState(w); }, []);
  const handleLoopFxOrderChange = useCallback((next) => { setLoopFxOrder(next); chainRef.current?.loop?.setFxOrder(next); }, []);
  const handleLoopEQChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('eq')]: next })); chainRef.current?.loop?.updateEQ(next); }, []);
  const handleLoopEffectsChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('delay')]: next.delay, [defaultInstanceId('reverb')]: next.reverb })); chainRef.current?.loop?.updateEffects(next, 120); }, []);
  const handleLoopDynamicsChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('compressor')]: next.compressor, [defaultInstanceId('limiter')]: next.limiter })); chainRef.current?.loop?.updateDynamics(next); }, []);
  const handleLoopSaturationChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('saturation')]: next })); chainRef.current?.loop?.updateSaturation(next); }, []);
  const handleLoopAnalogueDensityChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('analogueDensity')]: next })); chainRef.current?.loop?.updateAnalogueDensity(next); }, []);
  const handleLoopClipChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('clip')]: next })); chainRef.current?.loop?.updateClip(next); }, []);
  const handleLoopTapeChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('tape')]: next })); chainRef.current?.loop?.updateTape(next); }, []);
  const handleLoopStereoImagerChange = useCallback((next) => {
    setLoopInstances((s) => ({ ...s, [defaultInstanceId('stereoImager')]: next }));
    const lo = next.spreadLo ?? -1;
    const hi = next.width ?? 1;
    const w = Math.max(0, Math.min(3, (hi - lo) / 2));
    const direction = Math.max(-180, Math.min(180, next.direction ?? 0));
    chainRef.current?.loop?.updateStereoImager({ ...next, width: w, spreadLo: w, direction });
  }, []);
  const handleLoopMon8Change = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('mon8')]: next })); chainRef.current?.loop?.updateMon8(next); }, []);
  const handleLoopDynamicEQChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('dynamicEq')]: next })); chainRef.current?.loop?.updateDynamicEQ(next); }, []);
  const handleLoopMbcChange = useCallback((next) => { setLoopInstances((s) => ({ ...s, [defaultInstanceId('multiBandComp')]: next })); chainRef.current?.loop?.updateMultiBandComp(next); }, []);

  // ── Loop instance-level handlers (multi-instance loop chain) ──────────
  // Mirror the main-chain instance handlers but drive chain.loop's own module
  // instances. delay needs the current BPM; stereoImager needs the window→width
  // mapping. Used by the carousel inspector + signal-path loop lane for every
  // loop instance (#1 included).
  const handleLoopInstanceUpdate = useCallback((id, next) => {
    if (!id) return;
    setLoopInstances((s) => ({ ...s, [id]: next }));
    const type = instanceType(id);
    const mod = chainRef.current?.loop?.modules?.[id];
    if (!mod?.update) return;
    if (type === 'delay') mod.update(next, bpm);
    else if (type === 'stereoImager') mod.update(imagerDspState(next));
    else mod.update(next);
  }, [bpm]);
  const handleLoopInstanceToggle = useCallback((id) => {
    const cur = loopInstances[id];
    if (!cur) return;
    handleLoopInstanceUpdate(id, { ...cur, enabled: !cur.enabled });
  }, [loopInstances, handleLoopInstanceUpdate]);
  const handleLoopAddInstance = useCallback((type) => {
    const loop = chainRef.current?.loop;
    if (!loop || !FX_SLOT[type]) return null;
    const id = loop.addInstance(type);
    if (!id) return null;
    let seed;
    switch (type) {
      case 'eq': seed = LOOP_DEFAULT_EQ; break;
      case 'dynamicEq': seed = LOOP_DEFAULT_DYNAMIC_EQ; break;
      case 'multiBandComp': seed = LOOP_DEFAULT_MBC; break;
      case 'compressor': seed = LOOP_DEFAULT_DYNAMICS.compressor; break;
      case 'limiter': seed = LOOP_DEFAULT_DYNAMICS.limiter; break;
      case 'delay': seed = LOOP_DEFAULT_EFFECTS.delay; break;
      case 'reverb': seed = LOOP_DEFAULT_EFFECTS.reverb; break;
      case 'saturation': seed = LOOP_DEFAULT_SATURATION; break;
      case 'analogueDensity': seed = LOOP_DEFAULT_ANALOGUE_DENSITY; break;
      case 'clip': seed = LOOP_DEFAULT_CLIP; break;
      case 'tape': seed = LOOP_DEFAULT_TAPE; break;
      case 'stereoImager': seed = LOOP_DEFAULT_STEREO_IMAGER; break;
      case 'mon8': seed = LOOP_DEFAULT_MON8; break;
      default: seed = { enabled: false };
    }
    // Spawn enabled so the new loop instance is immediately visible + active.
    seed = { ...seed, enabled: true };
    setLoopInstances((s) => ({ ...s, [id]: seed }));
    const mod = loop.modules[id];
    if (mod?.update) {
      if (type === 'delay') mod.update(seed, bpm);
      else if (type === 'stereoImager') mod.update(imagerDspState(seed));
      else mod.update(seed);
    }
    const next = normalizeInstanceOrder([...loopFxOrder, id]);
    loop.setInstanceOrder(next);
    setLoopFxOrder(next);
    return id;
  }, [loopFxOrder, bpm]);
  const handleLoopRemoveInstance = useCallback((id) => {
    if (!id || id.endsWith('#1')) return; // keep the default loop instances
    const loop = chainRef.current?.loop;
    loop?.removeInstance(id);
    setLoopInstances((s) => { const n = { ...s }; delete n[id]; return n; });
    const next = loopFxOrder.filter((x) => x !== id);
    loop?.setInstanceOrder(next);
    setLoopFxOrder(next);
  }, [loopFxOrder]);

  // Synced-note durations (1/16 … 1/4.) expressed in beats.
  const NOTE_DURATIONS = [0.25, 0.375, 0.5, 0.75, 1, 1.5];
  const handleBpmChange = useCallback((nextBpm) => {
    const v = Math.max(20, Math.min(300, Math.round(nextBpm || 120)));
    setBpm(v);
    const beat = 60 / v;
    const recompute = (eff) => {
      if (eff?.delay && eff.delay.syncNote != null && NOTE_DURATIONS[eff.delay.syncNote] != null) {
        return { ...eff, delay: { ...eff.delay, time: beat * NOTE_DURATIONS[eff.delay.syncNote] } };
      }
      return eff;
    };
    const ne = recompute(effects); if (ne !== effects) setInstanceStates((s) => ({ ...s, [defaultInstanceId('delay')]: ne.delay })); chainRef.current?.updateEffects(ne, v);
    const nle = recompute(loopEffects); if (nle !== loopEffects) setLoopInstances((s) => ({ ...s, [defaultInstanceId('delay')]: nle.delay })); chainRef.current?.loop?.updateEffects(nle, v);
  }, [effects, loopEffects]);

  const handleBypassToggle = useCallback(() => {
    setBypass((prev) => {
      const next = !prev;
      chainRef.current?.setBypass(next);
      // Bypass ON: also silence the morph chain. Bypass OFF: do NOT auto-engage
      // the morph chain — it stays at rest (bypassed) and only wakes for an
      // actual section-mastering transition (prepareMorphChain). Mirroring the
      // main bypass here was what made the morph chain run full-time and starve
      // the audio thread whenever effects were in the path.
      if (next) {
        if (morphBypassTimerRef.current) { clearTimeout(morphBypassTimerRef.current); morphBypassTimerRef.current = null; }
        morphChainRef.current?.setBypass(true);
      }
      if (!next) wireAnalyzers();
      return next;
    });
  }, [wireAnalyzers]);

  const handleMonoToggle = useCallback(() => {
    setMono((prev) => {
      const next = !prev;
      const node = monoRef.current;
      if (node) {
        if (next) { node.channelCount = 1; node.channelCountMode = 'explicit'; }
        else { node.channelCount = 2; node.channelCountMode = 'max'; }
      }
      return next;
    });
  }, []);

  // Main-chain toggle — slots are instance ids. Falls back to the per-type
  // switch only for a bare type (legacy / loop).
  const handleToggle = useCallback((slot) => {
    if (isInstanceId(slot)) { handleInstanceToggle(slot); return; }
    switch (slot) {
      case FX_SLOT.compressor: handleDynamicsChange({ ...dynamics, compressor: { ...dynamics.compressor, enabled: !dynamics.compressor.enabled } }); break;
      case FX_SLOT.limiter: handleDynamicsChange({ ...dynamics, limiter: { ...dynamics.limiter, enabled: !dynamics.limiter.enabled } }); break;
      case FX_SLOT.saturation: handleSaturationChange({ ...saturation, enabled: !saturation.enabled }); break;
      case FX_SLOT.analogueDensity: handleAnalogueDensityChange({ ...analogueDensity, enabled: !analogueDensity.enabled }); break;
      case FX_SLOT.clip: handleClipChange({ ...clip, enabled: !clip.enabled }); break;
      case FX_SLOT.tape: handleTapeChange({ ...tape, enabled: !tape.enabled }); break;
      case FX_SLOT.delay: handleEffectsChange({ ...effects, delay: { ...effects.delay, enabled: !effects.delay.enabled } }); break;
      case FX_SLOT.reverb: handleEffectsChange({ ...effects, reverb: { ...effects.reverb, enabled: !effects.reverb.enabled } }); break;
      case FX_SLOT.eq: handleEQChange({ ...eq, enabled: !eq.enabled }); break;
      case FX_SLOT.dynamicEq: handleDynamicEQChange({ ...dynamicEq, enabled: !dynamicEq.enabled }); break;
      case FX_SLOT.multiBandComp: handleMbcChange({ ...mbc, enabled: !mbc.enabled }); break;
      case FX_SLOT.stereoImager: handleStereoImagerChange({ ...stereoImager, enabled: !stereoImager.enabled }); break;
      case FX_SLOT.mon8: handleMon8Change({ ...mon8, enabled: !mon8.enabled }); break;
      default: break;
    }
  }, [dynamics, saturation, analogueDensity, clip, tape, effects, eq, dynamicEq, mbc, mon8, handleInstanceToggle, handleDynamicsChange, handleSaturationChange, handleAnalogueDensityChange, handleClipChange, handleTapeChange, handleEffectsChange, handleEQChange, handleDynamicEQChange, handleMbcChange, handleMon8Change]);

  const handleLoopToggle = useCallback((slot) => {
    switch (slot) {
      case FX_SLOT.compressor: handleLoopDynamicsChange({ ...loopDynamics, compressor: { ...loopDynamics.compressor, enabled: !loopDynamics.compressor.enabled } }); break;
      case FX_SLOT.limiter: handleLoopDynamicsChange({ ...loopDynamics, limiter: { ...loopDynamics.limiter, enabled: !loopDynamics.limiter.enabled } }); break;
      case FX_SLOT.saturation: handleLoopSaturationChange({ ...loopSaturation, enabled: !loopSaturation.enabled }); break;
      case FX_SLOT.analogueDensity: handleLoopAnalogueDensityChange({ ...loopAnalogueDensity, enabled: !loopAnalogueDensity.enabled }); break;
      case FX_SLOT.clip: handleLoopClipChange({ ...loopClip, enabled: !loopClip.enabled }); break;
      case FX_SLOT.tape: handleLoopTapeChange({ ...loopTape, enabled: !loopTape.enabled }); break;
      case FX_SLOT.delay: handleLoopEffectsChange({ ...loopEffects, delay: { ...loopEffects.delay, enabled: !loopEffects.delay.enabled } }); break;
      case FX_SLOT.reverb: handleLoopEffectsChange({ ...loopEffects, reverb: { ...loopEffects.reverb, enabled: !loopEffects.reverb.enabled } }); break;
      case FX_SLOT.eq: handleLoopEQChange({ ...loopEq, enabled: !loopEq.enabled }); break;
      case FX_SLOT.dynamicEq: handleLoopDynamicEQChange({ ...loopDynamicEq, enabled: !loopDynamicEq.enabled }); break;
      case FX_SLOT.multiBandComp: handleLoopMbcChange({ ...loopMbc, enabled: !loopMbc.enabled }); break;
      case FX_SLOT.stereoImager: handleLoopStereoImagerChange({ ...loopStereoImager, enabled: !loopStereoImager.enabled }); break;
      case FX_SLOT.mon8: handleLoopMon8Change({ ...loopMon8, enabled: !loopMon8.enabled }); break;
      default: break;
    }
  }, [loopDynamics, loopSaturation, loopAnalogueDensity, loopClip, loopTape, loopEffects, loopEq, loopDynamicEq, loopMbc, loopMon8, handleLoopDynamicsChange, handleLoopSaturationChange, handleLoopAnalogueDensityChange, handleLoopClipChange, handleLoopTapeChange, handleLoopEffectsChange, handleLoopEQChange, handleLoopDynamicEQChange, handleLoopMbcChange, handleLoopMon8Change]);

  const handleReset = useCallback(() => {
    // Tear down any non-default instances, then re-seed the instance state map
    // and reset the #1 modules to their defaults.
    const chain = chainRef.current;
    if (chain) {
      for (const id of Object.keys(chain.instances)) {
        if (!id.endsWith('#1')) { try { chain.removeInstance(id); } catch {} }
      }
    }
    setInstanceStates(seedInstances());
    chainRef.current?.updateEQ(DEFAULT_EQ);
    chainRef.current?.updateEffects(DEFAULT_EFFECTS, 120);
    chainRef.current?.updateDynamics(DEFAULT_DYNAMICS);
    chainRef.current?.updateSaturation(DEFAULT_SATURATION);
    chainRef.current?.updateAnalogueDensity(DEFAULT_ANALOGUE_DENSITY);
    chainRef.current?.updateClip(DEFAULT_CLIP);
    chainRef.current?.updateTape(DEFAULT_TAPE);
    chainRef.current?.updateStereoImager(DEFAULT_STEREO_IMAGER);
    chainRef.current?.updateMon8(DEFAULT_MON8);
    chainRef.current?.updateDynamicEQ(DEFAULT_DYNAMIC_EQ);
    chainRef.current?.updateMultiBandComp(DEFAULT_MULTIBAND_COMP);
    setFxOrder(defaultInstanceOrder()); chainRef.current?.setInstanceOrder(defaultInstanceOrder()); morphChainRef.current?.setInstanceOrder(defaultInstanceOrder());
    setBpm(120);
    setInputGainL(0); setInputGainR(0); setOutputGainL(0); setOutputGainR(0); setLinkLR(true);
    setBypass(false); chainRef.current?.setBypass(false);
    if (morphBypassTimerRef.current) { clearTimeout(morphBypassTimerRef.current); morphBypassTimerRef.current = null; }
    morphChainRef.current?.setBypass(true); // morph chain returns to rest after a reset
    // reset the loop routing state (serial-only chain now — these are no-ops on the graph)
    setRoutingModeState('serial');
    setSendPositionState(0);
    setReturnPositionState(DEFAULT_FX_ORDER.length);
    setLoopWetState(0.25);
    // reset the loop too — tear down #2 loop instances + reseed the #1 state.
    if (chainRef.current?.loop) {
      for (const id of Object.keys(chainRef.current.loop.instances)) {
        if (!id.endsWith('#1')) { try { chainRef.current.loop.removeInstance(id); } catch {} }
      }
    }
    setLoopInstances(seedLoopInstances());
    setLoopFxOrder(defaultInstanceOrder()); chainRef.current?.loop?.setInstanceOrder(defaultInstanceOrder());
    chainRef.current?.loop?.updateEQ(LOOP_DEFAULT_EQ);
    chainRef.current?.loop?.updateEffects(LOOP_DEFAULT_EFFECTS, 120);
    chainRef.current?.loop?.updateDynamics(LOOP_DEFAULT_DYNAMICS);
    chainRef.current?.loop?.updateSaturation(LOOP_DEFAULT_SATURATION);
    chainRef.current?.loop?.updateAnalogueDensity(LOOP_DEFAULT_ANALOGUE_DENSITY);
    chainRef.current?.loop?.updateClip(LOOP_DEFAULT_CLIP);
    chainRef.current?.loop?.updateTape(LOOP_DEFAULT_TAPE);
    chainRef.current?.loop?.updateStereoImager(LOOP_DEFAULT_STEREO_IMAGER);
    chainRef.current?.loop?.updateMon8(LOOP_DEFAULT_MON8);
    chainRef.current?.loop?.updateDynamicEQ(LOOP_DEFAULT_DYNAMIC_EQ);
    chainRef.current?.loop?.updateMultiBandComp(LOOP_DEFAULT_MBC);
    setUsedMap({});
    setLoopUsedMap({});
    wireAnalyzers();
  }, [wireAnalyzers]);

  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.01);
    }
  }, [volume]);

  // Input / output trim — apply the per-channel dB values to the gain nodes.
  // When L/R are linked, moving one side mirrors the other so they stay equal.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const lin = (db) => Math.pow(10, db / 20);
    inputGainLRef.current?.gain.setTargetAtTime(lin(inputGainL), ctx.currentTime, 0.01);
    inputGainRRef.current?.gain.setTargetAtTime(lin(inputGainR), ctx.currentTime, 0.01);
    outputGainLRef.current?.gain.setTargetAtTime(lin(outputGainL), ctx.currentTime, 0.01);
    outputGainRRef.current?.gain.setTargetAtTime(lin(outputGainR), ctx.currentTime, 0.01);
  }, [inputGainL, inputGainR, outputGainL, outputGainR]);

  const handleInputGainLChange = useCallback((db) => {
    setInputGainL(db);
    if (linkLR) setInputGainR(db);
  }, [linkLR]);
  const handleInputGainRChange = useCallback((db) => {
    setInputGainR(db);
    if (linkLR) setInputGainL(db);
  }, [linkLR]);
  const handleOutputGainLChange = useCallback((db) => {
    setOutputGainL(db);
    if (linkLR) setOutputGainR(db);
  }, [linkLR]);
  const handleOutputGainRChange = useCallback((db) => {
    setOutputGainR(db);
    if (linkLR) setOutputGainL(db);
  }, [linkLR]);
  // Engaging the L/R link snaps the right channel to the left so the single
  // (linked) fader view is unambiguous.
  const handleLinkLRToggle = useCallback(() => {
    const nv = !linkLR;
    setLinkLR(nv);
    if (nv) { setInputGainR(inputGainL); setOutputGainR(outputGainL); }
  }, [linkLR, inputGainL, outputGainL]);

  // Standby — when no signal is flowing (not playing, mic off), tell every
  // always-on meter/visualizer to skip its per-frame work so idle CPU drops.
  useEffect(() => {
    setMeterStandby(!(isPlaying || isMicOn || signalUtilityOn));
  }, [isPlaying, isMicOn, signalUtilityOn]);

  // ── Mastering Effect macro — apply the scaled mix to every used module ──
  // Runs whenever the knob, the chain order, or any instance state changes
  // (so tweaking any parameter keeps the macro's scaled mix live — the per-
  // type handlers reset a module to its BASE mix, then this overlays the
  // scaled value). The limiter is never touched (brickwall safety).
  useEffect(() => {
    const chain = chainRef.current;
    if (!chain || !ready) return;
    const m = masterEffect / 100;
    for (const id of fxOrder) {
      const type = instanceType(id);
      const cfg = MACRO_MIX[type];
      if (!cfg) continue;                 // limiter / mon8 / unknown — excluded
      const base = instanceStates[id];
      if (!base) continue;
      const baseFrac = (base[cfg.field] ?? cfg.max) / cfg.max;
      const effFrac = Math.max(0, Math.min(1, baseFrac * (1 + m)));
      const scaled = { ...base, [cfg.field]: effFrac * cfg.max };
      const mod = chain.modules[id];
      if (!mod?.update) continue;
      if (type === 'delay') mod.update(scaled, bpm);
      else if (type === 'stereoImager') mod.update(imagerDspState(scaled));
      else mod.update(scaled);
    }
  }, [masterEffect, fxOrder, instanceStates, ready, bpm]);

  // Render-state for offline mastering: the same chain state the live engine
  // plays, with the macro's scaled mix baked in so the rendered master matches
  // what the user hears (the offline renderer rebuilds from this snapshot).
  const getRenderState = useCallback(() => {
    const m = masterEffect / 100;
    const scale = (type, base) => {
      if (!base) return base;
      const cfg = MACRO_MIX[type];
      if (!cfg) return base;
      const baseFrac = (base[cfg.field] ?? cfg.max) / cfg.max;
      const eff = Math.max(0, Math.min(1, baseFrac * (1 + m)));
      return { ...base, [cfg.field]: eff * cfg.max };
    };
    return {
      fxOrder,
      eq: scale('eq', eq),
      dynamics: { compressor: scale('compressor', dynamics.compressor), limiter: dynamics.limiter },
      effects: { delay: scale('delay', effects.delay), reverb: scale('reverb', effects.reverb) },
      saturation: scale('saturation', saturation),
      clip: scale('clip', clip),
      dynamicEq: scale('dynamicEq', dynamicEq),
      mbc: scale('multiBandComp', mbc),
      tape: scale('tape', tape),
      stereoImager: scale('stereoImager', stereoImager),
      analogueDensity: scale('analogueDensity', analogueDensity),
      mon8,
      bypass, bpm,
    };
  }, [masterEffect, fxOrder, eq, dynamics, effects, saturation, clip, dynamicEq, mbc, tape, stereoImager, analogueDensity, mon8, bypass, bpm]);

  const resumeCtx = async () => {
    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
  };

  // ── Buffer-source playback (AIFF / JS-decoded formats) ────────────────
  // Browsers can't decode AIFF through the <audio> element or decodeAudioData,
  // so for AIFF we parse the container in JS, build an AudioBuffer, and play it
  // through a looped AudioBufferSourceNode instead of the media-element path.
  // Transport (play/pause/stop/seek/scrubber) dispatches on playerModeRef.
  const stopBufferSource = () => {
    const src = bufferSourceRef.current;
    if (src) { try { src.onended = null; } catch {} try { src.stop(); } catch {} try { src.disconnect(); } catch {} bufferSourceRef.current = null; }
  };
  const startBufferPlayback = (offset) => {
    const ctx = ctxRef.current; const buf = bufferRef.current;
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(inputUpmixRef.current);
    const off = Math.max(0, Math.min(buf.duration - 0.001, offset || 0));
    try { src.start(0, off); } catch { return; }
    bufferSourceRef.current = src;
    bufferStartCtxTimeRef.current = ctx.currentTime;
    bufferOffsetRef.current = off;
  };
  const bufferPosition = () => {
    const buf = bufferRef.current; const ctx = ctxRef.current;
    if (!buf) return 0;
    if (bufferSourceRef.current && ctx) {
      const elapsed = ctx.currentTime - bufferStartCtxTimeRef.current;
      return (bufferOffsetRef.current + elapsed) % buf.duration;
    }
    return bufferOffsetRef.current % buf.duration;
  };

  const handlePlay = async () => {
    setError('');
    await resumeCtx();
    if (playerModeRef.current === 'buffer') {
      if (!bufferRef.current && !isMicOn) { setError('Upload an audio file or enable the microphone first.'); return; }
      if (bufferRef.current) { startBufferPlayback(bufferOffsetRef.current || 0); setIsPlaying(true); }
      return;
    }
    const el = audioElRef.current;
    if (!el.src && !isMicOn) { setError('Upload an audio file or enable the microphone first.'); return; }
    try { if (el.src) await el.play(); setIsPlaying(true); } catch (e) { setError('Playback failed: ' + e.message); }
  };
  const handlePause = () => {
    if (playerModeRef.current === 'buffer') {
      if (bufferSourceRef.current) {
        const buf = bufferRef.current; const ctx = ctxRef.current;
        if (buf && ctx) {
          const elapsed = ctx.currentTime - bufferStartCtxTimeRef.current;
          bufferOffsetRef.current = (bufferOffsetRef.current + elapsed) % buf.duration;
        }
        stopBufferSource();
      }
      setIsPlaying(false);
      return;
    }
    audioElRef.current?.pause(); setIsPlaying(false);
  };
  const handleStop = () => {
    if (playerModeRef.current === 'buffer') {
      stopBufferSource();
      bufferOffsetRef.current = 0;
      setIsPlaying(false);
      return;
    }
    const el = audioElRef.current; if (el) { el.pause(); el.currentTime = 0; } setIsPlaying(false);
  };

  // Seekable playback — lets the timeline scrubber read position/duration and
  // jump the loaded file to an arbitrary point (so playback doesn't always
  // start from the beginning). Mic has no duration; returns zeros.
  const seekTo = useCallback((t) => {
    if (playerModeRef.current === 'buffer') {
      const buf = bufferRef.current;
      if (!buf || !Number.isFinite(t)) return;
      const nt = Math.max(0, Math.min(buf.duration, t));
      bufferOffsetRef.current = nt;
      if (bufferSourceRef.current) { stopBufferSource(); startBufferPlayback(nt); }
      return;
    }
    const el = audioElRef.current;
    if (el && Number.isFinite(t)) {
      const d = Number.isFinite(el.duration) ? el.duration : Infinity;
      el.currentTime = Math.max(0, Math.min(d || t, t));
    }
  }, []);
  const getPlayback = useCallback(() => {
    if (playerModeRef.current === 'buffer') {
      const buf = bufferRef.current;
      if (!buf) return { current: 0, duration: 0 };
      return { current: bufferPosition(), duration: buf.duration };
    }
    const el = audioElRef.current;
    return { current: el?.currentTime || 0, duration: Number.isFinite(el?.duration) ? el.duration : 0 };
  }, []);

  // Audio-element load lifecycle → loading indicator, progress and a failure
  // flag. The media element fires 'error' for formats it can't play (e.g. AIFF),
  // so the drop zone can show "Failed to load" instead of the misleading
  // "Now loaded" when a file didn't actually load.
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onLoadStart = () => { setIsLoading(true); setLoadProgress(0); setLoadFailed(false); };
    const onProgress = () => {
      try {
        const d = el.duration;
        if (Number.isFinite(d) && d > 0 && el.buffered.length) {
          setLoadProgress(Math.min(100, (el.buffered.end(el.buffered.length - 1) / d) * 100));
        }
      } catch {}
    };
    const onLoaded = () => { setIsLoading(false); setLoadProgress(100); setLoadFailed(false); };
    const onError = () => {
      setIsLoading(false); setLoadProgress(0); setLoadFailed(true);
      setError("This audio format isn't supported for playback in the browser. Try WAV or MP3.");
    };
    el.addEventListener('loadstart', onLoadStart);
    el.addEventListener('progress', onProgress);
    el.addEventListener('loadeddata', onLoaded);
    el.addEventListener('canplaythrough', onLoaded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('loadstart', onLoadStart);
      el.removeEventListener('progress', onProgress);
      el.removeEventListener('loadeddata', onLoaded);
      el.removeEventListener('canplaythrough', onLoaded);
      el.removeEventListener('error', onError);
    };
  }, [ready]);

  const loadFile = useCallback(async (file) => {
    if (!file) return;
    const aiff = isAiffFile(file);
    if (!aiff && !file.type.startsWith('audio/')) { setError('Please drop an audio file.'); return; }
    setError('');
    const wasPlaying = isPlaying;
    // Stop whichever path is running before swapping sources.
    try { audioElRef.current?.pause(); } catch {}
    stopBufferSource();
    bufferOffsetRef.current = 0;
    setIsLoading(true);
    setLoadProgress(0);
    setLoadFailed(false);
    // Keep the raw File handle so the offline master render can decode it
    // directly (re-fetching the blob URL can fail on some MP3s / browsers).
    fileRef.current = file;
    setFileName(file.name);

    if (aiff) {
      // JS-decode path — browsers can't play/decode AIFF natively (Chrome,
      // Firefox, Edge). Parse the container and build an AudioBuffer.
      playerModeRef.current = 'buffer';
      try {
        const arr = await file.arrayBuffer();
        const buf = await decodeAiffToAudioBuffer(ctxRef.current, arr);
        bufferRef.current = buf;
        setLoadProgress(100);
        setIsLoading(false);
        setLoadFailed(false);
        if (wasPlaying) { startBufferPlayback(0); setIsPlaying(true); }
      } catch (e) {
        bufferRef.current = null;
        setIsLoading(false); setLoadProgress(0); setLoadFailed(true); setIsPlaying(false);
        setError(e?.message || "Couldn't decode this AIFF file (unsupported compression). Try WAV or MP3.");
      }
      return;
    }

    // Media-element path (browser-decodable: MP3 / WAV / FLAC …).
    playerModeRef.current = 'media';
    bufferRef.current = null;
    const url = URL.createObjectURL(file);
    const el = audioElRef.current;
    if (!el) { URL.revokeObjectURL(url); setError('Audio engine is still starting up — try again in a moment.'); setIsLoading(false); return; }
    if (el.src) URL.revokeObjectURL(el.src);
    el.src = url; el.currentTime = 0;
    if (wasPlaying) el.play().catch(() => {});
  }, [isPlaying]);

  // Decode helper that works across browsers: prefer the promise form, but fall
  // back to the legacy callback form (some Safari builds reject promise-form
  // decodeAudioData for MP3). Surfaces the real error instead of swallowing it.
  const decodeBuf = (ctx, arr) => new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(arr, resolve, reject);
      if (p && typeof p.then === 'function') { p.then(resolve, reject); }
    } catch (e) { reject(e); }
  });

  const getDecodedAudioBuffer = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    try { if (ctx.state === 'suspended') { await ctx.resume(); } } catch {}
    // If we decoded an AIFF buffer for playback, reuse it — browsers can't
    // decode AIFF through decodeAudioData, so the normal path would fail.
    if (playerModeRef.current === 'buffer' && bufferRef.current) return bufferRef.current;
    // Decode from the stored File (most reliable) — fall back to the blob URL.
    const source = fileRef.current || audioElRef.current?.src;
    if (!source) return null;
    try {
      const arr = typeof source.arrayBuffer === 'function'
        ? await source.arrayBuffer()
        : await (await fetch(source)).arrayBuffer();
      return await decodeBuf(ctx, arr);
    } catch (e) {
      console.warn('[getDecodedAudioBuffer] decode failed:', e);
      // One retry with a fresh fetch of the blob URL (the ArrayBuffer may have
      // been detached by a prior decode attempt).
      try {
        const arr2 = await (await fetch(audioElRef.current?.src)).arrayBuffer();
        return await decodeBuf(ctx, arr2);
      } catch (e2) { console.warn('[getDecodedAudioBuffer] retry failed:', e2); return null; }
    }
  }, []);

  const onFileInput = (e) => { loadFile(e.target.files?.[0]); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files?.[0]); };

  const toggleMic = async () => {
    setError('');
    const ctx = ctxRef.current;
    const chain = chainRef.current;
    if (!ctx || !chain) return;
    if (!isMicOn) {
      try {
        await resumeCtx();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        micSourceRef.current = ctx.createMediaStreamSource(stream);
        micSourceRef.current.connect(inputUpmixRef.current);
        setIsMicOn(true);
      } catch (e) { setError('Microphone access failed: ' + e.message); }
    } else {
      try { micSourceRef.current?.disconnect(); } catch {}
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null; micSourceRef.current = null;
      setIsMicOn(false);
    }
  };

  // Preset snapshot — captures the entire app state: every panel, on/off,
  // signal-chain order, parallel-loop config, routing, BPM, layout, meters.
  const captureState = () => ({
    v: 2,
    fxOrder, instances: instanceStates,
    eq, dynamicEq, effects, dynamics, saturation, analogueDensity, clip, tape, mbc, stereoImager, mon8, bypass, mono,
    volume, layout, meterOrient, meterPro, meteringMode, bpm,
    inputGainL, inputGainR, outputGainL, outputGainR, linkLR,
    routingMode, sendPosition, returnPosition, loopWet,
    loopFxOrder, loopInstances, loopEq, loopDynamicEq, loopEffects, loopDynamics, loopSaturation, loopAnalogueDensity, loopClip, loopTape, loopMbc, loopStereoImager, loopMon8,
  });

  // Restore a captured snapshot — replays every state slice through the
  // existing handlers so React state and the live audio graph stay in sync.
  const applyState = (snap) => {
    if (!snap) return;
    // ── Rebuild multi-instance chain to match the snapshot ──────────────
    // The snapshot's `instances` map (v2) may reference #2+ instance ids the
    // current chain doesn't own. Create/remove modules so the registry matches,
    // then seed each instance's state+module BEFORE handleFxOrderChange (which
    // drops ids whose module doesn't exist). The derived-slice handlers below
    // re-affirm the #1 params and cover v1 snapshots (no `instances` key).
    if (snap.instances) {
      const chain = chainRef.current;
      if (chain) {
        const snapIds = Object.keys(snap.instances).filter((id) => FX_SLOT[instanceType(id)]);
        // Remove current #2 instances the snapshot omits.
        for (const id of Object.keys(chain.instances)) {
          if (!id.endsWith('#1') && !snapIds.includes(id)) { try { chain.removeInstance(id); } catch {} }
        }
        // Create missing #2 in index order so generated ids match the snapshot.
        const byType = {};
        for (const id of snapIds) {
          if (id.endsWith('#1') || chain.instances[id]) continue;
          const t = instanceType(id);
          (byType[t] = byType[t] || []).push(id);
        }
        for (const [t, ids] of Object.entries(byType)) {
          ids.sort((a, b) => instanceIndex(a) - instanceIndex(b));
          for (let i = 0; i < ids.length; i++) chain.addInstance(t);
        }
      }
      // Seed every instance's stored params (sets instanceStates + module).
      for (const [id, st] of Object.entries(snap.instances)) {
        if (FX_SLOT[instanceType(id)]) handleInstanceUpdate(id, st);
      }
    }
    if (Array.isArray(snap.fxOrder)) handleFxOrderChange(snap.fxOrder);
    if (snap.eq) handleEQChange(snap.eq);
    if (snap.dynamicEq) handleDynamicEQChange(snap.dynamicEq);
    if (snap.effects) handleEffectsChange(snap.effects);
    if (snap.dynamics) handleDynamicsChange(snap.dynamics);
    if (snap.saturation) handleSaturationChange(snap.saturation);
    if (snap.analogueDensity) handleAnalogueDensityChange(snap.analogueDensity);
    if (snap.clip) handleClipChange(snap.clip);
    if (snap.tape) handleTapeChange(snap.tape);
    if (snap.stereoImager) handleStereoImagerChange(snap.stereoImager);
    if (snap.mon8) handleMon8Change(snap.mon8);
    if (snap.mbc) handleMbcChange(snap.mbc);
    if (typeof snap.bypass === 'boolean') { setBypass(snap.bypass); chainRef.current?.setBypass(snap.bypass); if (!snap.bypass) wireAnalyzers(); }
    if (typeof snap.mono === 'boolean') {
      setMono(snap.mono);
      const node = monoRef.current;
      if (node) {
        if (snap.mono) { node.channelCount = 1; node.channelCountMode = 'explicit'; }
        else { node.channelCount = 2; node.channelCountMode = 'max'; }
      }
    }
    if (typeof snap.volume === 'number') setVolume(snap.volume);
    if (typeof snap.inputGainL === 'number') setInputGainL(snap.inputGainL);
    if (typeof snap.inputGainR === 'number') setInputGainR(snap.inputGainR);
    if (typeof snap.outputGainL === 'number') setOutputGainL(snap.outputGainL);
    if (typeof snap.outputGainR === 'number') setOutputGainR(snap.outputGainR);
    if (typeof snap.linkLR === 'boolean') setLinkLR(snap.linkLR);
    if (typeof snap.bpm === 'number') setBpm(snap.bpm);
    if (typeof snap.layout === 'string') setLayout(snap.layout);
    if (typeof snap.meterOrient === 'string') setMeterOrient(snap.meterOrient);
    if (typeof snap.meterPro === 'boolean') setMeterPro(snap.meterPro);
    if (typeof snap.meteringMode === 'string') setMeteringMode(snap.meteringMode);
    // Mastering Effect (the big macro knob) is intentionally NOT restored — it
    // stays a separate, user-controlled master trim, independent of presets.
    if (typeof snap.routingMode === 'string') handleRoutingModeChange(snap.routingMode);
    if (typeof snap.sendPosition === 'number') handleSendPositionChange(snap.sendPosition);
    if (typeof snap.returnPosition === 'number') handleReturnPositionChange(snap.returnPosition);
    if (typeof snap.loopWet === 'number') handleLoopWetChange(snap.loopWet);
    // ── Rebuild multi-instance loop chain to match the snapshot ───────────
    // Mirror the main-chain rebuild: create/remove chain.loop's #2+ modules so
    // the registry matches, seed each instance, THEN restore the order (which
    // drops ids whose module doesn't exist). The derived handlers below re-affirm
    // the #1 loop params and cover older snapshots (no `loopInstances` key).
    if (snap.loopInstances) {
      const loop = chainRef.current?.loop;
      if (loop) {
        const snapIds = Object.keys(snap.loopInstances).filter((id) => FX_SLOT[instanceType(id)]);
        for (const id of Object.keys(loop.instances)) {
          if (!id.endsWith('#1') && !snapIds.includes(id)) { try { loop.removeInstance(id); } catch {} }
        }
        const byType = {};
        for (const id of snapIds) {
          if (id.endsWith('#1') || loop.instances[id]) continue;
          const t = instanceType(id);
          (byType[t] = byType[t] || []).push(id);
        }
        for (const [t, ids] of Object.entries(byType)) {
          ids.sort((a, b) => instanceIndex(a) - instanceIndex(b));
          for (let i = 0; i < ids.length; i++) loop.addInstance(t);
        }
      }
      for (const [id, st] of Object.entries(snap.loopInstances)) {
        if (FX_SLOT[instanceType(id)]) handleLoopInstanceUpdate(id, st);
      }
    }
    if (Array.isArray(snap.loopFxOrder)) handleLoopFxOrderChange(snap.loopFxOrder);
    if (snap.loopEq) handleLoopEQChange(snap.loopEq);
    if (snap.loopDynamicEq) handleLoopDynamicEQChange(snap.loopDynamicEq);
    if (snap.loopEffects) handleLoopEffectsChange(snap.loopEffects);
    if (snap.loopDynamics) handleLoopDynamicsChange(snap.loopDynamics);
    if (snap.loopSaturation) handleLoopSaturationChange(snap.loopSaturation);
    if (snap.loopAnalogueDensity) handleLoopAnalogueDensityChange(snap.loopAnalogueDensity);
    if (snap.loopClip) handleLoopClipChange(snap.loopClip);
    if (snap.loopTape) handleLoopTapeChange(snap.loopTape);
    if (snap.loopMbc) handleLoopMbcChange(snap.loopMbc);
    if (snap.loopStereoImager) handleLoopStereoImagerChange(snap.loopStereoImager);
    if (snap.loopMon8) handleLoopMon8Change(snap.loopMon8);
  };

  return {
    // refs exposed for panels
    audioContext: ctxRef.current,
    signalUtility: signalUtilityRef.current,
    captureState,
    applyState,
    analyzers: analyzersRef.current,
    eqAnalyzer: analyzersRef.current?.spectrum,
    loopSpectrum: analyzersRef.current?.loopSpectrum,
    nodes, dynNodes, mbcNodes, levelEngine,
    // status
    ready, isPlaying, isMicOn, volume, fileName, error, dragOver,
    isLoading, loadProgress, loadFailed,
    // params
    fxOrder, eq, dynamicEq, effects, dynamics, saturation, analogueDensity, clip, tape, mbc, stereoImager, mon8, bypass, mono,
    layout, meterOrient, meterPro, meteringMode,
    inputGainL, inputGainR, outputGainL, outputGainR, linkLR,
    // derived
    enabledMap,
    usedMap, loopUsedMap,
    // instance model
    instanceStates, handleInstanceUpdate, handleInstanceToggle, handleAddInstance, handleRemoveInstance,
    // setters / transport
    setVolume, setLayout, setMeterOrient, setMeterPro, setMeteringMode, setDragOver,
    handleInputGainLChange, handleInputGainRChange, handleOutputGainLChange, handleOutputGainRChange, handleLinkLRToggle,
    handlePlay, handlePause, handleStop, toggleMic, handleBypassToggle, handleMonoToggle, handleReset,
    seekTo, getPlayback,
    onFileInput, onDrop, loadFile, getDecodedAudioBuffer,
    // param handlers
    handleEQChange, handleEffectsChange, handleDynamicsChange, handleSaturationChange, handleAnalogueDensityChange, handleClipChange, handleTapeChange, handleDynamicEQChange, handleMbcChange, applyGlideBlend, setMbcCrossfade, prepareMorphChain, setMorphT, rampMorphToChain, handleFxOrderChange, handleToggle,
    handleStereoImagerChange, handleMon8Change,
    // mastering effect macro
    masterEffect, setMasterEffect: setMasterEffectState, getRenderState,
    // section mastering (render integration)
    sectionMastering, setSectionMastering,
    // transport
    bpm, handleBpmChange,
    // send/return loop
    target, handleTargetChange: setTarget,
    routingMode, sendPosition, returnPosition, loopWet,
    loopFxOrder, loopInstances, loopEq, loopDynamicEq, loopEffects, loopDynamics, loopSaturation, loopAnalogueDensity, loopClip, loopTape, loopMbc, loopStereoImager, loopMon8, loopEnabledMap,
    handleRoutingModeChange, handleSendPositionChange, handleReturnPositionChange, handleLoopWetChange,
    handleLoopFxOrderChange, handleLoopEQChange, handleLoopEffectsChange, handleLoopDynamicsChange, handleLoopSaturationChange, handleLoopAnalogueDensityChange, handleLoopClipChange, handleLoopTapeChange, handleLoopDynamicEQChange, handleLoopMbcChange, handleLoopToggle,
    handleLoopStereoImagerChange, handleLoopMon8Change,
    handleLoopInstanceUpdate, handleLoopInstanceToggle, handleLoopAddInstance, handleLoopRemoveInstance,
  };
}