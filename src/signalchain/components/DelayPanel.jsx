import React, { useState } from 'react';
import { Timer, Power } from 'lucide-react';
import DelayEchoVisualizer from './DelayEchoVisualizer.jsx';
import InfoButton from './InfoButton';
import TcFader from './TcFader';
import { DEFAULT_EFFECTS } from '../useSignalChainEngine';

/**
 * Delay — TC Native-styled panel (brushed-aluminum faceplate + teal-blue
 * faders). Same parameter set, echo visualizer and engine wiring as before;
 * only the skin changed to match the Reverb panel. See .tc-panel CSS.
 */
const ACCENT = '#1fa9a9';

const NOTE_VALUES = [
  { label: '1/16', value: 0.25 }, { label: '1/16.', value: 0.375 },
  { label: '1/8', value: 0.5 }, { label: '1/8.', value: 0.75 },
  { label: '1/4', value: 1 }, { label: '1/4.', value: 1.5 },
];

// Rhythm-based delay presets — time in seconds (free mode), feedback, mix.
// Each evokes a classic rhythmic echo style; titles show the feel.
const DELAY_PRESETS = [
  { name: 'Slap',     patch: { syncNote: null, time: 0.110, feedback: 0.10, mix: 0.30, xfadeMs: 15 } },
  { name: '1/8 Echo', patch: { syncNote: 2,    time: null,  feedback: 0.35, mix: 0.30, xfadeMs: 15 } },
  { name: 'Dotted',   patch: { syncNote: 3,    time: null,  feedback: 0.40, mix: 0.32, xfadeMs: 15 } },
  { name: 'Quarter',  patch: { syncNote: 4,    time: null,  feedback: 0.45, mix: 0.28, xfadeMs: 20 } },
  { name: 'Tape',     patch: { syncNote: null, time: 0.260, feedback: 0.55, mix: 0.35, xfadeMs: 30 } },
  { name: 'Dub',      patch: { syncNote: null, time: 0.380, feedback: 0.72, mix: 0.40, xfadeMs: 25 } },
  { name: 'Ambient',  patch: { syncNote: null, time: 0.620, feedback: 0.65, mix: 0.45, xfadeMs: 40 } },
  { name: 'Shimmer',  patch: { syncNote: 1,    time: null,  feedback: 0.50, mix: 0.38, xfadeMs: 20 } },
];

