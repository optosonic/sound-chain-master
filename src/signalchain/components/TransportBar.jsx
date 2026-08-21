import React, { useRef } from 'react';
import { Play, Pause, Square, Mic, MicOff, Upload, Volume2, Power, RotateCcw } from 'lucide-react';
import ThemePresetNav from '@/signalchain/components/ThemePresetNav.jsx';
import { AUDIO_IMPORT_ACCEPT } from '@/signalchain/audioFormats.js';

/**
 * Shared slim transport / status bar used by the plugin and mini layouts.
 * One row: source · play/stop/mic/bypass/reset · volume · status LED.
 * `dense` tightens paddings for the 800×600 plugin.
 */
export default function TransportBar({ engine, dense = false }) {
  const fileRef = useRef(null);
  const {
    isPlaying, isMicOn, volume, fileName, ready, bypass, error,
    handlePlay, handlePause, handleStop, toggleMic, handleBypassToggle, handleReset, setVolume, onFileInput,
  } = engine;

  const pad = dense ? 'px-2 py-1.5' : 'px-3 py-2';
  const btn = dense ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]';

  return (
    <div className={`flex items-center gap-2 ${pad} border-t border-white/10 bg-black/40 backdrop-blur`}>
      {/* Source */}
      <button
        onClick={() => fileRef.current?.click()}
        className={`flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 ${btn} text-white/80 hover:bg-white/10`}
        title="Load audio file"
      >
        <Upload size={12} />
        <span className="max-w-[120px] truncate font-mono text-white/60">{fileName || 'Load file…'}</span>
      </button>
      <input ref={fileRef} type="file" accept={AUDIO_IMPORT_ACCEPT} className="hidden" onChange={onFileInput} />

      <div className="mx-1 h-4 w-px bg-white/10" />

      {/* Transport */}
      <button
        onClick={isPlaying ? handlePause : handlePlay}
        className={`flex items-center gap-1 rounded-md ${btn} font-medium text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]`}
        style={{ background: 'linear-gradient(180deg,#7c3aed,#6d28d9)' }}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <button onClick={handleStop} className={`flex items-center gap-1 rounded-md border border-white/10 bg-white/5 ${btn} text-white/80 hover:bg-white/10`}><Square size={12} /></button>
      <button
        onClick={toggleMic}
        className={`flex items-center gap-1 rounded-md border ${btn} ${isMicOn ? 'border-rose-400 bg-rose-500 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
      >
        {isMicOn ? <Mic size={12} /> : <MicOff size={12} />}
      </button>
      <button
        onClick={handleBypassToggle}
        className={`flex items-center gap-1 rounded-md border ${btn} ${bypass ? 'border-amber-400 bg-amber-500 text-black' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
        title="A/B bypass"
      >
        <Power size={12} />
      </button>
      <button onClick={handleReset} className={`flex items-center gap-1 rounded-md border border-white/10 bg-white/5 ${btn} text-white/70 hover:bg-white/10`} title="Reset all"><RotateCcw size={12} /></button>

      {/* Centre — visual-identity theme navigator (six themes) */}
      <div className="flex flex-1 justify-center px-2">
        <ThemePresetNav />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {error && <span className="max-w-[160px] truncate text-[10px] text-rose-400" title={error}>{error}</span>}
        <span className="shrink-0 font-mono text-[8px] uppercase tracking-widest text-white/35">Monitor Out</span>
        <Volume2 size={13} className="text-white/40" />
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 accent-violet-500 sm:w-28" />
        <span className="w-12 text-right font-mono text-[10px] text-white/55">{volume <= 0 ? '−∞' : `${(20 * Math.log10(volume)).toFixed(1)}`}<span className="text-white/30">dB</span></span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-mono ${ready ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-white/40'}`}>
          {ready ? '● READY' : '○ INIT'}
        </span>
      </div>
    </div>
  );
}