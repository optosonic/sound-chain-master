import React, { useEffect, useRef } from 'react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';

/**
 * Compact "multi-meter" companion to the segmented LED LevelMeter.
 * Reads `engine.getDetail()` ({ left/right: { peak, rms } }) and shows:
 *   - PEAK / RMS / CREST (dB) numeric readouts
 *   - L/R BALANCE bar (center-zero)
 *   - a mini RMS LED ladder (L/R) as a secondary meter
 *
 * `orientation` mirrors the host panel so it lays out as a row (horizontal)
 * or a column (vertical).
 */
const fmt = (db) => (db <= -60 ? '-∞' : db.toFixed(1));
const peakColor = (db) => (db >= 0 ? '#ff2b2b' : db >= -3 ? '#ffae42' : '#e2e8f0');

// mini RMS ladder segments: -36..0 dB, 3 dB each
const RUNG = [];
for (let db = -36; db <= 0; db += 3) RUNG.push(db);
const rungColor = (db) => (db >= -3 ? '#ff2b2b' : db >= -12 ? '#ccff00' : '#00afff');

export default function MultiMeter({ engine, orientation = 'horizontal', monitor = 'out' }) {
  const r = useRef({});
  const rmsRefs = useRef([[], []]);
  const balRef = useRef(null);
  const vertical = orientation === 'vertical';
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);

  useEffect(() => {
    let raf;
    const tick = () => {
      if (standbyRef.current) { raf = requestAnimationFrame(tick); return; }
      const d = monitor === 'in' ? engine?.getDetailIn?.() : engine?.getDetail?.();
      if (d) {
        const lp = d.left.peak, lr = d.left.rms, rp = d.right.peak, rr = d.right.rms;
        const maxPeak = Math.max(lp, rp);
        const maxRms = Math.max(lr, rr);
        const crest = maxPeak - maxRms;
        const balance = lp - rp; // + = left louder
        const set = (k, v, c) => { const el = r.current[k]; if (el) { el.textContent = v; if (c) el.style.color = c; } };
        set('peak', fmt(maxPeak), peakColor(maxPeak));
        set('rms', fmt(maxRms), '#a5f3fc');
        set('crest', (maxRms <= -60 ? '∞' : crest.toFixed(1)));
        set('bal', (Math.abs(balance) < 0.05 ? 'C' : (balance > 0 ? 'L ' : 'R ') + Math.abs(balance).toFixed(1)));
        // balance bar — center zero, ±12 dB full span
        if (balRef.current) {
          const pct = Math.max(-1, Math.min(1, balance / 12));
          const half = 50;
          if (pct >= 0) {
            balRef.current.style.left = '50%';
            balRef.current.style.width = `${(pct * half).toFixed(1)}%`;
            balRef.current.style.background = '#00afff';
          } else {
            balRef.current.style.left = `${(50 + pct * half).toFixed(1)}%`;
            balRef.current.style.width = `${(-pct * half).toFixed(1)}%`;
            balRef.current.style.background = '#ff5ca0';
          }
        }
        // mini RMS ladders
        for (let row = 0; row < 2; row++) {
          const arr = rmsRefs.current[row];
          const db = row === 0 ? lr : rr;
          for (let i = 0; i < RUNG.length; i++) {
            const el = arr?.[i];
            if (!el) continue;
            const lit = RUNG[i] <= db;
            const col = rungColor(RUNG[i]);
            el.style.opacity = lit ? '1' : '0.10';
            el.style.boxShadow = lit ? `0 0 5px ${col}` : 'none';
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine, monitor]);

  const setRmsRef = (row, i) => (el) => {
    if (!rmsRefs.current[row]) rmsRefs.current[row] = [];
    rmsRefs.current[row][i] = el;
  };

  const Readout = ({ label, k }) => (
    <div className={`flex ${vertical ? 'justify-between' : 'flex-col'} ${vertical ? 'gap-2' : ''}`}>
      <span className="text-[7px] font-mono uppercase tracking-wider text-slate-500">{label}</span>
      <span ref={(el) => (r.current[k] = el)} className="font-mono text-[10px] font-semibold text-slate-200">-∞</span>
    </div>
  );

  const Ladder = ({ row, label }) => (
    <div className={`flex ${vertical ? 'flex-col-reverse items-center' : 'items-center'} gap-1`}>
      <span className="text-[7px] font-mono text-slate-500">{label}</span>
      <div className={vertical ? 'flex flex-col-reverse gap-[1px] h-20 w-2' : 'flex flex-1 gap-[1px] h-2 w-16'}>
        {RUNG.map((db, i) => (
          <div
            key={i}
            ref={setRmsRef(row, i)}
            className={vertical ? 'flex-1 w-full rounded-[1px]' : 'flex-1 rounded-[1px]'}
            style={{ background: rungColor(db), opacity: 0.1, clipPath: vertical ? 'polygon(0 0, 100% 0, 88% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`rounded-md border border-cyan-500/15 bg-black/70 px-2 py-1.5 ${vertical ? 'flex flex-col gap-2' : 'flex flex-col gap-1.5'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-mono uppercase tracking-widest text-cyan-200/50">Multi</span>
        <span className="text-[6px] font-mono text-slate-600">RMS</span>
      </div>

      <div className={vertical ? 'flex flex-col gap-1.5' : 'grid grid-cols-3 gap-1.5'}>
        <Readout label="Peak" k="peak" />
        <Readout label="Rms" k="rms" />
        <Readout label="Crest" k="crest" />
      </div>

      {/* balance bar */}
      <div>
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[7px] font-mono uppercase tracking-wider text-slate-500">Balance</span>
          <span ref={(el) => (r.current.bal = el)} className="font-mono text-[9px] font-semibold text-slate-300">C</span>
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-slate-800">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/25" />
          <div ref={balRef} className="absolute top-0 bottom-0 rounded-full" style={{ width: 0, background: '#00afff' }} />
        </div>
      </div>

      <div className={vertical ? 'flex gap-2' : 'flex gap-3'}>
        <Ladder row={0} label="L" />
        <Ladder row={1} label="R" />
      </div>
    </div>
  );
}