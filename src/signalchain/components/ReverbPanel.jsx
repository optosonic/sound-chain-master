import React, { useState } from 'react';
import { Sparkles, Power } from 'lucide-react';
import ReverbFieldVisualizer from './ReverbFieldVisualizer.jsx';
import ReverbEQGraph from './ReverbEQGraph.jsx';
import InfoButton from './InfoButton';
import TcFader from './TcFader';
import { DEFAULT_EFFECTS } from '../useSignalChainEngine';

/**
 * Reverb — TC Native-styled panel (brushed-aluminum faceplate + cool-blue
 * faders). Layout mirrors the Delay panel: large recessed visualizer on top,
 * preset pills below it, then a clean stack of TcFaders underneath.
 * Main tab → reverb field; EQ tab → EQ graph with the wet-shaping controls as
 * faders below it. See .tc-panel CSS in index.css.
 */
const ACCENT = '#1fa9a9';

const REVERB_PRESETS = [
  { name: 'Room',      patch: { decay: 0.6,  size: 0.30, diffusion: 0.5,  damping: 0.40, radicalness: 0.0, mix: 0.25, predelay: 10, lowCut: 80,  highShelfFreq: 8000,  highShelfGain: 0  } },
  { name: 'Studio',    patch: { decay: 1.0,  size: 0.40, diffusion: 0.6,  damping: 0.40, radicalness: 0.0, mix: 0.25, predelay: 20, lowCut: 60,  highShelfFreq: 8000,  highShelfGain: 0  } },
  { name: 'Hall',      patch: { decay: 2.5,  size: 0.60, diffusion: 0.70, damping: 0.50, radicalness: 0.1, mix: 0.30, predelay: 40, lowCut: 40,  highShelfFreq: 7000,  highShelfGain: -1 } },
  { name: 'Cathedral', patch: { decay: 7.0,  size: 0.85, diffusion: 0.85, damping: 0.60, radicalness: 0.4, mix: 0.40, predelay: 60, lowCut: 30,  highShelfFreq: 6000,  highShelfGain: -2 } },
  { name: 'Plate',     patch: { decay: 1.8,  size: 0.50, diffusion: 0.90, damping: 0.30, radicalness: 0.0, mix: 0.30, predelay: 5,  lowCut: 100, highShelfFreq: 10000, highShelfGain: 1  } },
  { name: 'Shimmer',   patch: { decay: 4.0,  size: 0.70, diffusion: 0.80, damping: 0.35, radicalness: 0.6, mix: 0.35, predelay: 30, lowCut: 50,  highShelfFreq: 9000,  highShelfGain: 2  } },
  { name: 'Extreme',   patch: { decay: 15.0, size: 0.95, diffusion: 0.95, damping: 0.50, radicalness: 1.0, mix: 0.45, predelay: 50, lowCut: 25,  highShelfFreq: 5000,  highShelfGain: -1 } },
];

