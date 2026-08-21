import React, { useMemo, useState } from 'react';
import { RotateCcw, Power, Layers } from 'lucide-react';
import Dial from './Dial';
import MBCGraph from './MBCGraph.jsx';
import MBCVisualizer from './MBCVisualizer.jsx';
import {
  MBC_BAND_COUNTS, MBC_BAND_COLORS, defaultBand, defaultMultiBandComp,
  setMbcBandCount, updateMbcBand, updateMbcCrossover,
} from '../multiBandCompModel.js';
import InfoButton from './InfoButton';
import { MS_MID_COLOR, MS_SIDE_COLOR } from '../eqModel.js';

// Single shared default band — the Option-click reset target for every
// per-band dial/slider in the BandCard.
const DEF_BAND = defaultBand();

const ACCENT = '#4ade80';

/**
 * Sophisticated 1–5 band compressor. The canvas drives crossovers + thresholds
 * by dragging; per-band cards give manual dial + slider control. Props mirror
 * the other effect panels (state + onChange + live nodes for the GR overlay).
 */
export default function MultiBandCompPanel({ mbc, onMbcChange, mbcNodes, analyzerNode, audioContext }) {
  const safe = useMemo(() => {
    const base = defaultMultiBandComp(4);
    const merged = { ...base, ...(mbc || {}) };
    const k = Math.max(1, Math.min(5, merged.bandCount || 4));
    merged.bandCount = k;
    merged.crossovers = (mbc?.crossovers?.length ? mbc.crossovers : base.crossovers).slice(0, k - 1);
    while (merged.crossovers.length < k - 1) merged.crossovers.push(defaultCrossoverAt(merged.crossovers.length, k));
    const bands = [];
    for (let i = 0; i < k; i++) bands.push({ ...defaultBand(), ...(mbc?.bands?.[i] || {}) });
    merged.bands = bands;
    const sideBands = [];
    for (let i = 0; i < k; i++) sideBands.push({ ...defaultBand(), ...(mbc?.sideBands?.[i] || bands[i]) });
    merged.sideBands = sideBands;
    merged.msMode = !!merged.msMode;
    merged.msChannel = merged.msChannel === 'side' ? 'side' : 'mid';
    return merged;
  }, [mbc]);

  const update = (patch) => onMbcChange({ ...safe, ...patch });
  const changeCount = (c) => onMbcChange(setMbcBandCount(safe, c));
  const msOn = !!safe.msMode;
  const channel = safe.msChannel === 'side' ? 'side' : 'mid';
  const channelColor = msOn ? (channel === 'side' ? MS_SIDE_COLOR : MS_MID_COLOR) : ACCENT;
  const activeBands = msOn && channel === 'side' ? safe.sideBands : safe.bands;
  const updBand = (i, p) => onMbcChange(updateMbcBand(safe, i, p, msOn && channel === 'side' ? 'side' : 'mid'));
  const toggleMS = () => update({ msMode: !safe.msMode, msChannel: 'mid' });
  const pickChannel = (ch) => update({ msChannel: ch });
  const activeNodes = mbcNodes && (msOn ? mbcNodes.side : mbcNodes.mid);
  const updXover = (i, f) => onMbcChange(updateMbcCrossover(safe, i, f));
  const reset = () => onMbcChange(defaultMultiBandComp(safe.bandCount));
  const [selectedBand, setSelectedBand] = useState(0);
  const sel = Math.min(selectedBand, safe.bandCount - 1);

  if (!onMbcChange) return null;

  return (
    <div>
      <div data-fx="multibandcomp" className="p-4 pb-5 rounded-xl h-[470px] flex flex-col bg-gradient-to-br from-emerald-950/30 to-black/60 border border-emerald-500/30">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: ACCENT + '33' }}>
              <Layers className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <span className={`text-sm font-medium ${safe.enabled ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-white/80'}`}>M-Band Comp</span>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {MBC_BAND_COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => changeCount(c)}
                  className={`px-2 py-1 text-[10px] font-mono ${safe.bandCount === c ? 'text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                  style={safe.bandCount === c ? { background: ACCENT } : undefined}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              onClick={toggleMS}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[10px] font-semibold tracking-wide"
              style={msOn
                ? { background: '#f0b84d', borderColor: '#f0b84d', color: '#1a1a1a', boxShadow: '0 0 10px rgba(240,184,77,0.45)' }
                : { background: 'rgba(240,184,77,0.10)', borderColor: '#f0b84d', color: '#b97c0a' }}
              title="Mid/Side mode — compress the Mid and Side band trees independently"
            >
              <span className="h-1.5 w-1.5 rounded-full transition-colors" style={{ background: msOn ? '#1a1a1a' : '#f0b84d' }} />
              M/S
            </button>
            {msOn && (
              <div className="flex overflow-hidden rounded-full border" style={{ borderColor: channelColor + '66' }}>
                <button onClick={() => pickChannel('mid')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'mid' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'mid' ? { background: MS_MID_COLOR } : undefined}>Mid</button>
                <button onClick={() => pickChannel('side')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'side' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'side' ? { background: MS_SIDE_COLOR } : undefined}>Side</button>
              </div>
            )}
            <button onClick={reset} title="Reset" className="flex items-center gap-1 px-2 py-1 rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all text-[10px]">
              <RotateCcw className="w-3 h-3" />
            </button>
            <InfoButton panelId="multibandcomp" accent={ACCENT} />
            <button
              onClick={() => update({ enabled: !safe.enabled })}
              className="sc-power-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all"
              style={safe.enabled
                ? { background: ACCENT, borderColor: ACCENT, color: '#04240f', boxShadow: `0 0 10px ${ACCENT}88` }
                : { background: 'var(--sc-off-bg, rgba(255,255,255,0.05))', borderColor: 'var(--sc-off-border, rgba(255,255,255,0.1))', color: 'var(--sc-off-text, rgba(255,255,255,0.5))' }}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {msOn && (
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded-md font-bold uppercase" style={{ background: channelColor, color: '#000' }}>
              Editing {channel === 'side' ? 'Side' : 'Mid'}
            </span>
            <span className="text-white/45">Mid = (L+R) · Side = (L−R) — each band's compressor is independent per channel.</span>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col">
          <MBCVisualizer analyzerNode={analyzerNode} audioContext={audioContext} state={safe} mbcNodes={activeNodes} height={108} />
          <MBCGraph state={safe} onBandChange={updBand} onCrossoverChange={updXover} mbcNodes={activeNodes} accent={ACCENT} onBandSelect={setSelectedBand} />
        </div>

        {/* Lower section — two columns: band controls (left) + output (right) */}
        <div className="flex items-stretch gap-2 mt-2">
          {/* Left: band selector + parameter knobs */}
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {activeBands.map((b, i) => {
                const color = MBC_BAND_COLORS[i % MBC_BAND_COLORS.length];
                const active = sel === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedBand(i)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-all"
                    style={active
                      ? { background: color + '22', borderColor: color, color, boxShadow: `0 0 8px ${color}44` }
                      : { background: 'var(--sc-off-bg, rgba(255,255,255,0.05))', borderColor: 'var(--sc-off-border, rgba(255,255,255,0.18))', color: 'var(--sc-off-text, rgba(255,255,255,0.65))' }}
                    title={`Edit Band ${i + 1}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: b.enabled ? color : 'var(--sc-off-text, rgba(255,255,255,0.3))', boxShadow: b.enabled ? `0 0 6px ${color}` : 'none' }}
                    />
                    B{i + 1}
                    {b.solo && <span className="text-amber-400 font-bold text-[8px]">S</span>}
                  </button>
                );
              })}
            </div>
            <BandCard index={sel} band={activeBands[sel]} color={MBC_BAND_COLORS[sel % MBC_BAND_COLORS.length]} onPatch={(p) => updBand(sel, p)} />
          </div>
          {/* Right: Output column */}
          <div className="flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-lg bg-black/30" style={{ borderColor: ACCENT + '44', borderWidth: 1 }}>
            <Dial value={safe.globalMakeup} onChange={(v) => update({ globalMakeup: v })} defaultValue={defaultMultiBandComp(4).globalMakeup} min={-12} max={24} step={0.5} label="Output" unit="dB" size="small" accent={ACCENT} />
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultCrossoverAt(i, k) {
  return defaultMultiBandComp(k).crossovers[i] ?? 1000;
}

