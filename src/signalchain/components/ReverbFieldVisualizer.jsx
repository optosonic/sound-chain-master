import React, { useEffect, useRef, useState } from 'react';

/**
 * High-tech reverb field: a direct impulse, a continuous band of early
 * reflections, and a shimmering decaying tail — laid out so there is NO dead
 * gap between the reflections and the tail (they abut, like a real impulse
 * response). Pre-delay pushes the first reflection later; Size widens the
 * reflection band; X-Large shallows the envelope and adds density; Decay
 * scales the tail height and the readout. Animated with rAF.
 */
const VB = { w: 300, h: 196, base: 168 };
const PURPLE = '#c084fc';
const INDIGO = '#818cf8';

const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export default function ReverbFieldVisualizer({ reverb = {} }) {
  const [, force] = useState(0);
  const tRef = useRef(0);
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      tRef.current += dt;
      force((n) => (n + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const enabled = !!reverb.enabled;
  const decay = reverb.decay ?? 2;
  const damping = reverb.damping ?? 0.4;
  const mix = reverb.mix ?? 0.3;
  const predelay = reverb.predelay ?? 0;   // ms, 0..200
  const size = reverb.size ?? 0.5;         // 0..1
  const xlarge = reverb.radicalness ?? 0;  // 0..1 — "X-Large"

  const decayNorm = Math.max(0, Math.min(1, (decay - 0.5) / (15 - 0.5)));
  const color = damping > 0.6 ? INDIGO : PURPLE;

  // Pixel geometry — three contiguous regions, no dead space:
  //   direct impulse ► first reflection (pre-delay shifts it right)
  //   ► reflection band (Size widens it) ► tail onset ► tail to right edge.
  const preFrac = Math.max(0, Math.min(1, predelay / 200));
  const firstReflX = 16 + preFrac * 44;
  const reflZoneW = (0.10 + size * 0.14 + xlarge * 0.04) * VB.w;
  const tailX = Math.min(firstReflX + reflZoneW, VB.w - 40);
  const tailEndX = VB.w - 8;

  const amp = 104 * (0.6 + decayNorm * 0.5) * (1 + xlarge * 0.12);
  const envPow = 1.5 - xlarge * 0.55;           // X-Large → shallower falloff
  const directH = 124 * (0.7 + mix * 0.3);

  // Early reflections fill the whole band continuously (amplitude decays with
  // distance; small jitter so they don't sit on a perfect grid).
  const reflCount = 8 + Math.round(size * 6 + xlarge * 4);
  const refls = [];
  for (let i = 0; i < reflCount; i++) {
    const f = reflCount > 1 ? i / (reflCount - 1) : 0;
    const jitter = (rnd(i) - 0.5) * reflZoneW * 0.08;
    const x = firstReflX + f * reflZoneW + jitter;
    const a = (1 - f * 0.75) * (0.45 + rnd(i + 99) * 0.55) * (0.7 + size * 0.3);
    refls.push({ x, amp: a });
  }

  // Tail field — particles + smooth envelope from the tail onset to the edge.
  const N = 64 + Math.round(xlarge * 36);
  const t = tRef.current;
  const particles = [];
  for (let i = 0; i < N; i++) {
    const f = i / N;
    const x = tailX + f * (tailEndX - tailX);
    const env = Math.pow(1 - f, envPow);
    const ph = rnd(i) * Math.PI * 2;
    const freq = 1.4 + rnd(i + 7) * 4.5;
    const shim = 0.5 + 0.5 * Math.sin(t * freq + ph);
    const h = env * amp * (0.32 + shim * 0.68);
    particles.push({ x, h });
  }

  const envPts = [];
  for (let i = 0; i <= 44; i++) {
    const f = i / 44;
    const x = tailX + f * (tailEndX - tailX);
    const env = Math.pow(1 - f, envPow);
    envPts.push(`${x},${VB.base - env * amp}`);
  }

  return (
    <div className="relative w-full h-full">
    <svg width="100%" viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" style={{ display: 'block', height: '100%' }}>
      <defs>
        <linearGradient id="revField" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <pattern id="revGrid" width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.55" fill={`${color}24`} />
        </pattern>
      </defs>
      <rect x="0" y="0" width={VB.w} height={VB.h} fill="url(#revGrid)" />
      <line x1="6" y1={VB.base} x2={VB.w - 6} y2={VB.base} stroke={`${color}55`} strokeWidth="0.6" />

      {/* shimmering tail field */}
      <g>
        {particles.map((p, i) => (
          <rect key={i} x={p.x} y={VB.base - p.h} width="1.4" height={p.h} fill={color} opacity={enabled ? 1 : 0.5} />
        ))}
      </g>

      {/* smooth decay envelope */}
      <polyline points={envPts.join(' ')} fill="none" stroke={color} strokeWidth="1" className="sc-dash-flow" style={{ animationDuration: `${Math.max(0.4, decay)}s` }} />

      {/* direct impulse */}
      <rect x="8" y={VB.base - directH} width="3" height={directH} rx="1.5" fill="url(#revField)" />

      {/* early reflections — continuous band abutting the tail onset */}
      <g>
        {refls.map((p, i) => {
          const h = p.amp * 72;
          return <rect key={`r${i}`} x={p.x - 0.8} y={VB.base - h} width="1.6" height={h} rx="0.8" fill={color} />;
        })}
      </g>

    </svg>
    <span className="pointer-events-none absolute top-1 right-2 font-mono font-bold" style={{ fontSize: 12, color }}>
      {decay.toFixed(1)}s
    </span>
    </div>
  );
}