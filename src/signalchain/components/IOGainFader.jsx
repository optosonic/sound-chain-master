import React, { useRef } from 'react';

// Log-taper gain fader. Unity (0 dB) sits 3/4 up the track; +12 dB at the top,
// −36 dB at the bottom. Below unity the position follows amplitude (10^(dB/20))
// so most of the travel lives in the cut region for fine gain-staging; above
// unity it is linear across the small +12 dB boost band. This matches the
// Ozone I/O fader feel the user referenced.
const MAX_DB = 12;
const MIN_DB = -36;
const UNITY_P = 0.75;
const F0 = Math.pow(10, MIN_DB / 20);

const dbToP = (db) => {
  if (db >= 0) return UNITY_P + (1 - UNITY_P) * (db / MAX_DB);
  const amp = Math.pow(10, db / 20);
  return UNITY_P * (amp - F0) / (1 - F0);
};
const pToDb = (p) => {
  const pp = Math.max(0, Math.min(1, p));
  if (pp >= UNITY_P) return ((pp - UNITY_P) / (1 - UNITY_P)) * MAX_DB;
  const amp = F0 + (pp / UNITY_P) * (1 - F0);
  return 20 * Math.log10(amp);
};

function Fader({ value, onChange, accent, dual }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const p = dbToP(value);
  const topPct = (1 - p) * 100;
  const unityTopPct = (1 - UNITY_P) * 100;
  const handleW = dual ? 16 : 28;
  const tickW = dual ? 7 : 11;

  const update = (e) => {
    const el = trackRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const pp = 1 - y / rect.height;
    onChange(Math.round(pToDb(pp) * 10) / 10);
  };
  const onDown = (e) => {
    e.preventDefault();
    // Option-click (Alt) — reset to 0 dB unity.
    if (e.altKey) { onChange(0); return; }
    draggingRef.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} update(e);
  };
  const onMove = (e) => { if (draggingRef.current) update(e); };
  const onUp = (e) => { draggingRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} };

  return (
    <div
      ref={trackRef}
      className={`relative h-full ${dual ? 'w-3.5' : 'w-6'} cursor-ns-resize rounded-md border border-white/10 bg-black/60`}
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* center rail */}
      <div className="absolute left-1/2 top-1.5 bottom-1.5 w-px -translate-x-1/2 bg-white/10" />
      {/* unity (0 dB) tick */}
      <div className="absolute left-1 right-1 -translate-y-1/2" style={{ top: `${unityTopPct}%` }}>
        <div className="mx-auto h-px bg-white/25" style={{ width: tickW }} />
      </div>
      {/* gain fill 0 → value */}
      <div
        className="absolute left-1/2 w-1 -translate-x-1/2 rounded-full"
        style={{ top: `${Math.min(topPct, unityTopPct)}%`, height: `${Math.abs(topPct - unityTopPct)}%`, background: accent, opacity: 0.5, boxShadow: `0 0 6px ${accent}` }}
      />
      {/* handle — oversized for easy grabbing */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ top: `${topPct}%`, width: handleW, height: 14, background: 'linear-gradient(180deg,#6b7280,#3f4248)', border: '1px solid rgba(0,0,0,0.65)', boxShadow: '0 1px 2px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.25)' }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: handleW * 0.6, height: 2, background: accent, boxShadow: `0 0 7px ${accent}, 0 0 2px ${accent}` }} />
      </div>
    </div>
  );
}

/**
 * IOGainFader — Ozone-style vertical gain-trim fader flanking the master I/O
 * meters. Pass `values` as a 1-element array for a linked (stereo) fader, or a
 * 2-element array [L, R] to render independent left/right sub-faders. The
 * parent owns the values and `onChange(index, db)`.
 */
export default function IOGainFader({ values, onChange, label = 'IN', accent = '#22d3ee' }) {
  const arr = Array.isArray(values) ? values : [values];
  const dual = arr.length > 1;
  return (
    <div className="flex h-full flex-col items-center gap-1 select-none">
      <span className="text-[7px] font-mono uppercase tracking-widest" style={{ color: accent, opacity: 0.85 }}>{label}</span>
      <div className="flex min-h-0 flex-1 justify-center gap-1">
        {arr.map((v, i) => (
          <Fader key={i} value={v} onChange={(db) => onChange(i, db)} accent={accent} dual={dual} />
        ))}
      </div>
      <div className="flex flex-col items-center leading-tight">
        {arr.map((v, i) => (
          <span key={i} className="text-[7px] font-mono tabular-nums whitespace-nowrap" style={{ color: accent }}>
            {v > 0 ? '+' : ''}{v.toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}