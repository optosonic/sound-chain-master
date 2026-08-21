import React, { useMemo, useState } from 'react';
import { RotateCcw, Power, SlidersHorizontal } from 'lucide-react';
import Dial from './Dial';
import EQGraph from './EQGraph';
import {
  BAND_COUNTS, SLOPES, MID_COLORS,
  getActiveBands, getInactiveBands, updateActiveBand, setActiveBandCount, resetActiveChannel, ensureSideBands,
  MS_MID_COLOR, MS_SIDE_COLOR, GAIN_RANGES, gainRangeOf,
} from '../eqModel.js';
import InfoButton from './InfoButton';

/**
 * N-Band Parametric EQ (hybrid shelves: low shelf + N−2 mid bells + high shelf).
 * The band count (3 / 4 / 5 / 6 / 8) is selected from the header.
 *
 * Mid/Side mode: when msMode is on, the Mid channel (eq.low/mids/high) and the
 * Side channel (eq.sideLow/sideMids/sideHigh) are EQ'd independently. The
 * M|S selector picks which channel the dials/graph edit; the other channel is
 * drawn as a faint ghost curve so you always know what you're shaping.
 */
export default function EQPanel({ eq, onEQChange, audioContext, analyzerNode }) {
  const safeEq = useMemo(() => {
    const low = { freq: 200, gain: 0, slope: 12, cut: false, ...(eq?.low || {}) };
    const high = { freq: 5000, gain: 0, slope: 12, cut: false, ...(eq?.high || {}) };
    const mids = (eq?.mids || []).map((m) => ({ freq: 1000, gain: 0, q: 1, ...m }));
    const base = { enabled: false, bandCount: 3, msMode: false, msChannel: 'mid', gainRange: 'full', ...(eq || {}), low, high, mids };
    return ensureSideBands(base);
  }, [eq]);

  const msOn = !!safeEq.msMode;
  const channel = safeEq.msChannel === 'side' ? 'side' : 'mid';
  const channelColor = msOn ? (channel === 'side' ? MS_SIDE_COLOR : MS_MID_COLOR) : '#2563eb';
  const range = gainRangeOf(safeEq.gainRange);

  // Switch the vertical gain range — clamps the active channel's band gains to
  // the new span so no dial holds a value outside the visible scale.
  const changeRange = (key) => {
    const r = gainRangeOf(key);
    const lo = -r.max, hi = r.max;
    const clampGain = (g) => Math.max(lo, Math.min(hi, g));
    if (msOn && channel === 'side') {
      const side = ensureSideBands(safeEq);
      onEQChange({
        ...side, gainRange: key,
        sideLow: { ...side.sideLow, gain: clampGain(side.sideLow.gain) },
        sideMids: side.sideMids.map((m) => ({ ...m, gain: clampGain(m.gain) })),
        sideHigh: { ...side.sideHigh, gain: clampGain(side.sideHigh.gain) },
      });
    } else {
      onEQChange({
        ...safeEq, gainRange: key,
        low: { ...safeEq.low, gain: clampGain(safeEq.low.gain) },
        mids: safeEq.mids.map((m) => ({ ...m, gain: clampGain(m.gain) })),
        high: { ...safeEq.high, gain: clampGain(safeEq.high.gain) },
      });
    }
  };

  const active = getActiveBands(safeEq);          // { enabled, low, mids, high } — what the dials edit
  const ghostBands = getInactiveBands(safeEq);    // the other channel (null in stereo)

  const update = (patch) => onEQChange({ ...safeEq, ...patch });
  const updBand = (id, p) => onEQChange(updateActiveBand(safeEq, id, p));
  const handleBandDrag = (id, p) => onEQChange(updateActiveBand(safeEq, id, p));
  const changeCount = (c) => onEQChange(setActiveBandCount(safeEq, c, false));
  const resetEQ = () => onEQChange(resetActiveChannel(safeEq));

  const toggleMS = () => {
    const next = ensureSideBands(safeEq);
    onEQChange({ ...next, msMode: !safeEq.msMode, msChannel: 'mid' });
  };
  const pickChannel = (ch) => update({ msChannel: ch });

  const aLow = active.low, aHigh = active.high, aMids = active.mids;

  // Band selector — one pill per band; the selected band's card renders below
  // the graph (mirrors the Multiband Compressor panel).
  const [selectedBand, setSelectedBand] = useState(0);
  const bandList = [
    { id: 'low', label: 'Low', color: '#60a5fa', kind: 'low' },
    ...aMids.map((m, i) => ({ id: `mid${i}`, label: `Mid ${i + 1}`, color: MID_COLORS[i % MID_COLORS.length], kind: 'mid', index: i })),
    { id: 'high', label: 'High', color: '#f59e0b', kind: 'high' },
  ];
  const sel = Math.min(selectedBand, bandList.length - 1);
  const selBand = bandList[sel];

  const titleChip = (color, label) => (
    <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded" style={{ color, background: color + '22' }}>{label}</span>
  );

  const renderSelectedBand = () => {
    if (selBand.kind === 'low') {
      return (
        <BandCard color="#60a5fa" channelColor={msOn ? channelColor : null}>
          {titleChip('#60a5fa', 'Low')}
          <ShelfCut value={aLow.cut} onShelf={() => updBand('low', { cut: false })} onCut={() => updBand('low', { cut: true })} color="#60a5fa" />
          <Dial value={aLow.freq} onChange={(v) => updBand('low', { freq: v })} defaultValue={200} min={20} max={2000} step={1} scale="log" label="Freq" unit="Hz" size="small" />
          {!aLow.cut && <Dial value={aLow.gain} onChange={(v) => updBand('low', { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" size="small" />}
          {aLow.cut && <SlopeButtons value={aLow.slope} onChange={(s) => updBand('low', { slope: s })} color="#60a5fa" />}
        </BandCard>
      );
    }
    if (selBand.kind === 'mid') {
      const i = selBand.index;
      const m = aMids[i];
      return (
        <BandCard color={selBand.color} channelColor={msOn ? channelColor : null}>
          {titleChip(selBand.color, `Mid ${i + 1}`)}
          <Dial value={m.freq} onChange={(v) => updBand(`mid${i}`, { freq: v })} defaultValue={1000} min={200} max={8000} step={1} scale="log" label="Freq" unit="Hz" size="small" />
          <Dial value={m.gain} onChange={(v) => updBand(`mid${i}`, { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" size="small" />
          <Dial value={m.q} onChange={(v) => updBand(`mid${i}`, { q: v })} defaultValue={1} min={0.1} max={6} step={0.1} label="Q" size="small" />
        </BandCard>
      );
    }
    return (
      <BandCard color="#f59e0b" channelColor={msOn ? channelColor : null}>
        {titleChip('#f59e0b', 'High')}
        <ShelfCut value={aHigh.cut} onShelf={() => updBand('high', { cut: false })} onCut={() => updBand('high', { cut: true })} color="#f59e0b" />
        <Dial value={aHigh.freq} onChange={(v) => updBand('high', { freq: v })} defaultValue={5000} min={1000} max={20000} step={1} scale="log" label="Freq" unit="Hz" size="small" />
        {!aHigh.cut && <Dial value={aHigh.gain} onChange={(v) => updBand('high', { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" size="small" />}
        {aHigh.cut && <SlopeButtons value={aHigh.slope} onChange={(s) => updBand('high', { slope: s })} color="#f59e0b" />}
      </BandCard>
    );
  };

  return (
    <div data-fx="eq" className="p-4 pb-5 rounded-xl h-[470px] flex flex-col bg-gradient-to-br from-blue-950/20 to-black/60 border border-blue-500/30">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          </div>
          <span className={`text-sm font-medium ${safeEq.enabled ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-white/80'}`}>
            Parametric EQ
          </span>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {BAND_COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => changeCount(c)}
                className={`px-2 py-1 text-[10px] font-mono ${safeEq.bandCount === c ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-white/10" title="Vertical gain range — rescales the graph axis, gridlines and drag sensitivity">
            {Object.entries(GAIN_RANGES).map(([key, r]) => (
              <button
                key={key}
                onClick={() => changeRange(key)}
                title={`±${r.max} dB — ${r.name} · ${r.grid} dB grid`}
                className={`px-2 py-1 text-[10px] font-mono ${safeEq.gainRange === key ? 'text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                style={safeEq.gainRange === key ? { background: r.color, boxShadow: `0 0 8px ${r.color}66` } : undefined}
              >
                {r.name}
              </button>
            ))}
          </div>

        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            onClick={toggleMS}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[10px] font-semibold tracking-wide ${msOn ? '' : 'border-white/12 bg-white/5 text-white/55 hover:text-white/80 hover:border-white/25'}`}
            style={msOn ? { background: '#f59e0b', borderColor: '#b45309', color: '#1a1205', boxShadow: '0 0 10px rgba(245,158,11,0.5)' } : undefined}
            title="Mid/Side mode — EQ the Mid and Side channels independently"
          >
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${msOn ? 'bg-black/40' : 'bg-white/30'}`} />
            M/S
          </button>
          {msOn && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-white/45">Edit</span>
              <div className="flex overflow-hidden rounded-full border" style={{ borderColor: channelColor + '66' }}>
                <button
                  onClick={() => pickChannel('mid')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'mid' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`}
                  style={channel === 'mid' ? { background: MS_MID_COLOR } : undefined}
                >Mid</button>
                <button
                  onClick={() => pickChannel('side')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'side' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`}
                  style={channel === 'side' ? { background: MS_SIDE_COLOR } : undefined}
                >Side</button>
              </div>
            </div>
          )}
          <button
            onClick={resetEQ}
            className="flex items-center gap-1 px-2 py-1 rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all text-[10px]"
            title={msOn ? `Reset ${channel === 'side' ? 'Side' : 'Mid'} channel` : 'Reset EQ'}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <InfoButton panelId="eq" accent="#2563eb" />
          <button
            onClick={() => update({ enabled: !safeEq.enabled })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${safeEq.enabled ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase w-5 text-center">{safeEq.enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>

      {msOn && (
        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-md font-bold uppercase" style={{ background: channelColor, color: '#000' }}>
            Editing {channel === 'side' ? 'Side' : 'Mid'}
          </span>
          <span className="text-white/45">Mid = (L+R) · Side = (L−R) — shape each channel independently. The dashed curve is the other channel.</span>
        </div>
      )}

      <div className="flex-1 min-h-0 mb-2">
        <EQGraph
          eq={active}
          ghostEq={ghostBands}
          audioContext={audioContext}
          analyzerNode={analyzerNode}
          onBandDrag={handleBandDrag}
          enabledAccent={channelColor}
          minDb={-range.max}
          maxDb={range.max}
          gridDb={range.grid}
          labelDb={range.label}
        />
      </div>

      {/* Band selector — click a pill to edit that band's controls. */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {bandList.map((b, i) => {
          const activeSel = sel === i;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBand(i)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-all"
              style={activeSel
                ? { background: b.color + '22', borderColor: b.color, color: b.color, boxShadow: `0 0 8px ${b.color}44` }
                : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.65)' }}
              title={`Edit ${b.label}`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
              {b.label}
            </button>
          );
        })}
      </div>
      <div className="mt-1 shrink-0 flex items-stretch gap-2">
        <div className="flex-1 min-w-0">{renderSelectedBand()}</div>
        <div className="flex flex-col items-center justify-center gap-1 px-3 rounded-lg bg-black/30 border border-blue-500/30 shrink-0" title="Global dry/wet mix">
          <Dial value={safeEq.mix ?? 100} onChange={(v) => update({ mix: v })} defaultValue={100} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent="#2563eb" />
        </div>
      </div>
    </div>
  );
}

function BandCard({ color, channelColor, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1 rounded-lg bg-black/30 min-w-0" style={{ borderColor: (channelColor || color) + '44', borderWidth: 1 }}>
      {children}
    </div>
  );
}

function ShelfCut({ value, onShelf, onCut, color }) {
  return (
    <div className="inline-flex w-fit rounded overflow-hidden border border-white/10 text-[9px]">
      <button
        onClick={onShelf}
        className={`px-2 py-0.5 ${!value ? 'text-white' : 'bg-white/5 text-white/50'}`}
        style={!value ? { background: color } : undefined}
      >
        Shelf
      </button>
      <button
        onClick={onCut}
        className={`px-2 py-0.5 ${value ? 'text-white' : 'bg-white/5 text-white/50'}`}
        style={value ? { background: color } : undefined}
      >
        Cut
      </button>
    </div>
  );
}

function SlopeButtons({ value, onChange, color }) {
  return (
    <div className="flex gap-1">
      {SLOPES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`flex-1 py-1 text-[9px] rounded ${value === s ? 'text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
          style={value === s ? { background: color } : undefined}
        >
          {s}
        </button>
      ))}
    </div>
  );
}