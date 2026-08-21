import React, { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/signalchain/themes.jsx';

/**
 * Reusable professional rotary dial. Drag vertically to change the value.
 *
 * Props:
 *  - value, onChange, min, max, step
 *  - label, unit
 *  - size: 'xsmall' | 'small' | 'medium'
 *  - scale: 'linear' | 'log'
 *  - accent: hex color for the active arc + pointer (defaults to violet)
 */
const hexToRgb = (h) => {
  let h2 = h.replace('#', '');
  if (h2.length === 3) h2 = h2.split('').map((c) => c + c).join('');
  const n = parseInt(h2, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const lighten = (h, amt) => {
  const { r, g, b } = hexToRgb(h);
  const m = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};
const darken = (h, amt) => {
  const { r, g, b } = hexToRgb(h);
  const m = (v) => Math.round(v * (1 - amt));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};

// Knob arc geometry: 0deg = top (12 o'clock), positive clockwise.
// Sweep spans -135deg → +135deg (270deg), gap at the bottom.
const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
};
const arcPath = (cx, cy, r, a0, a1) => {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};
// Bipolar arc — starts at 12 o'clock (top) and sweeps clockwise for positive
// angles or counter-clockwise for negative angles, so a center-zero knob
// (Direction) grows its arc left/right from the top instead of from 7 o'clock.
const arcPathBipolar = (cx, cy, r, angle) => {
  const e = polar(cx, cy, r, angle);
  const large = Math.abs(angle) > 180 ? 1 : 0;
  const sweep = angle >= 0 ? 1 : 0;
  return `M ${cx} ${(cy - r).toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};

export default function Dial({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = '',
  size = 'medium',
  scale = 'linear',
  accent = '#8b5cf6',
  className = '',
  defaultValue = null,
  bipolar = false,
  faceplate = 'dark',
  sensitivity = 0.0065,
}) {
  const { theme } = useTheme();
  const gem = theme?.gem || theme?.accent || accent;
  const light = faceplate === 'light';
  const dialRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const pointerId = useRef(null);
  const valueRef = useRef(value);
  const wheelParamsRef = useRef(null);
  const rafRef = useRef(null);
  const pendingValueRef = useRef(null);

  const sizes = { xsmall: 36, small: 48, medium: 62, large: 88, xlarge: 161 };
  const dim = sizes[size] || sizes.medium;
  const cx = dim / 2;
  const cy = dim / 2;
  const r = dim / 2 - 7;
  const strokeW = size === 'large' ? 4.5 : size === 'medium' ? 3.5 : size === 'small' ? 3 : 2.5;
  // Decimal precision for display + value rounding, derived from the step
  // magnitude so small-step dials (attack 0.001 s, release 0.01 s) don't
  // collapse to a single coarse digit and feel "locked".
  const decimals = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0;

  const gid = `dial-${accent.replace('#', '')}-${size}`;

  const valueToNormalized = useCallback((val) => {
    if (scale === 'log') {
      // min=0 (e.g. makeup gain) can't span log directly — use the step as the
      // log floor and pin 0 to the bottom of the travel.
      const floor = min > 0 ? min : (step > 0 ? step : 0.1);
      if (min <= 0 && val <= 0) return 0;
      const logMin = Math.log10(floor);
      const logMax = Math.log10(max);
      const logVal = Math.log10(Math.max(floor, val));
      return (logVal - logMin) / (logMax - logMin);
    }
    return (val - min) / (max - min);
  }, [min, max, scale, step]);

  const normalizedToValue = useCallback((norm) => {
    if (scale === 'log') {
      const floor = min > 0 ? min : (step > 0 ? step : 0.1);
      if (min <= 0 && norm <= 0) return min;
      const logMin = Math.log10(floor);
      const logMax = Math.log10(max);
      const logVal = logMin + norm * (logMax - logMin);
      return Math.pow(10, logVal);
    }
    return min + norm * (max - min);
  }, [min, max, scale, step]);

  valueRef.current = value;
  wheelParamsRef.current = { valueToNormalized, normalizedToValue, step, min, max, onChange, decimals };

  // Mouse-wheel nudging — scroll over a dial to fine-tune its value without
  // dragging. Non-passive listener so we can preventDefault the page scroll.
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const { valueToNormalized, normalizedToValue, step, min, max, onChange, decimals } = wheelParamsRef.current;
      const dir = e.deltaY > 0 ? -1 : 1;
      let n = valueToNormalized(valueRef.current) + dir * 0.015;
      n = Math.max(0, Math.min(1, n));
      let nv = normalizedToValue(n);
      nv = Math.round(nv / step) * step;
      nv = Math.max(min, Math.min(max, nv));
      onChange(parseFloat(nv.toFixed(decimals)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Cancel any pending drag update on unmount so we never leave a RAF queued.
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const normalized = Math.max(0, Math.min(1, valueToNormalized(value)));
  // Bipolar: the arc + pointer pivot on the centre (12 o'clock, angle 0) and
  // deflect left (−) / right (+). Linear dials keep the 7-o'clock start.
  const signedNorm = normalized - 0.5;
  const a0 = -135;
  const aEnd = a0 + normalized * 270;
  const bipolarAngle = signedNorm * 270;
  const pointerAngle = bipolar ? bipolarAngle : a0 + normalized * 270;

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (pendingValueRef.current != null) {
      onChange(pendingValueRef.current);
      pendingValueRef.current = null;
    }
  }, [onChange]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    let newNormalized = startValue.current + deltaY * sensitivity;
    newNormalized = Math.max(0, Math.min(1, newNormalized));
    let newValue = normalizedToValue(newNormalized);
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));
    pendingValueRef.current = parseFloat(newValue.toFixed(decimals));
    // Coalesce pointer-move updates to one per animation frame so fast drags
    // don't fire dozens of React state updates per frame (the panel's heavy
    // children — tubes, air plot, transfer curve — re-render per change).
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushPending);
  }, [normalizedToValue, sensitivity, step, min, max, flushPending]);

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false;
    // Flush the last queued value synchronously so the dial lands exactly
    // where the pointer stopped (no half-frame "catch-up" jump).
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
    // Option-click (Alt) resets the dial to its neutral position: the
    // caller-supplied defaultValue if present, otherwise 0 when 0 sits inside
    // the range, or the bottom of the range when it does not.
    if (e.altKey) {
      const reset = defaultValue != null
        ? Math.max(min, Math.min(max, defaultValue))
        : (0 >= min && 0 <= max ? 0 : min);
      onChange(parseFloat(reset.toFixed(decimals)));
      return;
    }
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = valueToNormalized(value);
    pointerId.current = e.pointerId;
    // Pointer capture routes pointermove/pointerup straight to the knob for the
    // whole drag — no document listeners to lose on re-render, so the dial
    // never "freezes" mid-drag even when the pointer crosses overlapping artwork
    // (reel photos, visualizers) or leaves the knob entirely.
    try { dialRef.current?.setPointerCapture(e.pointerId); } catch {}
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [value, valueToNormalized, defaultValue, min, max, step, onChange]);

  const formatValue = (val) => {
    const v = Number.isFinite(val) ? val : 0;
    if (unit === 'Hz' && v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (unit === 'dB') return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
    return v.toFixed(decimals);
  };

  // Fixed readout width sized to the longest possible value+unit for this
  // parameter, so the column (and thus the knob centre) never shifts when the
  // value changes length (e.g. "-24.0 dB" ↔ "+18.0 dB"). Uses `ch` because the
  // readout is monospaced + tabular-nums → 1ch per character.
  const valueWidthCh = (() => {
    const probes = [min, max, 0, -1, 1, 999, 1000, 9999, 10000, 99999];
    let best = 0;
    for (const p of probes) if (p >= min && p <= max) best = Math.max(best, formatValue(p).length);
    best = Math.max(best, formatValue(min).length, formatValue(max).length);
    return best + (unit ? unit.length : 0) + 1.5; // +unit chars + gap/buffer
  })();

  // Tick marks + identity-gem LED dots. Idle ticks stay graphite on B&K mint;
  // lit ticks / 12 o'clock follow scmIdentityGem (theme.gem), not housing yellow.
  const tickLit = (a) => {
    if (bipolar) {
      if (Math.abs(signedNorm) <= 0.001) return false;
      return bipolarAngle >= 0 ? a >= -0.01 && a <= bipolarAngle + 0.01
                               : a <= 0.01 && a >= bipolarAngle - 0.01;
    }
    return a <= aEnd + 0.5 && normalized > 0.001;
  };
  const idleTick = light ? 'rgba(46,42,39,0.5)' : 'rgba(255,255,255,0.22)';
  const ticks = [];
  const leds = [];
  const major = 11;
  const majorLen = size === 'large' ? 7.5 : 5;
  const minorLen = size === 'large' ? 6 : 4;
  const ledR = size === 'large' ? 1.7 : size === 'medium' ? 1.25 : 1.0;
  for (let i = 0; i <= major; i++) {
    const a = a0 + (i / major) * 270;
    const p1 = polar(cx, cy, r + (size === 'large' ? 4 : 2.5), a);
    const p2 = polar(cx, cy, r + majorLen, a);
    const lit = tickLit(a);
    ticks.push(<line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
      stroke={lit ? gem : idleTick} strokeWidth={lit ? (size === 'large' ? 1.45 : 1.05) : (size === 'large' ? 1.1 : 0.8)} strokeLinecap="round" />);
    const led = polar(cx, cy, r + majorLen + ledR + 1.2, a);
    leds.push(<circle key={`led${i}`} cx={led.x} cy={led.y} r={ledR}
      fill={lit ? gem : (light ? 'rgba(46,42,39,0.28)' : 'rgba(255,255,255,0.12)')}
      opacity={lit ? 1 : 0.85} />);
  }
  if (size === 'large') {
    for (let i = 0; i < 40; i++) {
      const a = a0 + (i / 40) * 270;
      const p1 = polar(cx, cy, r + 4, a);
      const p2 = polar(cx, cy, r + minorLen, a);
      const lit = tickLit(a);
      ticks.push(<line key={`m${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={lit ? gem : (light ? 'rgba(46,42,39,0.2)' : 'rgba(255,255,255,0.12)')} strokeWidth={lit ? 0.75 : 0.5} strokeLinecap="round" />);
    }
  }
  const noonInner = polar(cx, cy, r + (size === 'large' ? 1 : 0), 0);
  const noonOuter = polar(cx, cy, r + majorLen + 1.5, 0);

  const hub = r * 0.78;
  const ptr = polar(cx, cy, r * 0.82, pointerAngle);
  const ptrBase = polar(cx, cy, r * 0.18, pointerAngle);

  return (
    <div className={`flex flex-col items-center gap-0 ${className}`}>
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
      >
        <svg width={dim} height={dim} className="absolute">
          <defs>
            <linearGradient id={`${gid}-arc`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={lighten(accent, 0.3)} />
              <stop offset="100%" stopColor={accent} />
            </linearGradient>
            <radialGradient id={`${gid}-body`} cx="35%" cy="28%" r="75%">
              <stop offset="0%" stopColor="#4a4a55" />
              <stop offset="55%" stopColor="#23232b" />
              <stop offset="100%" stopColor="#121217" />
            </radialGradient>
            <radialGradient id={`${gid}-body-light`} cx="38%" cy="30%" r="82%">
              <stop offset="0%" stopColor="#f6f1e6" />
              <stop offset="48%" stopColor="#e6e0d2" />
              <stop offset="82%" stopColor="#d0c9ba" />
              <stop offset="100%" stopColor="#bbb4a2" />
            </radialGradient>
            <linearGradient id={`${gid}-ring`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
              <stop offset="48%" stopColor="rgba(176,168,152,0.5)" />
              <stop offset="100%" stopColor="rgba(110,102,86,0.65)" />
            </linearGradient>
            <radialGradient id={`${gid}-rim`} cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
            </radialGradient>
            <filter id={`${gid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path d={arcPath(cx, cy, r, a0, a0 + 270)} fill="none"
            stroke={light ? 'rgba(46,42,39,0.18)' : 'rgba(255,255,255,0.09)'} strokeWidth={strokeW} strokeLinecap="round" />

          {/* Ticks + gem LED dots */}
          {ticks}
          {leds}
          {/* 12 o'clock identity-gem reference */}
          <line x1={noonInner.x} y1={noonInner.y} x2={noonOuter.x} y2={noonOuter.y}
            stroke={gem} strokeWidth={size === 'large' ? 2.2 : 1.6} strokeLinecap="round"
            filter={light ? undefined : `url(#${gid}-glow)`} />

          {/* Active arc */}
          {bipolar ? (
            Math.abs(signedNorm) > 0.001 && (
              <path d={arcPathBipolar(cx, cy, r, bipolarAngle)} fill="none"
                stroke={`url(#${gid}-arc)`} strokeWidth={strokeW} strokeLinecap="round"
                filter={`url(#${gid}-glow)`} />
            )
          ) : (
            normalized > 0.001 && (
              <path d={arcPath(cx, cy, r, a0, aEnd)} fill="none"
                stroke={`url(#${gid}-arc)`} strokeWidth={strokeW} strokeLinecap="round"
                filter={`url(#${gid}-glow)`} />
            )
          )}

          {/* Knob body */}
          {light ? (
            <>
              {/* brushed-metal perimeter ring */}
              <circle cx={cx} cy={cy} r={hub + 3.5} fill="none" stroke={`url(#${gid}-ring)`} strokeWidth="3.5" />
              <circle cx={cx} cy={cy} r={hub + 1.6} fill="none" stroke="rgba(58,52,44,0.45)" strokeWidth="1" />
              <circle cx={cx} cy={cy} r={hub} fill={`url(#${gid}-body-light)`}
                stroke="rgba(78,70,58,0.6)" strokeWidth="1" />
              {/* concentric brushed grooves */}
              <circle cx={cx} cy={cy} r={hub * 0.84} fill="none" stroke="rgba(120,110,94,0.2)" strokeWidth="0.6" />
              <circle cx={cx} cy={cy} r={hub * 0.66} fill="none" stroke="rgba(120,110,94,0.15)" strokeWidth="0.6" />
              {/* top highlight */}
              <ellipse cx={cx} cy={cy - hub * 0.42} rx={hub * 0.6} ry={hub * 0.26}
                fill="rgba(255,255,255,0.5)" />
              {/* lower cast shadow */}
              <ellipse cx={cx} cy={cy + hub * 0.5} rx={hub * 0.56} ry={hub * 0.18}
                fill="rgba(80,72,60,0.16)" />
            </>
          ) : (
            <>
              <circle cx={cx} cy={cy} r={hub} fill={`url(#${gid}-body)`}
                stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
              <circle cx={cx} cy={cy} r={hub} fill={`url(#${gid}-rim)`} />
              {/* top highlight */}
              <ellipse cx={cx} cy={cy - hub * 0.45} rx={hub * 0.62} ry={hub * 0.28}
                fill="rgba(255,255,255,0.08)" />
            </>
          )}

          {/* Pointer */}
          <line x1={ptrBase.x} y1={ptrBase.y} x2={ptr.x} y2={ptr.y}
            stroke={light ? '#2E2A27' : lighten(accent, 0.25)} strokeWidth={size === 'large' ? 3 : size === 'medium' ? 2.2 : 1.8}
            strokeLinecap="round" filter={light ? undefined : `url(#${gid}-glow)`} />
          <circle cx={cx} cy={cy} r={size === 'large' ? 3 : size === 'medium' ? 2 : 1.6} fill={light ? '#2E2A27' : 'rgba(255,255,255,0.85)'} />
        </svg>
      </div>

      <span
        className={`whitespace-nowrap text-[10px] leading-none font-mono tabular-nums text-center ${light ? 'text-[#2E2A27]' : 'text-white/70'}`}
        style={{ width: `${valueWidthCh}ch` }}
      >
        {formatValue(value)}
        {unit && <span className={`ml-0.5 ${light ? 'text-[#2E2A27]/55' : 'text-white/40'}`}>{unit}</span>}
      </span>

      {label && <span className={`text-[9px] leading-none uppercase tracking-wider ${light ? 'text-[#2E2A27]/65' : 'text-white/45'}`}>{label}</span>}
    </div>
  );
}