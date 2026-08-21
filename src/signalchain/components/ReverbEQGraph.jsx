import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';

/**
 * ReverbEQGraph — the reverb's wet-shaping EQ editor (Low Cut → Damping →
 * High Shelf). Rendered on its own clean frequency-response canvas (Main tab
 * shows the reverb field; the EQ tab shows this graph).
 *
 * Responsive: measures its container and draws in real pixel space, so the
 * log-frequency axis, gridlines, curve and handles never stretch or distort
 * regardless of the panel width/height (the previous fixed 300×196 viewBox +
 * preserveAspectRatio="none" stretched the handles into ellipses and made the
 * high end read as "compressed").
 *
 * Handles:
 *   • Low Cut (LC) — drag horizontally, high-pass corner 20–500 Hz
 *   • Damping (Dmp) — drag horizontally, low-pass corner 500 Hz–20 kHz
 *   • High Shelf (HS) — drag in 2D, shelf freq 1k–16k + gain ±12 dB
 */
const ACCENT = '#c4b5fd';
const F_MIN = 20, F_MAX = 20000;
const DB_MIN = -24, DB_MAX = 12;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function respDb(f, lowCut, dampFreq, hsFreq, hsGain) {
  const hp = (f * f) / Math.sqrt(f * f * f * f + Math.pow(lowCut, 4));
  const lp = (dampFreq * dampFreq) / Math.sqrt(Math.pow(f, 4) + Math.pow(dampFreq, 4));
  const hsDb = hsGain * (f * f / (f * f + hsFreq * hsFreq));
  return 20 * Math.log10(Math.max(1e-6, hp)) + 20 * Math.log10(Math.max(1e-6, lp)) + hsDb;
}

