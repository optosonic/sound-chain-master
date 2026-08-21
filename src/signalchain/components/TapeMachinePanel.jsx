import React from 'react';
import { Disc3, Power, RotateCcw } from 'lucide-react';
import Dial from './Dial';
import TapeReels from './TapeReels';
import { Image } from '@/components/ui/image';
import { DEFAULT_TAPE, TAPE_PRESETS, applyTapePreset } from '../tapeModel.js';
import InfoButton from './InfoButton';

const AMBER = '#e8a06a';

// AI-generated studio photos of each tape machine — shown behind the reel
// visualizer and swapped when the preset changes. The 30 ips variant reuses the
// base Studer A800 shot (same deck, higher speed).
const PRESET_IMAGE = {
  studera800:    'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/ad742183d_generated_image.png',
  ampexatr102:   'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/d04fce5de_generated_image.png',
  studera810:    'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/75bd52ce8_generated_image.png',
  otarimtr90:    'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/d0433ce3e_generated_image.png',
  mmm79:         'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/c94e01cec_generated_image.png',
  nagraivs:      'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/8fce4b674_generated_image.png',
  tascammsr:     'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/3fb54f2c8_generated_image.png',
  studera800_30: 'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/ad742183d_generated_image.png',
};

/**
 * Tape Machine — analog 2-track tape simulation panel.
 * Animated reel visualizer + preset machines (Studer, Ampex, Otari, Nagra…),
 * tape-speed selector, and the full analog control set: drive, saturation,
 * bias, hysteresis, wow, flutter, noise, head bump, HF loss, mix, I/O gain.
 *
 * Props:
 *  - tape: DEFAULT_TAPE-shaped state
 *  - onChange(next)
 */
