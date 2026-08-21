import React, { useEffect, useRef, useState } from 'react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

/**
 * LimiterLufs — full ITU-R BS.1770-4 K-weighted loudness suite for the limiter's
 * post-output: Momentary (400 ms), Short-Term (3 s), Integrated (gated programme
 * loudness) and Loudness Range (LRA, P95−P10 of the short-term distribution).
 *
 * K-weighting uses the 48 kHz biquad coefficients from the ITU spec, applied per
 * channel with persistent filter state across analyzer frames. This is a live
 * meter (not an offline compliance measurement): frames are sampled from the
 * AnalyserNode at ~60 fps with overlapping windows, so the values track the
 * loudness trend rather than match an offline analyser to the decimal.
 */

// K-weighting filter coefficients (ITU-R BS.1770-4, 48 kHz).
const F1 = { b0: 1.5351248594, b1: -2.6916961898, b2: 1.1983928103, a1: -1.6906592901, a2: 0.7324807722 };
const F2 = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.9900474548, a2: 0.9900722504 };

const M_WIN = 24;  // ~400 ms at 60 fps
const S_WIN = 180;  // ~3 s at 60 fps

const lufsColor = (lufs) => {
  if (lufs >= -9) return '#ff5252';
  if (lufs >= -16) return '#ccff00';
  return '#00afff';
};
const fmt = (v) => (v <= -100 ? '-∞' : v.toFixed(1));

export default function LimiterLufs({ analyzers, enabled }) {
  const [vals, setVals] = useState({ M: -100, S: -100, I: -100, LRA: 0 });
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const intBufRef = useRef([]); // momentary-block LUFS for Integrated (gated)
  const sBufRef = useRef([]);   // short-term LUFS for LRA (gated percentiles)

  useEffect(() => {
    const outL = analyzers?.limiterOutLeft;
    const outR = analyzers?.limiterOutRight;
    if (!outL || !outR) return;
    const lBuf = new Float32Array(outL.fftSize);
    const rBuf = new Float32Array(outR.fftSize);
    // K-weight biquad state (per channel × 2 stages).
    let s1L0 = 0, s1L1 = 0, s2L0 = 0, s2L1 = 0, s1R0 = 0, s1R1 = 0, s2R0 = 0, s2R1 = 0;
    const mBuf = []; // per-frame K-weighted z (zL + zR) for the sliding windows
    const intBuf = intBufRef.current;
    const sBuf = sBufRef.current;
    let fc = 0;
    let raf;

    const mean = (arr) => { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return arr.length ? s / arr.length : 0; };
    const toLufs = (mz) => (mz > 1e-12 ? -0.691 + 10 * Math.log10(mz) : -100);

    const tick = () => {
      if (!enabled || standbyRef.current) {
        setVals((v) => (v.M <= -100 ? v : { M: -100, S: -100, I: -100, LRA: 0 }));
        raf = requestAnimationFrame(tick);
        return;
      }
      outL.getFloatTimeDomainData(lBuf);
      outR.getFloatTimeDomainData(rBuf);
      let sumL = 0, sumR = 0;
      const n = lBuf.length;
      for (let i = 0; i < n; i++) {
        // L: stage 1 (high shelf)
        const x = lBuf[i];
        const y = F1.b0 * x + s1L0; s1L0 = F1.b1 * x - F1.a1 * y + s1L1; s1L1 = F1.b2 * x - F1.a2 * y;
        // L: stage 2 (high pass)
        const x2 = y; const y2 = F2.b0 * x2 + s2L0; s2L0 = F2.b1 * x2 - F2.a1 * y2 + s2L1; s2L1 = F2.b2 * x2 - F2.a2 * y2;
        sumL += y2 * y2;
        // R: stage 1
        const xr = rBuf[i];
        const yr = F1.b0 * xr + s1R0; s1R0 = F1.b1 * xr - F1.a1 * yr + s1R1; s1R1 = F1.b2 * xr - F1.a2 * yr;
        // R: stage 2
        const x2r = yr; const y2r = F2.b0 * x2r + s2R0; s2R0 = F2.b1 * x2r - F2.a1 * y2r + s2R1; s2R1 = F2.b2 * x2r - F2.a2 * y2r;
        sumR += y2r * y2r;
      }
      const z = sumL / n + sumR / n; // ITU: sum of channel mean squares
      mBuf.push(z);
      if (mBuf.length > S_WIN) mBuf.shift();
      const M = toLufs(mean(mBuf.slice(-M_WIN)));
      const S = toLufs(mean(mBuf));

      // Gated programme loudness (I) + LRA, sampled at a reduced hop to limit
      // window overlap (ITU: 400 ms blocks @ 100 ms hop; 3 s blocks @ 500 ms).
      fc++;
      if (fc % 6 === 0 && M > -70) { intBuf.push(M); if (intBuf.length > 18000) intBuf.shift(); }
      if (fc % 30 === 0 && S > -70) { sBuf.push(S); if (sBuf.length > 3600) sBuf.shift(); }

      let I = -100;
      if (intBuf.length) {
        const absMean = mean(intBuf);
        const relGate = absMean - 10;
        let gs = 0, gc = 0;
        for (let i = 0; i < intBuf.length; i++) { if (intBuf[i] >= relGate) { gs += intBuf[i]; gc++; } }
        if (gc) I = gs / gc;
      }
      let LRA = 0;
      if (sBuf.length > 10) {
        const sorted = [...sBuf].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
        LRA = Math.max(0, pct(95) - pct(10));
      }
      setVals({ M, S, I, LRA });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [analyzers, enabled]);

  const reset = () => {
    intBufRef.current = [];
    sBufRef.current = [];
    setVals({ M: -100, S: -100, I: -100, LRA: 0 });
  };

  return (
    <div className="col-span-2 rounded-md border border-cyan-500/20 bg-black/40 px-2 py-1" title="ITU-R BS.1770-4 K-weighted loudness (post-limiter output)">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-white/45 text-[8px] uppercase tracking-wider">LUFS · BS.1770</span>
        <button onClick={reset} className="text-[7px] text-white/30 hover:text-white/70 uppercase tracking-wider">Reset I/LRA</button>
      </div>
      <div className="grid grid-cols-4 gap-1 font-mono">
        {[
          { k: 'M', v: vals.M, label: 'Mom', lu: false },
          { k: 'S', v: vals.S, label: 'Short', lu: false },
          { k: 'I', v: vals.I, label: 'Int', lu: false },
          { k: 'LRA', v: vals.LRA, label: 'LRA', lu: true },
        ].map((r) => (
          <div key={r.k} className="flex flex-col items-center">
            <span className="text-[7px] uppercase text-white/35 leading-none">{r.label}</span>
            <span className="text-[11px] font-bold tabular-nums leading-tight" style={{ color: r.lu ? '#a78bfa' : lufsColor(r.v) }}>
              {r.lu ? (r.v > 0 ? `${r.v.toFixed(1)}` : '—') : fmt(r.v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}