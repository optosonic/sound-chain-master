import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Link2, Unlink } from 'lucide-react';
import IOGainFader from '@/signalchain/components/IOGainFader.jsx';
import SignalPathPanel from '@/signalchain/components/SignalPathPanel.jsx';
import LevelMeter from '@/signalchain/components/LevelMeter.jsx';
import VUMeter from '@/signalchain/components/VUMeter.jsx';
import VerticalLedMeter from '@/signalchain/components/VerticalLedMeter.jsx';
import SaturationPanel from '@/signalchain/components/SaturationPanel.jsx';
import CompressorPanel from '@/signalchain/components/CompressorPanel.jsx';
import LimiterPanel from '@/signalchain/components/LimiterPanel.jsx';
import DelayPanel from '@/signalchain/components/DelayPanel.jsx';
import ReverbPanel from '@/signalchain/components/ReverbPanel.jsx';
import EQPanel from '@/signalchain/components/EQPanel.jsx';
import DynamicEQPanel from '@/signalchain/components/DynamicEQPanel.jsx';
import ClipDistortionPanel from '@/signalchain/components/ClipDistortionPanel.jsx';
import TapeMachinePanel from '@/signalchain/components/TapeMachinePanel.jsx';
import MultiBandCompPanel from '@/signalchain/components/MultiBandCompPanel.jsx';
import StereoImagerPanel from '@/signalchain/components/StereoImagerPanel.jsx';
import Mon8Panel from '@/signalchain/components/Mon8Panel.jsx';
import AnalogueDensityPanel from '@/signalchain/components/AnalogueDensityPanel.jsx';
import OutputVisualizer from '@/signalchain/components/OutputVisualizer.jsx';
import { FX_SLOT, instanceType } from '@/signalchain/fxSlots.js';
import MasteringPresetsMenu from '@/signalchain/components/MasteringPresetsMenu.jsx';

// Display-only "box" appended to the serial chain — clicking it shows the
// full multimeter in the lower window instead of an effect editor.
const METER_SLOT = 'multimeter';

// Which editor panel owns each module slot.
function InspectorFor({ slot, engine }) {
  // ── Main chain (instance-based) ───────────────────────────────────────
  // Each serial slot is an instance id. The instance's state lives in
  // engine.instanceStates; edits route through engine.handleInstanceUpdate,
  // which drives that instance's own module update() directly. Analyzer / node
  // taps only exist for the default (#1) instances, so non-default instances
  // render their panel without the live visualizer (no crash).
  const type = instanceType(slot);
  const state = engine.instanceStates?.[slot];
  const onUpdate = (next) => engine.handleInstanceUpdate(slot, next);
  const isPrimary = typeof slot === 'string' && slot.endsWith('#1');
  const nodes = isPrimary ? engine.nodes : undefined;
  const dynNodes = isPrimary ? engine.dynNodes : undefined;
  const mbcNodes = isPrimary ? engine.mbcNodes : undefined;
  const specAnalyzer = engine.eqAnalyzer;
  switch (type) {
    case 'compressor':
      return <CompressorPanel compressor={state} onChange={onUpdate} analyzers={engine.analyzers} node={nodes?.compressor} nodeMid={nodes?.compressorMid} nodeSide={nodes?.compressorSide} />;
    case 'limiter':
      return <LimiterPanel limiter={state} onChange={onUpdate} analyzers={engine.analyzers} node={nodes?.limiter} getGR={nodes?.limiterGR} />;
    case 'saturation':
      return <SaturationPanel saturation={state} onSaturationChange={onUpdate} layout="wide" />;
    case 'analogueDensity':
      return <AnalogueDensityPanel density={state} onChange={onUpdate} analyzers={engine.analyzers} />;
    case 'delay':
      return <DelayPanel delay={state} onChange={onUpdate} bpm={engine.bpm} onBpmChange={engine.handleBpmChange} />;
    case 'reverb':
      return <ReverbPanel reverb={state} onChange={onUpdate} />;
    case 'eq':
      return <EQPanel eq={state} onEQChange={onUpdate} audioContext={engine.audioContext} analyzerNode={specAnalyzer} />;
    case 'clip':
      return <ClipDistortionPanel clip={state} onChange={onUpdate} layout="wide" />;
    case 'tape':
      return <TapeMachinePanel tape={state} onChange={onUpdate} />;
    case 'dynamicEq':
      return <DynamicEQPanel dynamicEq={state} onDynamicEQChange={onUpdate} audioContext={engine.audioContext} analyzerNode={specAnalyzer} dynamicEqNodes={dynNodes} />;
    case 'multiBandComp':
      return <MultiBandCompPanel mbc={state} onMbcChange={onUpdate} mbcNodes={mbcNodes} analyzerNode={specAnalyzer} audioContext={engine.audioContext} />;
    case 'stereoImager':
      return <StereoImagerPanel stereoImager={state} onChange={onUpdate} analyzers={engine.analyzers} audioContext={engine.audioContext} />;
    case 'mon8':
      return <Mon8Panel mon8={state} onChange={onUpdate} analyzers={isPrimary ? engine.analyzers : undefined} />;
    default:
      return null;
  }
}

