import React, { useEffect, useRef, useCallback } from 'react';
import { Image } from '@/components/ui/image';
import { useTheme } from '@/signalchain/themes.jsx';

/**
 * Cybernetic Helix Gauge — the Mastering Effect macro dial.
 * A photorealistic brushed-metal knob face (AI-rendered asset) encircled by an
 * identity-gem radial ticks that light from 12 o'clock as the value moves, plus a
 * 12-o'clock reference mark. Drag vertically to change;
 * scroll to nudge; Alt-click resets to 0. Two metallic −/+ buttons nudge in
 * steps. Reuses the caller's onChange (no new business logic).
 */
const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
};

// AI-rendered brushed-metal knob face (pure-black background, masked to a circle).
const KNOB_FACE =
  'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/1d095f738_generated_image.png';

export default function MasterEffectGauge({
  value,
  onChange,
  min = -50,
  max = 50,
  step = 0.5,
  defaultValue = 0,
  accent,
  label = 'Mastering Effect',
  footer = '±50% mix trim. LUFS overrides medium.',
}) {
  const { theme } = useTheme();
  const gem = accent || theme?.gem || '#38e0ff';
  const dialRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const pointerId = useRef(null);
  const valueRef = useRef(value);
  const rafRef = useRef(null);
  const pendingValueRef = useRef(null);
  const lastTapRef = useRef(0);

  const sensitivity = 0.005;
  const decimals = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0;
  valueRef.current = value;

  useEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      let n = (valueRef.current - min) / (max - min) + dir * 0.02;
      n = Math.max(0, Math.min(1, n));
      let nv = min + n * (max - min);
      nv = Math.round(nv / step) * step;
      nv = Math.max(min, Math.min(max, nv));
      onChange(parseFloat(nv.toFixed(decimals)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [min, max, step, onChange, decimals]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (pendingValueRef.current != null) { onChange(pendingValueRef.current); pendingValueRef.current = null; }
  }, [onChange]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    let nn = startValue.current + deltaY * sensitivity;
    nn = Math.max(0, Math.min(1, nn));
    let nv = min + nn * (max - min);
    nv = Math.round(nv / step) * step;
    nv = Math.max(min, Math.min(max, nv));
    pendingValueRef.current = parseFloat(nv.toFixed(decimals));
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushPending);
  }, [min, max, step, decimals, flushPending]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (pendingValueRef.current != null) { onChange(pendingValueRef.current); pendingValueRef.current = null; }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try { if (pointerId.current != null) dialRef.current?.releasePointerCapture(pointerId.current); } catch {}
    pointerId.current = null;
  }, [onChange]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.altKey) {
      const reset = defaultValue != null ? Math.max(min, Math.min(max, defaultValue)) : (0 >= min && 0 <= max ? 0 : min);
      onChange(parseFloat(reset.toFixed(decimals)));
      return;
    }
    // Only start a rotation drag when the press lands ON the knob disc
    // (radius ≤ knobR from the dial centre). The outer bevel / ring stays inert.
    const rect = dialRef.current?.getBoundingClientRect();
    if (rect) {
      const px = e.clientX - (rect.left + rect.width / 2);
      const py = e.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(px, py) > knobR) return;
    }
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = (value - min) / (max - min);
    pointerId.current = e.pointerId;
    try { dialRef.current?.setPointerCapture(e.pointerId); } catch {}
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [value, min, max, defaultValue, onChange]);

  const nudge = (dir) => {
    let nv = value + dir * step;
    nv = Math.round(nv / step) * step;
    nv = Math.max(min, Math.min(max, nv));
    onChange(parseFloat(nv.toFixed(decimals)));
  };

  // Geometry — the KNOB and the CASING (bevel) are two separate objects.
  //   knob  : a clean brushed-metal disc, cropped to a circle (its own element)
  //   casing: a metallic bevel ring drawn around the knob (a separate element)
  //   arc   : sits in the dark gap BETWEEN the knob and the bevel
  //   tick  : rests ON the bevel
  const W = 292;
  const dim = 256;            // dial box (fits knob + dark gap + arc + bevel + tick)
  const cx = dim / 2;         // 128
  const cy = dim / 2;         // 128
  const disc = 180;           // knob face diameter
  const knobR = disc / 2;     // 90 — knob radius
  const discInset = (dim - disc) / 2;
  // The AI-rendered knob image ships with a black border around the actual
  // knob. Zoom the image so the knob fills the disc and the circular clip
  // crops that black border away (no black ring around the knob).
  const KNOB_ZOOM = 1.2;
  const arcR = 99;            // LED ring — in the dark gap between knob (90) and bevel
  const bevelInner = 108;     // casing bevel inner edge
  const bevelOuter = 118;     // casing bevel outer edge
  const bevelMid = (bevelInner + bevelOuter) / 2;  // 113
  const bevelW = bevelOuter - bevelInner;          // 10
  // Rotating knurled rim mask — reveal only the knob's outer knurl ring.
  const rimMask = `radial-gradient(circle ${knobR}px at center, transparent 0 ${knobR - 6}px, #000 ${knobR - 4}px ${knobR}px)`;
  const normalized = (value - min) / (max - min);
  const signedNorm = normalized - 0.5;
  const bipolarAngle = signedNorm * 270;
  const pointerAngle = bipolarAngle;

  const gid = 'meg';


  const formatValue = (v) => {
    const x = Number.isFinite(v) ? v : 0;
    return (x > 0 ? '+' : '') + x.toFixed(decimals);
  };

  const pressBtn = (dir, glyph, title) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); nudge(dir); }}
      title={title}
      className="grid place-items-center rounded-full transition-all active:scale-90 active:translate-y-px"
      style={{
        width: 24, height: 24,
        background: 'radial-gradient(circle at 42% 32%, #2a2e35, #14161a 72%)',
        border: '1px solid rgba(0,0,0,0.75)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.10), 0 2px 4px rgba(0,0,0,0.5)',
      }}
    >
      <span
        className="grid place-items-center rounded-full leading-none"
        style={{
          width: 14, height: 14,
          background: `radial-gradient(circle at 42% 35%, color-mix(in srgb, ${gem} 55%, white), ${gem} 72%)`,
          boxShadow: `0 0 7px ${gem}bf, inset 0 0 2px rgba(255,255,255,0.45)`,
          color: '#0a1218',
        }}
      >
        <span className="text-[12px] font-bold leading-none">{glyph}</span>
      </span>
    </button>
  );

  return (
    <div className="relative flex flex-col items-center" style={{ width: W }}>

      {/* header */}
      <div className="relative pt-3 text-center">
        <span className="text-[13px] font-semibold uppercase tracking-[0.26em] text-white/85">{label}</span>
      </div>

      {/* value readout */}
      <div className="relative mb-5 text-center leading-none">
        <span className="tabular-nums text-[12px] font-light tracking-wide" style={{ color: gem }}>
          {formatValue(value)}<span className="ml-0.5 text-[11px] font-light tracking-[0.05em]" style={{ color: gem, opacity: 0.8 }}>%</span>
        </span>
      </div>

      {/* knob */}
      <div className="relative flex items-center justify-center py-0">
        <div
          ref={dialRef}
          className="relative cursor-ns-resize touch-none"
          style={{ width: dim, height: dim }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          title="Drag to trim · scroll to nudge · Alt-click to reset"
        >
          {/* ── KNOB (separate element) ──
              A clean brushed-metal face, cropped to a circle. The casing/bevel
              around it is a separate drawn ring. */}
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              width: disc, height: disc, left: discInset, top: discInset,
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.65)',
            }}
          >
            <Image src={KNOB_FACE} fittingType="fill" className="w-full h-full" alt="" style={{ transform: `scale(${KNOB_ZOOM})`, transformOrigin: 'center' }} />
            {/* Lift the blacks ~10% on the flat face + center only. Screen
                blend leaves pure white untouched (1-(1-a)(1-1)=1) while lifting
                darks toward the overlay. The knurled rim layer renders on top
                (opaque, masked to the ring) so the knurl stays untouched. */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: '#ffffff', mixBlendMode: 'screen', opacity: 0.10 }} />
          </div>
          {/* Rotating knurled rim — the knob's own outer knurl ring turns with the value */}
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              width: disc, height: disc, left: discInset, top: discInset,
              transform: `rotate(${pointerAngle}deg)`,
              transformOrigin: 'center center',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.7)',
              WebkitMaskImage: rimMask,
              maskImage: rimMask,
            }}
          >
            <Image src={KNOB_FACE} fittingType="fill" className="w-full h-full" alt="" style={{ transform: `scale(${KNOB_ZOOM})`, transformOrigin: 'center' }} />
          </div>
          {/* center button — double-click to reset to 0%.
              Rendered LAST so it sits on top of the knob face + rotating rim
              (otherwise the rim layer intercepts the center clicks). A manual
              double-tap on pointerdown is used because the parent dial's
              pointerdown calls preventDefault, which suppresses synthetic
              dblclick events in most browsers. */}
          <div
            role="button"
            tabIndex={-1}
            title="Double-click to reset to 0%"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const now = e.timeStamp;
              if (now - lastTapRef.current <= 350) {
                lastTapRef.current = 0;
                const reset = defaultValue != null ? Math.max(min, Math.min(max, defaultValue)) : (0 >= min && 0 <= max ? 0 : min);
                onChange(parseFloat(reset.toFixed(decimals)));
              } else {
                lastTapRef.current = now;
              }
            }}
            className="absolute rounded-full cursor-pointer"
            style={{
              zIndex: 20,
              width: 34, height: 34, left: discInset + disc / 2 - 17, top: discInset + disc / 2 - 17,
              background: 'radial-gradient(circle at 50% 38%, #6a6e74 0%, #4a4e54 48%, #2a2d32 78%, transparent 100%)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -1px 2px rgba(0,0,0,0.5)',
            }}
          />

          {/* ── CASING (separate element) ──
              The bevel ring + yellow radial ticks + 12-o'clock mark. Ticks sit
              in the dark gap between the knob and the bevel; they light from
              12 o'clock as the value moves. pointer-events:none keeps drag on the knob. */}
          <svg width={dim + 32} height={dim + 32} className="absolute" style={{ left: -16, top: -16, overflow: 'visible', pointerEvents: 'none' }}>
            <g transform="translate(16,16)">
            <defs>
              <radialGradient id={`${gid}-bevel`} cx={cx} cy={cy} r={bevelOuter} gradientUnits="userSpaceOnUse">
                <stop offset={bevelInner / bevelOuter} stopColor="#6a7078" />
                <stop offset="1" stopColor="#2a2d33" />
              </radialGradient>
              <filter id={`${gid}-glow`} x="-40" y="-40" width="300" height="300" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id={`${gid}-led`} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.8" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Bevel / casing ring — INWARD bevel: inner edge lit, outer edge shadowed (recessed look) */}
            <circle cx={cx} cy={cy} r={bevelMid} fill="none" stroke={`url(#${gid}-bevel)`} strokeWidth={bevelW} />
            <circle cx={cx} cy={cy} r={bevelInner + 0.6} fill="none" stroke="#6a7078" strokeWidth="1" opacity="0.7" />
            <circle cx={cx} cy={cy} r={bevelOuter - 0.6} fill="none" stroke="#07090c" strokeWidth="1.2" />
            {/* radial ticks (270°) — light one-after-another from 12 o'clock */}
            {Array.from({ length: 101 }, (_, i) => {
              const a = -135 + (270 * i) / 100;
              const inner = polar(cx, cy, arcR - 4.5, a);
              const outer = polar(cx, cy, arcR + 4.5, a);
              const lit = Math.abs(signedNorm) > 0.001 && (
                bipolarAngle >= 0 ? a >= -0.01 && a <= bipolarAngle + 0.01
                                  : a <= 0.01 && a >= bipolarAngle - 0.01
              );
              return (
                <line
                  key={i}
                  x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke={lit ? gem : 'rgba(255,255,255,0.12)'}
                  strokeWidth={lit ? 1.35 : 1.05}
                  strokeLinecap="round"
                />
              );
            })}
            {/* 12 o'clock reference tick — fits WITHIN the bevel ring */}
            <line x1={cx} y1={cy - bevelOuter + 2} x2={cx} y2={cy - bevelInner - 2} stroke={gem} strokeWidth="2.6" strokeLinecap="round" filter={`url(#${gid}-glow)`} />
            </g>
          </svg>
        </div>
      </div>

      {/* − / + amber press buttons */}
      <div className="flex items-center justify-center gap-4 pb-2 pt-1">
        {pressBtn(-1, '−', 'Nudge down')}
        {pressBtn(1, '+', 'Nudge up')}
      </div>

      {/* footer */}
      <div className="px-3 pt-0.5 text-center">
        <span className="text-[9px] leading-snug text-white/45">{footer}</span>
      </div>
    </div>
  );
}