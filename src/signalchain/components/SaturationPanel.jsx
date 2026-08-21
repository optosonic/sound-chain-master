import React from 'react';
import { Slider } from './ui/slider';
import { Flame, Power } from 'lucide-react';
import { satTransfer } from '../satModel.js';
import InfoButton from './InfoButton';

/**
 * Saturation: controlled harmonic distortion for warmth / punch / loudness.
 * Emulates Tube, Tape, Transistor, Opto and a Clean blend via a WaveShaper curve.
 * The graph plots the *true* transfer characteristic for the selected character
 * (shared with the DSP model in satModel.js), so what you see is what you hear.
 */
const MODES = [
  { id: 'tube', label: 'Tube' },
  { id: 'tape', label: 'Tape' },
  { id: 'transistor', label: 'Trans' },
  { id: 'opto', label: 'Opto' },
  { id: 'clean', label: 'Clean' },
];

// Plot geometry (SVG user units).
const PLOT = { L: 33, R: 267, T: 31, B: 265 };
const TICKS = [-1, -0.5, 0, 0.5, 1];
const DEF = { drive: 0.4, grit: 0, mix: 0.5, tone: 12000, output: 1 };

export default function SaturationPanel({ saturation, onSaturationChange, layout = 'wide' }) {
  const s = {
    enabled: false,
    mode: 'tube',
    drive: 0.4,
    grit: 0,
    mix: 0.5,
    tone: 12000,
    output: 1,
    ...saturation,
  };
  const set = (k, v) => onSaturationChange({ ...s, [k]: v });

  const W = PLOT.R - PLOT.L;
  const H = PLOT.B - PLOT.T;
  const mx = (x) => PLOT.L + ((x + 1) / 2) * W;
  const my = (y) => PLOT.B - ((y + 1) / 2) * H;

  // Stable pseudo-random in [-1,1) — gives an organic, non-perfect curve that
  // represents the noise modulation the DSP actually injects (grit).
  const noiseAt = (i) => {
    const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };

  const curvePoints = () => {
    const pts = [];
    const g = s.grit || 0;
    for (let i = 0; i <= 140; i++) {
      const x = -1 + (i / 140) * 2;
      let y = satTransfer(s.mode, s.drive, x);
      if (g > 0) {
        const amp = g * 0.11 * (0.4 + 0.6 * s.drive) * (0.5 + 0.5 * Math.abs(x));
        y += amp * noiseAt(i);
      }
      pts.push(`${mx(x).toFixed(1)},${my(y).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const activeMode = MODES.find((m) => m.id === s.mode) || MODES[0];

  return (
    <div className="h-full">
      <div data-fx="saturation" className="p-4 pb-5 rounded-xl h-full flex flex-col bg-gradient-to-br from-orange-950/30 to-black/60 border border-orange-500/30">
        <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20">
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <span
            className={`text-sm font-medium transition-all ${
              s.enabled
                ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]'
                : 'text-white/80'
            }`}
          >
            Saturation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton panelId="saturation" accent="#fb923c" />
          <button
            onClick={() => set('enabled', !s.enabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
              s.enabled
                ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_10px_rgba(251,146,60,0.5)]'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase w-5 text-center">
              {s.enabled ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-2">
        <div className="grid grid-cols-5 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => set('mode', m.id)}
                className={`py-1.5 text-[10px] rounded transition-all ${
                  s.mode === m.id
                    ? 'bg-orange-500 text-white shadow-[0_0_8px_rgba(251,146,60,0.5)]'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
              >
                {m.label}
              </button>
            ))}
        </div>

        <div className={`flex-1 min-h-0 flex gap-4 ${layout === 'narrow' ? 'flex-col' : 'flex-row'}`}>
          {/* Transfer characteristic — engineering plot (square 1:1) */}
          <div className={`relative overflow-hidden rounded-lg border border-orange-500/25 bg-black/60 shadow-[inset_0_0_18px_rgba(251,146,60,0.08)] ${layout === 'narrow' ? 'w-full aspect-square' : 'w-[320px] shrink-0 aspect-square self-start'}`}>
            <div className="pointer-events-none absolute left-2 right-2 top-1.5 z-10 flex items-center justify-between">
              <span className="text-[8px] font-mono uppercase tracking-widest text-orange-200">
                Transfer Characteristic
              </span>
              <span className="text-[8px] font-mono text-orange-200">{activeMode.label}</span>
            </div>
            <svg viewBox="0 0 300 300" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="satGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="satFill" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(251,146,60,0.14)" />
                  <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                </linearGradient>
              </defs>

              {/* Grid */}
              {TICKS.map((t, i) => (
                <line key={`vg${i}`} x1={mx(t)} y1={PLOT.T} x2={mx(t)} y2={PLOT.B}
                  stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
              ))}
              {TICKS.map((t, i) => (
                <line key={`hg${i}`} x1={PLOT.L} y1={my(t)} x2={PLOT.R} y2={my(t)}
                  stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
              ))}

              {/* Axes */}
              <line x1={PLOT.L} y1={PLOT.T} x2={PLOT.L} y2={PLOT.B} stroke="rgba(251,146,60,0.85)" strokeWidth="0.8" />
              <line x1={PLOT.L} y1={PLOT.B} x2={PLOT.R} y2={PLOT.B} stroke="rgba(251,146,60,0.85)" strokeWidth="0.8" />

              {/* Zero lines */}
              <line x1={mx(0)} y1={PLOT.T} x2={mx(0)} y2={PLOT.B} stroke="rgba(255,255,255,0.30)" strokeWidth="0.4" />
              <line x1={PLOT.L} y1={my(0)} x2={PLOT.R} y2={my(0)} stroke="rgba(255,255,255,0.30)" strokeWidth="0.4" />

              {/* Unity (linear) reference */}
              <line x1={mx(-1)} y1={my(-1)} x2={mx(1)} y2={my(1)}
                stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeDasharray="3,3" />

              {/* Tick labels */}
              {TICKS.map((t, i) => (
                <text key={`xl${i}`} x={mx(t)} y={PLOT.B + 9} textAnchor="middle"
                  className="fill-slate-300" style={{ fontSize: 6, fontFamily: 'monospace' }}>
                  {t.toFixed(1)}
                </text>
              ))}
              {TICKS.map((t, i) => (
                <text key={`yl${i}`} x={PLOT.L - 5} y={my(t) + 2} textAnchor="end"
                  className="fill-slate-300" style={{ fontSize: 6, fontFamily: 'monospace' }}>
                  {t.toFixed(1)}
                </text>
              ))}

              {/* Axis titles */}
              <text x={(PLOT.L + PLOT.R) / 2} y={300 - 14} textAnchor="middle"
                className="fill-slate-200" style={{ fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }}>
                INPUT
              </text>
              <text x={14} y={(PLOT.T + PLOT.B) / 2} textAnchor="middle"
                className="fill-slate-200" style={{ fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }}
                transform={`rotate(-90 14 ${(PLOT.T + PLOT.B) / 2})`}>
                OUTPUT
              </text>

              {/* Curve area fill */}
              <polygon
                points={`${mx(-1)},${my(0)} ${curvePoints()} ${mx(1)},${my(0)}`}
                fill="url(#satFill)"
              />
              {/* Curve glow + line */}
              <polyline points={curvePoints()} fill="none" stroke="rgba(245,130,51,0.55)"
                strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#satGlow)" />
              <polyline points={curvePoints()} fill="none" stroke="#f58233"
                strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>

        {/* Sliders — stretch to the graph height, even distribution with margins */}
        <div className={`flex flex-col justify-evenly ${layout === 'narrow' ? 'w-full' : 'flex-1 h-[320px]'}`}>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/60">Drive</span>
              <span className="text-orange-400 font-mono">{Math.round(s.drive * 100)}%</span>
            </div>
            <Slider
              value={[s.drive]}
              onValueChange={([v]) => set('drive', v)} defaultValue={DEF.drive}
              min={0}
              max={1}
              step={0.01}
              className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/60">Grit</span>
              <span className="text-orange-400 font-mono">{Math.round((s.grit || 0) * 100)}%</span>
            </div>
            <Slider
              value={[s.grit || 0]}
              onValueChange={([v]) => set('grit', v)} defaultValue={DEF.grit}
              min={0}
              max={1}
              step={0.01}
              className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/60">Mix</span>
              <span className="text-orange-400 font-mono">{Math.round(s.mix * 100)}%</span>
            </div>
            <Slider
              value={[s.mix]}
              onValueChange={([v]) => set('mix', v)} defaultValue={DEF.mix}
              min={0}
              max={1}
              step={0.01}
              className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/60">Tone</span>
              <span className="text-orange-400 font-mono">{(s.tone / 1000).toFixed(1)} kHz</span>
            </div>
            <Slider
              value={[s.tone]}
              onValueChange={([v]) => set('tone', v)} defaultValue={DEF.tone}
              min={2000}
              max={20000}
              step={100}
              className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/60">Output</span>
              <span className="text-orange-400 font-mono">{s.output.toFixed(2)}×</span>
            </div>
            <Slider
              value={[s.output]}
              onValueChange={([v]) => set('output', v)} defaultValue={DEF.output}
              min={0}
              max={2}
              step={0.01}
              className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
            />
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}