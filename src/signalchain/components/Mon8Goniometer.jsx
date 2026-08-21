import React, { useEffect, useRef } from 'react';

/**
 * Mon8 bass goniometer — a small blue square vectorscope that plots a stereo
 * pair (already low-passed to <500 Hz by the engine taps) rotated 45° so a mono
 * bass signal draws a vertical line and a wide stereo signal spreads out.
 *
 * Used in pairs (pre / post) on the Mon8 panel so the user can see the bass
 * stereo image before and after the Mono collapse.
 *
 * Props: leftAnalyser, rightAnalyser (AnalyserNodes), size (px, square)
 */
const BLUE = '#5b9cff';

export default function Mon8Goniometer({ leftAnalyser, rightAnalyser, size = 72 }) {
  const canvasRef = useRef(null);
  const leftRef = useRef(leftAnalyser || null);
  const rightRef = useRef(rightAnalyser || null);
  leftRef.current = leftAnalyser || null;
  rightRef.current = rightAnalyser || null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf;
    const bufL = new Float32Array(1024);
    const bufR = new Float32Array(1024);

    const tick = () => {
      // background
      ctx.fillStyle = 'rgba(6,10,20,0.92)';
      ctx.fillRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const rad = size / 2 - 4;
      // axes (blue)
      ctx.strokeStyle = 'rgba(91,156,255,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad);
      ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(91,156,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(cx - rad, cy - rad); ctx.lineTo(cx + rad, cy + rad);
      ctx.moveTo(cx - rad, cy + rad); ctx.lineTo(cx + rad, cy - rad);
      ctx.stroke();

      const L = leftRef.current, R = rightRef.current;
      if (L && R) {
        L.getFloatTimeDomainData(bufL);
        R.getFloatTimeDomainData(bufR);
        const scale = rad;
        ctx.fillStyle = BLUE;
        ctx.globalAlpha = 0.72;
        for (let i = 0; i < bufL.length; i += 2) {
          const l = bufL[i], r = bufR[i];
          const x = cx + (l - r) * scale * 0.5;
          const y = cy - (l + r) * scale * 0.5;
          ctx.fillRect(x - 0.5, y - 0.5, 1.4, 1.4);
        }
        ctx.globalAlpha = 1;
      } else {
        // no signal / no analyser — faint idle hint
        ctx.fillStyle = 'rgba(91,156,255,0.25)';
        ctx.fillRect(cx - 0.75, cy - rad + 2, 1.5, rad * 2 - 4);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-md"
      style={{
        width: size,
        height: size,
        border: '1px solid rgba(91,156,255,0.45)',
        boxShadow: '0 0 8px rgba(91,156,255,0.18), inset 0 0 10px rgba(0,0,0,0.4)',
      }}
    />
  );
}