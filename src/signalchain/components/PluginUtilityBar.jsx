import React from 'react';
import { RotateCcw, AudioLines, Power } from 'lucide-react';

/**
 * PluginUtilityBar — Ozone-style bottom utility strip for the plugin window.
 * Wires to existing engine controls only:
 *   · Metering scale  — dBFS / K-12 / K-14 / K-20  (engine.meteringMode)
 *   · Bypass all FX   — engine.handleBypassToggle
 *   · Mono sum        — engine.handleMonoToggle
 *   · Reset / Init    — engine.handleReset
 */
const K_MODES = ['dBFS', 'K-12', 'K-14', 'K-20'];

function Pill({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider transition-all ${
        active
          ? 'bg-white text-black shadow'
          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export default function PluginUtilityBar({ engine }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-black/40 px-3 py-1.5">
      {/* Metering scale */}
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-mono uppercase tracking-widest text-white/35">Scale</span>
        <div className="flex items-center rounded-lg border border-white/10 bg-black/30 p-0.5">
          {K_MODES.map((m) => (
            <button
              key={m}
              onClick={() => engine.setMeteringMode(m)}
              className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold transition-all ${
                engine.meteringMode === m ? 'bg-white text-black' : 'text-white/55 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Bypass / Mono */}
      <Pill active={!!engine.bypass} onClick={engine.handleBypassToggle} title="Bypass all effects">
        <Power size={11} /> Bypass
      </Pill>
      <Pill active={!!engine.mono} onClick={engine.handleMonoToggle} title="Sum to mono">
        <AudioLines size={11} /> Mono
      </Pill>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Reset */}
      <Pill active={false} onClick={engine.handleReset} title="Reset to Init">
        <RotateCcw size={11} /> Reset
      </Pill>
    </div>
  );
}