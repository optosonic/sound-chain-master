import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, GripVertical } from 'lucide-react';

/**
 * GenericSerialChain
 * ─────────────────────────
 * A reorderable, toggleable serial-chain UI: IN terminal → a row of module
 * boxes connected by gradient chain links → OUT terminal, with a trailing
 * "+" box to add modules. Drop-in reusable for ANY domain (not just audio):
 * swap the `MODULES` catalog and `items` data for your own node definitions.
 *
 * Behaviour copied from the SignalChainLab serial chain:
 *   · Drag a box to reorder it within the chain.
 *   · Press-and-HOLD a box (no movement) to toggle it on/off.
 *   · Double-click a non-default box to remove it.
 *   · Click a box to select it (caller shows its editor).
 *   · "+" trailing box opens a picker of available module types.
 *
 * Props:
 *   items        — [{ id, type, enabled }] the current chain order
 *   onChange     — (nextItems) => void       // reorder / toggle / remove / add
 *   selectedId   — id of the currently-selected box (or null)
 *   onSelect     — (id) => void
 *   modules      — map of type -> { label, color, Icon }  (your catalog)
 *   addable      — array of types still available to add (not already in chain)
 *   onAdd        — (type) => void            // caller spawns a new item
 */

// ── Visual constants (match the original aesthetic) ──────────────────────
const IN_COLOR = '#5ad391';
const OUT_COLOR = '#ff808b';
const HOLD_MS = 320; // press-and-hold latency before toggle fires

// ── Generic catalog (REPLACE with your own module definitions) ───────────
// Each entry: { label, color, Icon }. `Icon` is any lucide-react component.
export const MODULES = {
  nodeA: { label: 'Node A', color: '#38bdf8' },
  nodeB: { label: 'Node B', color: '#a78bfa' },
  nodeC: { label: 'Node C', color: '#fb923c' },
  nodeD: { label: 'Node D', color: '#34d399' },
  // add as many as you like…
};

const metaOf = (type, modules = MODULES) => modules[type] || { label: type, color: '#94a3b8' };

// ── SVG cable curve between two points (vertical bezier) ─────────────────
function cablePath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cp = Math.max(18, dy * 0.45);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

// ── A single module box ──────────────────────────────────────────────────
function ModuleBox({
  item, meta, selected, onToggle, onSelect, onRemove,
  draggableProps, dragHandleProps, innerRef, snapshot, canRemove,
}) {
  const timerRef = useRef(null);
  const movedRef = useRef(false);
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  // Whole-body reorder handle: a press that MOVES reorders; a press held STILL
  // for HOLD_MS toggles on/off. Lets pangea start a reorder drag from the body.
  const handleBodyPointerDown = (e) => {
    onSelect?.(item.id);
    movedRef.current = false;
    clearTimer();
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev) => {
      if (!movedRef.current) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        movedRef.current = true;
        clearTimer();
      }
    };
    const onUp = () => { clearTimer(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    timerRef.current = setTimeout(() => { if (!movedRef.current) onToggle?.(); }, HOLD_MS);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dragHandleProps?.onPointerDown?.(e);
  };

  const dim = !item.enabled;
  const Icon = meta.Icon;

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
        background: `linear-gradient(180deg, ${meta.color}33, #1a1714)`,
        boxShadow: snapshot.isDragging
          ? `0 16px 34px rgba(0,0,0,0.65), 0 0 0 2px ${meta.color}, 0 0 22px ${meta.color}66`
          : selected
            ? `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22, 0 0 0 2px #ffffffcc`
            : `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22`,
        ...(dim
          ? { borderColor: `${meta.color}80`, background: `linear-gradient(180deg, ${meta.color}1f, #2b2e35)`, filter: 'grayscale(0.35)', opacity: 0.9 }
          : {}),
      }}
      className={`relative flex h-16 w-14 shrink-0 select-none flex-col items-center justify-center gap-1 rounded-md border font-mono font-semibold text-white/90 ${snapshot.isDragging ? 'brightness-125' : 'cursor-grab hover:brightness-110'}`}
    >
      <span aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm opacity-50">
        <GripVertical size={11} color={meta.color} />
      </span>
      <span className={`absolute right-1 top-1 h-2 w-2 rounded-full border ${item.enabled ? 'border-emerald-300 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'border-white/40 bg-white/10'}`} />
      {Icon && <Icon size={18} color={meta.color} />}
      <span className="text-[9px]">{meta.label}</span>
    </div>
  );
}

// ── Gradient connector between two adjacent boxes ────────────────────────
function ChainLink({ fromColor, toColor, dim }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden style={dim ? { opacity: 0.35 } : undefined}>
      <div className="h-[2px] w-3" style={{ background: `linear-gradient(to right, ${fromColor}, ${toColor})` }} />
      <div className="h-[5px] w-[5px] rounded-full shrink-0" style={{ background: toColor }} />
    </div>
  );
}

// ── IN / OUT terminal circles ───────────────────────────────────────────
function TerminalNode({ label, color }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold text-white/90"
      style={{ borderColor: color, background: `${color}40`, boxShadow: `0 0 12px ${color}66` }}
    >
      {label}
    </div>
  );
}

