import React from 'react';

/**
 * Segmented LED level-meter column. Pure presentational — the parent owns the
 * metering loop and passes already-decimated dB values each frame.
 *
 * The fill colour is ABSOLUTE to the scale (not relative to the fill height):
 * the full green→amber→red gradient lives on the track, and an opaque mask
 * hides the unfilled top portion so the colour at any level stays fixed.
 *
 * Props:
 *  - db       : current level (dBFS)
 *  - peak     : peak-hold level (dBFS) — drawn as a tick
 *  - tp       : true-peak level (dBFS) — drawn as a dot (optional)
 *  - scale    : { top, bottom } dBFS range of the column
 *  - ceiling  : ceiling position (dBFS) — drawn as a white line
 *  - enabled  : dim the column when the limiter is off
 *  - label    : small caption above the column
 */
export default function LedMeter({ db = -120, peak = -120, tp = -120, scale = { top: 0, bottom: -60 }, ceiling = -0.1, enabled = true, label = '' }) {
  const span = scale.top - scale.bottom;
  const pct = (d) => Math.max(0, Math.min(100, ((d - scale.bottom) / span) * 100));
  const fill = enabled ? pct(db) : 0;
  const peakPct = enabled ? pct(peak) : 0;
  const tpPct = enabled ? pct(tp) : 0;
  const ceilPct = pct(ceiling);
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {label && <span className="text-[7px] font-mono uppercase tracking-wider text-white/45">{label}</span>}
      <div className="relative w-3.5 flex-1 overflow-hidden rounded-sm border border-white/10" style={{ minHeight: 120, backgroundColor: 'rgba(0,0,0,0.70)' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #10b981 0%, #22c55e 38%, #eab308 66%, #f97316 82%, #ef4444 94%, #dc2626 100%)' }} />
        <div className="absolute left-0 right-0 top-0" style={{ height: `${100 - fill}%`, backgroundColor: 'rgba(0,0,0,0.85)' }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to top, transparent 0, transparent 4px, rgba(0,0,0,0.55) 4px, rgba(0,0,0,0.55) 5px)' }} />
        <div className="absolute left-0 right-0 h-px bg-white/70" style={{ bottom: `${ceilPct}%` }} />
        {enabled && <div className="absolute left-0 right-0 h-[2px] -translate-y-1/2 bg-white" style={{ bottom: `${peakPct}%`, boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />}
        {enabled && tp > scale.bottom && <div className="absolute right-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-300" style={{ bottom: `${tpPct}%`, boxShadow: '0 0 5px rgba(103,232,249,0.9)' }} />}
      </div>
    </div>
  );
}