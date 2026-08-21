import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical, ChevronDown } from 'lucide-react';

/**
 * GenericChainStudio
 * ──────────────────
 * Complete, domain-agnostic serial + parallel chain UI.
 *   · IN → module boxes → OUT, drag to reorder, hold to toggle on/off, double-click to remove.
 *   · Serial / Parallel toggle (orange active pill, like the reference screenshot).
 *   · Parallel lane floats below the serial chain; add modules via "+".
 *   · Drag a serial module's bottom dot DOWN onto the parallel lane to create the send cable.
 *   · Drag a parallel module's bottom dot UP onto the serial chain to set the return point.
 *   · Draggable IN/OUT anchor dots reposition the send/return taps; double-click to remove a cable.
 *
 * Swap `MODULES` for your own catalog. Each item: { id, type, enabled }.
 */

// ── Visual constants ────────────────────────────────────────────────────
const IN_COLOR = '#62e0a2';
const OUT_COLOR = '#f57f86';
const SEND_COLOR = '#38bdf8';   // send cable (serial → parallel)
const RET_COLOR = '#fde68a';    // return cable (parallel → serial)
const HOLD_MS = 320;
const SERIAL_ACTIVE = '#F59E42'; // orange active pill in the toggle

// ── Generic catalog (REPLACE with your own module definitions) ──────────
export const MODULES = {
  cmp: { label: 'CMP', color: '#9aa6b2' },
  sat: { label: 'SAT', color: '#f87171' },
  clp: { label: 'CLP', color: '#34d399' },
  tpe: { label: 'TPE', color: '#d4a373' },
  del: { label: 'DEL', color: '#facc15' },
  rev: { label: 'REV', color: '#38bdf8' },
  eq:  { label: 'EQ',  color: '#fb923c' },
  deq: { label: 'D-EQ', color: '#a78bfa' },
  mbc: { label: 'MBC', color: '#34d399' },
  mon: { label: 'MON', color: '#6366f1' },
  img: { label: 'IMG', color: '#7dd3fc' },
  lim: { label: 'LIM', color: '#f87171' },
};
const metaOf = (type) => MODULES[type] || { label: type, color: '#94a3b8' };
const ALL_TYPES = Object.keys(MODULES);

// ── SVG cable curves ────────────────────────────────────────────────────
function cablePath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1), cp = Math.max(18, dy * 0.45);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}
function cablePathUp(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1), cp = Math.max(18, dy * 0.45);
  return `M ${x1} ${y1} C ${x1} ${y1 - cp}, ${x2} ${y2 + cp}, ${x2} ${y2}`;
}

