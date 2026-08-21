import React, { useRef, useEffect, useCallback, useState } from 'react';
import { SECTION_COLORS, mixHex } from '../sectionMasteringModel.js';

/**
 * Section Mastering waveform canvas.
 *
 * Behind: a professional min/max waveform of the loaded file (mono-summed).
 * On top: semi-transparent coloured section regions (one per assigned letter),
 * draggable white cue handles (horizontal drag = cue position), and per-cue
 * "✕" glide handles (vertical drag = cross-parameterization amount) that draw
 * a triangle/glide zone blending the two adjacent section colours. A cyan
 * playhead reads engine.getPlayback() each frame.
 *
 * The glide zone is visualised here; the actual DSP parameter morph is a
 * follow-up phase — for now clicking a section or enabling Live Follow
 * hard-switches the section's assigned preset.
 */
export default function SectionWaveform({
  peaks, cues, glides, assignment,
  onCueChange, onGlideChange, onSectionClick,
  getPlayback,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const stateRef = useRef({ cues, glides, assignment });
  useEffect(() => { stateRef.current = { cues, glides, assignment }; }, [cues, glides, assignment]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height: h } = dims;
    if (width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = stateRef.current;
    const mid = h / 2;

    // background
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect(0, 0, width, h);

    // section regions
    const bounds = [0, ...s.cues, 1];
    for (let i = 0; i < s.assignment.length; i++) {
      const x0 = bounds[i] * width;
      const x1 = bounds[i + 1] * width;
      const col = SECTION_COLORS[s.assignment[i]] || '#888';
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, col + '14');
      g.addColorStop(0.5, col + '30');
      g.addColorStop(1, col + '14');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h);
      ctx.fillStyle = col + 'cc';
      ctx.font = '700 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.assignment[i], (x0 + x1) / 2, 18);
    }

    // waveform (min/max bars, centred)
    if (peaks && peaks.length) {
      const n = peaks.length;
      const colW = width / n;
      const amp = mid - 10;
      for (let i = 0; i < n; i++) {
        const x = i * colW;
        const yMax = mid - peaks[i].max * amp;
        const yMin = mid - peaks[i].min * amp;
        ctx.fillStyle = 'rgba(170,190,210,0.55)';
        ctx.fillRect(x, yMax, Math.max(1, colW), Math.max(1, yMin - yMax));
      }
    }

    // glide zones + cue handles
    for (let i = 0; i < s.cues.length; i++) {
      const cx = s.cues[i] * width;
      const leftCol = SECTION_COLORS[s.assignment[i]] || '#888';
      const rightCol = SECTION_COLORS[s.assignment[i + 1]] || '#888';
      const glide = s.glides[i] ?? 0;
      const leftSpan = (s.cues[i] - (i ? s.cues[i - 1] : 0)) * width;
      const rightSpan = ((i + 1 < s.cues.length ? s.cues[i + 1] : 1) - s.cues[i]) * width;
      const maxZone = Math.min(leftSpan, rightSpan, 0.18 * width);
      const zoneHalf = glide * maxZone;

      // glide zone — crossfade gradient + triangle outline
      if (zoneHalf > 1) {
        const g = ctx.createLinearGradient(cx - zoneHalf, 0, cx + zoneHalf, 0);
        g.addColorStop(0, leftCol + '55');
        g.addColorStop(0.5, mixHex(leftCol, rightCol) + '88');
        g.addColorStop(1, rightCol + '55');
        ctx.fillStyle = g;
        ctx.fillRect(cx - zoneHalf, 0, zoneHalf * 2, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, mid - 22);
        ctx.lineTo(cx - zoneHalf, mid + 22);
        ctx.lineTo(cx + zoneHalf, mid + 22);
        ctx.closePath();
        ctx.stroke();
      }

      // cue line + handle
      const cueActive = (drag && drag.type === 'cue' && drag.i === i) || (hover && hover.type === 'cue' && hover.i === i);
      ctx.strokeStyle = cueActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
      ctx.setLineDash(cueActive ? [] : [4, 4]);
      ctx.lineWidth = cueActive ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx, mid, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#0b0e14'; ctx.lineWidth = 1; ctx.stroke();

      // glide ✕ handle — vertical position encodes amount (top = max glide)
      const trackTop = 34, trackBottom = h - 28;
      const gy = trackBottom - glide * (trackBottom - trackTop);
      const gActive = (drag && drag.type === 'glide' && drag.i === i) || (hover && hover.type === 'glide' && hover.i === i);
      ctx.beginPath(); ctx.arc(cx, gy, gActive ? 8 : 7, 0, Math.PI * 2);
      ctx.fillStyle = leftCol; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 3, gy - 3); ctx.lineTo(cx + 3, gy + 3);
      ctx.moveTo(cx + 3, gy - 3); ctx.lineTo(cx - 3, gy + 3);
      ctx.stroke();
    }

    // playhead
    const pb = getPlayback?.() || { current: 0, duration: 0 };
    if (pb.duration > 0) {
      const px = (pb.current / pb.duration) * width;
      ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath(); ctx.arc(px, 7, 3, 0, Math.PI * 2); ctx.fill();
    }
  }, [dims, drag, hover, peaks, getPlayback]);

  // rAF redraw for the playhead
  useEffect(() => {
    let raf;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const HIT = 13;
  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    const mid = rect.height / 2;
    const trackTop = 34, trackBottom = rect.height - 28;
    // glide ✕ circles
    for (let i = 0; i < s.cues.length; i++) {
      const cx = s.cues[i] * rect.width;
      const gy = trackBottom - (s.glides[i] ?? 0) * (trackBottom - trackTop);
      if (Math.hypot(cx - x, gy - y) < HIT) { e.preventDefault(); setDrag({ type: 'glide', i }); return; }
    }
    // cue handles
    for (let i = 0; i < s.cues.length; i++) {
      const cx = s.cues[i] * rect.width;
      if (Math.hypot(cx - x, mid - y) < HIT) { e.preventDefault(); setDrag({ type: 'cue', i }); return; }
    }
    // cue lines
    for (let i = 0; i < s.cues.length; i++) {
      if (Math.abs(s.cues[i] * rect.width - x) < 7) { e.preventDefault(); setDrag({ type: 'cue', i }); return; }
    }
    // section click (audition)
    const frac = x / rect.width;
    const bounds = [0, ...s.cues, 1];
    for (let i = 0; i < bounds.length - 1; i++) {
      if (frac >= bounds[i] && frac <= bounds[i + 1]) { onSectionClick?.(i); return; }
    }
  };

  const onPointerMove = (e) => {
    if (drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    const mid = rect.height / 2;
    const trackTop = 34, trackBottom = rect.height - 28;
    let found = null;
    for (let i = 0; i < s.cues.length; i++) {
      const cx = s.cues[i] * rect.width;
      const gy = trackBottom - (s.glides[i] ?? 0) * (trackBottom - trackTop);
      if (Math.hypot(cx - x, gy - y) < HIT) { found = { type: 'glide', i }; break; }
      if (Math.hypot(cx - x, mid - y) < HIT) { found = { type: 'cue', i }; break; }
    }
    setHover(found);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const s = stateRef.current;
      if (drag.type === 'cue') {
        const margin = 0.02;
        const lo = drag.i === 0 ? margin : s.cues[drag.i - 1] + margin;
        const hi = drag.i === s.cues.length - 1 ? 1 - margin : s.cues[drag.i + 1] - margin;
        const frac = Math.max(lo, Math.min(hi, (e.clientX - rect.left) / rect.width));
        onCueChange?.(drag.i, Math.round(frac * 1000) / 1000);
      } else {
        const trackTop = 34, trackBottom = rect.height - 28;
        const amt = Math.max(0, Math.min(1, (trackBottom - (e.clientY - rect.top)) / (trackBottom - trackTop)));
        onGlideChange?.(drag.i, Math.round(amt * 100) / 100);
      }
    };
    const onUp = () => setDrag(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [drag, onCueChange, onGlideChange]);

  const cursor =
    drag?.type === 'cue' || hover?.type === 'cue' ? 'col-resize'
      : drag?.type === 'glide' || hover?.type === 'glide' ? 'ns-resize'
        : 'pointer';

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}