// ── Trailing "+" box with a picker popup (portal to body so it isn't clipped) ─
function AddBox({ addable, onAdd }) {
  const [menu, setMenu] = useState(null);
  return (
    <div data-ph className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-white/20 bg-white/5">
      <button
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left + r.width / 2, y: r.bottom + 4 }); }}
        className="grid h-7 w-7 place-items-center rounded-full border border-cyan-400/60 bg-cyan-500/15 text-cyan-200 transition-colors hover:bg-cyan-500/40"
        title="Add a node to the chain"
      >
        <Plus size={14} />
      </button>
      <span className="text-[8px] uppercase tracking-wider text-white/35">add</span>
      {menu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
          <div className="fixed z-[70] w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-cyan-400/30 bg-[#060b14] shadow-[0_18px_44px_rgba(0,0,0,0.7),0_0_18px_rgba(34,211,238,0.18)]" style={{ left: menu.x, top: menu.y }}>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300/80">Add node</span>
              <Plus size={11} className="text-white/40" />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {addable.length === 0 ? (
                <div className="px-2 py-2 text-[10px] text-white/40">All nodes in use</div>
              ) : addable.map((type) => {
                const m = metaOf(type);
                const Icon = m.Icon;
                return (
                  <button key={type} onClick={() => { onAdd?.(type); setMenu(null); }} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[11px] text-white/85 transition-colors hover:bg-cyan-500/15">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `${m.color}22`, border: `1px solid ${m.color}66` }}>
                      {Icon && <Icon size={13} color={m.color} />}
                    </span>
                    <span className="font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>, document.body
      )}
    </div>
  );
}

// ── The reorderable strip (IN → boxes → OUT) ─────────────────────────────
function ChainStrip({ items, modules, onReorder, onToggle, onRemove, selectedId, onSelect, addable, onAdd }) {
  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = Array.from(items);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onReorder?.(next);
  };

  const firstColor = items.length ? metaOf(items[0].type, modules).color : OUT_COLOR;
  const lastColor = items.length ? metaOf(items[items.length - 1].type, modules).color : IN_COLOR;

  // Scale-to-fit: shrink the whole row uniformly if it's wider than its container
  // so the IN/OUT terminals stay fully visible instead of being clipped.
  const containerRef = useRef(null);
  const rowRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    const cont = containerRef.current, row = rowRef.current;
    if (!cont || !row) return;
    const compute = () => {
      const cw = cont.clientWidth, rw = row.scrollWidth;
      setFitScale(rw > cw && rw > 0 ? Math.min(1, cw / rw) : 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(cont); ro.observe(row);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div ref={containerRef} className="flex items-center justify-center overflow-hidden py-2">
        <div ref={rowRef} className="flex flex-row items-center" style={{ transform: `scale(${fitScale})`, transformOrigin: 'center center' }}>
          <TerminalNode label="IN" color={IN_COLOR} />
          <ChainLink fromColor={IN_COLOR} toColor={firstColor} />

          <Droppable droppableId="chain" direction="horizontal" renderClone={(provided, snapshot, rubric) => {
            const item = items[rubric?.source?.index ?? 0];
            if (!item) return null;
            return createPortal(
              <ModuleBox
                innerRef={provided.innerRef}
                draggableProps={provided.draggableProps}
                dragHandleProps={provided.dragHandleProps}
                snapshot={snapshot}
                item={item}
                meta={metaOf(item.type, modules)}
                selected={selectedId === item.id}
                onSelect={onSelect}
                onToggle={() => onToggle?.(item.id)}
                onRemove={() => onRemove?.(item.id)}
                canRemove
              />,
              document.body
            );
          }}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-row items-center">
                {items.map((item, index) => {
                  const meta = metaOf(item.type, modules);
                  const nextColor = index < items.length - 1 ? metaOf(items[index + 1].type, modules).color : OUT_COLOR;
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(prov, snap) => (
                        <div data-slot={item.id} className="flex flex-row items-center">
                          <ModuleBox
                            innerRef={prov.innerRef}
                            draggableProps={prov.draggableProps}
                            dragHandleProps={prov.dragHandleProps}
                            snapshot={snap}
                            item={item}
                            meta={meta}
                            selected={selectedId === item.id}
                            onSelect={onSelect}
                            onToggle={() => onToggle?.(item.id)}
                            onRemove={() => onRemove?.(item.id)}
                            canRemove
                          />
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

          {/* trailing add box + link to OUT */}
          <div className="flex flex-row items-center">
            <ChainLink fromColor={lastColor} toColor="#64748b" />
            <AddBox addable={addable} onAdd={onAdd} />
            <ChainLink fromColor="#64748b" toColor={OUT_COLOR} />
          </div>

          <TerminalNode label="OUT" color={OUT_COLOR} />
        </div>
      </div>
    </DragDropContext>
  );
}

// ── Public component ─────────────────────────────────────────────────────
export default function GenericSerialChain({
  items,
  onChange,
  selectedId,
  onSelect,
  onAdd,
  modules = MODULES,
  availableTypes = Object.keys(MODULES),
  className = '',
}) {
  const handleReorder = useCallback((next) => onChange?.(next), [onChange]);
  const handleToggle = useCallback((id) => {
    onChange?.(items.map((it) => it.id === id ? { ...it, enabled: !it.enabled } : it));
  }, [items, onChange]);
  const handleRemove = useCallback((id) => {
    onChange?.(items.filter((it) => it.id !== id));
  }, [items, onChange]);

  const usedTypes = new Set(items.map((it) => it.type));
  const addable = availableTypes.filter((t) => !usedTypes.has(t));

  return (
    <section className={`relative z-20 rounded-xl border border-cyan-500/30 bg-[#060b14]/90 p-3 shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-white/55">Chain</span>
      </div>
      <div className="rounded-lg border border-cyan-400/30 bg-black/40 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-cyan-300">Serial Chain</span>
        </div>
        <ChainStrip
          items={items}
          modules={modules}
          onReorder={handleReorder}
          onToggle={handleToggle}
          onRemove={handleRemove}
          selectedId={selectedId}
          onSelect={onSelect}
          addable={addable}
          onAdd={onAdd}
        />
      </div>
    </section>
  );
}