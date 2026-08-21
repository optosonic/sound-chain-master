import React, { useEffect, useRef, useState } from 'react';
import { Power, Boxes } from 'lucide-react';
import Dial from './Dial';
import InfoButton from './InfoButton';
import { densityFullTransfer, airResponseDb } from '../analogueDensityModel.js';
import VacuumTube from './VacuumTube';

const ACCENT = '#6fb1e0';   // HG-2 blue LED identity

// ── Small HG-2-style sub-controls ───────────────────────────────────────
function LedButton({ active, label, onClick, color = ACCENT, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`group flex flex-col items-center gap-1 transition-all`}
    >
      <span
        className="grid h-7 w-7 place-items-center rounded-full border-2 transition-all"
        style={{
          borderColor: active ? color : 'rgba(180,190,205,0.45)',
          background: active
            ? `radial-gradient(circle at 50% 45%, ${color}, ${color}55 60%, #0a0f15)`
            : 'radial-gradient(circle at 50% 45%, #2a3038, #0a0f15)',
          boxShadow: active
            ? `0 0 12px ${color}, inset 0 0 6px ${color}aa`
            : 'inset 0 1px 1px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: active ? '#fff' : '#3a4048', boxShadow: active ? `0 0 6px #fff` : 'none' }}
        />
      </span>
      <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-white/45'}`}>{label}</span>
    </button>
  );
}

function SatFreqSwitch({ value, onChange }) {
  const opts = ['low', 'flat', 'high'];
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-white/55">Sat. Freq</span>
      <div className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-md border px-2.5 py-1.5 text-[8px] font-mono font-bold uppercase transition-all ${
              value === o
                ? 'border-sky-300 bg-white/90 text-black'
                : 'border-white/20 bg-black/50 text-white/50 hover:text-white/80'
            }`}
          >
            {o === 'low' ? 'Low' : o === 'flat' ? 'Flat' : 'High'}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeSwitch({ value, onChange }) {
  const opts = ['stereo', 'ms'];
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-white/55">Mode</span>
      <div className="flex overflow-hidden rounded-md border border-white/20 bg-black/50">
        {opts.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-1.5 py-1 text-[8px] font-mono font-bold uppercase transition-all ${
              value === o ? 'bg-white/90 text-black' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {o === 'stereo' ? 'Stereo' : 'M/S'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Realistic vacuum-tube rendering lives in ./VacuumTube.jsx ──

// ── Dotted LED meter ───────────────────────────────────────────────────
// Discrete circular LEDs on a matte-grey plate, each lit dot a white-hot
// core wrapped in a layered bloom — vintage hardware indicator look.
function LedMeter({ getLevel, mode, active = true }) {
  const [seg, setSeg] = useState(0);
  const valRef = useRef(-60);
  const rafRef = useRef(0);
  useEffect(() => {
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      // Module off → meters stay dark.
      if (!active) { valRef.current = -60; setSeg(0); rafRef.current = requestAnimationFrame(tick); return; }
      const db = getLevel();
      const rising = db > valRef.current;
      const attack = mode === 'ppm' ? 0.003 : 0.025;
      const release = mode === 'ppm' ? 0.55 : 0.32;
      const a = 1 - Math.exp(-dt / (rising ? attack : release));
      valRef.current += (db - valRef.current) * a;
      const pct = Math.max(0, Math.min(1, (valRef.current + 60) / 60));
      setSeg(pct);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [getLevel, mode, active]);

  const DOTS = 12;
  const lit = seg * DOTS;
  return (
    <div
      className="flex h-5 w-full items-center overflow-hidden rounded-md px-1.5 py-1"
      style={{ background: '#0a0b0d', border: '1px solid #1e1f22', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.9)' }}
    >
      <div className="flex w-full items-center justify-between gap-0.5">
        {Array.from({ length: DOTS }).map((_, i) => {
          const on = i < lit;
          // Green base, two yellow warning LEDs, red peak (last LED).
          const isRed = i === DOTS - 1;
          const color = isRed ? '#ff0d0d' : i >= DOTS - 3 ? '#ffd11a' : '#3dfb6b';
          // Red LED uses a red-tinted core (not white) so it reads as a rich
          // true red instead of a washed pink hotspot.
          const core = isRed ? '#ff6a6a' : '#ffffff';
          const coreStop = isRed ? '32%' : '52%';
          const inset = isRed ? '#ff9a9a' : '#fff';
          return (
            <span key={i} className="flex flex-1 items-center justify-center">
              <span
                className="rounded-full"
                style={{
                  width: '100%',
                  maxWidth: 6.4,
                  aspectRatio: '1 / 1',
                  background: on
                    ? `radial-gradient(circle at 50% 42%, ${core}, ${color} ${coreStop}, ${color})`
                    : 'rgba(255,255,255,0.05)',
                  boxShadow: on
                    ? `0 0 5px ${color}, 0 0 10px ${color}, 0 0 14px ${color}, inset 0 0 2px ${inset}`
                    : 'inset 0 0 2px rgba(0,0,0,0.6)',
                  opacity: on ? 1 : 0.4,
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Air frequency response mini-plot ──────────────────────────────────
function AirPlot({ airAmount, calibration, active }) {
  const W = 150, H = 56;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const f = 20 * Math.pow(1000, i / 60); // 20 Hz .. 20 kHz (log)
    const db = active ? airResponseDb(f, airAmount, calibration) : 0;
    const x = (i / 60) * W;
    const y = H - ((db + 5) / 10) * H;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={pts.join(' ')} fill="none" stroke={ACCENT} strokeWidth="1.4" style={{ filter: `drop-shadow(0 0 3px ${ACCENT}88)` }} />
    </svg>
  );
}

export default function AnalogueDensityPanel({ density, onChange, analyzers }) {
  const s = {
    enabled: false, bypass: false,
    inputGain: 0, density: 0,
    saturation: 0, satFreq: 'flat', satIn: true, altTube: false,
    pentode: 0, triode: 0,
    air: false, airAmount: 0,
    output: 5, calibration: 'normal', mix: 20,
    msMode: false, midDensity: 0, sideDensity: 0,
    ...(density || {}),
  };
  const set = (k, v) => onChange?.({ ...s, [k]: v });

  const al = analyzers?.levelLeft, ar = analyzers?.levelRight;
  const lvl = (a) => () => {
    if (!a) return -60;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let p = 0;
    for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; }
    return p > 1e-5 ? 20 * Math.log10(p) : -60;
  };
  const [meterMode, setMeterMode] = useState('vu');

  // Transfer curve for the panel plot (pentode → triode → transformers).
  const curvePts = (() => {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const x = -1 + (i / 120) * 2;
      const y = densityFullTransfer({ pentode: s.pentode / 10, triode: s.triode / 10, density: s.density / 100 }, x);
      pts.push(`${((x + 1) / 2 * 140).toFixed(1)},${((1 - (y + 1) / 2) * 90).toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  return (
    <div className="h-full">
      <div
        data-fx="analogueDensity"
        className="flex h-full flex-col overflow-hidden rounded-xl border border-white/15 p-3"
        style={{
          background:
            'linear-gradient(165deg, #1a1d22 0%, #121418 50%, #0a0c10 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-sky-400/40 bg-sky-500/15">
              <Boxes className="h-3.5 w-3.5 text-sky-300" />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-bold tracking-[0.16em] text-white">
                ANALOGUE <span className="text-sky-300">DENSITY</span>
              </div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-white/40">
                Black Box · Tube Density Engine
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="analogueDensity" accent={ACCENT} />
            <button
              onClick={() => set('enabled', !s.enabled)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all ${
                s.enabled
                  ? 'border-sky-400 bg-sky-500/80 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                  : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{s.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* ── Main 3-column body ── */}
        <div className="mt-4 flex flex-1 min-h-0 gap-2">
          {/* LEFT — sat freq, mode, saturation */}
          <div className="flex w-40 shrink-0 flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <SatFreqSwitch value={s.satFreq} onChange={(v) => set('satFreq', v)} />
            <ModeSwitch value={s.msMode ? 'ms' : 'stereo'} onChange={(v) => set('msMode', v === 'ms')} />
            <Dial value={s.saturation} onChange={(v) => set('saturation', v)} min={0} max={10} step={0.1} label="Saturation" size="large" accent={ACCENT} />
          </div>

          {/* CENTER — tubes + meters */}
          <div className="flex flex-1 min-w-0 flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="flex flex-1 min-h-0 gap-2">
              <VacuumTube type="12AX7" drive={s.saturation / 10} on={s.enabled && s.satIn} alt={s.altTube} analyzer={al} label="12AX7" />
              <VacuumTube type="6U8A" drive={Math.max(s.pentode, s.saturation) / 10} on={s.enabled} analyzer={al} label="6U8A · P" />
              <VacuumTube type="6U8A" drive={Math.max(s.triode, s.saturation) / 10} alt={s.altTube} on={s.enabled} analyzer={ar} label="6U8A · T" />
            </div>
            <div className="flex shrink-0 items-center justify-center">
              <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-white/30">12AX7 · 6U8A Pentode + Triode</span>
            </div>
            {/* footer brand */}
            <div className="shrink-0 text-center">
              <span className="text-[10px] font-black tracking-[0.18em] text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]">Analogue Design</span>
            </div>
          </div>

          {/* RIGHT — pentode, triode, air, output */}
          <div className="flex w-40 shrink-0 flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex w-full justify-around">
              <Dial value={s.pentode} onChange={(v) => set('pentode', v)} min={0} max={10} step={0.1} label="Pentode" size="medium" accent={ACCENT} />
              <Dial value={s.triode} onChange={(v) => set('triode', v)} min={0} max={10} step={0.1} label="Triode" size="medium" accent={ACCENT} />
            </div>
            <div className="flex w-full items-center justify-center gap-2">
              <LedButton active={s.enabled && s.air} label="Air" onClick={() => set('air', !s.air)} title="Air circuit on/off" />
              <Dial value={s.airAmount} onChange={(v) => set('airAmount', v)} min={0} max={10} step={0.1} label="Air Amt" size="small" accent={ACCENT} />
            </div>
            <AirPlot airAmount={s.airAmount} calibration={s.calibration} active={s.enabled && s.air} />
            <div className="mt-auto flex w-full flex-col items-center gap-1.5">
              <Dial value={s.output} onChange={(v) => set('output', v)} min={0} max={10} step={0.1} label="Output" size="small" accent={ACCENT} />
            </div>
          </div>
        </div>

        {/* ── Digital extras: input gain, density, calibration, mix ── */}
        <div className="mt-3 shrink-0 rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="flex items-center gap-3">
            {/* Transfer plot */}
            <div className="shrink-0 rounded border border-white/10 bg-black/50 p-1">
              <svg viewBox="0 0 140 90" width="84" height="54">
                <line x1="0" y1="45" x2="140" y2="45" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                <line x1="70" y1="0" x2="70" y2="90" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                <line x1="0" y1="0" x2="140" y2="90" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="2,2" />
                <polyline points={curvePts} fill="none" stroke={ACCENT} strokeWidth="1.4" style={{ filter: `drop-shadow(0 0 3px ${ACCENT}88)` }} />
              </svg>
            </div>
            <Dial value={s.inputGain} onChange={(v) => set('inputGain', v)} min={-12} max={12} step={0.1} label="Input" unit="dB" size="small" accent={ACCENT} />
            {s.msMode ? (
              <>
                <Dial value={s.midDensity} onChange={(v) => set('midDensity', v)} min={-100} max={100} step={1} label="Mid Dens" unit="%" size="small" accent="#ffd24a" bipolar defaultValue={0} />
                <Dial value={s.sideDensity} onChange={(v) => set('sideDensity', v)} min={-100} max={100} step={1} label="Side Dens" unit="%" size="small" accent="#6fb1e0" bipolar defaultValue={0} />
              </>
            ) : (
              <>
                <Dial value={s.density} onChange={(v) => set('density', v)} min={-100} max={100} step={1} label="Density" unit="%" size="large" accent="#ffd24a" bipolar defaultValue={0} />
                <div className="flex flex-col items-center opacity-25 pointer-events-none select-none" aria-disabled="true">
                  <Dial value={0} onChange={() => {}} min={-100} max={100} step={1} label="Side Dens" unit="%" size="small" accent="#6fb1e0" bipolar defaultValue={0} />
                </div>
              </>
            )}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-white/55">Calibration</span>
              <div className="flex overflow-hidden rounded border border-white/20">
                {['dark', 'normal', 'bright'].map((c) => (
                  <button
                    key={c}
                    onClick={() => set('calibration', c)}
                    className={`px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase transition-all ${
                      s.calibration === c ? 'bg-white/90 text-black' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {c.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <Dial value={s.mix} onChange={(v) => set('mix', v)} min={0} max={100} step={1} label="Mix" unit="%" size="large" accent={ACCENT} />
            {/* Saturation buttons — middle */}
            <div className="flex shrink-0 flex-col justify-center gap-3">
              <LedButton active={s.enabled && s.satIn} label="In/Out" onClick={() => set('satIn', !s.satIn)} title="Saturation path in/out" />
              <LedButton active={s.enabled && s.altTube} label="Alt Tube" onClick={() => set('altTube', !s.altTube)} color="#9ad8ff" title="Alternate (more aggressive) tube" />
            </div>
            {/* Meter — pushed right, shrinks to fit so it never overflows */}
            <div className="ml-auto flex w-[280px] min-w-[180px] shrink flex-col gap-1">
              <div className="flex overflow-hidden rounded border border-white/20 self-start">
                {['vu', 'ppm'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMeterMode(m)}
                    className={`px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase transition-all ${
                      meterMode === m ? 'bg-white/90 text-black' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {/* dB unit scale above the meters */}
              <div className="flex justify-between px-2 font-mono text-[7px] font-bold tracking-wider text-white/40">
                <span>-60</span><span>-40</span><span>-20</span><span>-12</span><span>-6</span><span>-3</span><span>0</span>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                <LedMeter getLevel={lvl(al)} mode={meterMode} active={s.enabled} />
                <LedMeter getLevel={lvl(ar)} mode={meterMode} active={s.enabled} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}