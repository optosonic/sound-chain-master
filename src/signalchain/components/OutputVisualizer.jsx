import React, { useRef, useEffect, useState } from 'react';
import { MIN_FREQ, MAX_FREQ } from '../eqModel.js';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';
import OutputLufsOverlay from './OutputLufsOverlay';

const freqToX = (f, w) =>
  ((Math.log10(f) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ))) * w;
const fmt = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f % 1000 ? 1 : 0)}k` : `${Math.round(f)}`);
const dbFmt = (db) => (db <= -60 ? '-∞' : db.toFixed(1));
const FREQS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

/**
 * Draws the static "instrument frame": vertical frequency grid lines + labels,
 * horizontal amplitude grid lines, the FINAL OUTPUT title and the PEAK / RMS
 * readout. Used by both the active and the inactive (standby/silent) paths so
 * the empty analyzer still reads as a useful instrument surface.
 *
 *  - onLight  : framework is drawn over a LIGHT faceplate (B&K inactive) → use
 *               dark strokes/text. Otherwise (dark active canvas, or dark-theme
 *               inactive) use the light strokes/text.
 *  - peak/rms : live values when active; `null` → render a "—" placeholder so
 *               the labels stay visible without implying signal.
 *  - showGhost: draw the "— DRY GHOST" tag (active only).
 */
function drawFramework(ctx, w, h, onLight, { peak, rms, showGhost }) {
  const grid = onLight ? 'rgba(26,26,26,0.10)' : 'rgba(255,255,255,0.05)';
  const label = onLight ? 'rgba(26,26,26,0.55)' : 'rgba(255,255,255,0.35)';
  const title = onLight ? 'rgba(26,26,26,0.70)' : 'rgba(255,255,255,0.5)';
  const peakCol = onLight ? '#475569' : '#cbd5e1';
  const rmsCol = onLight ? '#0e7490' : '#22d3ee';
  const ghostCol = onLight ? 'rgba(180,83,9,0.85)' : 'rgba(245,158,11,0.8)';
  const dim = onLight ? 'rgba(26,26,26,0.30)' : 'rgba(255,255,255,0.3)';

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  FREQS.forEach((f) => {
    const x = freqToX(f, w);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  });
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  ctx.fillStyle = label;
  ctx.font = '600 8px ui-monospace, monospace';
  ctx.textAlign = 'center';
  FREQS.forEach((f) => ctx.fillText(fmt(f), freqToX(f, w), h - 3));

  ctx.textAlign = 'left';
  ctx.fillStyle = title;
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.fillText('FINAL OUTPUT', 8, 13);
  ctx.font = '600 9px ui-monospace, monospace';
  ctx.fillStyle = peak == null ? dim : (peak >= 0 ? '#ff5b5b' : peakCol);
  ctx.fillText(`PEAK ${peak == null ? '—' : dbFmt(peak)} dB`, 8, 25);
  ctx.fillStyle = peak == null ? dim : rmsCol;
  ctx.fillText(`RMS ${rms == null ? '—' : dbFmt(rms)} dB`, 8, 36);
  if (showGhost) {
    ctx.textAlign = 'right';
    ctx.fillStyle = ghostCol;
    ctx.fillText('— DRY GHOST', w - 8, 13);
    ctx.textAlign = 'left';
  }
}

/**
 * Final Output Visualizer — "super pro" master analyzer:
 * log-frequency spectrum with a cyan→violet→pink gradient + decaying peak-hold
 * caps, an oscilloscope waveform overlay in the lower third, frequency labels,
 * and a live PEAK / RMS readout drawn on the canvas. Reads from the post-chain
 * spectrum analyzer.
 *
 * When inactive (standby or silent), the canvas stays transparent so the panel
 * faceplate shows through (NOT black), and the static instrument frame — grid
 * lines, frequency + amplitude ticks, FINAL OUTPUT title and PEAK/RMS labels —
 * is drawn as an overlay so the analyzer still reads as a useful surface.
 */
export default function OutputVisualizer({ analyzerNode, ghostAnalyzerNode, audioContext, height = 240, themeKey = 'dark', fullHeight = false, leftAnalyzer, rightAnalyzer }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height });
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const peaksRef = useRef([]);
  const readRef = useRef({ peak: -100, rms: -100 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setDims({ width: e[0].contentRect.width, height: fullHeight ? e[0].contentRect.height : height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, fullHeight]);

  useEffect(() => {
    let raf;
    const draw = () => {
      const canvas = canvasRef.current;
      const { width, height: h } = dims;
      if (!canvas || width <= 0) { raf = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Every identity's Final Output inset is a dark "screen" surface (B&K is a
      // dark CRT-style screen too), so the instrument frame always uses light
      // strokes/text.
      const onLightFaceplate = false;

      if (standbyRef.current) {
        // Idle: keep the panel faceplate (transparent) and draw only the
        // static instrument frame — no bars, no waveform, no live numbers.
        ctx.clearRect(0, 0, width, h);
        drawFramework(ctx, width, h, onLightFaceplate, { peak: null, rms: null, showGhost: false });
        raf = requestAnimationFrame(draw);
        return;
      }

      // No-signal check — engine active but silent: same inactive frame.
      let timeData = null;
      let peak = 0;
      if (analyzerNode) {
        timeData = new Float32Array(analyzerNode.fftSize);
        analyzerNode.getFloatTimeDomainData(timeData);
        for (let i = 0; i < timeData.length; i++) { const a = Math.abs(timeData[i]); if (a > peak) peak = a; }
      }
      if (peak < 0.0008) { // ~-62 dBFS → silence
        ctx.clearRect(0, 0, width, h);
        drawFramework(ctx, width, h, onLightFaceplate, { peak: null, rms: null, showGhost: false });
        raf = requestAnimationFrame(draw);
        return;
      }

      // Active signal → dark analyzer canvas (the instrument surface the
      // spectrum/scope reads against), then the full live overlay.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(10,14,24,0.85)');
      bg.addColorStop(1, 'rgba(4,6,12,0.9)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, h);

      // DRY ghost trace (pre-chain source) — sits behind the mastered output so
      // the A/B between dry and mastered is visible on the same analyzer.
      if (ghostAnalyzerNode) {
        const gTime = new Float32Array(ghostAnalyzerNode.fftSize);
        ghostAnalyzerNode.getFloatTimeDomainData(gTime);
        const gScopeTop = h * 0.66;
        const gScopeH = h - gScopeTop;
        const gMidY = gScopeTop + gScopeH / 2;
        ctx.strokeStyle = 'rgba(245,158,11,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < gTime.length; i++) {
          const x = (i / gTime.length) * width;
          const y = gMidY - gTime[i] * gScopeH * 0.42;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (analyzerNode) {
        const nyq = (audioContext?.sampleRate || 44100) / 2;
        const freqBuf = new Uint8Array(analyzerNode.frequencyBinCount);
        analyzerNode.getByteFrequencyData(freqBuf);

        // spectrum
        const bars = 84;
        if (!peaksRef.current || peaksRef.current.length !== bars) peaksRef.current = new Array(bars).fill(0);
        const scopeTop = h * 0.66;
        const specH = scopeTop;
        for (let i = 0; i < bars; i++) {
          const f0 = Math.pow(10, Math.log10(MIN_FREQ) + (i / bars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const f1 = Math.pow(10, Math.log10(MIN_FREQ) + ((i + 1) / bars) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const i0 = Math.floor((f0 / nyq) * freqBuf.length);
          const i1 = Math.max(i0 + 1, Math.floor((f1 / nyq) * freqBuf.length));
          let v = 0;
          for (let k = i0; k < i1 && k < freqBuf.length; k++) v = Math.max(v, freqBuf[k]);
          v /= 255;
          const x = freqToX(f0, width);
          const bw = Math.max(1, freqToX(f1, width) - x - 1);
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

        // oscilloscope overlay in the lower third (reuses the time data read
        // for the silence check above)
        const time = timeData;
        let sum = 0;
        for (let i = 0; i < time.length; i++) { sum += time[i] * time[i]; }
        const rms = Math.sqrt(sum / time.length);
        readRef.current.peak = 20 * Math.log10(peak || 1e-9);
        readRef.current.rms = 20 * Math.log10(rms || 1e-9);

        const scopeH = h - scopeTop;
        ctx.strokeStyle = 'rgba(34,211,238,0.9)';
        ctx.lineWidth = 1.4;
        ctx.shadowColor = 'rgba(34,211,238,0.6)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const midY = scopeTop + scopeH / 2;
        for (let i = 0; i < time.length; i++) {
          const x = (i / time.length) * width;
          const y = midY - time[i] * scopeH * 0.42;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(width, midY); ctx.stroke();
      }

      // instrument frame + live readout (drawn over the active canvas, which
      // is always dark, so onLight=false here).
      drawFramework(ctx, width, h, false, { peak: readRef.current.peak, rms: readRef.current.rms, showGhost: !!ghostAnalyzerNode });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzerNode, ghostAnalyzerNode, audioContext, dims, themeKey]);

  return (
    <div ref={containerRef} className={`sc-output-stage relative w-full rounded-xl overflow-hidden border border-white/10 ${fullHeight ? 'h-full' : ''}`} style={{ height: fullHeight ? '100%' : height }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <OutputLufsOverlay leftAnalyzer={leftAnalyzer} rightAnalyzer={rightAnalyzer} />
    </div>
  );
}