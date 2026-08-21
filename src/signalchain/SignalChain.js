import { DEFAULT_FX_ORDER, FX_SLOT, FX_SLOT_LIST, normalizeFxOrder, defaultInstanceOrder, normalizeInstanceOrder, nextInstanceId, instanceType } from './fxSlots.js';
import { dbToGain, FADE_TAU, fadeGain, makeInsert, identityCurve as _identityCurve, createSatCurve as _createSatCurve, createClipCurve as _createClipCurve, createTapeCurve as _createTapeCurve } from './modules/moduleUtils.js';
import { buildSaturation } from './modules/saturation.js';
import { buildClip } from './modules/clip.js';
import { buildTape } from './modules/tape.js';
import { buildDelay } from './modules/delay.js';
import { buildReverb } from './modules/reverb.js';
import { buildEQ } from './modules/eq.js';
import { buildStereoImager } from './modules/stereoImager.js';
import { buildCompressor } from './modules/compressor.js';
import { buildLimiter } from './modules/limiter.js';
import { buildDynamicEQ } from './modules/dynamicEQ.js';
import { buildMultiBandComp } from './modules/multiband.js';
import { buildAnalogueDensity } from './modules/analogueDensity.js';
import { satTransfer } from './satModel.js';
import { midShapeBand } from './eqModel.js';
import { createCharacterCompressor } from './CompressorNode.js';
import { createReverbEngine } from './reverbEngine.js';

// Shared helpers (dbToGain, fadeGain, makeInsert) + curve generators now live
// in ./modules/moduleUtils.js — imported above. Per-instance module factories
// live in ./modules/<name>.js.

// ── Per-instance module factories ───────────────────────────────────────
// Each factory builds a self-contained node-set (input/output + its own
// handles) and returns an `update(state)` that operates on those handles, so
// the same type can be instantiated multiple times in one chain. The default
// chain still builds one instance per type; extra instances are created via
// addInstance().

