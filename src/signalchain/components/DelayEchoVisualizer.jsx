import React, { useEffect, useRef } from 'react';

/**
 * Replika-style delay echo field: thin bright repeat bands that pulse as a
 * sweep crosses them (period = delay time), a flowing dashed decay curve, and
 * a dotted grid backdrop. Fully driven by the delay params so it stays
 * responsive to every dial.
 *
 * The per-frame animation (sweep position + echo-band pulse opacity) is driven
 * by direct DOM attribute writes via refs, NOT by React state. The previous
 * version called setState 60×/sec, which kept the main thread busy and made
 * the delay sliders feel sluggish during drags. The visual is identical.
 */
const VB = { w: 300, h: 196, base: 168 };
const BLUE = '#38bdf8';
const BRIGHT = '#7dd3fc';
const DRY_X = 16;
const SPAN = VB.w - DRY_X - 14;
const MAX_H = 132;
const SIGMA = 11;

export default function DelayEchoVisualizer({ delay = {} }) {
  const sweepRef = useRef(null);
  const tapRefs = useRef([]);
  const tRef = useRef(0);
  // Live values the rAF loop reads each frame (updated on render, no state).
  const live = useRef(null);

  const enabled = !!delay.enabled;
  const time = Math.max(0.05, delay.time ?? 0.3);
  const feedback = Math.max(0, Math.min(0.95, delay.feedback ?? 0.3));
  const mix = delay.mix ?? 0.3;

  const tapCount = Math.max(1, Math.min(10, feedback <= 0 ? 1 : Math.round(2 + feedback * 8)));
  const stepX = SPAN / tapCount;
  const taps = [];
  for (let i = 1; i <= tapCount; i++) taps.push({ x: DRY_X + stepX * i, h: MAX_H * Math.pow(feedback, i) });
  const baseAlpha = enabled ? (0.55 + mix * 0.45) : 0.32;

  live.current = { time, taps, baseAlpha };

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      tRef.current += dt;
      const { time: T, taps: TAP, baseAlpha: BA } = live.current;
      const phase = (tRef.current / T) % 1;
      const sweepX = DRY_X + phase * SPAN;
      const sweep = sweepRef.current;
      if (sweep) { sweep.setAttribute('x1', sweepX); sweep.setAttribute('x2', sweepX); }
      for (let i = 0; i < TAP.length; i++) {
        const el = tapRefs.current[i];
        if (!el) continue;
        const tp = TAP[i];
        const pulse = Math.exp(-((sweepX - tp.x) ** 2) / (2 * SIGMA * SIGMA));
        el.setAttribute('opacity', '1');
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative h-full w-full">
      <svg width="100%" viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" style={{ display: 'block', height: '100%' }}>
        <defs>
          <linearGradient id="delayEcho" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRIGHT} />
            <stop offset="55%" stopColor={BLUE} />
            <stop offset="100%" stopColor={BLUE} stopOpacity="1" />
          </linearGradient>
          <pattern id="delayGrid" width="13" height="13" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.55" fill="rgba(91,122,153,0.14)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VB.w} height={VB.h} fill="url(#delayGrid)" />
        <line x1={DRY_X - 6} y1={VB.base} x2={VB.w - 6} y2={VB.base} stroke="rgba(91,122,153,0.3)" strokeWidth="0.6" />

        {/* flowing decay curve */}
        <polyline
          points={[`${DRY_X},${VB.base - MAX_H}`, ...taps.map((tp) => `${tp.x},${VB.base - tp.h}`)].join(' ')}
          fill="none" stroke={BRIGHT} strokeWidth="1.2" strokeDasharray="2 3"
          className="sc-dash-flow"
          style={{ animationDuration: `${Math.max(0.12, time)}s` }}
        />

        {/* dry pulse */}
        <rect x={DRY_X - 2} y={VB.base - MAX_H} width="4" height={MAX_H} rx="2" fill="url(#delayEcho)" />

        {/* echo bands — opacity is brightened each frame by the rAF sweep */}
        <g>
          {taps.map((tp, i) => (
            <rect
              key={i}
              ref={(el) => { tapRefs.current[i] = el; }}
              x={tp.x - 1.6} y={VB.base - tp.h} width="3.2" height={tp.h} rx="1.5"
              fill="url(#delayEcho)"
            />
          ))}
        </g>

        {/* sweep line — x updated each frame via ref */}
        <line
          ref={sweepRef}
          x1={DRY_X} y1={VB.base - MAX_H - 6} x2={DRY_X} y2={VB.base}
          stroke={BRIGHT} strokeWidth="0.7"
        />
      </svg>
      <span className="pointer-events-none absolute top-1 right-2 font-mono font-bold" style={{ fontSize: 12, color: BRIGHT }}>
        {Math.round(time * 1000)}ms
      </span>
    </div>
  );
}