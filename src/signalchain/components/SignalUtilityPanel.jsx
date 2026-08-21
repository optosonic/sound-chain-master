import React, { memo, useEffect, useState } from 'react';
import { Power, VolumeX } from 'lucide-react';
import Dial from './Dial';
import { DEFAULT_SIGNAL_UTILITY } from '../signalUtility/signalUtilityEngine';
import { SIGNAL_UTILITY_PRESETS } from '../signalUtility/presets';

const ACCENT = '#22d3ee';
const MTR_CYAN = '#22d3ee';
const MTR_BODY = '#1a1714';

const WAVEFORMS = [
  { id: 'sine', label: 'Sine' },
  { id: 'white', label: 'White' },
  { id: 'pink', label: 'Pink' },
  { id: 'square', label: 'Square' },
  { id: 'saw', label: 'Saw' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'needle', label: 'Needle' },
  { id: 'impulse', label: 'Impulse' },
  { id: 'sweep', label: 'Sweep' },
];

// frequency → nearest note name (A4 = 440 Hz)
const noteOf = (f) => {
  if (f < 16) return '';
  const n = Math.round(12 * Math.log2(f / 440));
  const names = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const note = names[((n % 12) + 12) % 12];
  const oct = 4 + Math.floor((n + 9) / 12);
  return `${note}${oct}`;
};

