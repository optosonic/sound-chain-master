import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { ChevronDown, ChevronRight, Flame, X, Power } from 'lucide-react';
import Dial from './Dial.jsx';

/**
 * Compact, crisp pop-up "dot menu" anchored to a selected EQ / Dynamic-EQ band.
 *
 * Layout (short + wide, reference-style):
 *   [ icon column | type chip / shape dropdown + Freq·Gain·Q | threshold slider | drawer ]
 *
 * Placement is gain-aware and curve-avoiding: a boost (gain ≥ 0) pops the panel
 * BELOW the 0 dB neutral line (the bell lives above it), a cut pops it ABOVE
 * neutral (the bell lives below it) — so the panel never sits on the curve. It
 * flips to the side when there's no room, and clamps horizontally inside the
 * graph. The left icon column has Bypass (power), Solo (S) and Close (X). Solo
 * mutes every other band; Bypass neutralises this band.
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const fmtFreq = (f) => (f >= 1000 ? `${(f / 1000).toFixed(2)}k` : `${Math.round(f)}`);
const fmtDb = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
const fmtMs = (s) => `${Math.round(s * 1000)}`;
const fmtPct = (v) => `${Math.round(v * 100)}`;

const SAT_COLOR = '#fb923c';

const SHAPES = [
  { id: 'bell', label: 'Bell' },
  { id: 'propq', label: 'Proportional Q' },
  { id: 'bandshelf', label: 'Band Shelf' },
  { id: 'baxbass', label: 'Baxandall Bass' },
  { id: 'baxtreble', label: 'Baxandall Treble' },
];

/* tiny line glyph for each filter shape */
function ShapeGlyph({ shape, color }) {
  const s = shape || 'bell';
  const d = {
    bell: 'M1 9 C 4 9 4 1 7 1 C 10 1 10 9 13 9',
    propq: 'M1 9 C 5.5 9 5.5 1 7 1 C 8.5 1 8.5 9 13 9',
    bandshelf: 'M1 9 H4 C6 9 6 3 8 3 C10 3 10 9 13 9',
    baxbass: 'M1 9 C 6 9 8 2 13 2',
    baxtreble: 'M1 2 C 6 2 8 9 13 9',
  }[s];
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path d={d} stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShapeDropdown({ value, color, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = SHAPES.find((s) => s.id === value) || SHAPES[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold text-black w-fit"
        style={{ background: color }}
      >
        {cur.label}<ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-0.5 left-0 rounded-md border border-white/10 py-0.5 min-w-[130px] shadow-xl" style={{ background: '#22272e' }}>
            {SHAPES.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={`flex w-full items-center gap-1.5 px-2 py-1 text-left text-[9px] ${s.id === value ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}
              >
                <ShapeGlyph shape={s.id} color={color} />{s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── tiny vertical slider (Threshold) ── */
function MiniVSlider({ value, min, max, onChange, height = 44, accent }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const setFromY = (clientY) => {
    const r = ref.current.getBoundingClientRect();
    let t = 1 - (clientY - r.top) / r.height;
    t = clamp(t, 0, 1);
    onChange(parseFloat((min + t * (max - min)).toFixed(1)));
  };
  useEffect(() => {
    if (!drag) return;
    const mv = (e) => setFromY(e.clientY);
    const up = () => setDrag(false);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [drag]);
  const t = (value - min) / (max - min);
  return (
    <div
      ref={ref}
      onPointerDown={(e) => { e.preventDefault(); setDrag(true); setFromY(e.clientY); }}
      className="relative cursor-ns-resize touch-none"
      style={{ width: 18, height }}
    >
      <div className="absolute left-1/2 -translate-x-1/2 w-px" style={{ top: 0, bottom: 0, background: 'rgba(255,255,255,0.18)' }} />
      <div className="absolute left-1/2 -translate-x-1/2 w-0.5 rounded-full" style={{ bottom: 0, height: (1 - t) * height, background: accent, opacity: 0.55 }} />
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white shadow"
        style={{ top: (1 - t) * height - 6, width: 11, height: 11, border: `2px solid ${accent}` }} />
    </div>
  );
}

/* ── thin horizontal slider (Ratio / Attack / Release) — a slim 1px line
 *   with a small dot, matching the threshold fader's visual language so the
 *   dynamics drawer reads as the same family, not a thicker variant. ── */
function MiniHSlider({ value, min, max, onChange, width = 96, accent, scale }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  // Log scale gives finer travel per unit at the low end (mastering ratios live
  // near 1:1–1:3, so linear wasted the useful range in the first 25% of slider).
  const toVal = (t) => scale === 'log' ? min * Math.pow(max / min, t) : min + t * (max - min);
  const toT = (v) => scale === 'log' ? Math.log(Math.max(min, v) / min) / Math.log(max / min) : (v - min) / (max - min);
  const setFromX = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    let t = (clientX - r.left) / r.width;
    t = clamp(t, 0, 1);
    onChange(parseFloat(toVal(t).toFixed(3)));
  };
  useEffect(() => {
    if (!drag) return;
    const mv = (e) => setFromX(e.clientX);
    const up = () => setDrag(false);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [drag]);
  const t = clamp(toT(value), 0, 1);
  return (
    <div ref={ref} onPointerDown={(e) => { e.preventDefault(); setDrag(true); setFromX(e.clientX); }}
      className="relative cursor-ew-resize touch-none"
      style={{ width, height: 12 }}>
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2" style={{ height: 1, background: 'rgba(255,255,255,0.18)' }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ width: t * width, height: 1, background: accent, opacity: 0.85 }} />
      <div className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ left: t * width - 4, width: 8, height: 8, border: `1.5px solid ${accent}`, boxShadow: `0 0 4px ${accent}66` }} />
    </div>
  );
}

function Cell({ label, value, unit }) {
  return (
    <div className="flex flex-col items-center min-w-0 px-1.5">
      <span className="text-[7px] uppercase tracking-wider text-white/40 leading-none">{label}</span>
      <span className="text-[10px] text-white leading-tight tabular-nums whitespace-nowrap">{value}{unit && <span className="text-white/40 text-[8px] ml-0.5">{unit}</span>}</span>
    </div>
  );
}

function Param({ label, value, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase tracking-wider text-white/40">{label}</span>
        <span className="text-[9px] text-white tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Tip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && text && (
        <div className="absolute z-40 left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] text-black border border-black/20 shadow-md"
          style={{ background: '#FEFBEA' }}>{text}</div>
      )}
    </div>
  );
}

/* lit mini icon button (bypass / solo) */
function IconBtn({ active, activeColor, title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid place-items-center rounded-full w-5 h-5 border text-[8px] font-bold transition-all"
      style={active
        ? { background: activeColor, borderColor: activeColor, color: '#000', boxShadow: `0 0 6px ${activeColor}` }
        : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}
    >
      {children}
    </button>
  );
}

/* compact single-row dynamics parameter: [label] [thin slider] [value].
 *   Three of these stack inside the drawer without exceeding the panel's
 *   standard height. */
function DynRow({ label, value, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-[8px] uppercase tracking-wider text-white/40">{label}</span>
      <div className="shrink-0">{children}</div>
      <span className="text-[9px] text-white tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}

export default function BandDotMenu({ band, kind, color, onPatch, onClose, anchor, containerWidth, containerHeight = 260 }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState(() => {
    const boost = !band?.cut && (band?.gain || 0) >= 0;
    return { left: clamp(anchor.x - 120, 4, containerWidth - 240), top: boost ? anchor.y + 28 : Math.max(6, anchor.y - 112) };
  });
  // Once the user manually drags the panel it stays put so they can move it
  // clear of the bell curve to see the live dynamics processing. Reset on band
  // change is handled by the `key` on <BandDotMenu> in EQGraph (remount → fresh
  // state), so selecting another band re-anchors automatically.
  const [userPos, setUserPos] = useState(null);
  const [draggingPanel, setDraggingPanel] = useState(false);
  const dragStart = useRef(null);

  const onPanelPointerDown = (e) => {
    // Only drag from the panel chrome — not from buttons, the dial (svg), or
    // the sliders (which carry their own cursor-resize classes).
    if (e.target.closest('button, svg, input, .cursor-ew-resize, .cursor-ns-resize')) return;
    e.preventDefault();
    const base = userPos || pos;
    dragStart.current = { x: e.clientX, y: e.clientY, left: base.left, top: base.top };
    setDraggingPanel(true);
  };

  useEffect(() => {
    if (!draggingPanel) return;
    const onMove = (e) => {
      const ds = dragStart.current;
      if (!ds) return;
      const el = ref.current;
      const w = el ? el.offsetWidth : 240;
      const h = el ? el.offsetHeight : 80;
      const left = clamp(ds.left + (e.clientX - ds.x), 0, Math.max(0, containerWidth - w));
      const top = clamp(ds.top + (e.clientY - ds.y), 0, Math.max(0, containerHeight - h));
      setUserPos({ left, top });
      setPos({ left, top });
    };
    const onUp = () => setDraggingPanel(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [draggingPanel, containerWidth, containerHeight]);

  const isMid = kind === 'mid';
  const isShelf = kind === 'low' || kind === 'high';
  const dynamic = !!(band && band.threshold !== undefined);
  const cut = !!band?.cut;
  const enabled = band?.enabled !== false;
  const solo = !!band?.solo;
  const shape = band?.shape || 'bell';

  useLayoutEffect(() => {
    if (userPos) return; // user has repositioned the panel — keep it
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 28;
    const neutralY = containerHeight / 2;
    const isCut = !!band?.cut || (band?.gain || 0) < 0;
    let left = null;
    let top = null;
    // 1. Preferred side = the curve-free side: BELOW neutral for boosts (curve
    //    is above), ABOVE neutral for cuts (curve is below). Keeps the panel
    //    clear of the bell shape with a generous gap from the dot.
    if (!isCut) {
      const t = Math.max(anchor.y + gap, neutralY + 4);
      if (t + h <= containerHeight - 4) { top = t; left = clamp(anchor.x - w / 2, 4, containerWidth - w - 4); }
    } else {
      const bottom = Math.min(anchor.y - gap, neutralY - 4);
      const t = bottom - h;
      if (t >= 4) { top = t; left = clamp(anchor.x - w / 2, 4, containerWidth - w - 4); }
    }
    // 2. Fallback: place to the SIDE of the dot so the panel never sits on the curve.
    if (left == null) {
      const sideRight = anchor.x + gap + 6;
      left = sideRight + w <= containerWidth - 4 ? sideRight : Math.max(4, anchor.x - w - gap - 6);
      top = clamp(anchor.y - h / 2, 4, containerHeight - h - 4);
    }
    setPos({ left, top });
  }, [anchor.x, anchor.y, containerWidth, containerHeight, expanded, dynamic, cut, band?.gain, band?.enabled, band?.solo, band?.shape, userPos]);

  if (!band) return null;

  return (
    <div
      ref={ref}
      onPointerDown={onPanelPointerDown}
      className="absolute z-30 flex rounded-md font-mono text-white/85 select-none band-dot-menu"
      style={{ left: pos.left, top: pos.top, background: '#1d2228', border: '1px solid rgba(0,0,0,0.55)', boxShadow: '0 8px 24px rgba(0,0,0,0.55)', cursor: draggingPanel ? 'grabbing' : 'grab' }}
    >
      {/* icon column — bypass / solo / close */}
      <div className="flex flex-col items-center gap-1 py-1.5 px-0.5 w-6 border-r border-white/10">
        <IconBtn active={enabled} activeColor="#ef4444" title="Activate / bypass band"
          onClick={() => onPatch({ enabled: enabled ? false : true })}>
          <Power size={10} />
        </IconBtn>
        <IconBtn active={solo} activeColor={color} title="Solo band"
          onClick={() => onPatch({ solo: !solo })}>
          S
        </IconBtn>
        <button onClick={onClose} title="Close"
          className="grid place-items-center rounded-full w-5 h-5 border transition-all hover:bg-white/15"
          style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.28)', color: 'rgba(255,255,255,0.8)' }}>
          <X size={11} />
        </button>
      </div>

      {/* type + value grid */}
      <div className="flex flex-col gap-1 py-1 px-1.5 min-w-0">
        {isMid && !dynamic ? (
          <ShapeDropdown value={shape} color={color} onChange={(v) => onPatch({ shape: v })} />
        ) : isMid && dynamic ? (
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold text-black w-fit" style={{ background: color }}>Bell</span>
        ) : isShelf ? (
          <div className="flex rounded overflow-hidden border border-white/10 text-[8px] font-bold w-fit">
            <button onClick={() => onPatch({ cut: false })} className="px-1.5 py-0.5" style={!cut ? { background: color, color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>Shelf</button>
            <button onClick={() => onPatch({ cut: true })} className="px-1.5 py-0.5" style={cut ? { background: color, color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>Cut</button>
          </div>
        ) : null}
        <div className="flex">
          <Cell label="Freq" value={fmtFreq(band.freq)} unit="Hz" />
          {!cut && <Cell label="Gain" value={fmtDb(band.gain)} unit="dB" />}
          {isMid && <Cell label="Q" value={band.q.toFixed(1)} />}
          {isShelf && cut && <Cell label="Slope" value={band.slope} unit="dB/o" />}
        </div>
      </div>

      {/* threshold (dynamic only) — label + fixed-width value beside the slider.
       *   The value column is right-aligned with a min-width sized to the
       *   longest reading (-60.0 dB), so a minus sign / extra digit never
       *   grows the column and the panel never shifts while dragging. */}
      {dynamic && (
        <div className="flex items-center gap-1 px-1.5 py-1 border-l border-white/10">
          <div className="flex flex-col justify-center min-w-0">
            <Tip text="Determines the level at which the filter is dynamically triggered">
              <span className="text-[8px] uppercase tracking-wider text-white/40 leading-none">Thresh</span>
            </Tip>
            <span className="text-[10px] text-white tabular-nums leading-tight whitespace-nowrap text-right" style={{ minWidth: '46px' }}>
              {band.threshold.toFixed(1)}<span className="text-white/40 text-[8px] ml-0.5">dB</span>
            </span>
          </div>
          <MiniVSlider value={band.threshold} min={-60} max={0} onChange={(v) => onPatch({ threshold: v })} height={42} accent={color} />
        </div>
      )}

      {/* saturation (dynamic only) — relocated out of the drawer into the
       *   always-visible main section as a compact dial (enable toggle + drive
       *   dial), so it no longer inflates the expanding panel. */}
      {dynamic && (
        <div className="flex items-center gap-1 px-1.5 py-1 border-l border-white/10">
          <button onClick={() => onPatch({ satEnabled: !band.satEnabled })} title="Band saturation"
            className="grid place-items-center rounded-full w-5 h-5 border shrink-0 transition-all"
            style={band.satEnabled
              ? { background: SAT_COLOR, borderColor: '#fdba74', color: '#ffffff', boxShadow: `0 0 6px ${SAT_COLOR}` }
              : { background: '#f0a868', borderColor: '#d98a3a', color: '#9a4515' }}>
            <Flame size={10} />
          </button>
          <Dial value={band.satDrive} min={0} max={1} step={0.01} onChange={(v) => onPatch({ satDrive: v })} accent={SAT_COLOR} size="xsmall" />
        </div>
      )}

      {/* drawer toggle + dynamics (dynamic only) — thin faders in compact
       *   single rows so the expanded drawer fits the panel's standard height. */}
      {dynamic && (
        <>
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center justify-center w-4 self-stretch border-l border-white/10 text-white/50 hover:text-white hover:bg-white/5" title="More parameters">
            <ChevronRight size={12} className={expanded ? 'rotate-180' : ''} />
          </button>
          {expanded && (
            <div className="flex flex-col justify-center gap-1 px-1.5 py-1 border-l border-white/10">
              <div className="flex items-center gap-1">
                <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
                <span className="text-[8px] uppercase tracking-wider text-white/50">Dynamics</span>
              </div>
              <DynRow label="Ratio" value={band.ratio.toFixed(1)}>
                <MiniHSlider value={band.ratio} min={1} max={12} scale="log" onChange={(v) => onPatch({ ratio: v })} accent={color} width={88} />
              </DynRow>
              <DynRow label="Attack" value={`${fmtMs(band.attack)} ms`}>
                <MiniHSlider value={band.attack} min={0.001} max={0.5} onChange={(v) => onPatch({ attack: v })} accent={color} width={88} />
              </DynRow>
              <DynRow label="Release" value={`${fmtMs(band.release)} ms`}>
                <MiniHSlider value={band.release} min={0.01} max={1} onChange={(v) => onPatch({ release: v })} accent={color} width={88} />
              </DynRow>
            </div>
          )}
        </>
      )}
    </div>
  );
}