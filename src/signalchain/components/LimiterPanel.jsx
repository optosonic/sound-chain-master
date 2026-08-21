import React, { memo, useEffect, useRef, useState } from 'react';
import { Scissors, Power } from 'lucide-react';
import Dial from './Dial';
import InfoButton from './InfoButton';
import LedMeter from './LedMeter';
import LimiterIOFader from './LimiterIOFader';
import LimiterLufs from './LimiterLufs';
import GrHistory from './GrHistory';

const ACCENT = '#A33D52';

const STYLES = [
{ key: 'transparent', label: 'Transparent' },
{ key: 'punchy', label: 'Punchy' },
{ key: 'modern', label: 'Modern' },
{ key: 'warm', label: 'Warm' },
{ key: 'classical', label: 'Classical' }];

// Style = macro: each style loads a preset of the seven dials (+ release mode)
// so picking a style visibly moves the knobs. Values chosen to characterise the
// named sound — the user can still tweak any dial afterwards.
const STYLE_PRESETS = {
  transparent: { inputGain: 0, ceiling: -1.0, release: 0.12, releaseMode: 'auto', lookahead: 1, stereoLink: 100, mix: 100, outputGain: 0 },
  punchy:      { inputGain: 2.0, ceiling: -0.3, release: 0.05, releaseMode: 'manual', lookahead: 2, stereoLink: 100, mix: 100, outputGain: 0 },
  modern:      { inputGain: 3.0, ceiling: -0.5, release: 0.08, releaseMode: 'auto', lookahead: 3, stereoLink: 100, mix: 100, outputGain: 0 },
  warm:        { inputGain: 0, ceiling: -1.5, release: 0.18, releaseMode: 'manual', lookahead: 1, stereoLink: 100, mix: 88, outputGain: 0 },
  classical:   { inputGain: 0, ceiling: -2.0, release: 0.25, releaseMode: 'manual', lookahead: 0.5, stereoLink: 100, mix: 100, outputGain: 0 }
};


const SCALES = {
  '24': { top: 0, bottom: -24, label: '24' },
  '32': { top: 0, bottom: -32, label: '32' },
  '48': { top: 0, bottom: -48, label: '48' },
  k12: { top: 0, bottom: -12, label: 'K-12' },
  k14: { top: 0, bottom: -14, label: 'K-14' },
  k20: { top: 0, bottom: -20, label: 'K-20' }
};

const DEFAULT_LIMITER = {
  enabled: true, ceiling: -0.1, release: 0.05, releaseMode: 'manual', attack: 0,
  lookahead: 0, stereoLink: 100, style: 'transparent', truePeak: false,
  oversampling: 1, mix: 100, dither: 'off', dcBlocker: true, noiseShape: 'none',
  msMode: false, releaseShape: 'exp', scale: '24',
  inputGain: 0, outputGain: 0
};

// Inter-sample peak estimate via cubic-Hermite interpolation between
// consecutive samples — the reconstructed analog peak can overshoot the sample
// peaks, which is exactly what a true-peak meter must catch.
function truePeakOf(buf) {
  let max = 0;
  const n = buf.length;
  for (let i = 0; i < n; i++) {
    const y1 = buf[i];
    let a = Math.abs(y1);if (a > max) max = a;
    if (i < n - 1) {
      const y0 = i > 0 ? buf[i - 1] : y1;
      const y2 = buf[i + 1];
      const y3 = i < n - 2 ? buf[i + 2] : y2;
      const c1 = 0.5 * (y2 - y0);
      const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
      const c3 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
      const t = 0.5;
      const v = ((c3 * t + c2) * t + c1) * t + y1;
      a = Math.abs(v);if (a > max) max = a;
    }
  }
  return max;
}
function peakDbOf(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {const a = Math.abs(buf[i]);if (a > p) p = a;}
  return p > 1e-6 ? 20 * Math.log10(p) : -120;
}
function meanSquareOf(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return s / Math.max(1, buf.length);
}

