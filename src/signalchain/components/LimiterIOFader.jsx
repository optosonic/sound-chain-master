import React, { useRef } from 'react';

// Light-scheme vertical gain-trim fader for the Brickwall Limiter's meter
// bay. Same log-taper dB↔position mapping as IOGainFader (unity at 3/4, +12 dB
// top, −36 dB bottom) but rendered in a light cream/ivory colour scheme so it
// reads as a distinct, brighter element sandwiched between the dark LED
// meters — deliberately different from the dark cyan Master Level Meter fader.
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

// Amber accent harmonises with the GR section's gold; the rest of the fader is
// a light ivory track + pale handle so the whole thing reads "light".
const ACCENT = '#c98f2e';

/**
 * LimiterIOFader — a single-channel (linked stereo) vertical gain fader with
 * a light colour scheme, built to flank the GR meter in the Brickwall Limiter.
 *
 * Props:
 *  - value     : current gain in dB
 *  - onChange(db)
 *  - label     : small caps label above the track ("IN" / "OUT")
 */
export default function LimiterIOFader({ value, onChange, label = 'IN' }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const p = dbToP(value);
  const topPct = (1 - p) * 100;
  const unityTopPct = (1 - UNITY_P) * 100;

  const update = (e) => {
    const el = trackRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const pp = 1 - y / rect.height;
    onChange(Math.round(pToDb(pp) * 10) / 10);
  };
  const onDown = (e) => {
    e.preventDefault();
    if (e.altKey) { onChange(0); return; } // Alt-click → reset to unity
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    update(e);
  };
  const onMove = (e) => { if (draggingRef.current) update(e); };
  const onUp = (e) => { draggingRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} };

  return (
    <div className="flex h-full w-9 flex-col items-center gap-1 select-none">
      <span className="text-[8px] font-mono font-semibold uppercase tracking-widest" style={{ color: ACCENT, opacity: 0.9 }}>{label}</span>
      <div
        ref={trackRef}
        className="relative min-h-0 flex-1 w-5 cursor-ns-resize rounded-md border bg-[#e7e9e1]"
        style={{ touchAction: 'none', borderColor: 'rgba(0,0,0,0.22)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.08)' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* center rail */}
        <div className="absolute left-1/2 top-1.5 bottom-1.5 w-px -translate-x-1/2 bg-black/15" />
        {/* unity (0 dB) tick */}
        <div className="absolute left-1 right-1 -translate-y-1/2" style={{ top: `${unityTopPct}%` }}>
          <div className="mx-auto h-px bg-black/35" style={{ width: 11 }} />
        </div>
        {/* gain fill 0 → value */}
        <div
          className="absolute left-1/2 w-1 -translate-x-1/2 rounded-full"
          style={{ top: `${Math.min(topPct, unityTopPct)}%`, height: `${Math.abs(topPct - unityTopPct)}%`, background: ACCENT, opacity: 0.65, boxShadow: `0 0 5px ${ACCENT}` }}
        />
        {/* handle — pale ivory cap */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ top: `${topPct}%`, width: 18, height: 13, background: 'linear-gradient(180deg,#fbfdfb,#cdd1ca)', border: '1px solid rgba(0,0,0,0.4)', boxShadow: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.8)' }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 10, height: 2, background: ACCENT, boxShadow: `0 0 6px ${ACCENT}, 0 0 2px ${ACCENT}` }} />
        </div>
      </div>
      <span className="text-[8px] font-mono tabular-nums leading-tight" style={{ color: ACCENT }}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
    </div>
  );
}