// The lower-window "multimeter" view — a 3-button mode switcher. Each mode
// fills the full canvas unsquashed:
//   · View Meter   — the analog VU meter (the "view meter")
//   · Level        — the standard master level meter (pro readouts)
//   · Final Output — the spectral / scope analyzer
const MTR_MODES = [
  { key: 'view', label: 'View Meter' },
  { key: 'level', label: 'Level' },
  { key: 'final', label: 'Final Output' },
];

function MultimeterView({ engine, themeKey }) {
  const [mode, setMode] = useState('view');
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">MTR</span>
        <div className="flex items-center rounded-lg border border-white/15 bg-black/40 p-0.5 font-mono text-[10px] font-semibold">
          {MTR_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded px-2.5 py-1 transition-all ${mode === m.key ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white/90'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'view' && (
          <div className="flex h-full items-center justify-center">
            <VUMeter engine={engine.levelEngine} variant="round" />
          </div>
        )}
        {mode === 'level' && (
          <LevelMeter
            engine={engine.levelEngine}
            orientation="horizontal"
            pro
            meteringMode={engine.meteringMode}
            onMeteringModeChange={engine.setMeteringMode}
            inAnalyzer={engine.analyzers?.spectrumIn}
            outAnalyzer={engine.analyzers?.spectrum}
            audioContext={engine.audioContext}
          />
        )}
        {mode === 'final' && (
          <OutputVisualizer
            analyzerNode={engine.analyzers?.spectrum}
            ghostAnalyzerNode={engine.analyzers?.spectrumIn}
            audioContext={engine.audioContext}
            themeKey={themeKey}
            fullHeight
          />
        )}
      </div>
    </div>
  );
}

