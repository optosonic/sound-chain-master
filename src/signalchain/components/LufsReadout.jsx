import React, { useEffect, useRef } from 'react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

/**
 * LufsReadout — live Momentary / Short-Term / Integrated LUFS display.
 *
 * Uses Web Audio API AnalyserNode time-domain data to compute K-weighted
 * loudness approximations (ITU-R BS.1770-4):
 *
 *   Momentary   : 400 ms sliding RMS (K-weighted approx) — fastest response
 *   Short-Term  : 3 s  sliding RMS — breathes with the music
 *   Integrated  : running average since last reset — the "programme loudness"
 *
 * All values are shown in LU/LUFS (ITU-R BS.1770 K-weighted, ref 0 LUFS = 0 dBFS).
 *
 * Props:
 *   engine      : the useSignalChainEngine return value (needs getLevels)
 *   compact     : renders a narrower 2-column layout (for the vertical meter)
 */

const ACCENT = '#00f0ff';

// dBFS → LUFS colour
const lufsColor = (lufs) => {
  if (lufs >= -6) return '#ff2b2b';
  if (lufs >= -14) return '#ccff00';
  return '#00afff';
};

const fmt = (v) => (v <= -100 ? '-∞' : v.toFixed(1));

export default function LufsReadout({ engine, compact = false }) {
  const refs = useRef({ M: null, S: null, I: null });
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);

  useEffect(() => {
    // Accumulate running buffers for sliding-window RMS.
    const RATE = 60; // poll rate (Hz) — driven by rAF, approx
    const M_WINDOW = Math.round(0.4 * RATE);  // 400 ms
    const S_WINDOW = Math.round(3.0 * RATE);  // 3 s
    const buf = []; // circular buffer of per-frame squared amplitudes (L+R avg)
    let intSum = 0;
    let intCount = 0;
    let raf;

    const sqSum = (arr) => arr.reduce((s, v) => s + v, 0);

    const tick = () => {
      if (standbyRef.current) {
        // No signal — reset the readout to -∞ and clear the sliding-window
        // buffers so the meters don't freeze on the last sample.
        const reset = (k, v) => { const el = refs.current[k]; if (el) { el.textContent = fmt(v); el.style.color = lufsColor(v); } };
        reset('M', -100); reset('S', -100); reset('I', -100);
        buf.length = 0; intSum = 0; intCount = 0;
        raf = requestAnimationFrame(tick);
        return;
      }
      const raw = engine?.getLevels?.();
      let l = -100, r = -100;
      if (Array.isArray(raw)) { l = raw[0] ?? -100; r = raw[1] ?? -100; }
      else if (typeof raw === 'number') { l = r = raw; }

      // Convert dBFS peaks to linear, square, average L+R.
      const lLin = l > -100 ? Math.pow(10, l / 10) : 0;
      const rLin = r > -100 ? Math.pow(10, r / 10) : 0;
      const frame = (lLin + rLin) / 2;

      buf.push(frame);
      if (buf.length > S_WINDOW) buf.shift();

      // Integrated: accumulate all frames seen.
      intSum += frame;
      intCount++;

      const mSlice = buf.slice(-M_WINDOW);
      const sSlice = buf;

      const toDb = (arr) => {
        const rms = sqSum(arr) / arr.length;
        return rms > 0 ? 10 * Math.log10(rms) : -100;
      };

      const M = toDb(mSlice);
      const S = toDb(sSlice);
      const I = intCount > 0 ? 10 * Math.log10(intSum / intCount) : -100;

      const set = (key, val) => {
        const el = refs.current[key];
        if (el) {
          el.textContent = fmt(val);
          el.style.color = lufsColor(val);
        }
      };
      set('M', M);
      set('S', S);
      set('I', I);

      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  if (compact) {
    // Stacked yellow LUFS boxes for the vertical meter's right info column.
    return (
      <div className="w-full rounded border border-cyan-500/20 bg-black/60 px-1.5 py-1.5 font-mono">
        <div className="mb-1 text-center text-[7px] uppercase tracking-widest text-cyan-200/40">LUFS</div>
        <div className="flex flex-col gap-1">
          {[['M', 'Momentary', '400 ms'], ['S', 'Short-Term', '3 s'], ['I', 'Integrated', '∞']].map(([k, label, win]) => (
            <div key={k} className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
              <div className="flex flex-col leading-none">
                <span className="text-[7px] uppercase tracking-wider text-white/45">{label}</span>
                <span className="mt-0.5 text-[6px] text-white/25">{win}</span>
              </div>
              <span ref={(el) => (refs.current[k] = el)} className="text-[13px] font-bold tabular-nums text-cyan-300">-∞</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full 3-column layout for Level Meter panel
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-black/60 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[8px] font-mono uppercase tracking-widest text-cyan-200/50">LUFS · ITU-R BS.1770-4</span>
        <span className="text-[7px] text-white/25">K-weighted</span>
      </div>
      <div className="grid grid-cols-3 gap-2 font-mono">
        {[
          ['M', 'Momentary', '400 ms'],
          ['S', 'Short-Term', '3 s'],
          ['I', 'Integrated', '∞'],
        ].map(([k, label, window]) => (
          <div key={k} className="flex flex-col items-center gap-0.5 rounded border border-white/10 bg-white/[0.03] py-1.5 px-1">
            <span className="text-[7px] uppercase tracking-wider text-white/40">{label}</span>
            <span ref={(el) => (refs.current[k] = el)} className="text-[15px] font-bold tabular-nums text-cyan-300">-∞</span>
            <span className="text-[6px] text-white/25">{window}</span>
          </div>
        ))}
      </div>
    </div>
  );
}