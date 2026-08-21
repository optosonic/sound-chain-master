import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Gauge, Timer, Waves, SlidersHorizontal, ShieldAlert, Flame, GripVertical, Activity,
  Layers, Scissors, Disc3, Plus, Scaling, CircleDot, Boxes,
} from 'lucide-react';
import { DEFAULT_FX_ORDER, FX_SLOT_META, normalizeFxOrder, normalizeInstanceOrder, instanceType, isInstanceId } from '../fxSlots.js';
import InfoButton from './InfoButton';

const IN_COLOR = '#5ad391';
const OUT_COLOR = '#ff808b';
const MTR_COLOR = '#22d3ee';
const MTR_META = { label: 'MTR', color: MTR_COLOR };

const SLOT_ICON = {
  compressor: Gauge,
  saturation: Flame,
  analogueDensity: Boxes,
  clip: Scissors,
  tape: Disc3,
  delay: Timer,
  reverb: Waves,
  eq: SlidersHorizontal,
  dynamicEq: Activity,
  multiBandComp: Layers,
  limiter: ShieldAlert,
  stereoImager: Scaling,
  mon8: CircleDot,
};

const SLOT_NAME = {
  compressor: 'Compressor',
  saturation: 'Saturation',
  analogueDensity: 'Analogue Density',
  clip: 'Clipper',
  tape: 'Tape Machine',
  delay: 'Delay',
  reverb: 'Reverb',
  eq: 'Equalizer',
  dynamicEq: 'Dynamic EQ',
  multiBandComp: 'Multiband Comp',
  stereoImager: 'Stereo Imager',
  mon8: 'Mon8',
  limiter: 'Limiter',
};

const EMPTY_MAP = {};
const HOLD_MS = 320;

const metaOf = (slot) => FX_SLOT_META[instanceType(slot)];
const iconOf = (slot) => SLOT_ICON[instanceType(slot)] || Gauge;
const nameOf = (slot) => SLOT_NAME[instanceType(slot)];

// ── Serial module box ──────────────────────────────────────────────────
// drag the box to reorder · hold the box to toggle on/off · double-click a
// non-default (#2+) instance to remove it.
function ModuleBox({
  meta, Icon, vertical, snapshot, enabled, onToggle, selected, onSelect,
  draggableProps, dragHandleProps, innerRef, onRemoveInstance, slot,
}) {
  const timerRef = useRef(null);
  const movedRef = useRef(false);
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const handleBodyPointerDown = (e) => {
    onSelect?.(slot);
    movedRef.current = false;
    clearTimer();
    const sx = e.clientX, sy = e.clientY;
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    const onMove = (ev) => {
      if (!movedRef.current) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        movedRef.current = true;
        clearTimer();
      }
    };
    const onUp = () => { clearTimer(); cleanup(); };
    timerRef.current = setTimeout(() => { if (!movedRef.current) onToggle?.(); }, HOLD_MS);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dragHandleProps?.onPointerDown?.(e);
  };

  const dim = !enabled;
  const removable = onRemoveInstance && typeof slot === 'string' && !slot.endsWith('#1');

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      onPointerDown={handleBodyPointerDown}
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
      className={`relative flex shrink-0 select-none flex-col items-center justify-center gap-1 rounded-md font-mono font-semibold text-white/90 ${
        vertical ? 'h-16 w-16' : 'h-16 w-14'
      } border ${snapshot.isDragging ? 'brightness-125' : 'cursor-grab hover:brightness-110'}`}
      onDoubleClick={(e) => { e.stopPropagation(); if (removable) onRemoveInstance?.(slot); }}
      title={`${meta.label} — drag to reorder · hold to toggle ${enabled ? 'OFF' : 'ON'}${removable ? ' · double-click to remove' : ''}`}
    >
      <span aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm opacity-50">
        <GripVertical size={11} color={meta.color} />
      </span>
      <span
        className={`absolute right-1 top-1 h-2 w-2 rounded-full border ${
          enabled ? 'border-emerald-300 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'border-white/40 bg-white/10'
        }`}
      />
      <Icon size={18} color={meta.color} />
      <span className="text-[9px]">{meta.label}</span>
    </div>
  );
}