export default function TapeMachinePanel({ tape, onChange }) {
  const c = { ...DEFAULT_TAPE, ...(tape || {}) };
  const set = (k, v) => onChange({ ...c, [k]: v });

  const resetDsp = () =>
    onChange({
      ...c,
      drive: DEFAULT_TAPE.drive, saturation: DEFAULT_TAPE.saturation, bias: DEFAULT_TAPE.bias,
      hysteresis: DEFAULT_TAPE.hysteresis, wow: DEFAULT_TAPE.wow, flutter: DEFAULT_TAPE.flutter,
      noise: DEFAULT_TAPE.noise, headBump: DEFAULT_TAPE.headBump, hfLoss: DEFAULT_TAPE.hfLoss,
    });

  return (
    <div>
      <div data-fx="tape" className="p-4 pb-5 rounded-xl bg-gradient-to-br from-amber-950/25 to-black/60 border h-[470px] flex flex-col" style={{ borderColor: AMBER + '55' }}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: AMBER + '22' }}><Disc3 className="w-4 h-4" style={{ color: AMBER }} /></div>
            <span className={`text-sm font-medium ${c.enabled ? 'drop-shadow-[0_0_8px_rgba(232,160,106,0.8)]' : 'text-white/80'}`} style={c.enabled ? { color: AMBER } : undefined}>Tape Machine</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetDsp} className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all text-[10px]"><RotateCcw className="w-3 h-3" /></button>
            <InfoButton panelId="tape" accent={AMBER} />
            <button
              onClick={() => set('enabled', !c.enabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${c.enabled ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{c.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* animated reel visualizer — deck photo swaps with the selected preset;
            preset + speed live in an overlay so the header stays a single row */}
        <div className="relative rounded-lg border px-2 py-1 mb-2 overflow-hidden flex-1 min-h-0" style={{ borderColor: AMBER + '33', background: 'var(--tape-canvas-bg, #0a0805)' }}>
          <Image key={c.preset} src={PRESET_IMAGE[c.preset] || PRESET_IMAGE.studera800} fittingType="fill" alt={TAPE_PRESETS[c.preset]?.label || ''} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity duration-500" />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--tape-canvas-grad, linear-gradient(180deg, rgba(10,8,5,0.55), rgba(10,8,5,0.78)))' }} />
          <div className="absolute top-1 left-2 z-10 flex items-center gap-1.5">
            <select
              value={c.preset}
              onChange={(e) => onChange(applyTapePreset(c, e.target.value))}
              className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              style={{ borderColor: AMBER + '55', borderWidth: 1 }}
            >
              {Object.entries(TAPE_PRESETS).map(([k, p]) => (
                <option key={k} value={k} className="bg-[#0b1220]">{p.label}</option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded border" style={{ borderColor: AMBER + '55' }}>
              {[7.5, 15, 30].map((s) => (
                <button
                  key={s}
                  onClick={() => set('speed', s)}
                  className="px-1.5 py-0.5 text-[9px] font-mono"
                  style={c.speed === s ? { background: AMBER, color: '#1a0f00' } : { background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.6)' }}
                >{s}</button>
              ))}
            </div>
            <span className="text-[9px] text-white/50 font-mono">ips</span>
          </div>
          <div className="relative h-full">
            <TapeReels speed={c.speed} wow={c.wow} enabled={c.enabled} accent={AMBER} />
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 shrink-0 mt-auto">
          <Dial value={c.inputGain} onChange={(v) => set('inputGain', v)} defaultValue={DEFAULT_TAPE.inputGain} min={-30} max={30} step={0.1} label="Input" unit="dB" size="small" accent={AMBER} />
          <Dial value={c.drive} onChange={(v) => set('drive', v)} defaultValue={DEFAULT_TAPE.drive} min={0} max={1} step={0.01} label="Drive" size="small" accent={AMBER} />
          <Dial value={c.saturation} onChange={(v) => set('saturation', v)} defaultValue={DEFAULT_TAPE.saturation} min={0} max={1} step={0.01} label="Satur" size="small" accent={AMBER} />
          <Dial value={c.bias} onChange={(v) => set('bias', v)} defaultValue={DEFAULT_TAPE.bias} min={0} max={1} step={0.01} label="Bias" size="small" accent={AMBER} />
          <Dial value={c.hysteresis} onChange={(v) => set('hysteresis', v)} defaultValue={DEFAULT_TAPE.hysteresis} min={0} max={1} step={0.01} label="Hyster" size="small" accent={AMBER} />
          <Dial value={c.wow} onChange={(v) => set('wow', v)} defaultValue={DEFAULT_TAPE.wow} min={0} max={1} step={0.01} label="Wow" size="small" accent={AMBER} />
          <Dial value={c.flutter} onChange={(v) => set('flutter', v)} defaultValue={DEFAULT_TAPE.flutter} min={0} max={1} step={0.01} label="Flutter" size="small" accent={AMBER} />
          <Dial value={c.noise} onChange={(v) => set('noise', v)} defaultValue={DEFAULT_TAPE.noise} min={0} max={1} step={0.01} label="Noise" size="small" accent={AMBER} />
          <Dial value={c.headBump} onChange={(v) => set('headBump', v)} defaultValue={DEFAULT_TAPE.headBump} min={0} max={1} step={0.01} label="Head Bump" size="small" accent={AMBER} />
          <Dial value={c.hfLoss} onChange={(v) => set('hfLoss', v)} defaultValue={DEFAULT_TAPE.hfLoss} min={0} max={1} step={0.01} label="HF Loss" size="small" accent={AMBER} />
          <Dial value={Math.round(c.mix * 100)} onChange={(v) => set('mix', v / 100)} defaultValue={Math.round(DEFAULT_TAPE.mix * 100)} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent={AMBER} />
          <Dial value={c.outputGain} onChange={(v) => set('outputGain', v)} defaultValue={DEFAULT_TAPE.outputGain} min={-30} max={30} step={0.1} label="Output" unit="dB" size="small" accent={AMBER} />
        </div>
      </div>
    </div>
  );
}