/**
 * Brickwall Limiter — pro panel: dual L/R LED meters for IN and OUT, gain-
 * reduction meter, true-peak + LUFS-M readouts, and the full control set
 * (ceiling, release/auto, lookahead, stereo link, style, oversampling,
 * true-peak, mix, dither, meter scale).
 *
 * Props:
 *  - limiter   : the limiter state object
 *  - onChange(next)
 *  - analyzers : engine analyzers (reads limiterIn/Out Left/Right stereo taps)
 *  - node      : the linked DynamicsCompressorNode (fallback GR via .reduction)
 *  - getGR     : () => dB of gain reduction (linked or dual-mono aware)
 */
export default function LimiterPanel_PROPS_CHECK({ limiter, onChange, analyzers, node, getGR }) {
  const safe = { ...DEFAULT_LIMITER, ...(limiter || {}) };
  const [lv, setLv] = useState({ inL: -120, inR: -120, outL: -120, outR: -120, tpL: -120, tpR: -120, gr: 0, lufs: -70 });
  const maxRef = useRef({ in: -120, out: -120, gr: 0, tp: -120 });
  const [, forceReset] = useState(0);

  const inLRef = useRef(null);const inRRef = useRef(null);
  const outLRef = useRef(null);const outRRef = useRef(null);
  inLRef.current = analyzers?.limiterInLeft || null;
  inRRef.current = analyzers?.limiterInRight || null;
  outLRef.current = analyzers?.limiterOutLeft || null;
  outRRef.current = analyzers?.limiterOutRight || null;

  useEffect(() => {
    if (!inLRef.current || !inRRef.current || !outLRef.current || !outRRef.current) return;
    const bufs = [0, 1, 2, 3].map(() => new Float32Array(inLRef.current.fftSize));
    let raf;
    const tick = () => {
      if (safe.enabled && inLRef.current && inRRef.current && outLRef.current && outRRef.current) {
        inLRef.current.getFloatTimeDomainData(bufs[0]);
        inRRef.current.getFloatTimeDomainData(bufs[1]);
        outLRef.current.getFloatTimeDomainData(bufs[2]);
        outRRef.current.getFloatTimeDomainData(bufs[3]);
        const inL = peakDbOf(bufs[0]);const inR = peakDbOf(bufs[1]);
        const outL = peakDbOf(bufs[2]);const outR = peakDbOf(bufs[3]);
        const tpL = 20 * Math.log10(Math.max(1e-6, truePeakOf(bufs[2])));
        const tpR = 20 * Math.log10(Math.max(1e-6, truePeakOf(bufs[3])));
        const gr = getGR ? getGR() : node ? Math.abs(node.reduction || 0) : 0;
        const ms = (meanSquareOf(bufs[2]) + meanSquareOf(bufs[3])) / 2;
        const lufs = ms > 1e-10 ? -0.691 + 10 * Math.log10(ms) : -70;
        setLv({ inL, inR, outL, outR, tpL, tpR, gr, lufs });
        const mx = maxRef.current;
        if (Math.max(inL, inR) > mx.in) mx.in = Math.max(inL, inR);
        if (Math.max(outL, outR) > mx.out) mx.out = Math.max(outL, outR);
        if (gr > mx.gr) mx.gr = gr;
        if (Math.max(tpL, tpR) > mx.tp) mx.tp = Math.max(tpL, tpR);
      } else {
        setLv({ inL: -120, inR: -120, outL: -120, outR: -120, tpL: -120, tpR: -120, gr: 0, lufs: -70 });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {if (raf) cancelAnimationFrame(raf);};
  }, [analyzers, node, getGR, safe.enabled]);

  if (!onChange) return null;
  const set = (k, v) => onChange({ ...safe, [k]: v });
  const scale = SCALES[safe.scale] || SCALES['24'];
  const resetMax = () => {maxRef.current = { in: -120, out: -120, gr: 0, tp: -120 };forceReset((n) => n + 1);};

  const pill = (on, onClick, children, title) =>
  <button key={String(children)} onClick={onClick} title={title} className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all ${on ? 'bg-merlot-500 border-merlot-400 text-white shadow-[0_0_10px_rgba(123,45,63,0.5)]' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}>{children}</button>;

  const auto = safe.releaseMode === 'auto';

  return (
    <div>
      <div data-fx="limiter" className="p-5 rounded-xl h-[470px] flex flex-col bg-gradient-to-br from-merlot-950/30 to-black/60 border border-merlot-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-merlot-500/20"><Scissors className="w-4 h-4 text-merlot-400" /></div>
            <span className={`text-sm font-medium transition-all ${safe.enabled ? 'text-merlot-300 drop-shadow-[0_0_8px_rgba(123,45,63,0.8)]' : 'text-white/80'}`}>Brickwall Limiter</span>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="limiter" accent={ACCENT} />
            <button onClick={() => set('enabled', !safe.enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all bg-merlot-500 border-merlot-400 ${safe.enabled ? "text-white shadow-[0_0_10px_rgba(123,45,63,0.5)]" : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* meters (tall, hero) + controls — two columns */}
        <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr] gap-5">
          {/* LEFT: tall meters */}
          <div className="flex flex-col min-h-0 gap-2">
            <div className="flex-1 min-h-0 flex items-stretch gap-2.5">
              {/* Input */}
              <div className="flex-1 flex flex-col gap-1 min-h-0">
                <span className="text-[9px] text-merlot-300/80 font-semibold uppercase tracking-wider text-center">Input</span>
                <div className="flex-1 min-h-0 flex gap-1.5 justify-center">
                  <LedMeter db={lv.inL} peak={maxRef.current.in} scale={scale} ceiling={safe.ceiling} enabled={safe.enabled} label="L" />
                  <LedMeter db={lv.inR} peak={maxRef.current.in} scale={scale} ceiling={safe.ceiling} enabled={safe.enabled} label="R" />
                </div>
              </div>
              {/* IN gain fader — light scheme, flanks the GR section on the left */}
              <LimiterIOFader label="IN" value={safe.inputGain} onChange={(v) => set('inputGain', v)} />
              {/* GR */}
              <div className="flex flex-col gap-1 min-h-0 w-8">
                <span className="text-[9px] text-amber-400/80 font-semibold uppercase tracking-wider text-center">GR</span>
                <div className="relative flex-1 min-h-0 overflow-hidden rounded-sm border border-amber-500/40 bg-black/70">
                  <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-amber-500 to-amber-300" style={{ height: `${Math.min(100, lv.gr * 5)}%`, opacity: safe.enabled ? 1 : 0.2 }} />
                </div>
              </div>
              {/* OUT gain fader — light scheme, flanks the GR section on the right */}
              <LimiterIOFader label="OUT" value={safe.outputGain} onChange={(v) => set('outputGain', v)} />
              {/* Output */}
              <div className="flex-1 flex flex-col gap-1 min-h-0">
                <span className="text-[9px] text-merlot-300/80 font-semibold uppercase tracking-wider text-center">Output</span>
                <div className="flex-1 min-h-0 flex gap-1.5 justify-center">
                  <LedMeter db={lv.outL} peak={maxRef.current.out} tp={lv.tpL} scale={scale} ceiling={safe.ceiling} enabled={safe.enabled} label="L" />
                  <LedMeter db={lv.outR} peak={maxRef.current.out} tp={lv.tpR} scale={scale} ceiling={safe.ceiling} enabled={safe.enabled} label="R" />
                </div>
              </div>
            </div>
            {/* readouts */}
            <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
              <button onClick={resetMax} className="flex flex-col items-center rounded-md border border-white/10 bg-black/40 px-1 py-1 hover:bg-black/60" title="Click to reset max holds">
                <span className="text-white/45 text-[8px] uppercase">Max IN</span><span className="text-merlot-300">{maxRef.current.in > -120 ? maxRef.current.in.toFixed(1) : '—'}</span>
              </button>
              <button onClick={resetMax} className="flex flex-col items-center rounded-md border border-white/10 bg-black/40 px-1 py-1 hover:bg-black/60" title="Click to reset max holds">
                <span className="text-white/45 text-[8px] uppercase">Max OUT</span><span className="text-emerald-300">{maxRef.current.out > -120 ? maxRef.current.out.toFixed(1) : '—'}</span>
              </button>
              <button onClick={resetMax} className="flex flex-col items-center rounded-md border border-white/10 bg-black/40 px-1 py-1 hover:bg-black/60" title="Click to reset max holds">
                <span className="text-white/45 text-[8px] uppercase">Max GR</span><span className="text-amber-300">-{maxRef.current.gr.toFixed(1)}</span>
              </button>
              <div className="flex flex-col items-center rounded-md border border-white/10 bg-black/40 px-1 py-1">
                <span className="text-white/45 text-[8px] uppercase">True Peak</span><span className="text-cyan-300">{maxRef.current.tp > -120 ? maxRef.current.tp.toFixed(1) : '—'}</span>
              </div>
              <LimiterLufs analyzers={analyzers} enabled={safe.enabled} />
            </div>
            <GrHistory getGR={getGR} enabled={safe.enabled} />
          </div>

          {/* RIGHT: controls */}
          <div className="flex h-full min-h-0 flex-col">
            <LimiterControls limiter={limiter} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>);

}

/**
 * Memoized control surface for the limiter (dials + option pills + status
 * footer). Split out of the main panel so the ~60 fps metering re-render loop
 * (setLv) does NOT churn the controls every frame — the controls only re-render
 * when the limiter state or the change handler actually changes, which keeps
 * click handling stable and predictable.
 */
const LimiterControls = memo(function LimiterControls({ limiter, onChange }) {
  if (!onChange) return null;
  const safe = { ...DEFAULT_LIMITER, ...(limiter || {}) };
  const set = (k, v) => onChange({ ...safe, [k]: v });
  const auto = safe.releaseMode === 'auto';
  const pill = (on, onClick, children, title) =>
    <button key={String(children)} onClick={onClick} title={title} className={`min-w-0 flex-1 px-2 py-1.5 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all ${on ? 'bg-merlot-500 border-merlot-400 text-white shadow-[0_0_10px_rgba(123,45,63,0.5)]' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}>{children}</button>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap justify-center gap-2.5">
        <Dial value={safe.inputGain} onChange={(v) => set('inputGain', v)} defaultValue={DEFAULT_LIMITER.inputGain} min={-60} max={24} step={0.1} label="Input" unit="dB" size="small" accent={ACCENT} />
        <Dial value={safe.ceiling} onChange={(v) => set('ceiling', v)} defaultValue={DEFAULT_LIMITER.ceiling} min={-6} max={0} step={0.05} label="Ceiling" unit="dB" size="small" accent={ACCENT} />
        <div className="flex flex-col items-center gap-1">
          <Dial value={safe.release} onChange={(v) => { if (!auto) set('release', v); }} defaultValue={DEFAULT_LIMITER.release} min={0.005} max={0.5} step={0.005} label="Release" unit="s" size="small" accent={ACCENT} className={auto ? 'opacity-40' : ''} />
          <div className="flex overflow-hidden rounded-md border border-white/15 text-[8px] font-bold uppercase">
            <button onClick={() => set('releaseMode', 'manual')} className={`px-1.5 py-0.5 ${!auto ? 'bg-merlot-500 text-white' : 'bg-white/5 text-white/50'}`}>Man</button>
            <button onClick={() => set('releaseMode', 'auto')} className={`px-1.5 py-0.5 ${auto ? 'bg-merlot-500 text-white' : 'bg-white/5 text-white/50'}`}>Auto</button>
          </div>
        </div>
        <Dial value={safe.lookahead} onChange={(v) => set('lookahead', v)} defaultValue={DEFAULT_LIMITER.lookahead} min={0} max={20} step={0.5} label="Lookahead" unit="ms" size="small" accent={ACCENT} />
        <Dial value={safe.stereoLink} onChange={(v) => set('stereoLink', v)} defaultValue={DEFAULT_LIMITER.stereoLink} min={0} max={100} step={1} label="Stereo Link" unit="%" size="small" accent={ACCENT} />
        <Dial value={safe.mix} onChange={(v) => set('mix', v)} defaultValue={DEFAULT_LIMITER.mix} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent={ACCENT} />
        <Dial value={safe.outputGain} onChange={(v) => set('outputGain', v)} defaultValue={DEFAULT_LIMITER.outputGain} min={-60} max={12} step={0.1} label="Output" unit="dB" size="small" accent={ACCENT} />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col justify-evenly gap-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[9px] uppercase tracking-wider text-white/45">Style</span>
          <div className="flex min-w-0 flex-1 gap-1.5">{STYLES.map((s) => pill(safe.style === s.key, () => onChange({ ...safe, style: s.key, ...STYLE_PRESETS[s.key] }), s.label, `Load ${s.label} preset into the dials`))}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[9px] uppercase tracking-wider text-white/45">Oversamp</span>
          <div className="flex min-w-0 flex-[0.42] gap-1.5">{[1, 2, 4, 8].map((o) => pill(safe.oversampling === o, () => set('oversampling', o), `${o}×`))}</div>
          <div className="flex min-w-0 flex-1 gap-1.5">
            {pill(!!safe.truePeak, () => set('truePeak', !safe.truePeak), 'True Peak', 'True-peak limiting + metering')}
            {pill(safe.dcBlocker !== false, () => set('dcBlocker', safe.dcBlocker === false), 'DC Block', 'Subsonic DC blocker (high-pass ~10 Hz)')}
            {pill(!!safe.msMode, () => set('msMode', !safe.msMode), 'M/S', 'Mid/Side processing — limit the M/S domain (width-aware)')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[9px] uppercase tracking-wider text-white/45">Dither</span>
          <div className="flex min-w-0 flex-[0.34] gap-1.5">
            {pill(safe.dither === 'off', () => set('dither', 'off'), 'Off')}
            {pill(safe.dither === '16', () => set('dither', '16'), '16')}
            {pill(safe.dither === '24', () => set('dither', '24'), '24')}
          </div>
          <span className={`w-10 shrink-0 text-center text-[9px] uppercase tracking-wider ${safe.dither === 'off' ? 'text-white/25' : 'text-white/45'}`}>Shape</span>
          <div className={`flex min-w-0 flex-1 gap-1.5 ${safe.dither === 'off' ? 'opacity-40' : ''}`}>
            {pill(safe.noiseShape === 'none', () => set('noiseShape', 'none'), 'None')}
            {pill(safe.noiseShape === 'basic', () => set('noiseShape', 'basic'), 'Basic')}
            {pill(safe.noiseShape === 'optimized', () => set('noiseShape', 'optimized'), 'Opt')}
            {pill(safe.noiseShape === 'weighted', () => set('noiseShape', 'weighted'), 'Weight')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[9px] uppercase tracking-wider text-white/45">Rel Shape</span>
          <div className="flex min-w-0 flex-[0.36] gap-1.5">
            {pill(safe.releaseShape === 'linear', () => set('releaseShape', 'linear'), 'Linear')}
            {pill(safe.releaseShape === 'exp', () => set('releaseShape', 'exp'), 'Exp')}
            {pill(safe.releaseShape === 'adaptive', () => set('releaseShape', 'adaptive'), 'Adapt', 'Program-adaptive: exp on heavy GR, linear when light')}
          </div>
          <span className="w-10 shrink-0 text-center text-[9px] uppercase tracking-wider text-white/45">Scale</span>
          <div className="flex min-w-0 flex-1 gap-1.5">{Object.entries(SCALES).map(([k, s]) => pill(safe.scale === k, () => set('scale', k), s.label))}</div>
        </div>
      </div>

      <p className="mt-2 shrink-0 text-center text-[9px] text-white/40">
        {auto ? 'Auto release · ' : `Release ${(safe.release * 1000).toFixed(0)} ms · `}
        {safe.stereoLink >= 50 ? 'Linked · ' : 'Unlinked · '}
        Lookahead {safe.lookahead} ms · Oversampling {safe.oversampling}×{safe.truePeak ? ' · True-Peak' : ''}{safe.msMode ? ' · M/S' : ''}
        {safe.dcBlocker !== false ? ' · DC Block' : ''}{safe.dither !== 'off' ? ` · Dither ${safe.dither}-bit ${safe.noiseShape}` : ''} · {safe.releaseShape} release
      </p>
    </div>
  );
});