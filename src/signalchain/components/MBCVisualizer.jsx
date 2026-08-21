import React, { useRef, useEffect, useState } from 'react';
import { mbcBandList, mbcFreqToX as freqToX, MBC_MIN_FREQ, MBC_MAX_FREQ } from '../multiBandCompModel.js';

const fmt = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f % 1000 ? 1 : 0)}k` : `${Math.round(f)}`);

/**
 * Multi-Band visualizer — a live log-frequency spectrum divided into the MBC's
 * crossover band regions (each coloured), with crossover markers, decaying
 * peak-hold caps, and live per-band gain-reduction bars from the compressor
 * nodes. Uses the SAME 30 Hz–18 kHz mapping as MBCGraph so the crossover
 * lines align vertically between the two stacked canvases.
 */
export default function MBCVisualizer({ analyzerNode, audioContext, state, mbcNodes, height = 150 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height });
  const peaksRef = useRef([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setDims({ width: e[0].contentRect.width, height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const { width, height: h } = dims;
      if (width <= 0) { raf = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bands = mbcBandList(state);

      ctx.fillStyle = 'rgba(6,8,14,0.65)';
      ctx.fillRect(0, 0, width, h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((f) => {
        const x = freqToX(f, width);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });

      // band-region shading
      bands.forEach((b) => {
        const x0 = freqToX(Math.max(MBC_MIN_FREQ, b.lo), width);
        const x1 = freqToX(Math.min(MBC_MAX_FREQ, b.hi), width);
        ctx.fillStyle = b.color + '12';
        ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h);
      });

      // spectrum bars coloured by band
      if (analyzerNode) {
        const buf = new Uint8Array(analyzerNode.frequencyBinCount);
        analyzerNode.getByteFrequencyData(buf);
        const nyq = (audioContext?.sampleRate || 44100) / 2;
        const bars = 96;
        if (!peaksRef.current || peaksRef.current.length !== bars) peaksRef.current = new Array(bars).fill(0);
        const logLo = Math.log10(MBC_MIN_FREQ);
        const logHi = Math.log10(MBC_MAX_FREQ);
        for (let i = 0; i < bars; i++) {
          const f0 = Math.pow(10, logLo + (i / bars) * (logHi - logLo));
          const f1 = Math.pow(10, logLo + ((i + 1) / bars) * (logHi - logLo));
          const i0 = Math.floor((f0 / nyq) * buf.length);
          const i1 = Math.max(i0 + 1, Math.floor((f1 / nyq) * buf.length));
          let v = 0;
          for (let k = i0; k < i1 && k < buf.length; k++) v = Math.max(v, buf[k]);
          v /= 255;
          const fc = (f0 + f1) / 2;
          const band = bands.find((b) => fc >= b.lo && fc < b.hi) || bands[bands.length - 1];
          const x = freqToX(f0, width);
          const bw = Math.max(1, freqToX(f1, width) - x - 1);
          const barH = v * h * 0.92;
          const grad = ctx.createLinearGradient(0, h, 0, h - barH);
          grad.addColorStop(0, band.color + '22');
          grad.addColorStop(1, band.color);
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, h - barH, bw, barH);
          peaksRef.current[i] = Math.max(peaksRef.current[i] * 0.96, v);
          const ph = peaksRef.current[i] * h * 0.92;
          ctx.fillStyle = band.color;
          ctx.fillRect(x + 1, h - ph - 2, bw, 2);
        }
      }

      // crossover lines + labels
      (state.crossovers || []).forEach((f) => {
        const x = freqToX(f, width);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '600 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fmt(f), x, 10);
      });

      // live gain reduction per band
      if (mbcNodes && state.enabled) {
        bands.forEach((b) => {
          const comp = mbcNodes[b.id];
          if (!comp) return;
          const gr = Math.max(0, -comp.reduction);
          if (gr <= 0.05) return;
          const x0 = freqToX(Math.max(MBC_MIN_FREQ, b.lo), width);
          const x1 = freqToX(Math.min(MBC_MAX_FREQ, b.hi), width);
          ctx.fillStyle = 'rgba(255,90,90,0.55)';
          ctx.fillRect(x0 + 2, 0, Math.max(1, x1 - x0 - 4), Math.min(h, gr * 2.2));
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzerNode, audioContext, dims, state, mbcNodes]);

  return (
    <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-white/5" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}