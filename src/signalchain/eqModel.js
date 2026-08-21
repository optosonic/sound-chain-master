/**
 * Shared band model for the Parametric EQ and Dynamic EQ modules.
 *
 * Hybrid-shelf layout: low shelf + (bandCount − 2) parametric mid bells + high shelf.
 * Both modules share the same band geometry so the Dynamic EQ can reuse the EQ
 * graph and add a per-band dynamic-compression layer on top.
 */

export const BAND_COUNTS = [3, 4, 5, 6, 8];
export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;
export const MIN_DB = -24;
export const MAX_DB = 24;

/**
 * Vertical gain-range presets for the Parametric EQ graph.
 * Switching range rescales the dB axis, the gridline spacing AND the band-handle
 * drag sensitivity (same pixel height → finer dB), so a narrower range is a true
 * zoomed "surgical" view rather than the same ±24 graph with a clipped handle.
 *   surgical  · ±6 dB  · 1 dB grid · tiny mastering corrections
 *   mastering · ±12 dB · 2 dB grid · broader tone shaping
 *   full      · ±24 dB · 6 dB grid · creative / sound design
 */
export const GAIN_RANGES = {
  surgical:   { max: 6,  grid: 1, label: 2, step: 0.1, name: 'Surgical',  color: '#38bdf8' },
  mastering:  { max: 12, grid: 2, label: 2, step: 0.1, name: 'Mastering', color: '#4f46e5' },
  full:       { max: 24, grid: 6, label: 6, step: 0.1, name: 'Full',      color: '#7c3aed' },
};
export const gainRangeOf = (key) => GAIN_RANGES[key] || GAIN_RANGES.full;
export const SLOPES = [12, 24, 36, 48];

export const LOW_COLOR = '#60a5fa';
export const HIGH_COLOR = '#f59e0b';
export const MID_COLORS = ['#14b8a6', '#34d399', '#fbbf24', '#fb923c', '#22d3ee', '#f87171'];

/** Log-spaced frequency for a given sample index across the audible range. */
export const indexToFreq = (i, n) => {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  return Math.pow(10, logMin + (i / Math.max(1, n - 1)) * (logMax - logMin));
};

/** Default centre frequencies for the mid bells of a given band count. */
export function defaultMidFreqs(count) {
  const n = count - 2;
  if (n <= 0) return [];
  if (n === 1) return [1000];
  const min = 250;
  const max = 4500;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(Math.round(Math.pow(10, Math.log10(min) + t * (Math.log10(max) - Math.log10(min)))));
  }
  return out;
}

/** Build a fresh mid band for position i, optionally with dynamic-compression fields. */
export function newMidFor(count, i, isDynamic) {
  const freqs = defaultMidFreqs(count);
  const base = { freq: freqs[i] ?? 1000, gain: 0, q: 1 };
  if (isDynamic) {
    base.threshold = -24;
    base.ratio = 1;
    base.attack = 0.01;
    base.release = 0.2;
    base.satEnabled = false;
    base.satDrive = 0.3;
  }
  return base;
}

export function defaultEQ(count = 3) {
  return {
    enabled: true,
    bandCount: count,
    msMode: false,
    msChannel: 'mid', // which channel the UI is editing when msMode is on
    // Mid channel (also the stereo L/R chain when msMode is off)
    low: { freq: 200, gain: 0, slope: 12, cut: false },
    mids: defaultMidFreqs(count).map((freq) => ({ freq, gain: 0, q: 1 })),
    high: { freq: 5000, gain: 0, slope: 12, cut: false },
    // Side channel (only used in M/S mode)
    sideLow: { freq: 200, gain: 0, slope: 12, cut: false },
    sideMids: defaultMidFreqs(count).map((freq) => ({ freq, gain: 0, q: 1 })),
    sideHigh: { freq: 5000, gain: 0, slope: 12, cut: false },
  };
}

export function defaultDynamicEQ(count = 4) {
  const dynBand = (freq, q = 1) => ({ freq, gain: 0, q, threshold: -24, ratio: 1, attack: 0.01, release: 0.2, satEnabled: false, satDrive: 0.3 });
  const dynShelf = (freq) => ({ freq, gain: 0, threshold: -24, ratio: 1, attack: 0.01, release: 0.2, satEnabled: false, satDrive: 0.3 });
  return {
    enabled: true,
    bandCount: count,
    msMode: false,
    msChannel: 'mid',
    // Mid channel (also the stereo L/R chain when msMode is off)
    low: dynShelf(200),
    mids: defaultMidFreqs(count).map((freq) => dynBand(freq)),
    high: dynShelf(5000),
    // Side channel (only used in M/S mode)
    sideLow: dynShelf(200),
    sideMids: defaultMidFreqs(count).map((freq) => dynBand(freq)),
    sideHigh: dynShelf(5000),
    mix: 100,
  };
}

