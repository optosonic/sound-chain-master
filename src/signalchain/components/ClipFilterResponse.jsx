import React, { useMemo } from 'react';

const CYAN = '#87ceeb';
const Fs = 44100;

// RBJ biquad cookbook coefficients (a0-normalised).
function biquad(type, f0, Q, dBgain) {
  const w0 = (2 * Math.PI * f0) / Fs;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, dBgain / 40);
  const alpha = sw / (2 * Math.max(0.0001, Q));
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highpass':
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highshelf':
      b0 = A * ((A + 1) + (A - 1) * cw + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cw);
      b2 = A * ((A + 1) + (A - 1) * cw - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) - (A - 1) * cw + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cw);
      a2 = (A + 1) - (A - 1) * cw - 2 * Math.sqrt(A) * alpha; break;
    default:
      b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function magDb(b, w) {
  const cw = Math.cos(w), sw = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b.b0 + b.b1 * cw + b.b2 * c2;
  const ni = b.b1 * sw + b.b2 * s2;
  const dr = 1 + b.a1 * cw + b.a2 * c2;
  const di = b.a1 * sw + b.a2 * s2;
  const m = Math.sqrt(nr * nr + ni * ni) / Math.sqrt(dr * dr + di * di);
  return 20 * Math.log10(m || 1e-9);
}

const FMIN = 20, FMAX = 20000;

/**
 * Build the combined tone-chain frequency-response curve (Clip Filter → Tone
 * HP → High Shelf → LP Filter) as an SVG polyline points string for the given
 * canvas geometry. Shared by the standalone graph and the transfer-canvas
 * overlay so the math lives in one place.
 */
export function filterStages(clip) {
  const c = clip || {};
  return [
    biquad(c.clipFilterType === 'highpass' ? 'highpass' : 'lowpass', c.clipFilterFreq ?? 4400, 0.707, 0),
    biquad('highpass', c.tone ?? 170, 0.707, 0),
    biquad('highshelf', c.highShelfFreq ?? 980, 0.707, c.highShelfGain ?? 0),
    biquad('lowpass', c.lpFilterFreq ?? 6600, 0.707, 0),
  ];
}

/** Combined tone-chain gain (dB) at a single frequency — used to anchor the
 *  draggable tone-line control dots on the transfer canvas. */
export function filterDbAtFreq(clip, f) {
  const w = (2 * Math.PI * f) / Fs;
  let db = 0;
  for (const s of filterStages(clip)) db += magDb(s, w);
  return db;
}

export function filterResponsePoints(clip, { width = 300, midY = 70, pxPerDb = 58 / 30, dbSpan = 30, n = 240 } = {}) {
  const stages = filterStages(clip);
  const xFor = (f) => ((Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * width;
  const yFor = (db) => midY - Math.max(-dbSpan, Math.min(dbSpan, db)) * pxPerDb;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = Math.pow(10, Math.log10(FMIN) + (i / n) * (Math.log10(FMAX) - Math.log10(FMIN)));
    const w = (2 * Math.PI * f) / Fs;
    let db = 0;
    for (const s of stages) db += magDb(s, w);
    pts.push(`${xFor(f).toFixed(1)},${yFor(db).toFixed(1)}`);
  }
  return pts.join(' ');
}

const VW = 300, VH = 120, MIDY = VH / 2;
const freqToX = (f) => ((Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * VW;
const dbToY = (db) => MIDY - (Math.max(-30, Math.min(30, db)) / 30) * (VH / 2 - 6);

/** Standalone combined filter-response graph (used wherever a separate graph is wanted). */
export default function ClipFilterResponse({ clip }) {
  const curve = useMemo(
    () => filterResponsePoints(clip, { width: VW, midY: MIDY, pxPerDb: (VH / 2 - 6) / 30, dbSpan: 30 }),
    [clip],
  );
  return (
    <div className="relative mt-3 rounded-lg bg-black/40 border p-2" style={{ borderColor: CYAN + '33' }}>
      <div className="absolute top-1.5 left-2 text-[9px] font-mono" style={{ color: CYAN }}>Filter Response</div>
      <div className="absolute top-1.5 right-2 text-[9px] font-mono text-white/45">±30 dB · 20Hz–20kHz</div>
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {[100, 1000, 10000].map((f) => (
          <line key={f} x1={freqToX(f)} y1="8" x2={freqToX(f)} y2={VH - 12} stroke="rgba(135,206,235,0.08)" strokeWidth="0.5" />
        ))}
        {[-24, -12, 0, 12, 24].map((db) => (
          <line key={db} x1="0" y1={dbToY(db)} x2={VW} y2={dbToY(db)} stroke={db === 0 ? 'rgba(135,206,235,0.25)' : 'rgba(135,206,235,0.07)'} strokeWidth="0.5" />
        ))}
        <polyline points={curve} fill="none" stroke={CYAN} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${CYAN}88)` }} />
      </svg>
      <div className="flex justify-between px-1 text-[8px] font-mono text-white/35">
        <span>20</span><span>100</span><span>1k</span><span>10k</span><span>20k</span>
      </div>
    </div>
  );
}