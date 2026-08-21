import React, { useCallback, useRef } from 'react';

/**
 * SpreadRange — a symmetric, two-handle range slider modelled on Logic Pro's
 * Stereo Spread. Two independent handles define the LOWER and UPPER limits of
 * the spread band, on a 0–3 scale where the reference value (`center`, 1.0 =
 * original width) is pinned to the EXACT MIDDLE of the rail (50%) so the two
 * sides are equal pixel width. The fill spans between the two handles.
 * Option/Alt-click resets to `defaultValue`. Dragging the track (not a handle)
 * grabs the nearest handle.
 *
 * Props:
 *  - value: [lo, hi]
 *  - onChange([lo, hi])
 *  - min, max, step
 *  - center: the symmetric reference value placed at 50% (default 1)
 *  - accent: fill + handle glow colour
 *  - defaultValue: [lo, hi] used by Option-click reset
 */
export default function SpreadRange({
  value,
  onChange,
  min = 0,
  max = 3,
  step = 0.01,
  center = 1,
  accent = '#5eead4',
  defaultValue = [1, 1],
}) {
  const ref = useRef(null);
  const drag = useRef(null); // 'lo' | 'hi' | 'both' | null
  const bandStart = useRef(null); // { lo, hi, v } for whole-band dragging
  const [lo, hi] = value;

  // Symmetric piecewise mapping: `center` sits at 50% of the rail.
  const pct = useCallback(
    (v) => {
      if (v <= center) {
        const leftSpan = center - min;
        return leftSpan <= 0 ? 0 : Math.max(0, Math.min(50, ((v - min) / leftSpan) * 50));
      }
      const rightSpan = max - center;
      return rightSpan <= 0 ? 100 : Math.max(50, Math.min(100, 50 + ((v - center) / rightSpan) * 50));
    },
    [min, max, center],
  );

  const valFromFrac = useCallback(
    (f) => {
      const raw = f <= 0.5
        ? min + (f * 2) * (center - min)
        : center + ((f - 0.5) * 2) * (max - center);
      return Math.max(min, Math.min(max, Math.round(raw / step) * step));
    },
    [min, max, center, step],
  );

  const valFromX = useCallback(
    (clientX) => {
      const el = ref.current;
      if (!el) return center;
      const r = el.getBoundingClientRect();
      let f = (clientX - r.left) / r.width;
      f = Math.max(0, Math.min(1, f));
      return valFromFrac(f);
    },
    [valFromFrac, center],
  );

  const loPct = pct(lo);
  const hiPct = pct(hi);

  const onPointerDown = (e) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onChange([...defaultValue]);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const v = valFromX(e.clientX);
    // Click INSIDE the band (between the two handles) → grab the whole range
    // and slide it left/right, keeping the width fixed.
    if (v > lo + step && v < hi - step) {
      drag.current = 'both';
      bandStart.current = { lo, hi, v };
      return;
    }
    const dLo = Math.abs(v - lo);
    const dHi = Math.abs(v - hi);
    drag.current = dLo <= dHi ? 'lo' : 'hi';
    if (drag.current === 'lo') onChange([Math.min(v, hi - step), hi]);
    else onChange([lo, Math.max(v, lo + step)]);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    if (drag.current === 'both') {
      const bs = bandStart.current;
      if (!bs) return;
      const dv = valFromX(e.clientX) - bs.v;
      const width = bs.hi - bs.lo;
      let nLo = Math.max(min, Math.min(max - width, bs.lo + dv));
      let nHi = nLo + width;
      nLo = Math.round(nLo / step) * step;
      nHi = Math.round(nHi / step) * step;
      onChange([nLo, nHi]);
      return;
    }
    const v = valFromX(e.clientX);
    if (drag.current === 'lo') onChange([Math.min(v, hi - step), hi]);
    else onChange([lo, Math.max(v, lo + step)]);
  };

  const onPointerUp = (e) => {
    drag.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative h-9 w-full cursor-pointer touch-none select-none"
    >
      {/* track */}
      <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/15" />
      {/* center sticky tick (1.0 = original) at the rail midpoint */}
      <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-white/55" style={{ left: '50%' }} />
      {/* selected band fill — the visible [lo, hi] range */}
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
        style={{
          left: `${loPct}%`,
          width: `${Math.max(0, hiPct - loPct)}%`,
          background: `linear-gradient(90deg, ${accent}22, ${accent})`,
          boxShadow: `0 0 10px ${accent}55`,
        }}
      />
      {/* lower-limit handle */}
      <div
        className="absolute top-1/2 -ml-[5px] h-5 w-2.5 -translate-y-1/2 rounded-sm border border-white/60 bg-white/90 shadow-md"
        style={{ left: `${loPct}%`, boxShadow: `0 0 8px ${accent}66` }}
      />
      {/* upper-limit handle */}
      <div
        className="absolute top-1/2 -ml-[5px] h-5 w-2.5 -translate-y-1/2 rounded-sm border border-white/60 bg-white/90 shadow-md"
        style={{ left: `${hiPct}%`, boxShadow: `0 0 10px ${accent}aa` }}
      />
    </div>
  );
}