// Mon8 — Bass Mono / low-frequency stereo collapse.
//   Input (LR) → M/S encode → Side high-pass at the cutoff → narrowing blend
//   (w·S_HP + (1-w)·S) → M/S decode → output.
//   Mid is untouched; only the Side is filtered, so energy below the cutoff is
//   removed from the sides and the low end collapses to the centre. w=0 (or
//   disabled) = identity; w=1 = full mono below the cutoff.
function buildMon8(ctx) {
  const m8 = makeInsert(ctx);
  m8.dry.gain.value = 0; // full-wet; the M/S round-trip is identity at w=0
  // M/S encode: M = (L+R)/2, S = (L−R)/2
  const mon8Split = ctx.createChannelSplitter(2);
  const mon8MidEncL = ctx.createGain(); mon8MidEncL.gain.value = 0.5;
  const mon8MidEncR = ctx.createGain(); mon8MidEncR.gain.value = 0.5;
  const mon8SideEncL = ctx.createGain(); mon8SideEncL.gain.value = 0.5;
  const mon8SideEncR = ctx.createGain(); mon8SideEncR.gain.value = -0.5;
  const mon8MidSum = ctx.createGain(); mon8MidSum.gain.value = 1;
  const mon8SideSum = ctx.createGain(); mon8SideSum.gain.value = 1;
  m8.input.connect(mon8Split);
  mon8Split.connect(mon8MidEncL, 0); mon8MidEncL.connect(mon8MidSum);
  mon8Split.connect(mon8MidEncR, 1); mon8MidEncR.connect(mon8MidSum);
  mon8Split.connect(mon8SideEncL, 0); mon8SideEncL.connect(mon8SideSum);
  mon8Split.connect(mon8SideEncR, 1); mon8SideEncR.connect(mon8SideSum);
  // Side high-pass — two cascaded biquads. Slope 24 = two LR4 stages (Q 0.5);
  // slope 12 = one Butterworth stage (Q 0.707) + a flat peaking stage (gain
  // 0 = true unity, no phase shift) set in update().
  const mon8HP1 = ctx.createBiquadFilter(); mon8HP1.type = 'highpass'; mon8HP1.frequency.value = 120; mon8HP1.Q.value = 0.5;
  const mon8HP2 = ctx.createBiquadFilter(); mon8HP2.type = 'highpass'; mon8HP2.frequency.value = 120; mon8HP2.Q.value = 0.5;
  // S' = w·S_HP + (1-w)·S
  const mon8WetGain = ctx.createGain(); mon8WetGain.gain.value = 0;   // w · S_HP
  const mon8DryGain = ctx.createGain(); mon8DryGain.gain.value = 1;   // (1-w) · S
  const mon8SideOut = ctx.createGain(); mon8SideOut.gain.value = 1;
  mon8SideSum.connect(mon8HP1);
  mon8HP1.connect(mon8HP2);
  mon8HP2.connect(mon8WetGain);
  mon8SideSum.connect(mon8DryGain);
  mon8WetGain.connect(mon8SideOut);
  mon8DryGain.connect(mon8SideOut);
  // M/S decode: L = M + S', R = M − S'
  const mon8Merger = ctx.createChannelMerger(2);
  const mon8DecML = ctx.createGain(); mon8DecML.gain.value = 1;
  const mon8DecMR = ctx.createGain(); mon8DecMR.gain.value = 1;
  const mon8DecSL = ctx.createGain(); mon8DecSL.gain.value = 1;
  const mon8DecSR = ctx.createGain(); mon8DecSR.gain.value = -1;
  mon8MidSum.connect(mon8DecML); mon8DecML.connect(mon8Merger, 0, 0);
  mon8MidSum.connect(mon8DecMR); mon8DecMR.connect(mon8Merger, 0, 1);
  mon8SideOut.connect(mon8DecSL); mon8DecSL.connect(mon8Merger, 0, 0);
  mon8SideOut.connect(mon8DecSR); mon8DecSR.connect(mon8Merger, 0, 1);
  mon8Merger.connect(m8.output);
  let _enabled = false;
  return {
    input: m8.input,
    output: m8.output,
    update(state = {}) {
      const now = ctx.currentTime;
      const enabled = !!state.enabled;
      const freq = Math.max(20, Math.min(500, state.frequency ?? 120));
      const width = Math.max(0, Math.min(1, state.width ?? 0));   // 0 = no change, 1 = full mono below cutoff
      const slope = state.slope === 12 ? 12 : 24;
      const w = enabled ? width : 0;
      const ramp = _enabled !== enabled; _enabled = enabled;
      mon8HP1.type = 'highpass';
      mon8HP1.frequency.setValueAtTime(freq, now);
      mon8HP1.Q.setValueAtTime(slope === 24 ? 0.5 : 0.7071, now);
      if (slope === 24) {
        mon8HP2.type = 'highpass';
        mon8HP2.frequency.setValueAtTime(freq, now);
        mon8HP2.Q.setValueAtTime(0.5, now);
        mon8HP2.gain.setValueAtTime(0, now);
      } else {
        mon8HP2.type = 'peaking';
        mon8HP2.frequency.setValueAtTime(1000, now);
        mon8HP2.Q.setValueAtTime(1, now);
        mon8HP2.gain.setValueAtTime(0, now);
      }
      fadeGain(mon8WetGain, w, now, ramp);
      fadeGain(mon8DryGain, 1 - w, now, ramp);
    },
  };
}

/**
 * Standalone Web Audio API signal chain with a reorderable serial FX bus.
 *
 *   source.connect(chain.input);
 *   chain.connect(audioCtx.destination);
 *
 * Reorder the master bus (live audio rewire):
 *   chain.setFxOrder(["compressor","eq","delay","reverb","distortion","limiter"]);
 */