export default function ReverbPanel({ reverb, onChange }) {
  const r = {
    enabled: false, decay: 1.5, predelay: 0, size: 0.5, diffusion: 0.7,
    damping: 0.5, mix: 0.3, radicalness: 0, lowCut: 20, highShelfFreq: 8000, highShelfGain: 0,
    ...(reverb || {}),
  };
  const set = (k, v) => onChange({ ...r, [k]: v });
  const update = (patch) => onChange({ ...r, ...patch });
  const [tab, setTab] = useState('main');
  const [activePreset, setActivePreset] = useState(null);

  const clearPreset = () => setActivePreset(null);
  const applyPreset = (p) => {
    onChange({ ...r, ...p.patch, enabled: true });
    setActivePreset(p.name);
  };

  return (
    <div>
      <div data-fx="reverb" className="tc-panel p-4 pb-5 h-[470px] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/25 border border-cyan-700/40"><Sparkles className="w-4 h-4 text-cyan-700" /></div>
            <span className="tc-title text-sm">SCM · Reverb</span>
            <div className="flex overflow-hidden rounded border border-[#3a3d42]">
              <button onClick={() => setTab('main')} className={`tc-tab px-2.5 py-1 text-[10px] font-semibold transition-all ${tab === 'main' ? 'tc-tab-active' : ''}`}>Main</button>
              <button onClick={() => setTab('eq')} className={`tc-tab px-2.5 py-1 text-[10px] font-semibold transition-all ${tab === 'eq' ? 'tc-tab-active' : ''}`}>EQ</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="reverb" accent={ACCENT} />
            <button onClick={() => set('enabled', !r.enabled)} className={`tc-power-${r.enabled ? 'on' : 'off'} flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{r.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* Large recessed visualizer screen on top */}
        <div className="tc-screen p-2 flex-1 min-h-0 mb-2 flex flex-col">
          <div className="relative flex-1 min-h-0">
            {tab === 'main' ? (
              <ReverbFieldVisualizer reverb={r} />
            ) : (
              <ReverbEQGraph r={r} update={update} />
            )}
          </div>
          <div className="flex justify-between mt-1 text-[8px] uppercase tracking-wider text-cyan-300/70 shrink-0">
            <span>direct</span><span>early reflections</span><span>tail / density</span>
          </div>
        </div>

        {/* Preset pills */}
        <div className="flex flex-wrap items-center gap-1 mb-2 shrink-0">
          {REVERB_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={`tc-preset px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${activePreset === p.name ? 'tc-preset-active' : ''}`}
              title={`${p.name} — decay ${p.patch.decay}s`}
            >{p.name}</button>
          ))}
        </div>

        {/* Faders below — same clean stack as the Delay panel */}
        {tab === 'main' ? (
          <div className="space-y-1.5 shrink-0">
            <TcFader label="Decay" value={r.decay} min={0.3} max={15} step={0.1} unit="s" defaultValue={DEFAULT_EFFECTS.reverb.decay} format={(v) => v.toFixed(1)} onChange={(v) => { set('decay', v); clearPreset(); }} />
            <TcFader label="Pre-Delay" value={r.predelay} min={0} max={200} step={1} unit=" ms" defaultValue={DEFAULT_EFFECTS.reverb.predelay} format={(v) => Math.round(v)} onChange={(v) => { set('predelay', v); clearPreset(); }} />
            <div className="grid grid-cols-2 gap-2">
              <TcFader label="Size" value={r.size} min={0} max={1} step={0.01} unit="%" defaultValue={DEFAULT_EFFECTS.reverb.size} format={(v) => Math.round(v * 100)} onChange={(v) => { set('size', v); clearPreset(); }} />
              <TcFader label="X-Large" value={r.radicalness} min={0} max={1} step={0.01} unit="%" defaultValue={DEFAULT_EFFECTS.reverb.radicalness} format={(v) => Math.round(v * 100)} onChange={(v) => { set('radicalness', v); clearPreset(); }} />
            </div>
            <TcFader label="Mix" value={r.mix} min={0} max={1} step={0.01} unit="%" defaultValue={DEFAULT_EFFECTS.reverb.mix} format={(v) => Math.round(v * 100)} onChange={(v) => { set('mix', v); clearPreset(); }} />
          </div>
        ) : (
          <div className="space-y-1.5 shrink-0">
            <TcFader label="Low Cut" value={r.lowCut} min={20} max={1000} step={1} unit=" Hz" defaultValue={DEFAULT_EFFECTS.reverb.lowCut} format={(v) => Math.round(v)} onChange={(v) => { set('lowCut', v); clearPreset(); }} />
            <TcFader label="Damping" value={r.damping} min={0} max={1} step={0.01} unit="%" defaultValue={DEFAULT_EFFECTS.reverb.damping} format={(v) => Math.round(v * 100)} onChange={(v) => { set('damping', v); clearPreset(); }} />
            <div className="grid grid-cols-2 gap-2">
              <TcFader label="High Shelf" value={r.highShelfFreq} min={1000} max={16000} step={10} unit=" Hz" defaultValue={DEFAULT_EFFECTS.reverb.highShelfFreq} format={(v) => Math.round(v)} onChange={(v) => { set('highShelfFreq', v); clearPreset(); }} />
              <TcFader label="HS Gain" value={r.highShelfGain} min={-12} max={12} step={0.1} unit=" dB" defaultValue={DEFAULT_EFFECTS.reverb.highShelfGain} format={(v) => (v > 0 ? '+' : '') + v.toFixed(1)} onChange={(v) => { set('highShelfGain', v); clearPreset(); }} />
            </div>
            <TcFader label="Diffusion" value={r.diffusion} min={0} max={1} step={0.01} unit="%" defaultValue={DEFAULT_EFFECTS.reverb.diffusion} format={(v) => Math.round(v * 100)} onChange={(v) => { set('diffusion', v); clearPreset(); }} />
          </div>
        )}
      </div>
    </div>
  );
}