// ── A single module box ─────────────────────────────────────────────────
function ModuleBox({ item, lane, selected, onToggle, onSelect, onRemove, onStartSend, onStartReturn,
  draggableProps, dragHandleProps, innerRef, snapshot, canRemove }) {
  const timerRef = useRef(null);
  const movedRef = useRef(false);
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const handleBodyPointerDown = (e) => {
    if (e.target.closest('[data-send-dot]') || e.target.closest('[data-return-dot]')) return;
    onSelect?.(item.id);
    movedRef.current = false;
    clearTimer();
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev) => { if (!movedRef.current) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; movedRef.current = true; clearTimer(); } };
    const onUp = () => { clearTimer(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    timerRef.current = setTimeout(() => { if (!movedRef.current) onToggle?.(); }, HOLD_MS);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dragHandleProps?.onPointerDown?.(e);
  };

  const meta = metaOf(item.type);
  const dim = !item.enabled;
  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      onPointerDown={handleBodyPointerDown}
      onDoubleClick={(e) => { e.stopPropagation(); if (canRemove) onRemove?.(item.id); }}
      title={`${meta.label} — drag to reorder · hold to toggle ${item.enabled ? 'OFF' : 'ON'}${canRemove ? ' · double-click to remove' : ''}`}
      style={{
        ...draggableProps.style,
        borderColor: meta.color,
        background: `linear-gradient(180deg, ${meta.color}33, #202224)`,
        boxShadow: snapshot.isDragging
          ? `0 16px 34px rgba(0,0,0,0.65), 0 0 0 2px ${meta.color}, 0 0 22px ${meta.color}66`
          : selected
            ? `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22, 0 0 0 2px #ffffffcc`
            : `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22`,
        ...(dim ? { borderColor: `${meta.color}80`, background: `linear-gradient(180deg, ${meta.color}1f, #2b2e35)`, filter: 'grayscale(0.35)', opacity: 0.9 } : {}),
      }}
      className={`relative flex h-16 w-14 shrink-0 select-none flex-col items-center justify-center gap-1 rounded-md border font-mono font-semibold text-white/90 ${snapshot.isDragging ? 'brightness-125' : 'cursor-grab hover:brightness-110'}`}
    >
      <span aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm opacity-50">
        <GripVertical size={11} color={meta.color} />
      </span>
      <span className={`absolute right-1 top-1 h-2 w-2 rounded-full border ${item.enabled ? 'border-emerald-300 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'border-white/40 bg-white/10'}`} />
      <span className="text-[10px]">{meta.label}</span>
      {lane === 'loop' && (
        <span aria-hidden title="Parallel chain input" className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ width: 11, height: 11, borderColor: meta.color, background: '#0a0e13', boxShadow: `0 0 6px ${meta.color}aa` }}>
          <span className="absolute inset-[2px] rounded-full" style={{ background: meta.color }} />
        </span>
      )}
      {lane === 'main' && onStartSend && (
        <span data-send-dot onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartSend(e, item.id, e.currentTarget); }} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-grab rounded-full border-2 active:cursor-grabbing" style={{ width: 11, height: 11, borderColor: SEND_COLOR, background: '#0a0e13', boxShadow: `0 0 6px ${SEND_COLOR}cc` }} title="Drag down to the parallel chain to create the send">
          <span className="absolute inset-[2px] rounded-full" style={{ background: SEND_COLOR }} />
        </span>
      )}
      {lane === 'loop' && onStartReturn && (
        <span data-return-dot onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartReturn(e, item.id, e.currentTarget); }} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-grab rounded-full border-2 active:cursor-grabbing" style={{ width: 11, height: 11, borderColor: RET_COLOR, background: '#0a0e13', boxShadow: `0 0 6px ${RET_COLOR}cc` }} title="Drag up to the serial chain to set the return point">
          <span className="absolute inset-[2px] rounded-full" style={{ background: RET_COLOR }} />
        </span>
      )}
    </div>
  );
}

function ChainLink({ fromColor, toColor, dim }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden style={dim ? { opacity: 0.35 } : undefined}>
      <div className="h-[2px] w-3" style={{ background: `linear-gradient(to right, ${fromColor}, ${toColor})` }} />
      <div className="h-[5px] w-[5px] rounded-full shrink-0" style={{ background: toColor }} />
    </div>
  );
}
function TerminalNode({ label, color, dataEnd }) {
  return <div data-end={dataEnd} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold text-white/90" style={{ borderColor: color, background: `${color}40`, boxShadow: `0 0 12px ${color}66` }}>{label}</div>;
}

