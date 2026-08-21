import React, { useEffect, useRef, useState } from 'react';

/**
 * FpsReadout — a tiny live main-thread load indicator. Measures the actual
 * requestAnimationFrame cadence (which reflects every meter/visualizer loop
 * on the main thread, not just audio) and reports frames-per-second plus the
 * average frame time. Recomputes twice a second so the number is stable.
 *
 * Colour-codes by smoothness:
 *   ≥55 fps green · ≥30 amber · <30 rose
 */
export default function FpsReadout() {
  const [label, setLabel] = useState('FPS — · —ms');
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const framesRef = useRef(0);
  const accRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    lastRef.current = performance.now();
    const tick = (now) => {
      if (!mounted) return;
      accRef.current += now - lastRef.current;
      lastRef.current = now;
      framesRef.current++;
      if (accRef.current >= 500) {
        const fps = Math.round((framesRef.current * 1000) / accRef.current);
        const ms = (accRef.current / framesRef.current).toFixed(1);
        setLabel(`FPS ${fps} · ${ms}ms`);
        framesRef.current = 0;
        accRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const fps = parseInt(label.match(/FPS (\d+)/)?.[1] || '0', 10);
  const tone = fps >= 55
    ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
    : fps >= 30
      ? 'text-amber-300 border-amber-400/40 bg-amber-500/10'
      : 'text-rose-300 border-rose-400/40 bg-rose-500/10';

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-mono font-semibold tracking-wider ${tone}`}
      title="Live main-thread frame rate — green ≥55 fps, amber ≥30, rose <30"
    >
      {label}
    </span>
  );
}