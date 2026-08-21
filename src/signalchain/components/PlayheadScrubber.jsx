import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Seekable playback timeline for the loaded audio file. Sits between the
 * transport buttons and the Monitor Out fader. Clicks / drags jump the source
 * to an arbitrary position so playback can start from anywhere — not always
 * the beginning. Polls the engine's playback accessor via rAF; dragging takes
 * over so the playhead follows the pointer instead of fighting the clock.
 */
const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function PlayheadScrubber({ engine }) {
  const { seekTo, getPlayback } = engine;
  const trackRef = useRef(null);
  const dragRef = useRef(false);
  const [pos, setPos] = useState({ current: 0, duration: 0 });

  useEffect(() => {
    let raf;
    const tick = () => {
      if (!dragRef.current) {
        const p = getPlayback?.();
        if (p) setPos(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getPlayback]);

  const duration = pos.duration || 0;
  const pct = duration > 0 ? Math.min(1, Math.max(0, pos.current / duration)) : 0;

  const seekFromClientX = useCallback((clientX) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    const t = duration > 0 ? (x / r.width) * duration : 0;
    seekTo?.(t);
    setPos((p) => ({ ...p, current: t }));
  }, [duration, seekTo]);

  const onPointerDown = (e) => {
    e.preventDefault();
    dragRef.current = true;
    seekFromClientX(e.clientX);
    const move = (ev) => seekFromClientX(ev.clientX);
    const up = () => {
      dragRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/40 px-3 py-2">
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{fmt(pos.current)}</span>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        className="relative h-6 flex-1 cursor-pointer touch-none"
        title={duration > 0 ? 'Click or drag to seek' : 'Load a file to scrub'}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', boxShadow: '0 0 10px rgba(167,139,250,0.45)' }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white shadow-[0_0_12px_rgba(167,139,250,0.8)]"
          style={{ left: `${pct * 100}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/45">{duration > 0 ? fmt(duration) : '--:--'}</span>
    </div>
  );
}