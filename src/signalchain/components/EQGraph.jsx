import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { MIN_FREQ, MAX_FREQ, MIN_DB, MAX_DB, computeEQCurve, bandList, LOW_COLOR, HIGH_COLOR, MID_COLORS } from '../eqModel.js';
import { fmContourDb, pinkNoiseDb } from '../referenceCurves.js';
import BandDotMenu from './BandDotMenu.jsx';

/**
 * Shared EQ response graph used by both the Parametric EQ and Dynamic EQ panels.
 * Draws the shaped container, log-freq grid, 0 dB line, optional spectrum overlay,
 * the computed frequency-response curve, and draggable band points anchored on it.
 *
 * Interaction model (dot-click):
 *   · Click a band dot → selects it (shows the pop-up menu + Q lateral wings).
 *   · Drag the dot body → moves freq / gain.
 *   · Drag a mid band's lateral wings → adjusts Q (wider wings = lower Q).
 *   · Click empty graph → deselects / closes the menu.
 *
 * `onBandDrag(id, patch)` fires for both graph drags and pop-up edits.
 * `onDrawOverlay(ctx, helpers)` lets a parent draw an extra layer each frame
 * (the Dynamic EQ uses it to render live gain-reduction bars).
 */
const freqToX = (freq, width) =>
  ((Math.log10(freq) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ))) * width;