function AddBox({ addable, onAdd, withReturnDot, onStartReturn }) {
  const [menu, setMenu] = useState(null);
  return (
    <div data-ph className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-white/20 bg-white/5">
      <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left + r.width / 2, y: r.bottom + 4 }); }} className="grid h-7 w-7 place-items-center rounded-full border border-cyan-400/60 bg-cyan-500/15 text-cyan-200 transition-colors hover:bg-cyan-500/40" title="Add a node">
        <Plus size={14} />
      </button>
      <span className="text-[8px] uppercase tracking-wider text-white/35">add</span>
      {withReturnDot && (
        <span data-return-dot onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartReturn?.(e, null, e.currentTarget); }} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-grab rounded-full border-2 active:cursor-grabbing" style={{ width: 11, height: 11, borderColor: RET_COLOR, background: '#0a0e13', boxShadow: `0 0 6px ${RET_COLOR}cc` }} title="Drag up to set the return point">
          <span className="absolute inset-[2px] rounded-full" style={{ background: RET_COLOR }} />
        </span>
      )}
      {menu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
          <div className="fixed z-[70] w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-cyan-400/30 bg-[#060b14] shadow-[0_18px_44px_rgba(0,0,0,0.7),0_0_18px_rgba(34,211,238,0.18)]" style={{ left: menu.x, top: menu.y }}>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5"><span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300/80">Add node</span><Plus size={11} className="text-white/40" /></div>
            <div className="max-h-64 overflow-y-auto p-1">
              {addable.length === 0 ? <div className="px-2 py-2 text-[10px] text-white/40">All nodes in use</div>
                : addable.map((type) => { const m = metaOf(type); return (
                  <button key={type} onClick={() => { onAdd?.(type); setMenu(null); }} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[11px] text-white/85 transition-colors hover:bg-cyan-500/15">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `${m.color}22`, border: `1px solid ${m.color}66` }}><span className="text-[8px] font-mono" style={{ color: m.color }}>{m.label.slice(0, 3)}</span></span>
                    <span className="font-medium">{m.label}</span>
                  </button>); })}
            </div>
          </div>
        </>, document.body)}
    </div>
  );
}