/** Change band count, preserving existing mid bands where possible. */
export function setBandCount(eq, count, isDynamic) {
  const target = count - 2;
  const mids = [];
  for (let i = 0; i < target; i++) {
    mids.push(eq.mids?.[i] ? { ...eq.mids[i] } : newMidFor(count, i, isDynamic));
  }
  return { ...eq, bandCount: count, mids };
}

/** Return a new eq with a patch applied to one band (id: 'low' | 'high' | 'mid<i>'). */
export function updateBand(eq, id, patch) {
  if (id === 'low') return { ...eq, low: { ...eq.low, ...patch } };
  if (id === 'high') return { ...eq, high: { ...eq.high, ...patch } };
  if (id.startsWith('mid')) {
    const idx = parseInt(id.slice(3), 10);
    const mids = eq.mids.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    return { ...eq, mids };
  }
  return eq;
}

/** Ordered flat list of band descriptors for graph drawing + drag. */
export function bandList(eq) {
  const list = [];
  list.push({ id: 'low', kind: 'low', freq: eq.low.freq, gain: eq.low.gain, color: LOW_COLOR, cut: eq.low.cut, slope: eq.low.slope, satEnabled: !!eq.low.satEnabled, enabled: eq.low.enabled !== false, solo: !!eq.low.solo, shape: eq.low.shape || 'bell' });
  eq.mids.forEach((m, i) =>
    list.push({ id: `mid${i}`, kind: 'mid', freq: m.freq, gain: m.gain, q: m.q, color: MID_COLORS[i % MID_COLORS.length], satEnabled: !!m.satEnabled, enabled: m.enabled !== false, solo: !!m.solo, shape: m.shape || 'bell' })
  );
  list.push({ id: 'high', kind: 'high', freq: eq.high.freq, gain: eq.high.gain, color: HIGH_COLOR, cut: eq.high.cut, slope: eq.high.slope, satEnabled: !!eq.high.satEnabled, enabled: eq.high.enabled !== false, solo: !!eq.high.solo, shape: eq.high.shape || 'bell' });
  return list;
}

/**
 * Combined magnitude response (dB) across the log frequency range.
 * Mirrors the DSP routing in SignalChain.updateEQ exactly so the graph matches the audio.
 */