export class SignalChain {
  constructor(audioCtx, withLoop = true) {
    this.audioCtx = audioCtx;
    this.input = audioCtx.createGain();
    this.output = audioCtx.createGain();
    // DC blocker / subsonic high-pass at the chain input. Sits permanently
    // ahead of the FX bus so DC offset and sub-20 Hz rumble are stripped before
    // any effect — and crucially it stays in the circuit when the chain is
    // bypassed (pro mastering chains always run an input low-cut). 20 Hz /
    // Q 0.707 is transparent to audible bass (30–80 Hz).
    // DC blocker / subsonic high-pass at the chain input — a 3-stage cascade
    // (≈36 dB/oct) so sub-20 Hz rumble and DC offset are strongly attenuated,
    // not just -3 dB at 20 Hz. Stays permanently ahead of the FX bus and in
    // circuit when the chain is bypassed.
    this.inputFilters = [];
    for (let i = 0; i < 3; i++) {
      const f = audioCtx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 20;
      f.Q.value = 0.707;
      this.inputFilters.push(f);
    }
    // `inputFilter` points at the LAST stage — the output node rebuildChain
    // wires into the FX bus. The internal f1→f2→f3 links stay fixed; only the
    // last stage's downstream fan-out is ever rewired.
    this.inputFilter = this.inputFilters[this.inputFilters.length - 1];
    let hpPrev = this.input;
    for (const f of this.inputFilters) { hpPrev.connect(f); hpPrev = f; }
    this.bypass = false;
    this._buildModules();
    this._initInstanceRegistry();
    this.fxOrder = defaultInstanceOrder();
    this.rebuildChain();
    // Parallel / insert send-return loop REMOVED — the serial chain + per-module
    // MIX % + duplicate instances cover every use case without the summing
    // clipping and comb-filtering the parallel blend caused. `withLoop` is kept
    // in the signature for the morph-chain call site but now ignored.
  }

  _buildModules() {
    const ctx = this.audioCtx;

    this.modules = {};
    // --- Compressor (per-instance factory; see buildCompressor) ---
    {
      const comp = buildCompressor(ctx);
      this.modules[FX_SLOT.compressor] = comp;
      // Compat: the engine `nodes` memo reads these handles off the chain.
      this.compressorNode = comp.compressorNode;
      this.compMid = comp.compMid;
      this.compSide = comp.compSide;
    }

    // --- Saturation (per-instance factory; see buildSaturation) ---
    this.modules[FX_SLOT.saturation] = buildSaturation(ctx);

    // --- Analogue Density (per-instance factory; see buildAnalogueDensity) ---
    this.modules[FX_SLOT.analogueDensity] = buildAnalogueDensity(ctx);

    // --- Clip Distortion (per-instance factory; see buildClip) ---
    this.modules[FX_SLOT.clip] = buildClip(ctx);

    // --- Tape Machine (per-instance factory; see buildTape) ---
    this.modules[FX_SLOT.tape] = buildTape(ctx);

    // --- Delay (per-instance factory; see buildDelay) ---
    this.modules[FX_SLOT.delay] = buildDelay(ctx);

    // --- Reverb (per-instance factory; see buildReverb) ---
    this.modules[FX_SLOT.reverb] = buildReverb(ctx);

    // --- N-Band Parametric EQ (per-instance factory; see buildEQ) ---
    this.modules[FX_SLOT.eq] = buildEQ(ctx);

    // --- Dynamic EQ (per-instance factory; see buildDynamicEQ) ---
    {
      const dyn = buildDynamicEQ(ctx);
      this.modules[FX_SLOT.dynamicEq] = dyn;
      // Compat: engine `dynNodes` memo reads these band objects off the chain.
      this.dynLow = dyn.bands.low; this.dynMids = dyn.bands.mids; this.dynHigh = dyn.bands.high;
      this.dynMidLow = dyn.bands.midLow; this.dynMidMids = dyn.bands.midMids; this.dynMidHigh = dyn.bands.midHigh;
      this.dynSideLow = dyn.bands.sideLow; this.dynSideMids = dyn.bands.sideMids; this.dynSideHigh = dyn.bands.sideHigh;
    }

    // --- Multi-Band Compressor (per-instance factory; see buildMultiBandComp) ---
    {
      const mbc = buildMultiBandComp(ctx);
      this.modules[FX_SLOT.multiBandComp] = mbc;
      // Compat: engine `mbcNodes` memo reads these band-comp arrays off the chain.
      this.mbcComp = mbc.mbcComp;
      this.mbcSideComp = mbc.mbcSideComp;
    }

    // --- Brickwall Limiter (per-instance factory; see buildLimiter) ---
    {
      const lim = buildLimiter(ctx);
      this.modules[FX_SLOT.limiter] = lim;
      // Compat: engine nodes memo + prepareMorphChain read these off the chain.
      this.limiterNode = lim.limiterNode;
      this.limLookahead = lim.limLookahead;
    }

    // --- Stereo Imager (per-instance factory; see buildStereoImager) ---
    this.modules[FX_SLOT.stereoImager] = buildStereoImager(ctx);

    // --- Mon8 — Bass Mono (per-instance factory; see buildMon8) ---
    this.modules[FX_SLOT.mon8] = buildMon8(ctx);
  }

