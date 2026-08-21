import React, { useEffect, useRef, useState } from 'react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

/**
 * OutputLufsOverlay — K-weighted ITU-R BS.1770-4 Momentary / Short-Term /
 * Integrated loudness, shown as a compact top-right badge over the Final Output
 * spectral meter. Reads the post-chain L/R output analyzers (levelLeft/Right).
 *
 * Rendered inside OutputVisualizer so it appears in both the standard and the
 * full-screen views. The LED meters are untouched — this is a readout only.
 */
const F1 = { b0: 1.5351248594, b1: -2.6916961898, b2: 1.1983928103, a1: -1.6906592901, a2: 0.7324807722 };
const F2 = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.9900474548, a2: 0.9900722504 };
const M_WIN = 24;   // ~400 ms at 60 fps
const S_WIN = 180;  // ~3 s at 60 fps

const lufsColor = (lufs) => (lufs >= -9 ? '#ff5252' : lufs >= -16 ? '#ccff00' : '#00afff');
const fmt = (v) => (v <= -100 ? '-∞' : v.toFixed(1));

export default function OutputLufsOverlay({ leftAnalyzer, rightAnalyzer }) {
  const has = !!(leftAnalyzer && rightAnalyzer);
  const [vals, setVals] = useState({ M: -100, S: -100, I: -100 });
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const intBufRef = useRef([]);

  useEffect(() => {
    if (!has) return;
    const lBuf = new Float32Array(leftAnalyzer.fftSize);
    const rBuf = new Float32Array(rightAnalyzer.fftSize);
    let s1L0 = 0, s1L1 = 0, s2L0 = 0, s2L1 = 0, s1R0 = 0, s1R1 = 0, s2R0 = 0, s2R1 = 0;
    const mBuf = [];
    const intBuf = intBufRef.current;
    let fc = 0;
    let raf;
    const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
    const toLufs = (mz) => (mz > 1e-12 ? -0.691 + 10 * Math.log10(mz) : -100);

    const tick = () => {
      if (standbyRef.current) {
        setVals((v) => (v.M <= -100 ? v : { M: -100, S: -100, I: -100 }));
        raf = requestAnimationFrame(tick);
        return;
      }
      leftAnalyzer.getFloatTimeDomainData(lBuf);
      rightAnalyzer.getFloatTimeDomainData(rBuf);
      let sumL = 0, sumR = 0;
      const n = lBuf.length;
      for (let i = 0; i < n; i++) {
        const x = lBuf[i];
        const y = F1.b0 * x + s1L0; s1L0 = F1.b1 * x - F1.a1 * y + s1L1; s1L1 = F1.b2 * x - F1.a2 * y;
        const x2 = y; const y2 = F2.b0 * x2 + s2L0; s2L0 = F2.b1 * x2 - F2.a1 * y2 + s2L1; s2L1 = F2.b2 * x2 - F2.a2 * y2;
        sumL += y2 * y2;
        const xr = rBuf[i];
        const yr = F1.b0 * xr + s1R0; s1R0 = F1.b1 * xr - F1.a1 * yr + s1R1; s1R1 = F1.b2 * xr - F1.a2 * yr;
        const x2r = yr; const y2r = F2.b0 * x2r + s2R0; s2R0 = F2.b1 * x2r - F2.a1 * y2r + s2R1; s2R1 = F2.b2 * x2r - F2.a2 * y2r;
        sumR += y2r * y2r;
      }
      const z = sumL / n + sumR / n;
      mBuf.push(z);
      if (mBuf.length > S_WIN) mBuf.shift();
      const M = toLufs(mean(mBuf.slice(-M_WIN)));
      const S = toLufs(mean(mBuf));
      fc++;
      if (fc % 6 === 0 && M > -70) { intBuf.push(M); if (intBuf.length > 18000) intBuf.shift(); }
      let I = -100;
      if (intBuf.length) {
        const absMean = mean(intBuf);
        const relGate = absMean - 10;
        let gs = 0, gc = 0;
        for (let i = 0; i < intBuf.length; i++) if (intBuf[i] >= relGate) { gs += intBuf[i]; gc++; }
        if (gc) I = gs / gc;
      }
      setVals({ M, S, I });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [leftAnalyzer, rightAnalyzer, has]);

  if (!has) return null;
  const reset = () => { intBufRef.current = []; setVals({ M: -100, S: -100, I: -100 }); };

  return (
    <div className="absolute right-2 top-5 z-10 rounded-lg border border-cyan-500/25 bg-black/70 px-2 py-1" title="ITU-R BS.1770-4 K-weighted loudness (final output)">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[7px] font-mono uppercase tracking-widest text-cyan-200/55">LUFS · BS.1770</span>
        <button onClick={reset} className="text-[8px] leading-none text-white/30 hover:text-white/70" title="Reset Integrated">⟲</button>
      </div>
      <div className="flex gap-2.5 font-mono">
        {[
          { k: 'M', v: vals.M, label: 'Mom' },
          { k: 'S', v: vals.S, label: 'Short' },
          { k: 'I', v: vals.I, label: 'Int' },
        ].map((r) => (
          <div key={r.k} className="flex flex-col items-center leading-none">
            <span className="text-[6px] uppercase text-white/40">{r.label}</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: lufsColor(r.v) }}>{fmt(r.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}