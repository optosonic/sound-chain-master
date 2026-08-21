import React, { useEffect, useRef, useState } from 'react';

/**
 * Vectorscope / goniometer + correlation meter.
 * Reads a stereo pair of AnalyserNodes and plots L/R rotated 45° so a mono
 * signal draws a vertical line and an out-of-phase signal spreads horizontal.
 *
 * Responsive: when `width`/`height` are omitted, the canvas measures its
 * wrapper and renders a perfect square of min(wrapperW, wrapperH), so it can
 * be placed in any aspect-square / flex container and stay square.
 *
 * Props: leftAnalyser, rightAnalyser, audioContext, width?, height?, accent
 */
export default function Goniometer({ leftAnalyser, rightAnalyser, width, height, accent = '#5eead4' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [measured, setMeasured] = useState(0);
  const leftRef = useRef(leftAnalyser || null);
  const rightRef = useRef(rightAnalyser || null);
  leftRef.current = leftAnalyser || null;
  rightRef.current = rightAnalyser || null;

  const fixed = width != null && height != null;
  const w = fixed ? width : measured;
  const h = fixed ? height : measured;

  useEffect(() => {
    if (fixed) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const s = Math.max(120, Math.floor(Math.min(r.width, r.height)));
      setMeasured((prev) => (prev === s ? prev : s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !w || !h) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf;
    const bufL = new Float32Array(2048);
    const bufR = new Float32Array(2048);

    const drawAxes = () => {
      const cx = w / 2, cy = h / 2;
      const rad = Math.min(w, h) / 2 - 8;
      ctx.fillStyle = 'rgba(2,8,12,0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(94,234,212,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad);
      ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(94,234,212,0.09)';
      ctx.beginPath();
      ctx.moveTo(cx - rad, cy - rad); ctx.lineTo(cx + rad, cy + rad);
      ctx.moveTo(cx - rad, cy + rad); ctx.lineTo(cx + rad, cy - rad);
      ctx.stroke();
    };

    const drawCorrelation = (corr) => {
      const barY = h - 9;
      const barW = w - 16;
      const barX = 8;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(barX, barY, barW, 4);
      const midX = barX + barW / 2;
      const len = (barW / 2) * Math.abs(corr);
      ctx.fillStyle = corr >= 0 ? accent : '#f87171';
      if (corr >= 0) ctx.fillRect(midX, barY, len, 4);
      else ctx.fillRect(midX - len, barY, len, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(midX - 0.5, barY - 2, 1, 8);
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(corr.toFixed(2), barX, barY - 3);
    };

    const tick = () => {
      ctx.fillStyle = 'rgba(2,8,12,0.26)';
      ctx.fillRect(0, 0, w, h);
      drawAxes();
      const cx = w / 2, cy = h / 2;
      const scale = (Math.min(w, h) / 2 - 8);
      const L = leftRef.current, R = rightRef.current;
      let corr = 0;
      if (L && R) {
        L.getFloatTimeDomainData(bufL);
        R.getFloatTimeDomainData(bufR);
        let sumLR = 0, sumL2 = 0, sumR2 = 0;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < bufL.length; i += 2) {
          const l = bufL[i], r = bufR[i];
          const x = cx + (l - r) * scale * 0.5;
          const y = cy - (l + r) * scale * 0.5;
          ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
          sumLR += l * r; sumL2 += l * l; sumR2 += r * r;
        }
        ctx.globalAlpha = 1;
        const denom = Math.sqrt(sumL2 * sumR2);
        corr = denom > 1e-9 ? Math.max(-1, Math.min(1, sumLR / denom)) : 0;
      }
      drawCorrelation(corr);
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [w, h, accent]);

  if (fixed) {
    return <canvas ref={canvasRef} style={{ width: w, height: h }} className="rounded-lg border border-teal-500/20" />;
  }
  return (
    <div ref={wrapRef} className="w-full h-full flex items-start justify-center">
      {measured > 0 && <canvas ref={canvasRef} style={{ width: measured, height: measured }} className="rounded-lg border border-teal-500/20" />}
    </div>
  );
}