export default function ReverbEQGraph({ r, update }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lowCut = clamp(r.lowCut, 20, 1000);
  const damping = clamp(r.damping, 0, 1);
  const dampFreq = 500 + damping * 19500;
  const hsFreq = clamp(r.highShelfFreq, 1000, 16000);
  const hsGain = clamp(r.highShelfGain, -12, 12);

  const { w, h } = dims;
  const ready = w > 0 && h > 0;

  // Geometry in real pixels — margins leave room for handle labels (top) and
  // frequency labels (bottom).
  const LM = 14, RM = 14, TOP = 34, BOTTOM = Math.max(TOP + 40, h - 22);
  const PW = Math.max(1, w - LM - RM);
  const PH = Math.max(1, BOTTOM - TOP);

  const fToX = (f) => LM + (Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN)) * PW;
  const dbToY = (db) => TOP + ((DB_MAX - db) / (DB_MAX - DB_MIN)) * PH;
  const xToF = (x) => F_MIN * Math.pow(F_MAX / F_MIN, (x - LM) / PW);
  const yToDb = (y) => DB_MAX - ((y - TOP) / PH) * (DB_MAX - DB_MIN);

  const start = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = id;
    try { svgRef.current.setPointerCapture(e.pointerId); } catch {}
  }, []);
  const end = useCallback((e) => {
    dragRef.current = null;
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch {}
  }, []);
  const move = useCallback((e) => {
    const id = dragRef.current;
    if (!id || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const y = ((e.clientY - rect.top) / rect.height) * h;
    if (id === 'lowCut') {
      update({ lowCut: Math.round(clamp(xToF(x), 20, 1000)) });
    } else if (id === 'damping') {
      const f = clamp(xToF(x), 500, 20000);
      update({ damping: +((f - 500) / 19500).toFixed(3) });
    } else if (id === 'hs') {
      update({
        highShelfFreq: Math.round(clamp(xToF(x), 1000, 16000)),
        highShelfGain: +clamp(yToDb(y), -12, 12).toFixed(1),
      });
    }
  }, [w, h]);

  if (!ready) {
    return <div ref={wrapRef} className="absolute inset-0" />;
  }

  // Response curve. The handle frequencies are added as explicit breakpoints so
  // the polyline passes exactly through each handle's (x, y) — no near-misses
  // from log-spaced sampling landing between the handle and its nearest vertex.
  const N = 140;
  const freqs = [];
  for (let i = 0; i <= N; i++) freqs.push(F_MIN * Math.pow(F_MAX / F_MIN, i / N));
  [lowCut, dampFreq, hsFreq].forEach((f) => freqs.push(clamp(f, F_MIN, F_MAX)));
  freqs.sort((a, b) => a - b);
  const pts = freqs.map((f) => {
    const db = respDb(f, lowCut, dampFreq, hsFreq, hsGain);
    return `${fToX(f).toFixed(1)},${clamp(dbToY(db), TOP, BOTTOM).toFixed(1)}`;
  });
  const curve = pts.join(' ');
  const area = `${LM},${BOTTOM} ${curve} ${LM + PW},${BOTTOM}`;

  const lcX = fToX(clamp(lowCut, F_MIN, F_MAX));
  const lcY = clamp(dbToY(respDb(lowCut, lowCut, dampFreq, hsFreq, hsGain)), TOP, BOTTOM);
  const dpX = fToX(clamp(dampFreq, F_MIN, F_MAX));
  const dpY = clamp(dbToY(respDb(dampFreq, lowCut, dampFreq, hsFreq, hsGain)), TOP, BOTTOM);
  const hsX = fToX(clamp(hsFreq, F_MIN, F_MAX));
  // HS handle sits ON the curve at the shelf corner (≈3 dB below the asymptotic
  // gain), not at the asymptote — so the dot is pinned to the line.
  const hsY = clamp(dbToY(respDb(hsFreq, lowCut, dampFreq, hsFreq, hsGain)), TOP, BOTTOM);

  const Handle = ({ x, y, onDown, label }) => (
    <g onPointerDown={onDown} style={{ cursor: 'grab', pointerEvents: 'auto' }}>
      <circle cx={x} cy={y} r={7} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeOpacity={0.8} strokeWidth={1.2} />
      <circle cx={x} cy={y} r={2.8} fill={ACCENT} />
      <text x={x} y={y - 10} fontSize={9} fontFamily="monospace" fill={ACCENT} fillOpacity={0.9} textAnchor="middle">{label}</text>
    </g>
  );

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      >
        {/* clean graph background */}
        <rect x={0} y={0} width={w} height={h} fill="rgba(8,10,18,0.92)" />
        <rect x={LM} y={TOP} width={PW} height={PH} fill="rgba(196,181,253,0.03)" />

        {/* log frequency gridlines + labels */}
        {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => {
          const major = f === 100 || f === 1000 || f === 10000;
          const x = fToX(f);
          return (
            <g key={'v' + f}>
              <line x1={x} y1={TOP} x2={x} y2={BOTTOM} stroke={major ? 'rgba(196,181,253,0.14)' : 'rgba(196,181,253,0.06)'} strokeWidth={0.6} />
              {major && <text x={x} y={h - 6} fontSize={9} fontFamily="monospace" fill="rgba(196,181,253,0.55)" textAnchor="middle">{f >= 1000 ? `${f / 1000}k` : f}</text>}
            </g>
          );
        })}
        {/* dB gridlines */}
        {[-12, -6, 0, 6, 12].map((db) => (
          <line key={'h' + db} x1={LM} y1={dbToY(db)} x2={LM + PW} y2={dbToY(db)} stroke={db === 0 ? 'rgba(196,181,253,0.20)' : 'rgba(196,181,253,0.07)'} strokeWidth={0.6} strokeDasharray={db === 0 ? '3 3' : undefined} />
        ))}

        <polygon points={area} fill={ACCENT} fillOpacity={0.07} />
        <polyline points={curve} fill="none" stroke={ACCENT} strokeOpacity={0.9} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

        <Handle x={lcX} y={lcY} onDown={(e) => start(e, 'lowCut')} label="LC" />
        <Handle x={dpX} y={dpY} onDown={(e) => start(e, 'damping')} label="Dmp" />
        <Handle x={hsX} y={hsY} onDown={(e) => start(e, 'hs')} label="HS" />
      </svg>
    </div>
  );
}