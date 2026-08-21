import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  MBC_MIN_FREQ, MBC_MAX_FREQ, MBC_MIN_THRESH, MBC_MAX_THRESH,
  mbcFreqToX, mbcXToFreq, mbcBandList, mgToNorm, normToMg,
} from '../multiBandCompModel.js';

/**
 * Multi-Band Compressor canvas: coloured band regions, draggable white crossover
 * handles (horizontal drag = frequency) and draggable coloured threshold handles
 * (vertical drag = threshold). Live gain-reduction bars are overlaid per band
 * from the compressor nodes' `.reduction`.
 */
const dbToY = (db, h) => (1 - (db - MBC_MIN_THRESH) / (MBC_MAX_THRESH - MBC_MIN_THRESH)) * h;
const yToDb = (y, h) => (1 - y / h) * (MBC_MAX_THRESH - MBC_MIN_THRESH) + MBC_MIN_THRESH;
const clampF = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
const fmt = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f % 1000 ? 1 : 0)}k` : `${f}`);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Makeup-gain shader lives in a dedicated BOTTOM lane of the graph, fully
// decoupled from the threshold line. 0 dB → empty lane, 24 dB → full lane.
// Drag vertically inside a band's bottom lane to set its makeup gain.
const GAIN_LANE = 70;

export default function MBCGraph({ state, onBandChange, onCrossoverChange, mbcNodes, accent = '#4ade80', onBandSelect }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ width: r.width, height: Math.max(120, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = dims;
    if (width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = stateRef.current;
    const bands = mbcBandList(s);

    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(0, 0, width, height);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((f) => {
      const x = mbcFreqToX(f, width);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    });
    for (let db = MBC_MIN_THRESH; db <= MBC_MAX_THRESH; db += 12) {
      const y = dbToY(db, height);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.moveTo(0, dbToY(0, height)); ctx.lineTo(width, dbToY(0, height)); ctx.stroke();

    // band regions
    bands.forEach((b) => {
      const x0 = mbcFreqToX(b.lo, width);
      const x1 = mbcFreqToX(b.hi, width);
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, b.color + '14');
      grad.addColorStop(0.5, b.color + '2e');
      grad.addColorStop(1, b.color + '14');
      ctx.fillStyle = grad;
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), height);
      ctx.fillStyle = b.color + 'cc';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`B${b.id + 1}`, (x0 + x1) / 2, 12);
    });

    // live gain-reduction shaded area — a vivid gradient descending from the
    // threshold line, with a bright leading edge + dB readout so the
    // compression animation is clearly visible even for small reductions.
    if (mbcNodes && s.enabled) {
      const pxPerDb = height / (MBC_MAX_THRESH - MBC_MIN_THRESH);
      bands.forEach((b) => {
        const comp = mbcNodes[b.id];
        if (!comp) return;
        const gr = Math.max(0, -comp.reduction);
        if (gr < 0.01) return;
        const x0 = mbcFreqToX(b.lo, width);
        const x1 = mbcFreqToX(b.hi, width);
        const w = Math.max(1, x1 - x0 - 4);
        const ty = dbToY(b.threshold, height);
        const y1 = Math.min(height, ty + gr * pxPerDb);
        const h = Math.max(1, y1 - ty);
        const grad = ctx.createLinearGradient(0, ty, 0, y1);
        grad.addColorStop(0, b.color + 'cc');
        grad.addColorStop(1, b.color + '20');
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + 2, ty, w, h);
        // bright leading edge — the live reduction level
        ctx.fillStyle = b.color;
        ctx.fillRect(x0 + 2, y1 - 1, w, 1.5);
        // live dB readout below the reduction area
        ctx.fillStyle = b.color;
        ctx.font = '700 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const ly = Math.min(y1 + 9, height - 2);
        ctx.fillText(`−${gr.toFixed(1)}`, (x0 + x1) / 2, ly);
      });
    }

    // crossover lines + handles
    (s.crossovers || []).forEach((f, i) => {
      const x = mbcFreqToX(f, width);
      const isDrag = drag && drag.type === 'xover' && drag.index === i;
      const isHover = !isDrag && hover && hover.type === 'xover' && hover.index === i;
      const active = isDrag || isHover;
      ctx.strokeStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = active ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, height / 2, isDrag ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fmt(f), x, height - 4);
    });

    // threshold handles
    bands.forEach((b) => {
      const x = mbcFreqToX(b.center, width);
      const y = dbToY(b.threshold, height);
      const isDrag = drag && drag.type === 'thresh' && drag.index === b.id;
      const isHover = !isDrag && hover && hover.type === 'thresh' && hover.index === b.id;
      const x0 = mbcFreqToX(b.lo, width);
      const x1 = mbcFreqToX(b.hi, width);
      // Threshold line is bold ONLY while being dragged — hover no longer
      // keeps it solid, so it always reverts to dotted when you release/click away.
      ctx.strokeStyle = isDrag ? b.color : b.color + 'aa';
      ctx.lineWidth = isDrag ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, isDrag ? 7 : (isHover ? 6 : 5), 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.threshold.toFixed(0)}`, x, y - 9);
    });

    // band output-gain (makeup) — shader fill rising to the gain level, a thick
    // solid leading-edge line at that level, and a small lightly-rounded
    // grabber sitting ON the line at the band centre. Drag the grabber
    // vertically to set makeup gain (0→24 dB).
    const laneTop = height - GAIN_LANE;
    const laneBot = height - 3;
    bands.forEach((b) => {
      const x0 = mbcFreqToX(b.lo, width);
      const x1 = mbcFreqToX(b.hi, width);
      const w = Math.max(1, x1 - x0);
      const mg = Math.max(0, Math.min(24, b.makeupGain || 0));
      const norm = mgToNorm(mg);
      const barY = laneBot - norm * (laneBot - laneTop);
      const cx = mbcFreqToX(b.center, width);
      const isDrag = drag && drag.type === 'gain' && drag.index === b.id;
      const isHover = !isDrag && hover && hover.type === 'gain' && hover.index === b.id;
      const active = isDrag || isHover;
      // shader fill from the gain level down to the lane floor
      if (mg > 0) {
        const grad = ctx.createLinearGradient(0, laneTop, 0, laneBot);
        grad.addColorStop(0, b.color + '14');
        grad.addColorStop(1, b.color + (active ? '99' : '66'));
        ctx.fillStyle = grad;
        ctx.fillRect(x0, barY, w, laneBot - barY);
      }
      // solid leading-edge line at the gain level (always visible)
      ctx.fillStyle = active ? b.color : b.color + 'dd';
      ctx.fillRect(x0, barY - 1.5, w, 3);
      // small grabber handle sitting ON the line at band centre
      const gw = 12, gh = 7;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = active ? 8 : 4;
      roundRect(ctx, cx - gw / 2, barY - gh / 2, gw, gh, 1.5);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      // grip ridges
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 2.5, barY - 2.5);
        ctx.lineTo(cx + i * 2.5, barY + 2.5);
        ctx.stroke();
      }
      // gain readout above the grabber
      if (mg > 0) {
        ctx.fillStyle = b.color;
        ctx.font = '700 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`+${mg.toFixed(1)}`, cx, barY - gh / 2 - 3);
      }
    });
  }, [dims, drag, hover, mbcNodes, accent]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!mbcNodes) return;
    let raf;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mbcNodes, draw]);

  const HIT_DOT = 14;
  const HIT_LINE = 8;

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    // Clicking anywhere in a band also selects that band's footer pill, so the
    // matching dials come up for quick editing (no need to hunt for the button).
    {
      let bestBand = null, bestD = Infinity;
      mbcBandList(s).forEach((b) => {
        const lx = mbcFreqToX(b.lo, rect.width);
        const rx = mbcFreqToX(b.hi, rect.width);
        if (x >= lx && x <= rx) {
          const d = Math.abs((mbcFreqToX(b.center, rect.width)) - x);
          if (d < bestD) { bestD = d; bestBand = b.id; }
        }
      });
      if (bestBand != null) onBandSelect?.(bestBand);
    }
    // 1. gain shader — the BOTTOM lane (decoupled from the threshold line).
    if (y >= rect.height - GAIN_LANE) {
      let gBand = null, gD = Infinity;
      mbcBandList(s).forEach((b) => {
        const lx = mbcFreqToX(b.lo, rect.width);
        const rx = mbcFreqToX(b.hi, rect.width);
        if (x >= lx && x <= rx) {
          const d = Math.abs(mbcFreqToX(b.center, rect.width) - x);
          if (d < gD) { gD = d; gBand = b.id; }
        }
      });
      if (gBand != null) { e.preventDefault(); setDrag({ type: 'gain', index: gBand }); return; }
    }
    // 2. crossover dots (centre of canvas)
    let best = null, bestD = HIT_DOT;
    (s.crossovers || []).forEach((f, i) => {
      const d = Math.hypot(mbcFreqToX(f, rect.width) - x, rect.height / 2 - y);
      if (d < bestD) { bestD = d; best = { type: 'xover', index: i }; }
    });
    if (best) { e.preventDefault(); setDrag(best); return; }
    // 3. threshold dots (band centre)
    bestD = HIT_DOT;
    mbcBandList(s).forEach((b) => {
      const cx = mbcFreqToX(b.center, rect.width);
      const dT = Math.hypot(cx - x, dbToY(b.threshold, rect.height) - y);
      if (dT < bestD) { bestD = dT; best = { type: 'thresh', index: b.id }; }
    });
    if (best) { e.preventDefault(); setDrag(best); return; }
    // 4. vertical crossover lines
    bestD = HIT_LINE;
    (s.crossovers || []).forEach((f, i) => {
      const d = Math.abs(mbcFreqToX(f, rect.width) - x);
      if (d < bestD) { bestD = d; best = { type: 'xover', index: i }; }
    });
    if (best) { e.preventDefault(); setDrag(best); return; }
    // 5. horizontal threshold lines
    bestD = HIT_LINE;
    mbcBandList(s).forEach((b) => {
      const lx = mbcFreqToX(b.lo, rect.width);
      const rx = mbcFreqToX(b.hi, rect.width);
      if (x >= lx && x <= rx) {
        const dT = Math.abs(dbToY(b.threshold, rect.height) - y);
        if (dT < bestD) { bestD = dT; best = { type: 'thresh', index: b.id }; }
      }
    });
    if (best) { e.preventDefault(); setDrag(best); }
  };

  const onPointerMove = (e) => {
    if (drag) return; // dragging handled by the document listener
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    let found = null, bestD;
    // 1. gain shader — bottom lane
    if (y >= rect.height - GAIN_LANE) {
      let gBand = null, gD = Infinity;
      mbcBandList(s).forEach((b) => {
        const lx = mbcFreqToX(b.lo, rect.width);
        const rx = mbcFreqToX(b.hi, rect.width);
        if (x >= lx && x <= rx) {
          const d = Math.abs(mbcFreqToX(b.center, rect.width) - x);
          if (d < gD) { gD = d; gBand = b.id; }
        }
      });
      if (gBand != null) found = { type: 'gain', index: gBand };
    }
    // 2. crossover dots
    if (!found) {
      bestD = HIT_DOT;
      (s.crossovers || []).forEach((f, i) => {
        const d = Math.hypot(mbcFreqToX(f, rect.width) - x, rect.height / 2 - y);
        if (d < bestD) { bestD = d; found = { type: 'xover', index: i }; }
      });
    }
    // 3. threshold dots
    if (!found) {
      bestD = HIT_DOT;
      mbcBandList(s).forEach((b) => {
        const cx = mbcFreqToX(b.center, rect.width);
        const dT = Math.hypot(cx - x, dbToY(b.threshold, rect.height) - y);
        if (dT < bestD) { bestD = dT; found = { type: 'thresh', index: b.id }; }
      });
    }
    // 4. vertical crossover lines
    if (!found) {
      bestD = HIT_LINE;
      (s.crossovers || []).forEach((f, i) => {
        const d = Math.abs(mbcFreqToX(f, rect.width) - x);
        if (d < bestD) { bestD = d; found = { type: 'xover', index: i }; }
      });
    }
    // 5. horizontal threshold lines
    if (!found) {
      bestD = HIT_LINE;
      mbcBandList(s).forEach((b) => {
        const lx = mbcFreqToX(b.lo, rect.width);
        const rx = mbcFreqToX(b.hi, rect.width);
        if (x >= lx && x <= rx) {
          const dT = Math.abs(dbToY(b.threshold, rect.height) - y);
          if (dT < bestD) { bestD = dT; found = { type: 'thresh', index: b.id }; }
        }
      });
    }
    setHover((prev) => {
      if (found && prev && prev.type === found.type && prev.index === found.index) return prev;
      return found;
    });
  };

  const onPointerLeave = () => setHover(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const s = stateRef.current;
      if (drag.type === 'xover') {
        const x = clampF(0, rect.width, e.clientX - rect.left);
        let f = Math.round(mbcXToFreq(x, rect.width));
        const margin = 1.15;
        const lo = drag.index === 0 ? MBC_MIN_FREQ * margin : (s.crossovers[drag.index - 1]) * margin;
        const hi = drag.index === s.crossovers.length - 1 ? MBC_MAX_FREQ / margin : (s.crossovers[drag.index + 1]) / margin;
        f = Math.round(Math.max(lo, Math.min(hi, f)));
        onCrossoverChange?.(drag.index, f);
      } else if (drag.type === 'thresh') {
        const y = clampF(0, rect.height, e.clientY - rect.top);
        let db = parseFloat(yToDb(y, rect.height).toFixed(1));
        db = Math.max(MBC_MIN_THRESH, Math.min(MBC_MAX_THRESH, db));
        onBandChange?.(drag.index, { threshold: db });
      } else if (drag.type === 'gain') {
        const lt = rect.height - GAIN_LANE;
        const lb = rect.height - 3;
        let y = clampF(lt, lb, e.clientY - rect.top);
        let ratio = (lb - y) / (lb - lt);
        ratio = Math.max(0, Math.min(1, ratio));
        const mg = normToMg(ratio);
        onBandChange?.(drag.index, { makeupGain: mg });
      }
    };
    const onUp = () => { setDrag(null); setHover(null); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [drag, onCrossoverChange, onBandChange]);

  const cursor =
    drag?.type === 'xover' || hover?.type === 'xover' ? 'col-resize'
      : drag?.type === 'thresh' || hover?.type === 'thresh'
        || drag?.type === 'gain' || hover?.type === 'gain' ? 'row-resize'
        : 'crosshair';

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 200 }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      />
    </div>
  );
}