// Shared metering-mode logic for the Master Level Meter and the Final Output
// LED meter, so both stay in sync (one selector, two displays).

export const K_REFS = { K12: 12, K14: 14, K20: 20 };

export const METER_MODES = [
  { id: 'dBFS', label: 'dBFS' },
  { id: 'K12', label: 'K12' },
  { id: 'K14', label: 'K14' },
  { id: 'K20', label: 'K20' },
];

export const isKMode = (mode) => !!K_REFS[mode];

export function buildSegments(mode) {
  if (mode === 'dBFS') { const s = []; for (let db = -30; db <= 0; db++) s.push(db); return s; }
  const k = K_REFS[mode]; const s = []; for (let db = -k; db <= k; db++) s.push(db); return s;
}

// dBFS keeps the original blue/yellow/amber/red scheme; K-mode uses green below
// nominal, yellow into the headroom, amber near the ceiling, red at 0 dBFS.
export function colorForSeg(seg, mode) {
  if (mode === 'dBFS') return seg >= 0 ? '#ff2b2b' : seg >= -3 ? '#ffae42' : seg <= -12 ? '#00afff' : '#ccff00';
  const k = K_REFS[mode];
  if (seg >= k) return '#ff2b2b';
  if (seg >= k - 3) return '#ffae42';
  if (seg <= 0) return '#22c55e';
  return '#ccff00';
}

const fmtK = (v) => (v > 0 ? `+${v}` : `${v}`);

export function buildHScale(mode) {
  if (mode === 'dBFS') return ['-30', '-20', '-12', '-6', '-3', '0'];
  const k = K_REFS[mode]; const half = k / 2;
  return [fmtK(-k), fmtK(-half), '0', fmtK(half), fmtK(k)];
}

export function buildVScale(mode) {
  if (mode === 'dBFS') return ['0', '-3', '-6', '-12', '-20', '-30'];
  const k = K_REFS[mode]; const half = k / 2;
  return [fmtK(k), fmtK(half), '0', fmtK(-half), fmtK(-k)];
}

// Map of segment dB → scale label, for the vertical LED meter. Rendering the
// scale as one slot per segment (mirroring the segment flex layout) keeps the
// labels aligned exactly with the lit segments regardless of container size,
// instead of `justify-between` which spaces them evenly and drifts off the
// dB grid (0, -3, -6, -12, -20, -30 are NOT evenly spaced in dB).
export function buildVScaleMap(mode) {
  const m = {};
  if (mode === 'dBFS') {
    [0, -3, -6, -12, -20, -30].forEach((db) => { m[db] = `${db}`; });
    return m;
  }
  const k = K_REFS[mode]; const half = k / 2;
  [[k, fmtK(k)], [half, fmtK(half)], [0, '0'], [-half, fmtK(-half)], [-k, fmtK(-k)]].forEach(([db, label]) => { m[db] = label; });
  return m;
}

// Per-channel meter value for the given mode:
//   dBFS     → peak dBFS
//   K-System → RMS re-anchored by the K reference (RMS + K)
export function readMeterValues(engine, monitor, mode) {
  const raw = monitor === 'in' ? engine?.getLevelsIn?.() : engine?.getLevels?.();
  let lp = -100, rp = -100;
  if (Array.isArray(raw)) { lp = raw[0] ?? -100; rp = raw[1] ?? -100; }
  else if (typeof raw === 'number') { lp = rp = raw; }
  const kRef = K_REFS[mode] || 0;
  if (!kRef) return [lp, rp];
  const d = monitor === 'in' ? engine?.getDetailIn?.() : engine?.getDetail?.();
  if (d) return [(d.left.rms ?? -100) + kRef, (d.right.rms ?? -100) + kRef];
  return [lp + kRef, rp + kRef];
}