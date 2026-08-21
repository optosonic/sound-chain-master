/**
 * Multi-Band Compressor model.
 *
 * Splits the spectrum into 1–5 bands via draggable Linkwitz-Riley crossover
 * frequencies; each band has its own compressor (threshold / ratio / attack /
 * release / knee / makeup) plus solo + bypass. Shared by the DSP engine
 * (SignalChain.updateMultiBandComp) and the UI (MultiBandCompPanel / MBCGraph).
 */

export const MBC_BAND_COUNTS = [1, 2, 3, 4, 5];
export const MBC_MIN_FREQ = 30;
export const MBC_MAX_FREQ = 18000;
export const MBC_MIN_THRESH = -60;
export const MBC_MAX_THRESH = 0;

// Band colours low → high (distinct from the EQ palette).
export const MBC_BAND_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];

const logMin = Math.log10(MBC_MIN_FREQ);
const logMax = Math.log10(MBC_MAX_FREQ);

export const mbcFreqToX = (f, w) => ((Math.log10(f) - logMin) / (logMax - logMin)) * w;
export const mbcXToFreq = (x, w) => Math.pow(10, logMin + (x / w) * (logMax - logMin));

export function defaultBand() {
  return { enabled: true, solo: false, threshold: -18, ratio: 2.5, attack: 0.01, release: 0.15, knee: 6, makeupGain: 0 };
}

/** Log-spaced default crossover frequencies for `count` bands (count−1 points). */
export function defaultCrossovers(count) {
  const n = count - 1;
  if (n <= 0) return [];
  const lo = 120;
  const hi = 8000;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    out.push(Math.round(Math.pow(10, Math.log10(lo) + t * (Math.log10(hi) - Math.log10(lo)))));
  }
  return out;
}

export function defaultMultiBandComp(count = 4) {
  return {
    enabled: false,
    bandCount: count,
    crossovers: defaultCrossovers(count),
    bands: Array.from({ length: count }, defaultBand),
    // M/S mode: an independent Side band set (Mid uses `bands`).
    msMode: false,
    msChannel: 'mid',
    sideBands: Array.from({ length: count }, defaultBand),
    globalMakeup: 0,
    mix: 100,
  };
}

/** Change the band count, preserving crossovers/bands where possible. */
export function setMbcBandCount(state, count) {
  const k = Math.max(1, Math.min(5, count));
  const prevX = state.crossovers || [];
  const prevBands = state.bands || [];
  const need = k - 1;
  const def = defaultCrossovers(k);
  const crossovers = [];
  for (let i = 0; i < need; i++) crossovers.push(prevX[i] ?? def[i]);
  const bands = [];
  for (let i = 0; i < k; i++) bands.push(prevBands[i] ? { ...prevBands[i] } : defaultBand());
  const prevSide = state.sideBands || [];
  const sideBands = [];
  for (let i = 0; i < k; i++) sideBands.push(prevSide[i] ? { ...prevSide[i] } : defaultBand());
  return { ...state, bandCount: k, crossovers, bands, sideBands };
}

/** Patch one band by index. `channel` 'mid' (default) edits `bands[i]`;
 *  'side' edits the independent Side band set `sideBands[i]` (M/S mode). */
export function updateMbcBand(state, i, patch, channel = 'mid') {
  if (channel === 'side') {
    const sideBands = (state.sideBands || []).map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    return { ...state, sideBands };
  }
  const bands = state.bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
  return { ...state, bands };
}

/** Patch one crossover frequency by index (neighbour clamping is applied in the UI). */
export function updateMbcCrossover(state, i, freq) {
  const crossovers = state.crossovers.map((c, idx) => (idx === i ? freq : c));
  return { ...state, crossovers };
}

/**
 * Flat band descriptor list for the canvas:
 * { id, color, lo, hi, center, threshold, ... } — lo/hi are the band edges (Hz),
 * center is the log geometric mean (where the threshold handle sits).
 */
export function mbcBandList(state) {
  const k = state.bandCount;
  const x = state.crossovers || [];
  const edges = [MBC_MIN_FREQ, ...x, MBC_MAX_FREQ];
  // M/S mode: show the channel being edited (Mid = bands, Side = sideBands).
  const side = state.msMode && state.msChannel === 'side';
  const bandSet = side ? (state.sideBands || state.bands) : state.bands;
  const list = [];
  for (let i = 0; i < k; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const center = Math.sqrt(lo * hi);
    list.push({
      id: i,
      color: MBC_BAND_COLORS[i % MBC_BAND_COLORS.length],
      lo, hi, center,
      ...bandSet[i],
    });
  }
  return list;
}

// Logarithmic makeup-gain mapping: 0 dB sits at the bottom (norm 0), and the
// 0.5→24 dB range maps logarithmically so low boosts get more travel. MG_FLOOR
// matches the Makeup dial step (0.5 dB) so the dial and the graph grabber stay
// in sync.
export const MG_FLOOR = 0.1;
export const MG_MAX = 24;
const _logFloor = Math.log10(MG_FLOOR);
const _logMax = Math.log10(MG_MAX);
const _logSpan = _logMax - _logFloor;
export const mgToNorm = (mg) => (mg <= 0 ? 0 : (Math.log10(Math.max(MG_FLOOR, mg)) - _logFloor) / _logSpan);
export const normToMg = (norm) => {
  if (norm <= 0) return 0;
  const v = Math.pow(10, _logFloor + norm * _logSpan);
  return Math.round(v / 0.1) * 0.1;
};