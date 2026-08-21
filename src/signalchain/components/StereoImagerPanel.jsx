import React from 'react';
import { Scaling, Power } from 'lucide-react';
import Dial from './Dial';
import Goniometer from './Goniometer';
import SpreadRange from './SpreadRange';
import InfoButton from './InfoButton';
import { DEFAULT_STEREO_IMAGER } from '../useSignalChainEngine';

const ACCENT = '#5eead4';

/**
 * Stereo Imager — Direction Mixer (Logic-style).
 *
 * Controls:
 *  - Input   : LR or MS (decode an encoded Mid/Side input to L/R first).
 *  - Split    : ON splits the side channel into two bands at the Crossover so
 *               the low band (bass) and high band can have independent widths.
 *  - Crossover: the split frequency (Hz) — only active when Split is on.
 *  - Direction: rotates the stereo image by θ° (0 = centred).
 *  - Spread   : centered bidirectional width slider — center (1.0 = original)
 *               is the sticky point; drag left to narrow, right to widen.
 *  - Width    : the overall / high-band width (0 = mono, 1 = original, >1 wider),
 *               linked to the Spread handle.
 *
 * Props: stereoImager, onChange, analyzers (imagerLeft/Right for goniometer),
 *        audioContext.
 */
export default function StereoImagerPanel({ stereoImager, onChange, analyzers, audioContext }) {
  const safe = { ...DEFAULT_STEREO_IMAGER, ...(stereoImager || {}) };
  const set = (k, v) => onChange?.({ ...safe, [k]: v });
  const inputMs = !!safe.inputMs;

  // Spread — a single stereo window on a -3…+3 rail, centred at 0.
  //   spreadLo (lower handle) = LEFT edge of the image
  //   width    (upper handle) = RIGHT edge of the image
  //   [-1, +1] = the original stereo image; [0, 0] = mono; [-3, +3] = 3× wide.
  // The window WIDTH = (hi − lo)/2 drives the engine's side-gain (both bands);
  // the window CENTRE = (lo + hi)/2 IS the Direction — turning the Direction
  // knob shifts the whole window left/right, dragging the handles moves/reshapes
  // it and feeds back to the Direction knob. The two controls stay in sync.
  const lo = Math.min(safe.spreadLo ?? -1, safe.width ?? 1);
  const hi = Math.max(safe.spreadLo ?? -1, safe.width ?? 1);
  const halfW = (hi - lo) / 2;
  const center = (lo + hi) / 2;
  const onRange = ([nl, nh]) => {
    const nc = (nl + nh) / 2;
    onChange?.({ ...safe, spreadLo: nl, width: nh, split: true, direction: Math.max(-180, Math.min(180, nc * 60)) });
  };
  const onDirection = (deg) => {
    const nc = Math.max(-3 + halfW, Math.min(3 - halfW, deg / 60));
    onChange?.({ ...safe, direction: nc * 60, spreadLo: nc - halfW, width: nc + halfW });
  };

  const seg = (active, onClick, label) => (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${active ? 'bg-teal-500 text-black' : 'bg-black/40 text-white/55 hover:text-white'}`}
    >{label}</button>
  );

  return (
    <div>
      <div data-fx="stereoImager" className="p-4 pb-5 rounded-xl h-[470px] flex flex-col bg-gradient-to-br from-teal-950/40 to-black/60 border border-teal-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/20"><Scaling className="w-4 h-4 text-teal-300" /></div>
            <span className={`text-sm font-medium transition-all ${safe.enabled ? 'text-teal-300 drop-shadow-[0_0_8px_rgba(94,234,212,0.8)]' : 'text-white/80'}`}>Stereo Imager</span>
            <span className="ml-1 rounded border border-teal-500/30 px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider text-teal-300/80">Direction Mixer</span>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="stereoimager" accent={ACCENT} />
            <button onClick={() => set('enabled', !safe.enabled)} className="sc-power-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all" style={safe.enabled ? { background: ACCENT, borderColor: ACCENT, color: '#04240f', boxShadow: '0 0 10px rgba(94,234,212,0.5)' } : { background: 'var(--sc-off-bg, rgba(255,255,255,0.05))', borderColor: 'var(--sc-off-border, rgba(255,255,255,0.1))', color: 'var(--sc-off-text, rgba(255,255,255,0.5))' }}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-5 px-1 items-start">
          {/* Goniometer / correlation — square, top-aligned with the controls */}
          <div className="flex flex-col gap-2 min-h-0 px-2">
            <div className="aspect-square w-full max-w-[260px] mx-auto">
              <Goniometer leftAnalyser={analyzers?.imagerLeft} rightAnalyser={analyzers?.imagerRight} accent={ACCENT} />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-white/40 mx-auto w-full max-w-[260px]">
              <span>+1 · mono</span><span>correlation</span><span>-1 · out-of-phase</span>
            </div>
          </div>

          {/* Direction Mixer controls */}
          <div className="flex flex-col gap-2.5 min-h-0 px-2">
            {/* source settings row */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-white/50 uppercase tracking-wider">Input</span>
                <div className="flex overflow-hidden rounded-md border border-white/15">{seg(!inputMs, () => set('inputMs', false), 'LR')}{seg(inputMs, () => set('inputMs', true), 'MS')}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-white/50 uppercase tracking-wider">Xover</span>
                <span className="text-[11px] font-mono text-teal-300">{Math.round(safe.crossover)} Hz</span>
              </div>
            </div>

            {/* crossover dial (log) */}
            <div className="flex justify-center">
              <Dial value={safe.crossover} onChange={(v) => set('crossover', v)} defaultValue={DEFAULT_STEREO_IMAGER.crossover} min={20} max={2000} step={1} scale="log" label="Crossover" unit="Hz" size="small" accent={ACCENT} />
            </div>

            {/* Direction — own row, centred above the Spread lane */}
            <div className="flex justify-center">
              <Dial value={safe.direction} onChange={onDirection} defaultValue={DEFAULT_STEREO_IMAGER.direction} min={-180} max={180} step={1} label="Direction" unit="°" size="medium" accent={ACCENT} bipolar />
            </div>

            {/* Spread — full-width lane */}
            <div className="flex flex-col gap-1.5 px-1">
              <div className="flex justify-between text-[10px]"><span className="text-white/50">Spread</span><span className="text-teal-300 font-mono">{lo >= 0 ? '+' : ''}{lo.toFixed(2)} … {hi >= 0 ? '+' : ''}{hi.toFixed(2)}</span></div>
              <SpreadRange value={[lo, hi]} onChange={onRange} min={-3} max={3} step={0.01} center={0} accent={ACCENT} defaultValue={[-1, 1]} />
              <div className="flex justify-between text-[8px] font-mono text-white/40">
                <span>-3</span><span>0</span><span>+3</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono text-white/30">
                <span>wide</span><span>mono</span><span>wide</span>
              </div>
            </div>

            {/* Spread legend — width + centre (the Direction) */}
            <div className="flex items-center justify-center gap-3 border-t border-white/10 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50">Width</span>
                <span className="text-[11px] font-mono text-teal-300">{halfW.toFixed(2)}×</span>
              </div>
              <span className="text-white/20">·</span>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50">Centre (Direction)</span>
                <span className="text-[11px] font-mono text-teal-300">{center >= 0 ? '+' : ''}{center.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-center pt-1">
              <Dial value={Math.round(safe.mix ?? 100)} onChange={(v) => set('mix', v)} defaultValue={100} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent={ACCENT} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}