import React, { useRef, useEffect, useState } from 'react';
import { MIN_FREQ, MAX_FREQ } from '../eqModel.js';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

const freqToX = (f, w) =>
  ((Math.log10(f) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ))) * w;
const fmt = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f % 1000 ? 1 : 0)}k` : `${Math.round(f)}`);

/**
 * Compact log-frequency spectrum — bars (not a line) with decaying peak-hold
 * caps, the same cyan→violet→pink gradient as the Final Output analyzer.
 * A smaller sibling of OutputVisualizer for the Master Level Meter panel.
 */
export default function SpectrumBars({ analyzerNode, ghostAnalyzerNode, audioContext, height: heightProp, label = 'SPECTRUM', ghostLabel = 'GHOST', fill = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const peaksRef = useRef([]);
  const fixedHeight = heightProp ?? 70;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      setSize({ w: r.width, h: fill ? r.height : fixedHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill, fixedHeight]);

  const width = size.w;
  const height = fill ? size.h : fixedHeight;

  useEffect(() => {
    let raf;
    const draw = () => {
      if (standbyRef.current) { raf = requestAnimationFrame(draw); return; }
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const w = width, h = height;
      if (w <= 0) { raf = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(10,14,24,0.85)');
      bg.addColorStop(1, 'rgba(4,6,12,0.9)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      [100, 1000, 10000].forEach((f) => {
        const x = freqToX(f, w);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });

      const specH = h - 12; // leave room for freq labels
      const nyq = (audioContext?.sampleRate || 44100) / 2;

      // ghost trace (the opposite signal) — amber line, like the Final Output dry ghost
      if (ghostAnalyzerNode) {
        const gFreq = new Uint8Array(ghostAnalyzerNode.frequencyBinCount);
        ghostAnalyzerNode.getByteFrequencyData(gFreq);
        const gBars = 64;
        ctx.strokeStyle = 'rgba(245,158,11,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < gBars; i++) {
          const f0 = Math.pow(10, Math.log10(MIN_FREQ) + (i / gBars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const f1 = Math.pow(10, Math.log10(MIN_FREQ) + ((i + 1) / gBars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const i0 = Math.floor((f0 / nyq) * gFreq.length);
          const i1 = Math.max(i0 + 1, Math.floor((f1 / nyq) * gFreq.length));
          let v = 0;
          for (let k = i0; k < i1 && k < gFreq.length; k++) v = Math.max(v, gFreq[k]);
          v /= 255;
          const x = freqToX(f0, w);
          const y = specH - v * specH * 0.96;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (analyzerNode) {
        const freqBuf = new Uint8Array(analyzerNode.frequencyBinCount);
        analyzerNode.getByteFrequencyData(freqBuf);
        const bars = 64;
        if (!peaksRef.current || peaksRef.current.length !== bars) peaksRef.current = new Array(bars).fill(0);
        for (let i = 0; i < bars; i++) {
          const f0 = Math.pow(10, Math.log10(MIN_FREQ) + (i / bars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const f1 = Math.pow(10, Math.log10(MIN_FREQ) + ((i + 1) / bars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const i0 = Math.floor((f0 / nyq) * freqBuf.length);
          const i1 = Math.max(i0 + 1, Math.floor((f1 / nyq) * freqBuf.length));
          let v = 0;
          for (let k = i0; k < i1 && k < freqBuf.length; k++) v = Math.max(v, freqBuf[k]);
          v /= 255;
          const x = freqToX(f0, w);
          const bw = Math.max(1, freqToX(f1, w) - x - 1);
          const barH = v * specH * 0.96;
          const grad = ctx.createLinearGradient(0, specH, 0, specH - barH);
          grad.addColorStop(0, 'rgba(34,211,238,0.25)');
          grad.addColorStop(0.5, 'rgba(139,92,246,0.85)');
          grad.addColorStop(1, 'rgba(244,114,182,0.95)');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, specH - barH, bw, barH);
          peaksRef.current[i] = Math.max(peaksRef.current[i] * 0.965, v);
          const ph = peaksRef.current[i] * specH * 0.96;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(x + 1, specH - ph - 2, bw, 2);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '600 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('— no signal —', w / 2, specH / 2);
      }

      // freq labels
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '600 7px ui-monospace, monospace';
      ctx.textAlign = 'center';
      [100, 1000, 10000].forEach((f) => ctx.fillText(fmt(f), freqToX(f, w), h - 2));

      // label
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText(label, 6, 11);
      if (ghostAnalyzerNode) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(245,158,11,0.8)';
        ctx.fillText(`— ${ghostLabel}`, w - 6, 11);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzerNode, ghostAnalyzerNode, audioContext, width, height, label, ghostLabel]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg overflow-hidden border border-cyan-500/15 ${fill ? 'h-full' : ''}`}
      style={fill ? undefined : { height }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}