  rebuildChain() {
    // The input→inputFilter link is permanent (DC blocker); only disconnect the
    // filter's *downstream* fan-out so the FX bus can be rewired.
    this.inputFilter.disconnect();
    for (const slot of this.fxOrder) {
      if (!this.modules[slot]) continue; // stale instance id (e.g. an offline render chain that only owns #1)
      // Only disconnect module *outputs* (the external chain links). Disconnecting a
      // module *input* would sever its internal fan-out (input → processing node),
      // silently breaking the whole chain — the no-sound bug.
      this.modules[slot].output.disconnect();
    }
    if (this.bypass) {
      // True dry path — DC blocker stays in circuit, modules bypassed.
      this.inputFilter.connect(this.output);
      return;
    }

    // Serial chain only: input filter → modules in fxOrder → output.
    let prev = this.inputFilter;
    for (const slot of this.fxOrder) {
      const mod = this.modules[slot];
      if (!mod) continue;
      prev.connect(mod.input);
      prev = mod.output;
    }
    prev.connect(this.output);
  }

  setBypass(bypass) {
    const next = !!bypass;
    if (next === this.bypass) return;
    this.bypass = next;
    this.rebuildChain();
  }

  getFxOrder() {
    // Internal fxOrder holds instance ids; expose types for engine/UI compat
    // (pre-multi-instance). Stage 2 switches the engine to instance ids.
    return this.fxOrder.map(instanceType);
  }

  setFxOrder(order) {
    // Accept instance ids or bare types; store as instance ids internally.
    const next = normalizeInstanceOrder(order);
    if (next.join() === this.fxOrder.join()) return;
    this.fxOrder = next;
    this.rebuildChain();
  }

  // ── Instance registry ──────────────────────────────────────────────────
  // One default instance per type is registered up front (id "<type>#1"),
  // aliased into this.modules so rebuildChain can address modules by instance
  // id. Extra instances are created by addInstance() once a type has a factory.
  _initInstanceRegistry() {
    this.instances = {};
    this.typeCount = {};
    for (const type of FX_SLOT_LIST) {
      const id = `${type}#1`;
      this.typeCount[type] = 1;
      const mod = this.modules[type];
      this.instances[id] = { id, type, module: mod };
      this.modules[id] = mod; // alias: addressable by instance id in rebuildChain
    }
  }

  // Add a new instance of a type. Returns the new instance id, or null if the
  // type has no per-instance factory yet (only Mon8 is factory-ized so far).
  addInstance(type) {
    if (!FX_SLOT_LIST.includes(type)) return null;
    const id = nextInstanceId(type, Object.keys(this.instances));
    let mod = null;
    switch (type) {
      case FX_SLOT.mon8: mod = buildMon8(this.audioCtx); break;
      case FX_SLOT.saturation: mod = buildSaturation(this.audioCtx); break;
      case FX_SLOT.analogueDensity: mod = buildAnalogueDensity(this.audioCtx); break;
      case FX_SLOT.clip: mod = buildClip(this.audioCtx); break;
      case FX_SLOT.tape: mod = buildTape(this.audioCtx); break;
      case FX_SLOT.delay: mod = buildDelay(this.audioCtx); break;
      case FX_SLOT.reverb: mod = buildReverb(this.audioCtx); break;
      case FX_SLOT.eq: mod = buildEQ(this.audioCtx); break;
      case FX_SLOT.stereoImager: mod = buildStereoImager(this.audioCtx); break;
      case FX_SLOT.compressor: mod = buildCompressor(this.audioCtx); break;
      case FX_SLOT.limiter: mod = buildLimiter(this.audioCtx); break;
      case FX_SLOT.dynamicEq: mod = buildDynamicEQ(this.audioCtx); break;
      case FX_SLOT.multiBandComp: mod = buildMultiBandComp(this.audioCtx); break;
      default: return null; // factory not extracted yet
    }
    this.instances[id] = { id, type, module: mod };
    this.modules[id] = mod;
    this.typeCount[type] = (this.typeCount[type] || 0) + 1;
    this.fxOrder.push(id);
    this.rebuildChain();
    return id;
  }

