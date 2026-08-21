import React, { useEffect, useRef, useState } from 'react';
import { Activity, Power, Scissors } from 'lucide-react';
import { Slider } from './ui/slider';
import Dial from './Dial';
import InfoButton from './InfoButton';

/**
 * Dynamics: Compressor + Soft Clipper + Brickwall Limiter.
 *
 * Props:
 *  - dynamics: { compressor: {...}, limiter: {...} }
 *  - onDynamicsChange(next)
 *  - analyzers (optional): { compressorInput, compressorOutput, limiterInput, limiterOutput }
 *      AnalyserNodes tapped at each module's input/output for the meters.
 *  - nodes (optional): { compressor, limiter }
 *      The DynamicsCompressorNodes (used for live gain-reduction reading via `.reduction`).
 *
 * Without analyzers/nodes the meters rest at -60 dB — the panel is still fully usable.
 *
 * Extract for reuse: copy this file + Dial.jsx + ui/slider.jsx + ui/switch.jsx + lib/utils.js.
 */
export default function DynamicsPanel({ dynamics, onDynamicsChange, analyzers, nodes, layout = 'wide' }) {
  const safe = {
    compressor: {
      enabled: false,
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      knee: 30,
      makeupGain: 0,
      softClip: 0,
      ...dynamics?.compressor,
    },
    limiter: { enabled: true, threshold: -0.1, ...dynamics?.limiter },
  };

  const [inputLevel, setInputLevel] = useState(-60);
  const [outputLevel, setOutputLevel] = useState(-60);
  const [gainReduction, setGainReduction] = useState(0);
  const [limIn, setLimIn] = useState(-60);
  const [limOut, setLimOut] = useState(-60);
  const [limGR, setLimGR] = useState(0);
  const [isClipped, setIsClipped] = useState(false);
  const clipTimer = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!analyzers) return;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const releaseRate = 120; // dB/s

      // Compressor meters
      if (safe.compressor.enabled && analyzers.compressorInput && analyzers.compressorOutput) {
        const inData = new Float32Array(analyzers.compressorInput.fftSize);
        const outData = new Float32Array(analyzers.compressorOutput.fftSize);
        analyzers.compressorInput.getFloatTimeDomainData(inData);
        analyzers.compressorOutput.getFloatTimeDomainData(outData);
        let inPeak = 0, outPeak = 0;
        for (let i = 0; i < inData.length; i++) {
          inPeak = Math.max(inPeak, Math.abs(inData[i]));
          outPeak = Math.max(outPeak, Math.abs(outData[i]));
        }
        const inDb = inPeak > 0.00001 ? 20 * Math.log10(inPeak) : -60;
        const outDb = outPeak > 0.00001 ? 20 * Math.log10(outPeak) : -60;
        setInputLevel((p) => (inDb >= p ? inDb : Math.max(-60, p - releaseRate * dt)));
        setOutputLevel((p) => (outDb >= p ? outDb : Math.max(-60, p - releaseRate * dt)));
        const gr = nodes?.compressor ? Math.abs(nodes.compressor.reduction) : 0;
        setGainReduction(gr);
      } else {
        setInputLevel(-60); setOutputLevel(-60); setGainReduction(0);
      }

      // Limiter meters
      if (safe.limiter.enabled && analyzers.limiterInput && analyzers.limiterOutput) {
        const li = new Float32Array(analyzers.limiterInput.fftSize);
        const lo = new Float32Array(analyzers.limiterOutput.fftSize);
        analyzers.limiterInput.getFloatTimeDomainData(li);
        analyzers.limiterOutput.getFloatTimeDomainData(lo);
        let lInPeak = 0, lOutPeak = 0;
        for (let i = 0; i < li.length; i++) {
          lInPeak = Math.max(lInPeak, Math.abs(li[i]));
          lOutPeak = Math.max(lOutPeak, Math.abs(lo[i]));
        }
        const lInDb = lInPeak > 0.00001 ? 20 * Math.log10(lInPeak) : -60;
        const lOutDb = lOutPeak > 0.00001 ? 20 * Math.log10(lOutPeak) : -60;
        setLimIn((p) => (lInDb >= p ? lInDb : Math.max(-60, p - releaseRate * dt)));
        setLimOut((p) => (lOutDb >= p ? lOutDb : Math.max(-60, p - releaseRate * dt)));
        const gr = nodes?.limiter ? Math.abs(nodes.limiter.reduction) : 0;
        setLimGR(gr);
        if (lOutPeak >= 1.0 || lOutDb >= -0.01) {
          setIsClipped(true);
          if (clipTimer.current) clearTimeout(clipTimer.current);
          clipTimer.current = setTimeout(() => setIsClipped(false), 1000);
        }
      } else {
        setLimIn(-60); setLimOut(-60); setLimGR(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (clipTimer.current) clearTimeout(clipTimer.current);
    };
  }, [
    analyzers,
    nodes,
    safe.compressor.enabled,
    safe.limiter.enabled,
    safe.compressor.threshold,
    safe.compressor.ratio,
    safe.compressor.knee,
    safe.limiter.threshold,
  ]);

  if (!onDynamicsChange) return null;

  const setComp = (key, value) =>
    onDynamicsChange({ ...safe, compressor: { ...safe.compressor, [key]: value } });
  const setLim = (key, value) =>
    onDynamicsChange({ ...safe, limiter: { ...safe.limiter, [key]: value } });

  const meterPct = (db) => Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

  // Transfer function path for the compressor.
  // Standard soft-knee model: below the knee it's unity, above it the compressed
  // slope (1/r), and within the knee the gain-reduction ramps in quadratically so
  // the slope is C1-continuous (no hump / kink at the knee boundaries).
  const transferPath = () => {
    const t = safe.compressor.threshold;
    const r = Math.max(1, safe.compressor.ratio);
    const W = Math.max(0, safe.compressor.knee);
    const slope = 1 / r;
    const ks = t - W / 2;
    const ke = t + W / 2;
    const points = [];
    for (let i = 0; i <= 180; i++) {
      const inDb = -60 + (i / 180) * 60; // input range -60..0 dB
      let outDb;
      if (W > 0 && inDb > ks && inDb < ke) {
        const x = inDb - ks; // 0..W
        outDb = inDb - (1 - slope) * (x * x) / (2 * W);
      } else if (inDb >= ke) {
        outDb = t + (inDb - t) / r;
      } else {
        outDb = inDb;
      }
      const x = 10 + ((inDb + 60) / 60) * 120;
      const y = 130 - ((outDb + 60) / 60) * 120;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
  };

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
      <div className={`grid ${layout === 'narrow' ? 'grid-cols-1' : layout === 'medium' ? 'sm:grid-cols-2' : 'md:grid-cols-2'} gap-4 [&>*]:min-w-0`}>
        {/* Compressor + Soft Clip */}
        <div data-fx="compressor" className="p-4 rounded-xl bg-gradient-to-br from-sky-950/40 to-black/60 border border-sky-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/20">
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <span
                className={`text-sm font-medium transition-all ${
                  safe.compressor.enabled
                    ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                    : 'text-white/80'
                }`}
              >
                Compressor
              </span>
            </div>
            <div className="flex items-center gap-2">
              <InfoButton panelId="compressor" accent="#38bdf8" />
              <button
                onClick={() => setComp('enabled', !safe.compressor.enabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                  safe.compressor.enabled
                    ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase w-5 text-center">
                  {safe.compressor.enabled ? 'On' : 'Off'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Input meter */}
            <div className="flex flex-col items-center gap-1 w-10">
              <span className="text-[9px] text-sky-400/60 font-medium">IN</span>
              <div className="flex-1 w-6 bg-black/60 border border-sky-500/20 relative overflow-hidden rounded-sm">
                {safe.compressor.enabled && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-600 via-sky-400 to-sky-300"
                    style={{ height: `${meterPct(inputLevel)}%` }}
                  />
                )}
              </div>
              <span className="text-[8px] text-sky-400/80 font-mono">
                {safe.compressor.enabled ? inputLevel.toFixed(0) : '-60'}
              </span>
            </div>

            {/* Transfer function */}
            <div className="flex-1 h-40 bg-black/40 rounded-lg p-2 border border-sky-500/20">
              <svg width="100%" height="100%" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="cmpCurve" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                {[0, 20, 40, 60, 80, 100, 120].map((v) => (
                  <g key={v}>
                    <line x1={v + 10} y1="10" x2={v + 10} y2="130" stroke="rgb(56 189 248 / 0.06)" strokeWidth="0.5" />
                    <line x1="10" y1={v + 10} x2="130" y2={v + 10} stroke="rgb(56 189 248 / 0.06)" strokeWidth="0.5" />
                  </g>
                ))}
                <line x1="10" y1="130" x2="130" y2="10" stroke="rgb(56 189 248 / 0.15)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="10" y1="130" x2="130" y2="130" stroke="rgb(56 189 248 / 0.4)" strokeWidth="1.5" />
                <line x1="10" y1="10" x2="10" y2="130" stroke="rgb(56 189 248 / 0.4)" strokeWidth="1.5" />
                {(() => {
                  const tx = 10 + ((safe.compressor.threshold + 60) / 60) * 120;
                  return <line x1={tx} y1="10" x2={tx} y2="130" stroke="rgb(56 189 248 / 0.5)" strokeWidth="1" strokeDasharray="2,2" />;
                })()}
                <polyline points={transferPath()} fill="none" stroke="url(#cmpCurve)" strokeWidth="2" />
              </svg>
            </div>

            {/* Output meter + GR */}
            <div className="flex flex-col items-center gap-1 w-10">
              <span className="text-[9px] text-sky-400/60 font-medium">OUT</span>
              <div className="flex-1 w-6 bg-black/60 border border-sky-500/20 relative overflow-hidden rounded-sm">
                {safe.compressor.enabled && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-600 via-sky-400 to-sky-300"
                    style={{ height: `${meterPct(outputLevel)}%` }}
                  />
                )}
              </div>
              <span className="text-[8px] text-sky-400/80 font-mono">
                {safe.compressor.enabled ? outputLevel.toFixed(0) : '-60'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 w-10">
              <span className="text-[9px] text-amber-400/60 font-medium">GR</span>
              <div className="flex-1 w-6 bg-black/60 border border-amber-500/20 relative overflow-hidden rounded-sm">
                {safe.compressor.enabled && gainReduction > 0 && (
                  <div
                    className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-500 to-amber-300"
                    style={{ height: `${Math.min(100, gainReduction * 4)}%` }}
                  />
                )}
              </div>
              <span className="text-[8px] text-amber-400/80 font-mono">
                -{safe.compressor.enabled ? gainReduction.toFixed(1) : '0'}
              </span>
            </div>
          </div>

          {/* Compressor dials */}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Dial value={safe.compressor.threshold} onChange={(v) => setComp('threshold', v)} min={-60} max={0} step={0.5} label="Thresh" unit="dB" size="small" accent="#38bdf8" />
            <Dial value={safe.compressor.ratio} onChange={(v) => setComp('ratio', v)} min={1} max={20} step={0.5} label="Ratio" size="small" accent="#38bdf8" />
            <Dial value={safe.compressor.knee} onChange={(v) => setComp('knee', v)} min={0} max={40} step={1} label="Knee" unit="dB" size="small" accent="#38bdf8" />
            <Dial value={safe.compressor.makeupGain} onChange={(v) => setComp('makeupGain', v)} min={0} max={24} step={0.5} label="Makeup" unit="dB" size="small" accent="#38bdf8" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/60">Attack</span>
                <span className="text-sky-400 font-mono">{(safe.compressor.attack * 1000).toFixed(1)}ms</span>
              </div>
              <Slider value={[safe.compressor.attack]} onValueChange={([v]) => setComp('attack', v)} min={0.001} max={0.3} step={0.001} className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/60">Release</span>
                <span className="text-sky-400 font-mono">{(safe.compressor.release * 1000).toFixed(0)}ms</span>
              </div>
              <Slider value={[safe.compressor.release]} onValueChange={([v]) => setComp('release', v)} min={0.01} max={1} step={0.01} className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400" />
            </div>
          </div>

        </div>

        {/* Brickwall Limiter */}
        <div data-fx="limiter" className="p-4 rounded-xl bg-gradient-to-br from-rose-950/30 to-black/60 border border-rose-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/20">
                <Scissors className="w-4 h-4 text-rose-400" />
              </div>
              <span
                className={`text-sm font-medium transition-all ${
                  safe.limiter.enabled
                    ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]'
                    : 'text-white/80'
                }`}
              >
                Brickwall Limiter
              </span>
            </div>
            <div className="flex items-center gap-2">
              <InfoButton panelId="limiter" accent="#fb7185" />
              <button
                onClick={() => setLim('enabled', !safe.limiter.enabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                  safe.limiter.enabled
                    ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_10px_rgba(251,113,133,0.5)]'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase w-5 text-center">
                  {safe.limiter.enabled ? 'On' : 'Off'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1 w-10">
              <span className="text-[9px] text-rose-400/60 font-medium">IN</span>
              <div className="flex-1 w-6 bg-black/60 border border-rose-500/20 relative overflow-hidden rounded-sm">
                {safe.limiter.enabled && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-600 via-rose-400 to-rose-300"
                    style={{ height: `${meterPct(limIn)}%` }}
                  />
                )}
              </div>
              <span className="text-[8px] text-rose-400/80 font-mono">
                {safe.limiter.enabled ? limIn.toFixed(0) : '-60'}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  isClipped
                    ? 'bg-rose-500 border-rose-300 text-white shadow-[0_0_12px_rgba(251,113,133,0.8)] animate-pulse'
                    : 'bg-black/40 border-rose-500/30 text-rose-400/40'
                }`}
              >
                Clip
              </div>
              <div className="text-center">
                <div className="text-[9px] text-white/40 uppercase tracking-wider">Gain Reduction</div>
                <div className="text-2xl font-mono text-rose-400">
                  -{safe.limiter.enabled ? limGR.toFixed(1) : '0.0'}
                  <span className="text-xs text-rose-400/60">dB</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 w-10">
              <span className="text-[9px] text-rose-400/60 font-medium">OUT</span>
              <div className="flex-1 w-6 bg-black/60 border border-rose-500/20 relative overflow-hidden rounded-sm">
                {safe.limiter.enabled && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-600 via-rose-400 to-rose-300"
                    style={{ height: `${meterPct(limOut)}%` }}
                  />
                )}
              </div>
              <span className="text-[8px] text-rose-400/80 font-mono">
                {safe.limiter.enabled ? limOut.toFixed(0) : '-60'}
              </span>
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Dial value={safe.limiter.threshold} onChange={(v) => setLim('threshold', v)} min={-24} max={0} step={0.1} label="Threshold" unit="dB" size="medium" accent="#fb7185" />
          </div>
          <p className="text-center text-[9px] text-white/40 mt-2">
            Ratio 100:1 · Attack 0ms · Brickwall ceiling
          </p>
        </div>
      </div>
    </div>
  );
}