function BandCard({ index, band, color, onPatch }) {
  const toggleEnabled = () => onPatch({ enabled: !band.enabled });
  const toggleSolo = () => onPatch({ solo: !band.solo });
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/30 flex-1 min-h-0" style={{ borderColor: color + '33', borderWidth: 1 }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color }}>B{index + 1}</span>
      <button
        onClick={toggleSolo}
        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border transition-all shrink-0"
        style={band.solo
          ? { background: '#fbbf24', borderColor: '#fbbf24', color: '#000' }
          : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' }}
      >Solo</button>
      <button
        onClick={toggleEnabled}
        className="w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0"
        style={band.enabled
          ? { background: color, borderColor: color, boxShadow: `0 0 6px ${color}aa` }
          : { borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}
      >
        <Power className="w-2.5 h-2.5" style={{ color: band.enabled ? '#04240f' : 'rgba(255,255,255,0.4)' }} />
      </button>
      <div className="flex items-center justify-around gap-1 flex-1 min-w-0">
        <Dial value={band.threshold} onChange={(v) => onPatch({ threshold: v })} defaultValue={DEF_BAND.threshold} min={-60} max={0} step={0.5} label="Thresh" unit="dB" accent={color} />
        <Dial value={band.ratio} onChange={(v) => onPatch({ ratio: v })} defaultValue={DEF_BAND.ratio} min={1} max={20} step={0.5} label="Ratio" accent={color} />
        <Dial value={band.knee} onChange={(v) => onPatch({ knee: v })} defaultValue={DEF_BAND.knee} min={0} max={40} step={1} label="Knee" unit="dB" size="small" accent={color} />
        <Dial value={band.makeupGain} onChange={(v) => onPatch({ makeupGain: v })} defaultValue={DEF_BAND.makeupGain} min={0} max={24} step={0.1} label="Makeup" unit="dB" accent={color} scale="log" />
        <Dial value={band.attack} onChange={(v) => onPatch({ attack: v })} defaultValue={DEF_BAND.attack} min={0.001} max={0.3} step={0.001} scale="log" label="Atk" unit="s" size="xsmall" accent={color} />
        <Dial value={band.release} onChange={(v) => onPatch({ release: v })} defaultValue={DEF_BAND.release} min={0.01} max={1} step={0.01} scale="log" label="Rel" unit="s" size="xsmall" accent={color} />
      </div>
    </div>
  );
}