  removeInstance(id) {
    if (!this.instances[id] || id.endsWith('#1')) return; // keep the default instance
    try { this.instances[id].module.output?.disconnect(); } catch {}
    delete this.instances[id];
    delete this.modules[id];
    this.fxOrder = this.fxOrder.filter((x) => x !== id);
    this.rebuildChain();
  }

  setInstanceOrder(ids) {
    this.fxOrder = normalizeInstanceOrder(ids);
    this.rebuildChain();
  }

  getInstances() {
    return Object.values(this.instances);
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  // Curve generators delegate to ./modules/moduleUtils.js (shared with the
  // per-instance factories). createLimCeilingCurve stays inline until the
  // limiter factory is extracted.
  createSatCurve(mode, drive) { return _createSatCurve(mode, drive); }
  identityCurve() { return _identityCurve(); }
  createClipCurve(driveDb, symmetry) { return _createClipCurve(driveDb, symmetry); }
  createTapeCurve(drive, bias, saturation) { return _createTapeCurve(drive, bias, saturation); }

  updateEffects(effects, bpm) {
    this.modules[FX_SLOT.delay]?.update(effects?.delay, bpm);
    this.modules[FX_SLOT.reverb]?.update(effects?.reverb);
  }

  updateSaturation(state) {
    this.modules[FX_SLOT.saturation]?.update(state);
  }

  updateAnalogueDensity(state) {
    this.modules[FX_SLOT.analogueDensity]?.update(state);
  }

  updateClip(state) {
    this.modules[FX_SLOT.clip]?.update(state);
  }

  updateTape(state) {
    this.modules[FX_SLOT.tape]?.update(state);
  }

  updateEQ(eq) {
    this.modules[FX_SLOT.eq]?.update(eq);
  }

  updateDynamicEQ(deq) {
    this.modules[FX_SLOT.dynamicEq]?.update(deq);
  }

  updateMultiBandComp(state) {
    this.modules[FX_SLOT.multiBandComp]?.update(state);
  }

  // Section-mastering MBC crossfade — dispatches to the multiband factory's
  // setCrossfade (passGain = 1-w, sum = w·makeup). The glide loop calls this
  // directly; `instant` = setValueAtTime (per-frame tracking), false = 12 ms
  // ramp (manual enable toggle, click-free).
  setMbcCrossfade(weight, gm, ms, instant) {
    this.modules[FX_SLOT.multiBandComp]?.setCrossfade(weight, gm, ms, instant);
  }

  // Gain reduction from whichever limiter topology is currently active.
  getLimiterReduction() {
    return this.modules[FX_SLOT.limiter]?.getReduction?.() ?? 0;
  }

  dispose() {
    this.modules[FX_SLOT.limiter]?.dispose?.();
    this.modules[FX_SLOT.reverb]?.dispose?.();
  }

  // Soft-clip curve: identity below the (linear) ceiling, gently rounded above
  // it toward the ceiling — used by the oversampled stage to suppress
  // inter-sample peaks (true-peak mode).
  createLimCeilingCurve(ceilingDb) {
    const ceil = Math.pow(10, Math.min(0, ceilingDb) / 20);
    const head = Math.max(1e-4, 1 - ceil);
    const samples = 4096;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      const ax = Math.abs(x);
      let y;
      if (ax <= ceil) y = x;
      else {
        const over = (ax - ceil) / head;
        const soft = ceil + head * Math.tanh(over * 2.5) / 2.5;
        y = Math.sign(x) * Math.min(1, soft);
      }
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }

  updateDynamics(dynamics) {
    this.modules[FX_SLOT.compressor]?.update(dynamics?.compressor);
    this.modules[FX_SLOT.limiter]?.update(dynamics?.limiter);
  }

  updateStereoImager(state) {
    this.modules[FX_SLOT.stereoImager]?.update(state);
  }

  updateMon8(state) {
    this.modules[FX_SLOT.mon8]?.update(state);
  }
}