export function computeEQCurve(ctx, eq, n = 128) {
  if (!ctx) return [];
  const freqs = new Float32Array(n);
  for (let i = 0; i < n; i++) freqs[i] = indexToFreq(i, n);
  const mag = new Float32Array(n);
  const phase = new Float32Array(n);
  const total = new Float32Array(n).fill(1);
  const apply = (type, freq, gain, q) => {
    const bf = ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.value = freq;
    bf.Q.value = q;
    bf.gain.value = gain;
    bf.getFrequencyResponse(freqs, mag, phase);
    for (let i = 0; i < n; i++) total[i] *= mag[i];
  };
  if (eq.enabled) {
    const allBands = [eq.low, ...(eq.mids || []), eq.high];
    const anySolo = allBands.some((b) => b && b.solo);
    const isActive = (b) => !!b && b.enabled !== false && (!anySolo || !!b.solo);
    if (isActive(eq.low)) {
      if (eq.low.cut) {
        const c = (eq.low.slope || 12) / 12;
        for (let f = 0; f < c; f++) apply('highpass', eq.low.freq, 0, 0.707);
      } else {
        apply('lowshelf', eq.low.freq, eq.low.gain, 0.707);
      }
    }
    (eq.mids || []).forEach((m) => {
      if (!isActive(m)) return;
      const s = midShapeBand(m);
      apply(s.type, s.freq, s.gain, s.q);
    });
    if (isActive(eq.high)) {
      if (eq.high.cut) {
        const c = (eq.high.slope || 12) / 12;
        for (let f = 0; f < c; f++) apply('lowpass', eq.high.freq, 0, 0.707);
      } else {
        apply('highshelf', eq.high.freq, eq.high.gain, 0.707);
      }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) out.push({ freq: freqs[i], db: 20 * Math.log10(total[i]) });
  return out;
}

/**
 * Map a mid band's `shape` to a concrete biquad type + params.
 * Bell / Proportional Q / Band Shelf use peaking (Q scaled); Baxandall Bass /
 * Treble use a shelf — all from the existing Web Audio biquad set, so no new
 * DSP is required. Defaults to a plain peaking bell.
 */
export function midShapeBand(m) {
  const shape = m?.shape || 'bell';
  const g = m?.gain || 0;
  const q = m?.q ?? 1;
  const freq = m?.freq ?? 1000;
  switch (shape) {
    case 'propq': return { type: 'peaking', freq, gain: g, q: Math.max(0.1, q * (1 + Math.min(3, Math.abs(g) / 6))) };
    case 'bandshelf': return { type: 'peaking', freq, gain: g, q: Math.max(0.3, q * 0.5) };
    case 'baxbass': return { type: 'lowshelf', freq, gain: g, q: 0.707 };
    case 'baxtreble': return { type: 'highshelf', freq, gain: g, q: 0.707 };
    default: return { type: 'peaking', freq, gain: g, q };
  }
}

// ── Mid/Side (M/S) extensions ──────────────────────────────────────────
// The Mid channel lives in eq.low/mids/high (also the stereo L/R chain when
// msMode is off). The Side channel lives in eq.sideLow/sideMids/sideHigh and
// is only used when msMode is on. `msChannel` ('mid' | 'side') is the channel
// the UI is currently editing — purely an edit-target selector; the engine
// always applies Mid→mid chain and Side→side chain independently.
export const MS_MID_COLOR = '#fbbf24';  // amber — Mid channel
export const MS_SIDE_COLOR = '#22d3ee'; // cyan  — Side channel

export function defaultSideBands(count = 3) {
  return {
    low: { freq: 200, gain: 0, slope: 12, cut: false },
    mids: defaultMidFreqs(count).map((freq) => ({ freq, gain: 0, q: 1 })),
    high: { freq: 5000, gain: 0, slope: 12, cut: false },
  };
}

/** Ensure the Side band set exists; clones the Mid set when first needed
 *  (preserves dynamic-compression fields for the Dynamic EQ). */
export function ensureSideBands(eq) {
  if (eq.sideLow && eq.sideMids && eq.sideHigh) return eq;
  const clone = (b) => (b ? { ...b } : null);
  const mids = eq.mids || [];
  return {
    ...eq,
    sideLow: eq.sideLow || clone(eq.low) || { freq: 200, gain: 0, slope: 12, cut: false },
    sideMids: eq.sideMids || mids.map(clone),
    sideHigh: eq.sideHigh || clone(eq.high) || { freq: 5000, gain: 0, slope: 12, cut: false },
  };
}

/** Band set currently being edited: Mid (low/mids/high) or Side (side*). */
export function getActiveBands(eq) {
  if (eq?.msMode && eq?.msChannel === 'side') {
    return { enabled: !!eq?.enabled, low: eq.sideLow, mids: eq.sideMids, high: eq.sideHigh };
  }
  return { enabled: !!eq?.enabled, low: eq.low, mids: eq.mids, high: eq.high };
}

/** The *other* channel's band set (for the ghost curve), or null in stereo. */
export function getInactiveBands(eq) {
  if (!eq?.msMode) return null;
  if (eq?.msChannel === 'side') return { enabled: !!eq?.enabled, low: eq.low, mids: eq.mids, high: eq.high };
  return { enabled: !!eq?.enabled, low: eq.sideLow, mids: eq.sideMids, high: eq.sideHigh };
}

/** Patch one band on the active channel. id: 'low' | 'high' | 'mid<i>'. */
export function updateActiveBand(eq, id, patch) {
  if (eq?.msMode && eq?.msChannel === 'side') {
    const side = ensureSideBands(eq);
    if (id === 'low') return { ...side, sideLow: { ...side.sideLow, ...patch } };
    if (id === 'high') return { ...side, sideHigh: { ...side.sideHigh, ...patch } };
    if (id.startsWith('mid')) {
      const idx = parseInt(id.slice(3), 10);
      const mids = side.sideMids.map((m, i) => (i === idx ? { ...m, ...patch } : m));
      return { ...side, sideMids: mids };
    }
    return eq;
  }
  return updateBand(eq, id, patch);
}

/** Change band count on both channels so the graph stays comparable. */
export function setActiveBandCount(eq, count, isDynamic) {
  const next = setBandCount(eq, count, isDynamic);
  const side = ensureSideBands(next);
  const sideMids = [];
  for (let i = 0; i < count - 2; i++) {
    sideMids.push(side.sideMids?.[i] ? { ...side.sideMids[i] } : newMidFor(count, i, isDynamic));
  }
  return { ...side, sideMids };
}

/** Zero the active channel's gains, cuts, and dynamic params (for Dynamic EQ reset). */
export function resetActiveChannel(eq, isDynamic = false) {
  const resetBand = (b) => {
    const out = { ...b, gain: 0, cut: false };
    if (isDynamic) {
      out.threshold = -24;
      out.ratio = 1;
      out.attack = 0.01;
      out.release = 0.2;
      out.satEnabled = false;
      out.satDrive = 0.3;
    }
    return out;
  };
  const resetMids = (mids) => mids.map((m) => {
    const out = { ...m, gain: 0 };
    if (isDynamic) {
      out.threshold = -24;
      out.ratio = 1;
      out.attack = 0.01;
      out.release = 0.2;
      out.satEnabled = false;
      out.satDrive = 0.3;
    }
    return out;
  });

  if (eq?.msMode && eq?.msChannel === 'side') {
    const side = ensureSideBands(eq);
    return {
      ...side,
      sideLow: resetBand(side.sideLow),
      sideMids: resetMids(side.sideMids),
      sideHigh: resetBand(side.sideHigh),
    };
  }
  return {
    ...eq,
    low: resetBand(eq.low),
    mids: resetMids(eq.mids),
    high: resetBand(eq.high),
  };
}