// Empty slot — dashed placeholder with a "+" that opens a module picker.
function PlaceholderBox({ availableFx, onAddFx }) {
  const [menu, setMenu] = useState(null);
  return (
    <div data-ph className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed bg-white/5 border-white/20">
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.left + r.width / 2, y: r.bottom + 4 });
        }}
        className="grid h-7 w-7 place-items-center rounded-full border border-cyan-400/60 bg-cyan-500/15 text-cyan-200 transition-colors hover:bg-cyan-500/40"
        title="Add a plugin to the chain"
      >
        <Plus size={14} />
      </button>
      <span className="text-[8px] uppercase tracking-wider text-white/35">add</span>
      {menu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
          <div className="fixed z-[70] w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-cyan-400/30 bg-[#060b14] shadow-[0_18px_44px_rgba(0,0,0,0.7),0_0_18px_rgba(34,211,238,0.18)]" style={{ left: menu.x, top: menu.y }}>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300/80">Add module</span>
              <Plus size={11} className="text-white/40" />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {availableFx.length === 0 ? (
                <div className="px-2 py-2 text-[10px] text-white/40">All modules in use</div>
              ) : availableFx.map((slot) => {
                const m = metaOf(slot);
                const Icon = iconOf(slot);
                return (
                  <button key={slot} onClick={() => { onAddFx?.(slot); setMenu(null); }} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[11px] text-white/85 transition-colors hover:bg-cyan-500/15">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `${m.color}22`, border: `1px solid ${m.color}66` }}>
                      <Icon size={13} color={m.color} />
                    </span>
                    <span className="font-medium">{nameOf(slot) || m.label}</span>
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

function ChainLink({ vertical, fromColor, toColor, dim }) {
  const gradient = vertical
    ? `linear-gradient(to bottom, ${fromColor}, ${toColor})`
    : `linear-gradient(to right, ${fromColor}, ${toColor})`;
  return (
    <div className={`flex shrink-0 ${vertical ? 'flex-col items-center' : 'items-center'}`} aria-hidden style={dim ? { opacity: 0.35 } : undefined}>
      <div className={vertical ? 'w-[2px] h-3' : 'h-[2px] w-3'} style={{ background: gradient }} />
      <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: toColor }} />
    </div>
  );
}

function TerminalNode({ label, color }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold text-white/90" style={{ borderColor: color, background: `${color}40`, boxShadow: `0 0 12px ${color}66` }}>
      {label}
    </div>
  );
}

function MeterBox({ meta, Icon, vertical, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title="Multimeter — click to show detailed metering below"
      className={`relative flex shrink-0 select-none flex-col items-center justify-center gap-1 rounded-md border font-mono font-semibold text-white/90 ${vertical ? 'h-16 w-16' : 'h-16 w-14'} cursor-pointer transition-all hover:brightness-110`}
      style={{
        borderColor: meta.color,
        background: `linear-gradient(180deg, ${meta.color}33, #1a1714)`,
        boxShadow: selected ? `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22, 0 0 0 2px #ffffffcc` : `inset 0 1px 0 ${meta.color}55, 0 0 10px ${meta.color}22`,
      }}
    >
      <Icon size={18} color={meta.color} />
      <span className="text-[9px]">{meta.label}</span>
    </button>
  );
}

function FxStrip({
  order, enabledMap, onToggle, onOrderChange, vertical, droppableId,
  onRemoveInstance, selected, onSelect, meterSlot, trailingAddBox = false,
  availableFx = [], onAddFx, normalize = true,
}) {
  const displayOrder = normalize ? normalizeInstanceOrder(order) : Array.from(order || []);
  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    if (!onOrderChange) return;
    const next = Array.from(displayOrder);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onOrderChange(next);
  };

  const firstColor = displayOrder.length ? metaOf(displayOrder[0]).color : OUT_COLOR;
  const lastColor = displayOrder.length ? metaOf(displayOrder[displayOrder.length - 1]).color : IN_COLOR;

  // Scale-to-fit so IN / OUT terminals stay visible when the chain overflows.
  const containerRef = useRef(null);
  const rowRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    if (vertical) { setFitScale(1); return; }
    const cont = containerRef.current, row = rowRef.current;
    if (!cont || !row) return;
    const compute = () => {
      const cw = cont.clientWidth;
      const rw = row.scrollWidth;
      setFitScale(rw > cw && rw > 0 ? Math.min(1, cw / rw) : 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(cont); ro.observe(row);
    return () => ro.disconnect();
  }, [vertical, displayOrder.length]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div ref={containerRef} className={`flex ${vertical ? 'flex-col items-center' : 'items-center justify-center overflow-hidden'} py-2`}>
        <div ref={rowRef} className={`flex ${vertical ? 'flex-col items-center' : 'flex-row items-center'}`} style={vertical ? undefined : { transform: `scale(${fitScale})`, transformOrigin: 'center center' }}>
          <TerminalNode label="IN" color={IN_COLOR} />
          <ChainLink vertical={vertical} fromColor={IN_COLOR} toColor={firstColor} />
          <Droppable
            droppableId={droppableId}
            direction={vertical ? 'vertical' : 'horizontal'}
            renderClone={(provided, snapshot, rubric) => {
              const idx = rubric?.source?.index ?? 0;
              const slot = displayOrder[idx];
              if (!slot) return null;
              const meta = metaOf(slot);
              const Icon = iconOf(slot);
              const enabled = enabledMap ? enabledMap[slot] !== false : true;
              return createPortal(
                <ModuleBox
                  innerRef={provided.innerRef}
                  draggableProps={provided.draggableProps}
                  dragHandleProps={provided.dragHandleProps}
                  meta={meta} Icon={Icon} vertical={vertical} snapshot={snapshot}
                  enabled={enabled} selected={selected === slot} onSelect={onSelect}
                  onToggle={() => onToggle?.(slot)} onRemoveInstance={onRemoveInstance} slot={slot}
                />, document.body
              );
            }}
          >
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className={`flex ${vertical ? 'flex-col items-center' : 'flex-row items-center'}`}>
                {displayOrder.map((slot, index) => {
                  const meta = metaOf(slot);
                  const Icon = iconOf(slot);
                  const enabled = enabledMap ? enabledMap[slot] !== false : true;
                  const nextColor = index < displayOrder.length - 1 ? metaOf(displayOrder[index + 1]).color : OUT_COLOR;
                  return (
                    <Draggable key={slot} draggableId={`${droppableId}:${slot}`} index={index}>
                      {(prov, snap) => (
                        <div data-slot={slot} className={`flex ${vertical ? 'flex-col items-center' : 'flex-row items-center'}`}>
                          <ModuleBox
                            innerRef={prov.innerRef}
                            draggableProps={prov.draggableProps}
                            dragHandleProps={prov.dragHandleProps}
                            meta={meta} Icon={Icon} vertical={vertical} snapshot={snap}
                            enabled={enabled} selected={selected === slot} onSelect={onSelect}
                            onToggle={() => onToggle?.(slot)} onRemoveInstance={onRemoveInstance} slot={slot}
                          />
                          {index < displayOrder.length - 1 && (
                            <ChainLink vertical={vertical} fromColor={meta.color} toColor={nextColor} dim={!enabled} />
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {meterSlot && (
            <>
              <ChainLink vertical={vertical} fromColor={lastColor} toColor={MTR_COLOR} />
              <MeterBox meta={MTR_META} Icon={Activity} vertical={vertical} selected={selected === meterSlot} onSelect={() => onSelect?.(meterSlot)} />
            </>
          )}
          {trailingAddBox && availableFx.length > 0 && (
            <div className={`flex ${vertical ? 'flex-col items-center' : 'flex-row items-center'}`}>
              <ChainLink vertical={vertical} fromColor={meterSlot ? MTR_COLOR : lastColor} toColor="#64748b" />
              <PlaceholderBox availableFx={availableFx} onAddFx={onAddFx} />
            </div>
          )}
          <ChainLink vertical={vertical} fromColor={meterSlot ? MTR_COLOR : (trailingAddBox ? '#64748b' : lastColor)} toColor={OUT_COLOR} />
          <TerminalNode label="OUT" color={OUT_COLOR} />
        </div>
      </div>
    </DragDropContext>
  );
}

/**
 * Reorderable serial signal chain. Drag to reorder · hold a module to toggle
 * on/off · double-click a non-default instance to remove it · click the "+"
 * placeholder to add a duplicate instance. Per-module MIX % lives on each
 * effect's own editor panel.
 */
export default function SignalPathPanel({
  order = DEFAULT_FX_ORDER,
  onOrderChange,
  enabledMap = EMPTY_MAP,
  usedMap = EMPTY_MAP,
  onToggle,
  layout = 'wide',
  className = '',
  selected,
  onSelect,
  meterSlot,
  viewMode: viewModeProp,
  onViewModeChange,
  onAddInstance,
  onRemoveInstance,
  headerExtra,
}) {
  const vertical = layout === 'narrow';
  const displayOrder = normalizeInstanceOrder(order);
  const [internalView, setInternalView] = useState('all');
  const viewMode = viewModeProp ?? internalView;
  const setViewMode = (v) => { setInternalView(v); onViewModeChange?.(v); };
  const usedMode = viewMode === 'used';
  const visibleMain = usedMode ? displayOrder.filter((s) => enabledMap && enabledMap[s]) : displayOrder;
  const handleUsedReorder = useCallback((newVisible) => {
    let vi = 0;
    const next = displayOrder.map((s) => (enabledMap && enabledMap[s] ? newVisible[vi++] : s));
    onOrderChange?.(next);
  }, [displayOrder, enabledMap, onOrderChange]);

  // Available types for the "+" picker: all effect types, so duplicates are
  // allowed (e.g. a second EQ). nextInstanceId() assigns the free "#n" suffix.
  // Keeping the full list also keeps the trailing "+" box permanently visible.
  const availableFx = DEFAULT_FX_ORDER;

  return (
    <section className={`sc-chain relative z-20 rounded-xl border border-cyan-500/30 bg-[#060b14]/90 p-3 shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-white/70">Sound Chain</span>
        <InfoButton panelId="signalchain" accent="#22d3ee" />
        <div className="flex items-center rounded-lg border border-white/15 bg-black/40 p-0.5 font-mono text-[10px] font-semibold">
          {[
            { key: 'all', label: 'All' },
            { key: 'used', label: 'Only Used' },
          ].map((v) => {
            const active = viewMode === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className="rounded px-2.5 py-1 transition-all"
                style={active ? { background: '#22d3ee', color: '#062029', boxShadow: '0 0 10px #22d3eeaa, 0 0 0 1px #22d3ee' } : { color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        {headerExtra && <div className="ml-auto">{headerExtra}</div>}
      </div>

      <div className="rounded-lg border border-cyan-400/30 bg-black/40 p-2">
        <FxStrip
          order={usedMode ? visibleMain : order}
          enabledMap={enabledMap}
          onToggle={onToggle}
          onOrderChange={usedMode ? handleUsedReorder : onOrderChange}
          vertical={vertical}
          droppableId="fx-main"
          normalize={!usedMode}
          trailingAddBox
          availableFx={availableFx}
          onAddFx={onAddInstance}
          onRemoveInstance={onRemoveInstance}
          selected={selected}
          onSelect={onSelect}
          meterSlot={meterSlot}
        />
      </div>
    </section>
  );
}