const xToFreq = (x, width) =>
  Math.pow(10, Math.log10(MIN_FREQ) + (x / width) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
// dB↔pixel mapping is component-local so the graph can honour the active gain
// range (Surgical ±6 / Mastering ±12 / Full ±24). See dbToY/yToDb/clampDb below.
const clampF = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
const colorForId = (id) => {
  if (id === 'low') return LOW_COLOR;
  if (id === 'high') return HIGH_COLOR;
  if (id.startsWith('mid')) { const idx = parseInt(id.slice(3), 10); return MID_COLORS[idx % MID_COLORS.length]; }
  return '#ffffff';
};
const wingHalf = (q) => clampF(12, 60, 60 - (q || 1) * 8);

export default function EQGraph({ eq, audioContext, analyzerNode, onBandDrag, onDrawOverlay, enabledAccent = '#a78bfa', ghostEq = null, ghostAccent = 'rgba(255,255,255,0.35)', minDb = MIN_DB, maxDb = MAX_DB, gridDb = 6, labelDb = 6, selectedId, onSelect }) {
  // dB↔pixel mapping is local so the vertical axis, gridlines and band-handle
  // drag sensitivity all rescale together when the gain range changes — same
  // pixel height maps to a finer dB span, so a narrower range is a true zoomed
  // "surgical" view rather than the ±24 graph with a clipped handle.
  const dbToY = (db, height) => (1 - (db - minDb) / (maxDb - minDb)) * height;
  const yToDb = (y, height) => (1 - y / height) * (maxDb - minDb) + minDb;
  const clampDb = (v) => Math.max(minDb, Math.min(maxDb, v));
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(null);
  const [qDrag, setQDrag] = useState(null);
  // Selection can be parent-controlled (selectedId) so the graph ring stays in
  // sync with an external band selector (e.g. the Dynamic EQ pills + knobs). If
  // no prop is passed, the graph manages its own selection (Parametric EQ).
  const [internalSelected, setInternalSelected] = useState(null);
  const controlled = selectedId !== undefined;
  const selected = controlled ? selectedId : internalSelected;
  const commitSelect = useCallback((id) => {
    if (!controlled) setInternalSelected(id);
    onSelect?.(id);
  }, [controlled, onSelect]);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const [showFM, setShowFM] = useState(false);
  const [showPink, setShowPink] = useState(false);
  const eqRef = useRef(eq);
  useEffect(() => { eqRef.current = eq; }, [eq]);

  const localCtxRef = useRef(null);
  const getCtx = useCallback(() => {
    if (audioContext) return audioContext;
    if (!localCtxRef.current) localCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return localCtxRef.current;
  }, [audioContext]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ width: r.width, height: Math.max(180, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeEq = useMemo(() => {
    const low = { freq: 200, gain: 0, slope: 12, cut: false, ...(eq?.low || {}) };
    const high = { freq: 5000, gain: 0, slope: 12, cut: false, ...(eq?.high || {}) };
    const mids = (eq?.mids || []).map((m) => ({ freq: 1000, gain: 0, q: 1, ...m }));
    return { enabled: false, bandCount: 3, ...(eq || {}), low, high, mids };
  }, [eq]);

  // Optional ghost band set (the inactive M/S channel) — drawn as a faint
  // dashed curve so you can see the other channel while editing this one.
  const safeGhost = useMemo(() => {
    if (!ghostEq) return null;
    const low = { freq: 200, gain: 0, slope: 12, cut: false, ...(ghostEq.low || {}) };
    const high = { freq: 5000, gain: 0, slope: 12, cut: false, ...(ghostEq.high || {}) };
    const mids = (ghostEq.mids || []).map((m) => ({ freq: 1000, gain: 0, q: 1, ...m }));
    return { enabled: !!ghostEq.enabled, low, high, mids };
  }, [ghostEq]);

  // Recompute the response curve only when a band parameter actually changes.
  const bandKey = useMemo(() => JSON.stringify({
    e: safeEq.enabled,
    l: [safeEq.low.freq, safeEq.low.gain, safeEq.low.slope, safeEq.low.cut],
    h: [safeEq.high.freq, safeEq.high.gain, safeEq.high.slope, safeEq.high.cut],
    m: safeEq.mids.map((m) => [m.freq, m.gain, m.q]),
  }), [safeEq]);

  const response = useMemo(() => computeEQCurve(getCtx(), safeEq), [getCtx, bandKey]);
  const responseRef = useRef(response);
  responseRef.current = response;

  const ghostKey = useMemo(() => (safeGhost ? JSON.stringify({
    e: safeGhost.enabled,
    l: [safeGhost.low.freq, safeGhost.low.gain, safeGhost.low.slope, safeGhost.low.cut],
    h: [safeGhost.high.freq, safeGhost.high.gain, safeGhost.high.slope, safeGhost.high.cut],
    m: safeGhost.mids.map((m) => [m.freq, m.gain, m.q]),
  }) : null), [safeGhost]);
  const ghostResponse = useMemo(() => (safeGhost && ghostKey ? computeEQCurve(getCtx(), safeGhost) : []), [getCtx, ghostKey]);
  const ghostResponseRef = useRef(ghostResponse);
  ghostResponseRef.current = ghostResponse;

  const sampleAt = useCallback((freq) => {
    const r = responseRef.current;
    if (!r.length) return 0;
    const n = r.length;
    if (freq <= r[0].freq) return r[0].db;
    if (freq >= r[n - 1].freq) return r[n - 1].db;
    const lf = Math.log(freq);
    for (let i = 0; i < n - 1; i++) {
      if (r[i].freq <= freq && r[i + 1].freq >= freq) {
        const t = (lf - Math.log(r[i].freq)) / (Math.log(r[i + 1].freq) - Math.log(r[i].freq));
        return r[i].db + t * (r[i + 1].db - r[i].db);
      }
    }
    return r[n - 1].db;
  }, []);

  // Resolve a full band object (incl. dynamic fields) for the pop-up menu.
  const resolveBand = (src, id) => {
    if (!src) return null;
    if (id === 'low') return src.low;
    if (id === 'high') return src.high;
    if (id.startsWith('mid')) { const idx = parseInt(id.slice(3), 10); return src.mids?.[idx]; }
    return null;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = dims;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = eqRef.current;
    const notchH = 28;
    const leftNotch = 62;
    const rightNotch = 74;

    const shapePath = () => {
      ctx.beginPath();
      ctx.moveTo(0, height); ctx.lineTo(0, notchH); ctx.lineTo(leftNotch, notchH);
      ctx.bezierCurveTo(leftNotch + 8, notchH, leftNotch + 8, 0, leftNotch + 24, 0);
      ctx.lineTo(width - rightNotch - 24, 0);
      ctx.bezierCurveTo(width - rightNotch - 8, 0, width - rightNotch - 8, notchH, width - rightNotch, notchH);
      ctx.lineTo(width, notchH); ctx.lineTo(width, height); ctx.closePath();
    };

    shapePath();
    ctx.save();
    ctx.clip();
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, 'rgba(139,92,246,0.08)');
    bg.addColorStop(1, 'rgba(10,10,20,0.4)');
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach((f) => {
      const x = freqToX(f, width);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    });
    for (let db = minDb; db <= maxDb; db += gridDb) {
      const y = dbToY(db, height);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(0, dbToY(0, height)); ctx.lineTo(width, dbToY(0, height)); ctx.stroke();

    if (showSpectrum && analyzerNode) {
      const N = analyzerNode.frequencyBinCount;
      const buf = new Uint8Array(N);
      analyzerNode.getByteFrequencyData(buf);
      const nyquist = (audioContext?.sampleRate || 44100) / 2;
      const binHz = nyquist / N; // Hz per FFT bin
      ctx.beginPath(); ctx.moveTo(0, height);
      for (let x = 0; x <= width; x++) {
        const f0 = xToFreq(x, width);
        if (f0 >= nyquist) { ctx.lineTo(x, height); continue; }
        const f1 = xToFreq(Math.min(width, x + 1), width);
        const lo = Math.max(1, Math.floor(f0 / binHz));
        const hi = Math.min(N - 1, Math.max(lo, Math.ceil(f1 / binHz)));
        let peak = 0;
        if (hi > lo) {
          for (let k = lo; k <= hi; k++) if (buf[k] > peak) peak = buf[k];
        } else {
          const idx = f0 / binHz;
          const i0 = Math.max(1, Math.floor(idx));
          const i1 = Math.min(N - 1, i0 + 1);
          const t = idx - i0;
          peak = buf[i0] * (1 - t) + buf[i1] * t;
        }
        const val = peak / 255;
        ctx.lineTo(x, height - val * height * 0.9);
      }
      ctx.lineTo(width, height); ctx.closePath();
      ctx.fillStyle = 'rgba(139,92,246,0.15)';
      ctx.fill();
    }

    // Fletcher-Munson equal-loudness contour family (soft reference).
    if (showFM) {
      ctx.lineWidth = 1.2;
      [0, 20, 40].forEach((phon, idx) => {
        ctx.beginPath();
        const N = 90;
        for (let i = 0; i <= N; i++) {
          const f = Math.pow(10, Math.log10(MIN_FREQ) + (i / N) * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)));
          const db = fmContourDb(f, phon);
          const x = freqToX(f, width);
          const y = dbToY(Math.max(minDb, Math.min(maxDb, db)), height);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(34,211,238,${0.5 - idx * 0.13})`;
        ctx.stroke();
      });
      ctx.fillStyle = 'rgba(34,211,238,0.55)';
      ctx.font = '600 8px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('F-M', 6, 12);
    }

    // Pink-noise -3 dB/octave balance reference.
    if (showPink) {
      const y0 = dbToY(Math.max(minDb, Math.min(maxDb, pinkNoiseDb(MIN_FREQ, 0.8))), height);
      const y1 = dbToY(Math.max(minDb, Math.min(maxDb, pinkNoiseDb(MAX_FREQ, 0.8))), height);
      ctx.beginPath();
      ctx.moveTo(freqToX(MIN_FREQ, width), y0);
      ctx.lineTo(freqToX(MAX_FREQ, width), y1);
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.font = '600 8px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('PINK -3dB/oct', width - 6, 12);
    }

    // Ghost curve — the inactive M/S channel, drawn faint and dashed.
    const ghost = ghostResponseRef.current;
    if (ghost.length) {
      ctx.beginPath();
      ghost.forEach((p, i) => {
        const x = freqToX(p.freq, width);
        const y = dbToY(clampDb(p.db), height);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = ghostAccent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const curve = responseRef.current;
    if (curve.length) {
      ctx.beginPath();
      curve.forEach((p, i) => {
        const x = freqToX(p.freq, width);
        const y = dbToY(clampDb(p.db), height);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.enabled ? enabledAccent : 'rgba(167,139,250,0.4)';
      ctx.lineWidth = 2;
      ctx.shadowColor = enabledAccent + '99';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    shapePath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Axis labels — frequency along the bottom, ±dB down the left side.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach((f) => {
      const x = freqToX(f, width);
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x, height - 1.5);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let db = minDb; db <= maxDb; db += labelDb) {
      const y = dbToY(db, height);
      if (y < notchH + 6) continue; // top-left notch cuts into the label space
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 3, y);
    }

    const bands = bandList(s);
    const bandPoints = bands.map((b) => {
      const x = freqToX(b.freq, width);
      const y = dbToY(clampDb(sampleAt(b.freq)), height);
      return { ...b, x, y };
    });
    bandPoints.forEach((b) => {
      // Saturation engaged on this band → draw an orange ring around the dot.
      if (b.satEnabled) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Solo ring (lit when this band is soloed).
      if (b.solo) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = b.color; ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Selection ring + Q lateral wings + down-triangle hint.
      if (b.id === selected) {
        // Coloured selection ring + glow so the active node reads at a glance
        // and matches the band's pill colour below.
        ctx.beginPath();
        ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = b.color + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (b.kind === 'mid' && b.q != null) {
          const half = wingHalf(b.q);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(b.x - half, b.y); ctx.lineTo(b.x + half, b.y); ctx.stroke();
          [b.x - half, b.x + half].forEach((ex) => {
            ctx.beginPath(); ctx.arc(ex, b.y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = b.color; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.stroke();
          });
        }
        ctx.beginPath();
        ctx.moveTo(b.x - 3, b.y + 9); ctx.lineTo(b.x + 3, b.y + 9); ctx.lineTo(b.x, b.y + 13); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fill();
      }
      const dim = b.enabled === false ? 0.3 : 1;
      ctx.globalAlpha = dim;
      ctx.beginPath();
      ctx.arc(b.x, b.y, (dragging === b.id || b.id === selected) ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    if (onDrawOverlay) {
      onDrawOverlay(ctx, {
        width, height,
        freqToX: (f) => freqToX(f, width),
        dbToY: (d) => dbToY(d, height),
        bands: bandPoints,
      });
    }
  }, [dims, dragging, selected, showSpectrum, showFM, showPink, analyzerNode, audioContext, response, ghostResponse, sampleAt, onDrawOverlay, enabledAccent, ghostAccent, minDb, maxDb, gridDb, labelDb]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const needAnim = (showSpectrum && analyzerNode) || onDrawOverlay;
    if (!needAnim) return;
    let raf;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [showSpectrum, analyzerNode, onDrawOverlay, draw]);

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = eqRef.current;
    const bands = bandList(s).map((b) => ({
      id: b.id, kind: b.kind, q: b.q,
      x: freqToX(b.freq, rect.width),
      y: dbToY(clampDb(sampleAt(b.freq)), rect.height),
    }));
    // 1. Q-wing hit on the selected mid band.
    if (selected) {
      const sb = bands.find((b) => b.id === selected);
      if (sb && sb.kind === 'mid' && sb.q != null) {
        const half = wingHalf(sb.q);
        if (Math.hypot((sb.x - half) - x, sb.y - y) < 8 || Math.hypot((sb.x + half) - x, sb.y - y) < 8) {
          e.preventDefault(); setQDrag(selected); return;
        }
      }
    }
    // 2. Nearest dot → select + begin freq/gain drag.
    let nearest = null;
    let best = 18;
    bands.forEach((b) => {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < best) { best = d; nearest = b.id; }
    });
    if (nearest) { e.preventDefault(); commitSelect(nearest); setDragging(nearest); return; }
    // 3. Empty graph → deselect.
    commitSelect(null);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clampF(0, rect.width, e.clientX - rect.left);
      const y = clampF(0, rect.height, e.clientY - rect.top);
      const freq = clampF(MIN_FREQ, MAX_FREQ, xToFreq(x, rect.width));
      const desired = clampDb(parseFloat(yToDb(y, rect.height).toFixed(1)));
      const s = eqRef.current;
      const b = bandList(s).find((bb) => bb.id === dragging);
      if (!b) return;
      const other = sampleAt(b.freq) - (b.cut ? 0 : b.kind === 'mid' ? b.gain : b.gain / 2);
      if (b.cut) { onBandDrag?.(b.id, { freq }); return; }
      const newGain = b.kind === 'mid'
        ? clampDb(parseFloat((desired - other).toFixed(1)))
        : clampDb(parseFloat((2 * (desired - other)).toFixed(1)));
      onBandDrag?.(b.id, { freq, gain: newGain });
    };
    const onUp = () => setDragging(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [dragging, onBandDrag, sampleAt, minDb, maxDb]);

  // Q lateral-wing drag → adjusts Q (wider wings = lower Q).
  useEffect(() => {
    if (!qDrag) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const s = eqRef.current;
      const b = bandList(s).find((bb) => bb.id === qDrag);
      if (!b || b.kind !== 'mid') return;
      const dotX = freqToX(b.freq, rect.width);
      const half = clampF(12, 60, Math.abs(x - dotX));
      const q = clampF(0.1, 6, parseFloat(((60 - half) / 8).toFixed(1)));
      onBandDrag?.(b.id, { q });
    };
    const onUp = () => setQDrag(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [qDrag, onBandDrag]);

  // Resolved selected band (full object incl. dynamic fields) for the pop-up.
  const selectedBand = useMemo(() => {
    if (!selected || dims.width <= 0) return null;
    const b = resolveBand(safeEq, selected);
    if (!b) return null;
    return {
      id: selected,
      band: b,
      kind: selected === 'low' ? 'low' : selected === 'high' ? 'high' : 'mid',
      color: colorForId(selected),
      x: freqToX(b.freq, dims.width),
      y: dbToY(clampDb(sampleAt(b.freq)), dims.height),
    };
  }, [selected, safeEq, dims, sampleAt, response, minDb, maxDb]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[200px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
      />
      <button
        onClick={() => setShowSpectrum((v) => !v)}
        className={`absolute top-1 left-2 px-1.5 py-0.5 rounded-md text-[8px] border transition-all ${
          showSpectrum ? 'bg-violet-500/40 border-violet-400 text-white' : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
        }`}
      >Spectrum</button>
      <div className="absolute top-1 right-1 flex gap-0.5">
        <button
          onClick={() => setShowFM((v) => !v)}
          className={`px-1.5 py-0.5 rounded-md text-[8px] border transition-all ${
            showFM ? 'bg-cyan-500/40 border-cyan-400 text-white' : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
          }`}
          title="Fletcher-Munson equal-loudness contours"
        >F-M</button>
        <button
          onClick={() => setShowPink((v) => !v)}
          className={`px-1.5 py-0.5 rounded-md text-[8px] border transition-all ${
            showPink ? 'bg-amber-500/40 border-amber-400 text-white' : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
          }`}
          title="Pink noise -3 dB/octave reference"
        >Pink-N</button>
      </div>

      {selectedBand && (
        <BandDotMenu
          key={selectedBand.id}
          band={selectedBand.band}
          kind={selectedBand.kind}
          color={selectedBand.color}
          anchor={{ x: selectedBand.x, y: selectedBand.y }}
          containerWidth={dims.width}
          containerHeight={dims.height}
          onPatch={(patch) => onBandDrag?.(selectedBand.id, patch)}
          onClose={() => commitSelect(null)}
        />
      )}
    </div>
  );
}