export default function SignalUtilityPanel({ signalUtility }) {
  const [state, setState] = useState({ ...DEFAULT_SIGNAL_UTILITY });
  const [presetName, setPresetName] = useState('1 kHz Sine −20 dBFS');
  const su = signalUtility;

  // push every state change to the engine controller (which posts to the worklet)
  useEffect(() => { su?.update?.(state); }, [state, su]);

  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const togglePower = () => setState((s) => ({ ...s, enabled: !s.enabled }));
  const applyPreset = (p) => { setPresetName(p.name); setState((s) => ({ ...s, ...p.state, enabled: s.enabled })); };
  const triggerImpulse = () => su?.trigger?.();

  const isSweep = state.type === 'sweep';
  const isSquare = state.type === 'square';
  const isNoise = state.type === 'white' || state.type === 'pink';
  const isImpulse = state.type === 'impulse';
  const isNeedle = state.type === 'needle';
  const freqActive = !isSweep && !isNoise && !isImpulse && !isNeedle;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_240px] gap-3">
        {/* left: preset/dim/power + waveform + routing + sweep/impulse */}
        <div className="flex min-h-0 flex-col gap-2">
          {/* power / dim — sit ABOVE the preset dropdown so the on/off + dim
              controls lead, then the preset selector, then the waveform grid. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={togglePower}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${state.enabled ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-white/5 border-white/15 text-white/50 hover:bg-white/10'}`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase">{state.enabled ? 'On' : 'Off'}</span>
            </button>
            <button onClick={() => set('dim', !state.dim)} title="Dim (−20 dB temporary attenuation)"
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${state.dim ? 'bg-amber-500 border-amber-400 text-black' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'}`}>
              <VolumeX className="w-3 h-3" /> Dim
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={presetName}
              onChange={(e) => { const p = SIGNAL_UTILITY_PRESETS.find((x) => x.name === e.target.value); if (p) applyPreset(p); }}
              className="rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[10px] text-white/80 font-mono"
            >
              {SIGNAL_UTILITY_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <div className="shrink-0">
            <div className="mb-1 text-[9px] uppercase tracking-wider text-white/45">Waveform</div>
            <div className="grid grid-cols-3 gap-1.5" style={{ gridTemplateRows: 'repeat(3, minmax(44px, 52px))' }}>
              {WAVEFORMS.map((w) => {
                const on = state.type === w.id;
                return (
                  <button key={w.id} type="button"
                    onClick={() => { set('type', w.id); if (w.id === 'impulse') triggerImpulse(); }}
                    className="relative box-border flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md px-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${on ? 'rgba(34,211,238,0.22)' : 'rgba(34,211,238,0.12)'}, ${MTR_BODY})`,
                      boxShadow: on
                        ? 'inset 0 0 0 2px rgba(34,211,238,0.42), inset 0 0 0 3.2px #22d3ee, inset 0 1px 0 rgba(34,211,238,0.55)'
                        : 'inset 0 0 0 1.2px rgba(34,211,238,0.35), inset 0 1px 0 rgba(34,211,238,0.18)',
                      color: on ? '#ffffff' : 'rgba(255,255,255,0.62)',
                    }}
                  >
                    <span aria-hidden
                      className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                        on
                          ? 'border border-emerald-300 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                          : 'border border-white/25 bg-white/10'
                      }`}
                    />
                    <WaveGlyph id={w.id} on={on} />
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Toggle on={state.antiAliased} onClick={() => set('antiAliased', !state.antiAliased)} label="Anti-Alias" disabled={isNoise || state.type === 'sine' || state.type === 'needle' || state.type === 'impulse' || isSweep} />
            <Toggle on={state.decorrelated} onClick={() => set('decorrelated', !state.decorrelated)} label="Decorrelated" disabled={!isNoise} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Toggle on={state.stereo} onClick={() => set('stereo', !state.stereo)} label="Stereo" />
            <span className="ml-0.5 text-[9px] uppercase tracking-wider text-white/45">Invert</span>
            <div className="flex gap-1">
              {['none', 'left', 'right', 'both'].map((m) => (
                <button key={m} onClick={() => set('invert', m)} className={`rounded-md border px-1.5 py-1 text-[9px] font-bold uppercase ${state.invert === m ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-white/5 border-white/15 text-white/60'}`}>{m === 'none' ? 'Off' : m}</button>
              ))}
            </div>
          </div>

          {isSweep && (
            <div className="min-h-0 overflow-auto">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
              <Dial value={state.sweepStart} onChange={(v) => set('sweepStart', v)} min={1} max={20000} step={1} scale="log" label="Start" unit="Hz" size="small" accent={ACCENT} />
              <Dial value={state.sweepEnd} onChange={(v) => set('sweepEnd', v)} min={1} max={20000} step={1} scale="log" label="End" unit="Hz" size="small" accent={ACCENT} />
              <Dial value={state.sweepDuration} onChange={(v) => set('sweepDuration', v)} min={0.5} max={30} step={0.5} label="Duration" unit="s" size="small" accent={ACCENT} />
              <div className="flex flex-col justify-end gap-1">
                <span className="text-[8px] uppercase tracking-wider text-white/45">Rate</span>
                <div className="flex gap-1">
                  {['log', 'linear'].map((r) => (
                    <button key={r} onClick={() => set('sweepRate', r)} className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase ${state.sweepRate === r ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-white/5 border-white/15 text-white/60'}`}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* right: freq + level dials, note, meters, DC + duty.
            justify-between spreads the group across the full column height and
            pb-5 reserves a clear bottom margin so the DC/Duty dials never sit
            flush against the panel edge. */}
        <div className="flex min-h-0 flex-col justify-between gap-2 pb-5">
          <div className="flex justify-center gap-3">
            <Dial value={state.frequency} onChange={(v) => set('frequency', v)} min={1} max={20000} step={0.1} scale="log" label="Frequency" unit="Hz" size="small" accent={ACCENT} className={freqActive ? '' : 'opacity-30 pointer-events-none'} />
            <Dial value={state.level} onChange={(v) => set('level', v)} min={-96} max={6} step={0.1} label="Level" unit="dB" size="small" accent={ACCENT} />
          </div>
          {freqActive && state.frequency >= 16 && (
            <div className="text-center text-[9px] font-mono text-white/40">≈ {noteOf(state.frequency)}</div>
          )}
          <SignalUtilityMeters controller={su} />
          <div className="flex justify-center gap-3">
            <Dial value={state.dcOffset} onChange={(v) => set('dcOffset', v)} min={-1} max={1} step={0.01} label="DC Offset" size="small" accent="#fb923c" />
            <Dial value={state.duty} onChange={(v) => set('duty', v)} min={0.05} max={0.95} step={0.01} label="Duty" size="small" accent={ACCENT} className={isSquare ? '' : 'opacity-30 pointer-events-none'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WaveGlyph({ id, on }) {
  const stroke = on ? MTR_CYAN : 'rgba(34,211,238,0.42)';
  const glow = on
    ? 'drop-shadow(0 0 3px rgba(34,211,238,0.95)) drop-shadow(0 0 7px rgba(34,211,238,0.55))'
    : 'drop-shadow(0 0 2px rgba(34,211,238,0.18))';
  const strokeProps = {
    fill: 'none',
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  return (
    <svg viewBox="0 0 32 14" className="h-3.5 w-[88%]" aria-hidden style={{ filter: glow }}>
      {id === 'sine' && <path {...strokeProps} d="M1 7 C5 -1 11 -1 16 7 S27 15 31 7" />}
      {id === 'white' && (
        <>
          <path {...strokeProps} strokeWidth={1} d="M1 7 H31" />
          {[3, 6, 9, 12, 15, 18, 21, 24, 27].map((x, i) => {
            const h = [5, -4, 6, -3, 4.5, -5.5, 3, -4.5, 5][i];
            return <line key={x} {...strokeProps} strokeWidth={1.2} x1={x} y1={7} x2={x} y2={7 - h} />;
          })}
        </>
      )}
      {id === 'pink' && <path {...strokeProps} d="M1 6 Q5 2 8 7 T16 5 T24 10 T31 6" />}
      {id === 'square' && <path {...strokeProps} strokeLinejoin="miter" d="M1 3 H8 V11 H16 V3 H24 V11 H31" />}
      {id === 'saw' && <path {...strokeProps} strokeLinejoin="miter" d="M1 11 L15 3 L16 11 L30 3 L31 11" />}
      {id === 'triangle' && <path {...strokeProps} d="M1 7 L5 2 L13 12 L21 2 L29 12 L31 7" />}
      {id === 'needle' && (
        <>
          <path {...strokeProps} strokeWidth={1.1} d="M1 7 H31" />
          {[6, 16, 26].map((x) => <line key={x} {...strokeProps} x1={x} y1={7} x2={x} y2={2} />)}
        </>
      )}
      {id === 'impulse' && (
        <>
          <path {...strokeProps} strokeWidth={1.1} d="M1 7 H31" />
          <path fill={stroke} stroke="none" d="M12 7 L16 2 L20 7 Z" />
        </>
      )}
      {id === 'sweep' && (
        <>
          <path {...strokeProps} d="M1 7 C4 2 6 12 9 7 C11 3 12 11 14 7 C15.2 4 16 10 17.2 7 C18 4.5 18.6 9.5 19.4 7 C20 5 20.5 9 21.2 7 C21.7 5.4 22.1 8.6 22.6 7 C23 5.8 23.3 8.2 23.7 7" />
          <path fill={stroke} stroke="none" d="M31 7 L25 4.2 V9.8 Z" />
        </>
      )}
    </svg>
  );
}

function Toggle({ on, onClick, label, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all ${disabled ? 'bg-white/5 border-white/10 text-white/40 opacity-50' : on ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'}`}>
      {label}
    </button>
  );
}

const SignalUtilityMeters = memo(function SignalUtilityMeters({ controller }) {
  const [m, setM] = useState({ peakL: -100, peakR: -100, rmsL: -100, rmsR: -100 });
  useEffect(() => {
    let raf;
    const tick = () => {
      const mm = controller?.getMeters?.();
      if (mm) setM(mm);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [controller]);
  const fmt = (v) => (v <= -99 ? '-∞' : v.toFixed(1));
  const peakRows = [['L Peak', m.peakL], ['R Peak', m.peakR]];
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-2">
      {peakRows.map(([label, db]) => {
        const pct = Math.max(0, Math.min(100, ((db + 60) / 66) * 100));
        const col = db >= 0 ? '#ff5b5b' : db >= -6 ? '#fbbf24' : '#22d3ee';
        return (
          <div key={label} className="mt-1 first:mt-0">
            <div className="mb-0.5 flex items-center justify-between text-[8px] uppercase tracking-wider text-white/45"><span>{label}</span><span className="font-mono text-cyan-300">{fmt(db)}</span></div>
            <div className="relative h-1.5 w-full overflow-hidden rounded bg-black/50"><div className="absolute left-0 top-0 h-full" style={{ width: `${pct}%`, background: col }} /></div>
          </div>
        );
      })}
      <div className="mt-1 grid grid-cols-2 gap-2 text-[8px] font-mono">
        <div className="flex justify-between"><span className="text-white/40">L RMS</span><span className="text-white/80">{fmt(m.rmsL)}</span></div>
        <div className="flex justify-between"><span className="text-white/40">R RMS</span><span className="text-white/80">{fmt(m.rmsR)}</span></div>
      </div>
    </div>
  );
});