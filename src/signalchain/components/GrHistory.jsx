import React, { useEffect, useRef } from 'react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

/**
 * GrHistory — scrolling gain-reduction history for the limiter (~4 s).
 * Reads getGR() each frame, pushes into a ring buffer, and draws a filled
 * amber trace where 0 dB sits at the top edge and greater reduction dips down
 * (matching the pro-limiter convention of a reduction envelope hanging from a
 * top zero line).
 */
const ACCENT = '#fbbf24';
const LEN = 240;   // ~4 s at 60 fps
const MAX_GR = 12;

export default function GrHistory({ getGR, enabled }) {
  const canvasRef = useRef(null);
  const bufRef = useRef(new Float32Array(LEN));
  const headRef = useRef(0);
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);

  useEffect(() => {
    let raf;
    const tick = () => {
      const buf = bufRef.current;
      const head = headRef.current;
      const gr = (enabled && !standbyRef.current && getGR) ? Math.max(0, getGR()) : 0;
      buf[head] = gr;
      headRef.current = (head + 1) % LEN;
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // grid lines at 3 / 6 / 9 dB
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
        for (let g = 3; g < MAX_GR; g += 3) {
          const y = (g / MAX_GR) * h;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        // filled reduction area + trace (oldest → newest)
        ctx.beginPath();
        for (let i = 0; i < LEN; i++) {
          const idx = (head + i) % LEN;
          const x = (i / (LEN - 1)) * w;
          const y = (buf[idx] / MAX_GR) * h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath();
        ctx.fillStyle = 'rgba(251,191,36,0.18)'; ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < LEN; i++) {
          const idx = (head + i) % LEN;
          const x = (i / (LEN - 1)) * w;
          const y = (buf[idx] / MAX_GR) * h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.3; ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [getGR, enabled]);

  return (
    <div className="rounded-md border border-amber-500/25 bg-black/50 p-1" title="Gain-reduction history (last ~4 s)">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] text-amber-300/70 uppercase tracking-wider">GR History</span>
        <span className="text-[7px] text-white/30">0 … −12 dB</span>
      </div>
      <canvas ref={canvasRef} className="w-full block" style={{ height: 42 }} />
    </div>
  );
}