/** Inspector-column engraved watermark: SCM · Sound Chain Master · by Spher8 */
function DesktopWatermark() {
  const wrapRef = useRef(null);
  const lineRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const line = lineRef.current;
    if (!wrap || !line) return;
    const fit = () => {
      const avail = wrap.clientWidth;
      const need = line.scrollWidth;
      setScale(need > avail && need > 0 ? avail / need : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Original 3-pass inset bevel: small d, black 0.48 up-left, white 0.08 down-right,
  // muted steel fill #bfc8d5 @ 0.18. Extra gap before Spher8; optical vertical centre.
  const d = 1.2;
  const inset = {
    color: 'rgba(191,200,213,0.18)',
    textShadow: `-${d}px -${d}px 0 rgba(0,0,0,0.48), ${d}px ${d}px 0 rgba(255,255,255,0.08)`,
  };
  const mark = {
    fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
    fontWeight: 900,
    letterSpacing: '0.18em',
    ...inset,
  };

  return (
    <div
      className="pointer-events-none flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden select-none"
      aria-hidden
      style={{ minHeight: 0 }}
    >
      <div
        ref={wrapRef}
        className="flex h-[70%] w-full max-w-[855px] items-center justify-center overflow-hidden px-8"
      >
        <div
          ref={lineRef}
          className="flex items-center justify-center whitespace-nowrap"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          <span className="leading-none" style={{ fontSize: 'clamp(14px, 3.9vh, 34px)', ...mark }}>SCM</span>
          <span className="leading-none px-[0.28em]" style={{ fontSize: 'clamp(12px, 2.8vh, 22px)', fontWeight: 400, ...inset }}>·</span>
          <span className="leading-none tracking-[0.06em]" style={{ fontSize: 'clamp(11px, 2.0vh, 18px)', fontWeight: 400, ...inset }}>Sound Chain Master</span>
          <span className="leading-none px-[0.28em]" style={{ fontSize: 'clamp(12px, 2.8vh, 22px)', fontWeight: 400, ...inset }}>·</span>
          <span className="leading-none pr-[0.28em]" style={{ fontSize: 'clamp(8px, 1.5vh, 13px)', fontWeight: 400, ...inset }}>by</span>
          <span className="leading-none" style={{ fontSize: 'clamp(14px, 3.9vh, 34px)', marginLeft: '0.62em', ...mark }}>Spher8</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The shared "plugin studio" body: a serial-chain carousel of every module's
 * full editor panel (one slide per slot, plus the MTR multimeter at the end)
 * with the always-on dual IN/OUT vertical LED meter pinned to the right.
 *
 * Used by both the native plugin window (PluginLayout) and the full desktop
 * web-app harness (FullDesktopLayout), so the two present the effect panels
 * and metering identically.
 *
 * Props: engine, themeKey, meterW (aside width, default 188), className
 *        (sizing/height of the block — e.g. "flex-1 min-h-0" inside the plugin
 *         window, "h-full" inside a fixed-height desktop section).
 */
export default function ChainStudio({ engine, themeKey, meterW = 188, className = '' }) {
  // The carousel edits whichever chain is the active target: the main serial
  // chain ('main') or the parallel / insert loop chain ('loop'). One slide per
  // module in the active chain, with the multimeter last.
  const [viewMode, setViewMode] = useState('all');
  const mainVisible = useMemo(
    () => (engine.fxOrder || []).filter((s) => engine.enabledMap?.[s]),
    [engine.fxOrder, engine.enabledMap]
  );
  const usedMode = viewMode === 'used';
  const slides = useMemo(
    () => [...(usedMode ? mainVisible : engine.fxOrder), METER_SLOT],
    [mainVisible, usedMode, engine.fxOrder]
  );

  const scrollRef = useRef(null);
  const slideRefs = useRef({});
  const rafRef = useRef(0);
  const [selected, setSelected] = useState(() => engine.fxOrder[0] || METER_SLOT);

  // Detect which slide is most centred in the viewport → drive the chain highlight.
  const detectSelected = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const cx = rootRect.left + rootRect.width / 2;
    let best = null;
    let bestDist = Infinity;
    for (const slot of slides) {
      const el = slideRefs.current[slot];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - cx);
      if (dist < bestDist) { bestDist = dist; best = slot; }
    }
    if (best) setSelected(best);
  }, [slides]);

  // Scroll → rAF-throttled highlight detection.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(detectSelected);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { root.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafRef.current); };
  }, [detectSelected]);

  // When the "Only Used" view toggles, scroll to the slide of the currently
  // selected module if it still exists, otherwise jump to the first slide.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const idx = slides.indexOf(selected);
    if (idx >= 0) root.scrollTo({ left: idx * root.clientWidth, behavior: 'smooth' });
    else { setSelected(slides[0] || METER_SLOT); root.scrollTo({ left: 0 }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // The carousel is overflow-x-auto + snap-x, so horizontal trackpad swipes and
  // shift+wheel scroll it natively. We intentionally do NOT hijack vertical
  // wheel here — doing so (translate ΔY → horizontal + preventDefault) trapped
  // the whole page: when the cursor was over the carousel you couldn't scroll
  // the page up/down at all. Let vertical wheel bubble to the page normally.

  // Clicking a serial-chain module scrolls its panel into view. Scroll
  // deterministically to the exact slide boundary (index × slide width) instead
  // of using scrollIntoView — with snap-mandatory the latter can overshoot /
  // round oddly and land a slide flush-left, making the panel "jump" leftwards
  // and lose its left gutter. This keeps every slide at the same left inset as
  // the initial unscrolled view.
  const handleSelect = useCallback((slot) => {
    const root = scrollRef.current;
    const idx = slides.indexOf(slot);
    if (root && idx >= 0) root.scrollTo({ left: idx * root.clientWidth, behavior: 'smooth' });
    setSelected(slot);
  }, [slides]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-1 min-h-0 gap-2 items-stretch overflow-hidden">
        {/* Centre — serial chain on top, horizontal panel carousel below */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 p-2 pb-1">
            <SignalPathPanel
              order={engine.fxOrder}
              onOrderChange={engine.handleFxOrderChange}
              enabledMap={engine.enabledMap}
              usedMap={engine.usedMap}
              onToggle={engine.handleToggle}
              layout="wide"
              selected={selected}
              onSelect={handleSelect}
              meterSlot={METER_SLOT}
              headerExtra={<MasteringPresetsMenu engine={engine} className="w-[196px]" />}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onAddInstance={engine.handleAddInstance}
              onRemoveInstance={engine.handleRemoveInstance}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-1">
            {/* Fixed 494 px scroll height → 494 − 24 (slide p-3) = exactly
                470 px panel budget, locked regardless of the signal-chain
                area above. The wrapper stays flex-1 so any leftover main
                height sits as free space below this block. Dials & content are
                NOT scaled — panels are designed to fit 470 px. */}
            {/* 494 px = 470 px panel budget + 24 px slide padding. max-h-full
                shrinks the lane to its flex parent when the parent is shorter
                (so the slide's overflow-y-auto scrolls instead of the lane being
                clipped by the wrapper's overflow-hidden). */}
            <div
              ref={scrollRef}
              className="relative h-[494px] max-h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            >
              <div className="flex h-full w-full">
                {slides.map((slot) => {
                  const dim = engine.bypass && slot !== METER_SLOT;
                  return (
                    <div
                      key={slot}
                      data-slide={slot}
                      ref={(el) => { if (el) slideRefs.current[slot] = el; else delete slideRefs.current[slot]; }}
                      className="flex h-full w-full shrink-0 snap-start items-stretch"
                    >
                      <div className={`h-full min-w-0 flex-1 overflow-y-auto p-3 ${dim ? 'pointer-events-none opacity-40' : ''}`}>
                        {slot === METER_SLOT ? (
                          <MultimeterView engine={engine} themeKey={themeKey} />
                        ) : (
                          <InspectorFor slot={slot} engine={engine} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Leftover inspector well — native paints the engraved watermark
                here when height ≥ 36 px (plugin 1200×800 often has none; desktop 760 px does). */}
            <DesktopWatermark />
          </div>
        </main>

        {/* Right — dual IN / OUT master meters + utility controls */}
        <aside className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30 p-4 gap-2" style={{ width: meterW }}>
          <div className="relative flex h-8 items-center">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/80">Meters</span>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <button
                onClick={engine.handleLinkLRToggle}
                title={engine.linkLR ? 'L/R linked — click to unlink (independent L & R faders)' : 'L/R independent — click to link'}
                className={`pointer-events-auto flex items-center justify-center gap-1 rounded border px-2 py-1 text-[10px] font-mono font-semibold tracking-widest transition-all ${
                  engine.linkLR
                    ? 'border-cyan-300/60 bg-cyan-500/30 text-cyan-100'
                    : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                }`}
              >
                {engine.linkLR ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />} {engine.linkLR ? 'LINK' : 'L·R'}
              </button>
            </div>
            <span className="ml-auto rounded border border-cyan-300/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-widest text-white/70">I/O</span>
          </div>
          <div className="flex min-h-0 flex-1 items-stretch gap-1.5">
            <IOGainFader
              values={engine.linkLR ? [engine.inputGainL] : [engine.inputGainL, engine.inputGainR]}
              onChange={(i, db) => (i === 0 ? engine.handleInputGainLChange(db) : engine.handleInputGainRChange(db))}
              label="IN"
              accent="#22d3ee"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="mb-1 text-center text-[8px] font-mono uppercase tracking-widest text-cyan-200/55">IN</span>
              <div className="min-h-0 flex-1">
                <VerticalLedMeter engine={engine.levelEngine} monitor="in" meteringMode={engine.meteringMode} showLufs={false} compact />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="mb-1 text-center text-[8px] font-mono uppercase tracking-widest text-cyan-200/55">OUT</span>
              <div className="min-h-0 flex-1">
                <VerticalLedMeter engine={engine.levelEngine} monitor="out" meteringMode={engine.meteringMode} showLufs={false} compact />
              </div>
            </div>
            <IOGainFader
              values={engine.linkLR ? [engine.outputGainL] : [engine.outputGainL, engine.outputGainR]}
              onChange={(i, db) => (i === 0 ? engine.handleOutputGainLChange(db) : engine.handleOutputGainRChange(db))}
              label="OUT"
              accent="#22d3ee"
            />
          </div>

          {/* Utility controls — below the meters, same div */}
          <div className="shrink-0 space-y-1.5 border-t border-white/10 pt-3">
            <span className="block text-[7px] font-mono uppercase tracking-widest text-white/35">Scale</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[{ id: 'dBFS', label: 'dBFS' }, { id: 'K12', label: 'K-12' }, { id: 'K14', label: 'K-14' }, { id: 'K20', label: 'K-20' }].map((m) => (
                <button
                  key={m.id}
                  onClick={() => engine.setMeteringMode(m.id)}
                  className={`rounded border px-1 py-0.5 text-[8px] font-mono font-semibold tracking-wider transition-all ${
                    engine.meteringMode === m.id
                      ? 'border-white/70 bg-white text-black'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={engine.handleBypassToggle}
                className={`rounded border px-1 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider transition-all ${
                  engine.bypass
                    ? 'border-rose-400/60 bg-rose-500/80 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                Bypass
              </button>
              <button
                onClick={engine.handleMonoToggle}
                className={`rounded border px-1 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider transition-all ${
                  engine.mono
                    ? 'border-cyan-300/60 bg-cyan-500/80 text-black'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                Mono
              </button>
            </div>
            <button
              onClick={engine.handleReset}
              className="w-full rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              Reset
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}