export default function DelayPanel({ delay, onChange, bpm = 120, onBpmChange }) {
  const d = { enabled: false, syncNote: null, time: 0.3, feedback: 0.3, mix: 0.3, xfadeMs: 15, ...(delay || {}) };
  const set = (k, v) => onChange({ ...d, [k]: v });
  const [activePreset, setActivePreset] = useState(null);

  const clearPreset = () => setActivePreset(null);

  const applyPreset = (p) => {
    const beatDuration = 60 / bpm;
    const next = { ...d, ...p.patch, enabled: true };
    // Resolve synced note times from bpm.
    if (next.syncNote != null) {
      next.time = beatDuration * NOTE_VALUES[next.syncNote].value;
    }
    onChange(next);
    setActivePreset(p.name);
  };

  return (
    <div>
      <div data-fx="delay" className="tc-panel p-4 pb-5 h-[470px] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/25 border border-cyan-700/40"><Timer className="w-4 h-4 text-cyan-700" /></div>
            <span className="tc-title text-sm">SCM · Delay</span>
            <div className="flex overflow-hidden rounded border border-[#3a3d42]">
              <button onClick={() => { set('syncNote', null); clearPreset(); }} className={`tc-tab px-2.5 py-1 text-[10px] font-semibold transition-all ${d.syncNote == null ? 'tc-tab-active' : ''}`}>Free</button>
              <button onClick={() => { const beatDuration = 60 / bpm; onChange({ ...d, syncNote: 2, time: beatDuration * NOTE_VALUES[2].value }); clearPreset(); }} className={`tc-tab px-2.5 py-1 text-[10px] font-semibold transition-all ${d.syncNote != null ? 'tc-tab-active' : ''}`}>Sync</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="delay" accent={ACCENT} />
            <button onClick={() => set('enabled', !d.enabled)} className={`tc-power-${d.enabled ? 'on' : 'off'} flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{d.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* Echo visualization */}
        <div className="tc-screen p-2 flex-1 min-h-0 mb-2 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <DelayEchoVisualizer delay={d} />
          </div>
          <div className="flex justify-between mt-1 text-[8px] uppercase tracking-wider text-cyan-300/70 shrink-0">
            <span>dry</span><span>echoes · feedback {Math.round(d.feedback * 100)}%</span><span>tail</span>
          </div>
        </div>

        {/* Rhythm preset pills + tempo on one row */}
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1">
            {DELAY_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`tc-preset px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${activePreset === p.name ? 'tc-preset-active' : ''}`}
                title={`${p.name} — ${p.patch.syncNote != null ? NOTE_VALUES[p.patch.syncNote].label : Math.round((p.patch.time || 0) * 1000) + 'ms'} · fb ${Math.round((p.patch.feedback || 0) * 100)}%`}
              >{p.name}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onBpmChange?.(bpm - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-[#3a3d42] bg-gradient-to-b from-[#c4c9cf] to-[#9aa0a6] text-[#2a2d32] hover:from-[#d2d7dd] hover:to-[#a8aeb4]">−</button>
            <input
              type="number" min={20} max={300} value={Math.round(bpm)}
              onChange={(e) => onBpmChange?.(parseFloat(e.target.value) || 120)}
              className="w-14 rounded border border-[#3a3d42] bg-[#0a1620] px-2 py-1 text-center text-xs font-mono text-[#2cc8c8] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button onClick={() => onBpmChange?.(bpm + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-[#3a3d42] bg-gradient-to-b from-[#c4c9cf] to-[#9aa0a6] text-[#2a2d32] hover:from-[#d2d7dd] hover:to-[#a8aeb4]">+</button>
            <span className="tc-label">bpm</span>
          </div>
        </div>

        <div className="space-y-1.5 shrink-0">
          {d.syncNote == null ? (
            <TcFader label="Time" value={d.time} min={0.01} max={1.5} step={0.01} unit=" ms" defaultValue={DEFAULT_EFFECTS.delay.time} format={(v) => Math.round(v * 1000)} onChange={(v) => { set('time', v); clearPreset(); }} />
          ) : (
            <div className="space-y-0.5">
              <div className="flex justify-between items-baseline">
                <span className="tc-label">Note</span>
                <span className="tc-value text-[10px]">{NOTE_VALUES[d.syncNote].label} = {Math.round(d.time * 1000)} ms</span>
              </div>
              <div className="flex gap-1">
                {NOTE_VALUES.map((note, idx) => (
                  <button key={note.label} onClick={() => { const beatDuration = 60 / bpm; onChange({ ...d, syncNote: idx, time: beatDuration * note.value }); clearPreset(); }} className={`flex-1 py-1 text-[10px] rounded transition-all ${d.syncNote === idx ? 'tc-preset tc-preset-active' : 'tc-preset'}`}>{note.label}</button>
                ))}
              </div>
            </div>
          )}

          <TcFader label="Feedback" value={d.feedback} min={0} max={0.9} step={0.05} unit="%" defaultValue={DEFAULT_EFFECTS.delay.feedback} format={(v) => Math.round(v * 100)} onChange={(v) => { set('feedback', v); clearPreset(); }} />
          <TcFader label="Mix" value={d.mix} min={0} max={1} step={0.05} unit="%" defaultValue={DEFAULT_EFFECTS.delay.mix} format={(v) => Math.round(v * 100)} onChange={(v) => { set('mix', v); clearPreset(); }} />
          <TcFader label="Time Xfade" value={d.xfadeMs} min={2} max={60} step={1} unit=" ms" defaultValue={DEFAULT_EFFECTS.delay.xfadeMs} format={(v) => Math.round(v)} onChange={(v) => { set('xfadeMs', v); clearPreset(); }} />
        </div>
      </div>
    </div>
  );
}