function ChainStrip({ items, lane, onReorder, onToggle, onRemove, selectedId, onSelect, addable, onAdd, trailingAdd, onStartSend, onStartReturn, withReturnDot, mainDropRef }) {
  const onDragEnd = (result) => { if (!result.destination || result.destination.index === result.source.index) return; const next = Array.from(items); const [moved] = next.splice(result.source.index, 1); next.splice(result.destination.index, 0, moved); onReorder?.(next); };
  const firstColor = items.length ? metaOf(items[0].type).color : OUT_COLOR;
  const lastColor = items.length ? metaOf(items[items.length - 1].type).color : IN_COLOR;
  const containerRef = useRef(null), rowRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    const cont = containerRef.current, row = rowRef.current; if (!cont || !row) return;
    const compute = () => { const cw = cont.clientWidth, rw = row.scrollWidth; setFitScale(rw > cw && rw > 0 ? Math.min(1, cw / rw) : 1); };
    compute(); const ro = new ResizeObserver(compute); ro.observe(cont); ro.observe(row); return () => ro.disconnect();
  }, [items.length]);
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div ref={containerRef} className="flex items-center justify-center overflow-hidden py-2">
        <div ref={rowRef} className="flex flex-row items-center" style={{ transform: `scale(${fitScale})`, transformOrigin: 'center center' }}>
          {lane === 'main' && <><TerminalNode label="IN" color={IN_COLOR} dataEnd="in" /><ChainLink fromColor={IN_COLOR} toColor={firstColor} /></>}
          <Droppable droppableId={lane} direction="horizontal" renderClone={(provided, snapshot, rubric) => {
            const item = items[rubric?.source?.index ?? 0]; if (!item) return null;
            return createPortal(<ModuleBox innerRef={provided.innerRef} draggableProps={provided.draggableProps} dragHandleProps={provided.dragHandleProps} snapshot={snapshot} item={item} lane={lane} selected={selectedId === item.id} onSelect={onSelect} onToggle={() => onToggle?.(item.id)} onRemove={() => onRemove?.(item.id)} canRemove onStartSend={onStartSend} onStartReturn={onStartReturn} />, document.body);
          }}>
            {(provided) => (
              <div ref={(el) => { provided.innerRef(el); if (lane === 'main' && mainDropRef) mainDropRef.current = el; }} {...provided.droppableProps} className="flex flex-row items-center">
                {items.map((item, index) => {
                  const meta = metaOf(item.type);
                  const nextColor = index < items.length - 1 ? metaOf(items[index + 1].type).color : OUT_COLOR;
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(prov, snap) => (
                        <div data-slot={item.id} className="flex flex-row items-center">
                          <ModuleBox innerRef={prov.innerRef} draggableProps={prov.draggableProps} dragHandleProps={prov.dragHandleProps} snapshot={snap} item={item} lane={lane} selected={selectedId === item.id} onSelect={onSelect} onToggle={() => onToggle?.(item.id)} onRemove={() => onRemove?.(item.id)} canRemove onStartSend={onStartSend} onStartReturn={onStartReturn} />
                          {index < items.length - 1 && <ChainLink fromColor={meta.color} toColor={nextColor} dim={!item.enabled} />}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {lane === 'main' && trailingAdd && (
            <div className="flex flex-row items-center">
              <ChainLink fromColor={lastColor} toColor="#64748b" />
              <AddBox addable={addable} onAdd={onAdd} />
              <ChainLink fromColor="#64748b" toColor={OUT_COLOR} />
            </div>
          )}
          {lane === 'main' && !trailingAdd && <ChainLink fromColor={lastColor} toColor={OUT_COLOR} />}
          {lane === 'main' && <TerminalNode label="OUT" color={OUT_COLOR} dataEnd="out" />}
          {lane === 'loop' && items.length === 0 && (
            <AddBox addable={addable} onAdd={onAdd} withReturnDot onStartReturn={onStartReturn} />
          )}
        </div>
      </div>
    </DragDropContext>
  );
}

// ── Public component ────────────────────────────────────────────────────
export default function GenericChainStudio({
  items, onChange, loopItems, onLoopChange,
  selectedId, onSelect, loopSelectedId, onLoopSelect,
  routingMode = 'serial', onRoutingModeChange,
  className = '',
}) {
  const [parallelOpen, setParallelOpen] = useState(true);
  const isLoop = routingMode !== 'serial';

  // Add / remove / toggle helpers (main chain)
  const handleAdd = useCallback((type) => { onChange?.([...items, { id: crypto.randomUUID(), type, enabled: true }]); }, [items, onChange]);
  const handleToggle = useCallback((id) => { onChange?.(items.map((it) => it.id === id ? { ...it, enabled: !it.enabled } : it)); }, [items, onChange]);
  const handleRemove = useCallback((id) => { onChange?.(items.filter((it) => it.id !== id)); }, [items, onChange]);
  // Loop chain
  const handleLoopAdd = useCallback((type) => { onLoopChange?.([...loopItems, { id: crypto.randomUUID(), type, enabled: true }]); onRoutingModeChange?.('parallel'); }, [loopItems, onLoopChange, onRoutingModeChange]);
  const handleLoopToggle = useCallback((id) => { onLoopChange?.(loopItems.map((it) => it.id === id ? { ...it, enabled: !it.enabled } : it)); }, [loopItems, onLoopChange]);
  const handleLoopRemove = useCallback((id) => { const next = loopItems.filter((it) => it.id !== id); onLoopChange?.(next); if (next.length === 0) onRoutingModeChange?.('serial'); }, [loopItems, onLoopChange, onRoutingModeChange]);

  const usedTypes = new Set(items.map((it) => it.type));
  const addable = ALL_TYPES.filter((t) => !usedTypes.has(t));
  const loopUsedTypes = new Set(loopItems.map((it) => it.type));
  const loopAddable = ALL_TYPES.filter((t) => !loopUsedTypes.has(t));

  // ── Send / return cable state + geometry ──
  const sectionRef = useRef(null), mainDropRef = useRef(null), loopContainerRef = useRef(null), computeRef = useRef(null);
  const [geo, setGeo] = useState(null);
  const [sendDrag, setSendDrag] = useState(null), [returnDrag, setReturnDrag] = useState(null);
  const [sendActive, setSendActive] = useState(false), [returnActive, setReturnActive] = useState(false);
  const [sendPosition, setSendPosition] = useState(0), [returnPosition, setReturnPosition] = useState(items.length);

  useEffect(() => { if (!isLoop) { setSendActive(false); setReturnActive(false); } }, [isLoop]);

  const boundaryX = useCallback((p) => {
    const sec = sectionRef.current, main = mainDropRef.current; if (!sec || !main) return 0;
    const sr = sec.getBoundingClientRect(), mr = main.getBoundingClientRect();
    const mods = main.querySelectorAll('[data-slot]');
    if (p <= 0) return mr.left - sr.left;
    if (p >= items.length) return mr.right - sr.left;
    const a = mods[p - 1]?.getBoundingClientRect(), b = mods[p]?.getBoundingClientRect();
    if (a && b) return (a.right + b.left) / 2 - sr.left;
    return a ? a.right - sr.left : (b ? b.left - sr.left : mr.right - sr.left);
  }, [items.length]);

  const computeBoundary = useCallback((clientX) => {
    const main = mainDropRef.current; if (!main) return items.length;
    const mods = [...main.querySelectorAll('[data-slot]')];
    for (let i = 0; i < mods.length; i++) { const r = mods[i].getBoundingClientRect(); if (clientX >= r.left && clientX <= r.right) return i; }
    let b = 0; for (const m of mods) { const r = m.getBoundingClientRect(); if (clientX > (r.left + r.right) / 2) b++; else break; }
    return Math.max(0, Math.min(items.length, b));
  }, [items.length]);

  const startSendLine = useCallback((e, id, el) => {
    const sec = sectionRef.current; if (!sec || !el) return;
    const sr = sec.getBoundingClientRect(), r = el.getBoundingClientRect();
    const ox = r.left + r.width / 2, oy = r.bottom;
    const idx = items.findIndex((it) => it.id === id);
    const overLoop = (cx, cy) => { const lc = loopContainerRef.current; if (!lc) return false; const lr = lc.getBoundingClientRect(); return cx >= lr.left && cx <= lr.right && cy >= lr.top - 6 && cy <= lr.bottom + 6; };
    const onMove = (ev) => setSendDrag({ ox, oy, x: ev.clientX, y: ev.clientY, over: overLoop(ev.clientX, ev.clientY) });
    const onUp = (ev) => { cleanup(); if (overLoop(ev.clientX, ev.clientY)) { setSendPosition(Math.min(idx + 1, items.length)); onRoutingModeChange?.('parallel'); setSendActive(true); } setSendDrag(null); };
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  }, [items, onRoutingModeChange]);

  const startReturnLine = useCallback((e, id, el) => {
    const sec = sectionRef.current; if (!sec || !el) return;
    const sr = sec.getBoundingClientRect(), r = el.getBoundingClientRect();
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const overMain = (cx, cy) => { const md = mainDropRef.current; if (!md) return false; const mr = md.getBoundingClientRect(); return cx >= mr.left - 10 && cx <= mr.right + 10 && cy >= mr.top - 40 && cy <= mr.bottom + 30; };
    const onMove = (ev) => { const b = computeBoundary(ev.clientX); setReturnDrag({ ox, oy, x: ev.clientX, y: ev.clientY, hoverX: boundaryX(b) + sr.left, over: overMain(ev.clientX, ev.clientY) }); };
    const onUp = (ev) => { cleanup(); if (overMain(ev.clientX, ev.clientY)) { const b = computeBoundary(ev.clientX); let nr = Math.max(1, Math.min(items.length, b)); if (nr <= sendPosition) setSendPosition(Math.max(0, nr - 1)); setReturnPosition(nr); setReturnActive(true); } setReturnDrag(null); };
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  }, [computeBoundary, boundaryX, sendPosition, items.length]);

  const startSendHandleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation();
    const onMove = (ev) => setSendPosition(Math.max(0, Math.min(computeBoundary(ev.clientX), Math.max(0, returnPosition - 1))));
    const onUp = () => cleanup();
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); }, [computeBoundary, returnPosition]);
  const startReturnHandleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation();
    const onMove = (ev) => { const b = computeBoundary(ev.clientX); let nr = Math.max(1, Math.min(items.length, b)); if (nr <= sendPosition) setSendPosition(Math.max(0, nr - 1)); setReturnPosition(nr); };
    const onUp = () => cleanup();
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); }, [computeBoundary, sendPosition, items.length]);

  useLayoutEffect(() => {
    const compute = () => {
      const sec = sectionRef.current; if (!sec) { setGeo(null); return; }
      const sr = sec.getBoundingClientRect(), main = mainDropRef.current;
      const rel = (rr) => ({ x: rr.left - sr.left, y: rr.top - sr.top, w: rr.width, h: rr.height, cx: rr.left + rr.width / 2 - sr.left, bottom: rr.bottom - sr.top });
      const dotCenter = (el) => { const d = el.getBoundingClientRect(); return { x: d.left + d.width / 2 - sr.left, y: d.top + d.height / 2 - sr.top }; };
      const mainBoxes = main ? [...main.querySelectorAll('[data-slot]')] : [];
      const boxRel = mainBoxes.map((b) => rel((b.firstElementChild || b).getBoundingClientRect()));
      const inNode = sec.querySelector('[data-end="in"]'); const inRel = inNode ? rel(inNode.getBoundingClientRect()) : null;
      const sendDots = [...sec.querySelectorAll('[data-send-dot]')];
      let sendAnchor = null;
      if (sendPosition <= 0) sendAnchor = inRel ? { x: inRel.cx, y: inRel.bottom } : null;
      else { const idx = Math.min(sendPosition, items.length) - 1; sendAnchor = sendDots[idx] ? dotCenter(sendDots[idx]) : (boxRel[idx] ? { x: boxRel[idx].cx, y: boxRel[idx].bottom } : (inRel ? { x: inRel.cx, y: inRel.bottom } : null)); }
      const mainBottom = main ? main.getBoundingClientRect().bottom - sr.top : (inRel ? inRel.bottom : 0);
      let returnAnchor = null;
      if (returnPosition <= 0) returnAnchor = inRel ? { x: inRel.cx, y: inRel.bottom } : null;
      else if (returnPosition >= items.length) { const outNode = sec.querySelector('[data-end="out"]'); const outRel = outNode ? rel(outNode.getBoundingClientRect()) : null; returnAnchor = outRel ? { x: outRel.cx, y: outRel.bottom } : (boxRel[items.length - 1] ? { x: boxRel[items.length - 1].cx, y: boxRel[items.length - 1].bottom } : null); }
      else { const idx = Math.max(0, Math.min(returnPosition, items.length - 1)); returnAnchor = sendDots[idx] ? dotCenter(sendDots[idx]) : (boxRel[idx] ? { x: boxRel[idx].cx, y: boxRel[idx].bottom } : (inRel ? { x: inRel.cx, y: inRel.bottom } : null)); }
      const lc = loopContainerRef.current; const loopBoxes = lc ? [...lc.querySelectorAll('[data-slot]')] : [];
      let parallelIn = null, parallelOut = null, laneTop = mainBottom + 20;
      if (lc) { const lr = lc.getBoundingClientRect(); laneTop = lr.top - sr.top;
        const activeReturnDots = [...lc.querySelectorAll('[data-slot] [data-return-dot]')]; const lastActiveDot = activeReturnDots[activeReturnDots.length - 1];
        if (loopBoxes.length) { const f = rel((loopBoxes[0].firstElementChild || loopBoxes[0]).getBoundingClientRect()); const l = rel((loopBoxes[loopBoxes.length - 1].firstElementChild || loopBoxes[loopBoxes.length - 1]).getBoundingClientRect()); parallelIn = { x: f.x, y: f.y + f.h / 2 }; parallelOut = lastActiveDot ? dotCenter(lastActiveDot) : { x: l.cx, y: l.bottom }; }
        else { const ph = lc.querySelector('[data-ph]'); const pr = ph ? rel(ph.getBoundingClientRect()) : null; parallelIn = pr ? { x: pr.x, y: pr.y + pr.h / 2 } : { x: lr.left - sr.left + 40, y: lr.top - sr.top }; parallelOut = lastActiveDot ? dotCenter(lastActiveDot) : { x: lr.right - sr.left - 40, y: lr.bottom - sr.top }; }
      }
      setGeo({ sendAnchor, returnAnchor, parallelIn, parallelOut, secW: sr.width, laneTop, origin: { x: sr.left, y: sr.top } });
    };
    computeRef.current = compute; compute();
    const ro = new ResizeObserver(compute); if (sectionRef.current) ro.observe(sectionRef.current);
    window.addEventListener('scroll', compute, true);
    return () => { window.removeEventListener('scroll', compute, true); ro.disconnect(); };
  }, [items, loopItems, sendPosition, returnPosition, isLoop, parallelOpen]);

  const tracking = isLoop && (sendActive || returnActive || sendDrag || returnDrag);
  useEffect(() => { if (!tracking) return; let raf; const tick = () => { computeRef.current?.(); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [tracking]);

  const showCables = isLoop && parallelOpen && geo && geo.sendAnchor && geo.parallelIn && sendActive;
  const showReturnCable = isLoop && parallelOpen && geo && geo.returnAnchor && geo.parallelOut && returnActive;

  return (
    <section ref={sectionRef} className={`relative z-20 rounded-xl border border-cyan-500/30 bg-[#060b14]/90 p-3 shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] ${className}`}>
      {/* header — Serial / Parallel toggle */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-white/55">Signal Chain</span>
        <div className="flex items-center rounded-lg border border-white/15 bg-black/40 p-0.5 font-mono text-[10px] font-semibold">
          {[{ key: 'serial', label: 'Serial' }, { key: 'parallel', label: 'Parallel' }].map((m) => {
            const active = routingMode === m.key;
            return (
              <button key={m.key} onClick={() => onRoutingModeChange?.(m.key)} className="rounded px-2.5 py-1 transition-all" style={active ? { background: SERIAL_ACTIVE, color: '#000', boxShadow: `0 0 10px ${SERIAL_ACTIVE}aa, 0 0 0 1px ${SERIAL_ACTIVE}` } : { color: '#a0a0a0' }} onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#a0a0a0'; }}>{m.label}</button>
            );
          })}
        </div>
        {isLoop && (
          <button onClick={() => setParallelOpen((v) => !v)} title={parallelOpen ? 'Hide parallel chain' : 'Show parallel chain'} className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-cyan-200 transition-all hover:bg-cyan-500/20">
            <ChevronDown size={12} className={`transition-transform ${parallelOpen ? '' : '-rotate-90'}`} />{parallelOpen ? 'Parallel' : `Parallel · ${loopItems.length}`}
          </button>
        )}
      </div>

      {/* serial chain + floating parallel lane share one relative wrapper */}
      <div className="relative">
        <div className="rounded-lg border border-cyan-400/30 bg-black/40 p-2">
          <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold text-cyan-300">Serial Chain</span></div>
          <ChainStrip items={items} lane="main" onReorder={onChange} onToggle={handleToggle} onRemove={handleRemove} selectedId={selectedId} onSelect={onSelect} addable={addable} onAdd={handleAdd} trailingAdd onStartSend={startSendLine} mainDropRef={mainDropRef} />
        </div>

        {isLoop && parallelOpen && (
          <div ref={loopContainerRef} className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-cyan-400/30 bg-black/40 backdrop-blur-md p-2 shadow-[0_18px_40px_rgba(0,0,0,0.6)]">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300">Parallel Chain</span>
              {loopItems.length > 0 && <span className="font-mono text-[9px] text-white/35">drag a box up to set the return point</span>}
            </div>
            <ChainStrip items={loopItems} lane="loop" onReorder={onLoopChange} onToggle={handleLoopToggle} onRemove={handleLoopRemove} selectedId={loopSelectedId} onSelect={onLoopSelect} addable={loopAddable} onAdd={handleLoopAdd} onStartReturn={startReturnLine} withReturnDot />
          </div>
        )}
      </div>

      {/* send / return cables */}
      {((showCables || showReturnCable || sendDrag || returnDrag) && geo) && (() => {
        const O = geo.origin || { x: 0, y: 0 };
        const sa = geo.sendAnchor && { x: geo.sendAnchor.x + O.x, y: geo.sendAnchor.y + O.y };
        const pi = geo.parallelIn && { x: geo.parallelIn.x + O.x, y: geo.parallelIn.y + O.y };
        const ra = geo.returnAnchor && { x: geo.returnAnchor.x + O.x, y: geo.returnAnchor.y + O.y };
        const po = geo.parallelOut && { x: geo.parallelOut.x + O.x, y: geo.parallelOut.y + O.y };
        return (
          <svg className="pointer-events-none fixed inset-0 z-40 h-screen w-screen">
            {showCables && sa && pi && (<g><path d={cablePath(sa.x, sa.y, pi.x, pi.y)} fill="none" stroke={SEND_COLOR} strokeWidth={2.5} strokeDasharray="6 4" className="sc-dash-flow" style={{ filter: `drop-shadow(0 0 4px ${SEND_COLOR}88)`, animationDuration: '1.2s' }} /><circle cx={sa.x} cy={sa.y} r={3.5} fill={SEND_COLOR} /><circle cx={pi.x} cy={pi.y} r={3.5} fill={SEND_COLOR} /></g>)}
            {showReturnCable && ra && po && (<g><path d={cablePathUp(po.x, po.y, ra.x, ra.y)} fill="none" stroke={RET_COLOR} strokeWidth={2.5} strokeDasharray="6 4" className="sc-dash-flow" style={{ filter: `drop-shadow(0 0 4px ${RET_COLOR}88)`, animationDuration: '1.2s' }} /><circle cx={ra.x} cy={ra.y} r={3.5} fill={RET_COLOR} /><circle cx={po.x} cy={po.y} r={3.5} fill={RET_COLOR} /></g>)}
            {sendDrag && (<g><line x1={sendDrag.ox} y1={sendDrag.oy} x2={sendDrag.x} y2={sendDrag.y} stroke={SEND_COLOR} strokeWidth={2.5} strokeDasharray="5 3" style={{ filter: `drop-shadow(0 0 5px ${SEND_COLOR})` }} /><circle cx={sendDrag.x} cy={sendDrag.y} r={6} fill={sendDrag.over ? SEND_COLOR : 'rgba(0,0,0,0.5)'} stroke={SEND_COLOR} strokeWidth={2} /></g>)}
            {returnDrag && (<g><line x1={returnDrag.ox} y1={returnDrag.oy} x2={returnDrag.x} y2={returnDrag.y} stroke={RET_COLOR} strokeWidth={2.5} strokeDasharray="5 3" style={{ filter: `drop-shadow(0 0 5px ${RET_COLOR})` }} /><circle cx={returnDrag.x} cy={returnDrag.y} r={6} fill={returnDrag.over ? RET_COLOR : 'rgba(0,0,0,0.5)'} stroke={RET_COLOR} strokeWidth={2} /></g>)}
          </svg>
        );
      })()}

      {/* draggable IN / OUT anchor handles */}
      {showCables && geo.sendAnchor && (
        <button onPointerDown={startSendHandleDrag} onDoubleClick={() => setSendActive(false)} className="fixed z-40 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 active:cursor-grabbing" style={{ left: geo.sendAnchor.x + (geo.origin?.x || 0), top: geo.sendAnchor.y + (geo.origin?.y || 0), borderColor: SEND_COLOR, background: '#0a0e13', boxShadow: `0 0 10px ${SEND_COLOR}, 0 0 0 4px ${SEND_COLOR}22` }} title="IN — drag to move the send tap · double-click to remove"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SEND_COLOR }} /></button>
      )}
      {showReturnCable && geo.returnAnchor && (
        <button onPointerDown={startReturnHandleDrag} onDoubleClick={() => setReturnActive(false)} className="fixed z-40 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 active:cursor-grabbing" style={{ left: geo.returnAnchor.x + (geo.origin?.x || 0), top: geo.returnAnchor.y + (geo.origin?.y || 0), borderColor: RET_COLOR, background: '#0a0e13', boxShadow: `0 0 10px ${RET_COLOR}, 0 0 0 4px ${RET_COLOR}22` }} title="OUT — drag to move the return point · double-click to remove"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RET_COLOR }} /></button>
      )}
    </section>
  );
}