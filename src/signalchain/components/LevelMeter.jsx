import React, { useEffect, useRef, useState } from 'react';
import MultiMeter from './MultiMeter';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';
import SpectrumBars from './SpectrumBars';
import LufsReadout from './LufsReadout';
import { K_REFS, METER_MODES, buildSegments, colorForSeg, buildHScale, buildVScale, readMeterValues } from '../meteringMode.js';

const fmt = (db) => (db <= -60 ? '-∞' : db.toFixed(1));
const peakColor = (db) => (db >= 0 ? '#ff2b2b' : db >= -3 ? '#ffae42' : '#cbd5e1');

/**
 * Segmented LED level meter with a selectable metering standard:
 *   dBFS (digital ceiling) or Bob Katz K-System (K-12 / K-14 / K-20).
 * `engine.getLevels()` -> number | [leftDb, rightDb]            (peak dBFS)
 * `engine.getDetail()` -> { left:{peak,rms}, right:{peak,rms} } (RMS used for K)
 * `orientation` -> 'horizontal' | 'vertical'
 * `pro` -> show detailed numerical readout
 */
export default function LevelMeter({ engine, orientation = 'horizontal', pro = false, inAnalyzer, outAnalyzer, audioContext, meteringMode = 'dBFS', onMeteringModeChange }) {
  const segRefs = useRef([[], []]);
  const detail = useRef({});
  const vertical = orientation === 'vertical';
  const [monitor, setMonitor] = useState('out');
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const disp = useRef([-100, -100]);

  const kRef = K_REFS[meteringMode] || 0;
  const isK = kRef > 0;
  const segments = buildSegments(meteringMode);
  const hScale = buildHScale(meteringMode);
  const vScale = buildVScale(meteringMode);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      let lv, rv;
      if (standbyRef.current) {
        // No signal — drop the numerical readout to -∞ immediately and decay
        // the held bar level to silence instead of freezing on the last sample.
        if (pro) {
          const setR = (key, val, color) => { const el = detail.current[key]; if (el) { el.textContent = val; if (color) el.style.color = color; } };
          setR('lPeak', '-∞', '#cbd5e1'); setR('rPeak', '-∞', '#cbd5e1');
          setR('lRms', '-∞'); setR('rRms', '-∞');
          setR('headroom', '∞'); setR('master', '-∞', '#cbd5e1');
        }
        if (disp.current[0] <= -100 && disp.current[1] <= -100) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const decay = 300 * dt;
        lv = Math.max(-100, disp.current[0] - decay);
        rv = Math.max(-100, disp.current[1] - decay);
      } else {
        [lv, rv] = readMeterValues(engine, monitor, meteringMode);
      }
      disp.current = [lv, rv];

      for (let row = 0; row < 2; row++) {
        const arr = segRefs.current[row];
        const v = row === 0 ? lv : rv;
        for (let i = 0; i < segments.length; i++) {
          const el = arr?.[i];
          if (!el) continue;
          const segDb = segments[i];
          const lit = segDb <= v;
          const col = colorForSeg(segDb, meteringMode);
          el.style.opacity = lit ? '1' : '0.12';
          el.style.boxShadow = lit ? `0 0 6px ${col}, 0 0 2px ${col}` : 'none';
        }
      }

      if (pro && !standbyRef.current) {
        const d = monitor === 'in' ? engine?.getDetailIn?.() : engine?.getDetail?.();
        if (d) {
          const lp2 = d.left.peak, lr = d.left.rms, rp2 = d.right.peak, rr = d.right.rms;
          const maxPeak = Math.max(lp2, rp2);
          const set = (key, val, color) => {
            const el = detail.current[key];
            if (el) { el.textContent = val; if (color) el.style.color = color; }
          };
          set('lPeak', fmt(lp2), peakColor(lp2));
          set('rPeak', fmt(rp2), peakColor(rp2));
          set('lRms', fmt(lr));
          set('rRms', fmt(rr));
          set('headroom', Math.max(0, -maxPeak).toFixed(1));
          set('master', fmt(maxPeak), peakColor(maxPeak));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine, pro, monitor, meteringMode, segments]);

  const setRef = (row, i) => (el) => {
    if (!segRefs.current[row]) segRefs.current[row] = [];
    segRefs.current[row][i] = el;
  };

  const Segment = ({ db, i, row, v }) => (
    <div
      ref={setRef(row, i)}
      className={v ? 'flex-1 w-full rounded-[1px]' : 'flex-1 rounded-[1px]'}
      style={{
        background: colorForSeg(db, meteringMode),
        opacity: 0.12,
        clipPath: v
          ? 'polygon(0 0, 100% 0, 100% 92%, 0 100%)'
          : 'polygon(0 0, 100% 0, 92% 100%, 0 100%)',
      }}
    />
  );

  const Channel = ({ label, row }) => {
    if (vertical) {
      return (
        <div className="flex h-full flex-col items-center gap-1">
          <div className="flex w-3.5 min-h-0 flex-1 flex-col-reverse gap-[1.5px]">
            {segments.map((db, i) => <Segment key={i} db={db} i={i} row={row} v />)}
          </div>
          <span className="text-[9px] font-mono text-slate-400">{label}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="w-4 text-[9px] font-mono text-slate-400 shrink-0">{label}</span>
        <div className="flex flex-1 gap-[1.5px] h-2.5">
          {segments.map((db, i) => <Segment key={i} db={db} i={i} row={row} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-cyan-500/20 bg-black px-3 py-2">
      {!vertical && (
      <div className="mb-1 flex h-5 shrink-0 items-center justify-between gap-2 overflow-hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-mono tracking-widest text-cyan-200/50">LEVEL</span>
          {isK && (
            <span className="shrink-0 whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono font-semibold text-emerald-300/80">
              K-System · 0 ≡ −{kRef} dBFS
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded border border-cyan-500/30 font-mono text-[8px]">
            <button
              onClick={() => setMonitor('in')}
              className={`px-1.5 py-0.5 transition-colors ${monitor === 'in' ? 'bg-cyan-400 text-black' : 'text-cyan-300/60 hover:bg-white/10'}`}
            >IN</button>
            <button
              onClick={() => setMonitor('out')}
              className={`px-1.5 py-0.5 transition-colors ${monitor === 'out' ? 'bg-cyan-400 text-black' : 'text-cyan-300/60 hover:bg-white/10'}`}
            >OUT</button>
          </div>
          <div className="flex overflow-hidden rounded border border-cyan-500/30 font-mono text-[8px]" title="Metering standard — Bob Katz K-System reference levels">
            {METER_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onMeteringModeChange?.(m.id)}
                className={`px-1.5 py-0.5 transition-colors ${meteringMode === m.id ? 'bg-emerald-400 text-black' : 'text-cyan-300/60 hover:bg-white/10'}`}
              >{m.label}</button>
            ))}
          </div>
        </div>
      </div>
      )}

      {vertical ? (
        <div className="flex min-h-0 flex-1 items-stretch gap-2 pr-3">
          {/* Left — 2/3 — LEVEL header at the top, MultiMeter + LUFS below */}
          <div className="flex min-w-0 flex-[2] flex-col gap-2 min-h-0">
            <div className="flex h-5 shrink-0 items-center gap-1.5 overflow-hidden">
              <span className="shrink-0 text-[10px] font-mono tracking-widest text-cyan-200/50">LEVEL</span>
              {isK && (
                <span className="shrink-0 whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono font-semibold text-emerald-300/80">
                  K-System · 0 ≡ −{kRef} dBFS
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <MultiMeter engine={engine} orientation="vertical" monitor={monitor} />
            </div>
            <LufsReadout engine={engine} compact />
          </div>
          {/* Right — 1/3 — IN/OUT directly above the LEDs, scale locked to the LED row, K buttons spread across the left space */}
          <div className="flex min-w-0 flex-[1] items-stretch gap-2">
            {/* left space — K-system buttons as a small vertical column, centred between the edge and the meter */}
            <div className="flex min-w-0 flex-1 flex-col items-center justify-end pb-2">
              <div className="flex shrink-0 flex-col gap-1">
                {METER_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onMeteringModeChange?.(m.id)}
                    title="Metering standard — Bob Katz K-System reference levels"
                    className={`rounded border px-1.5 py-0.5 text-[8px] font-mono font-semibold transition-colors ${meteringMode === m.id ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-cyan-500/30 text-cyan-300/60 hover:bg-white/10'}`}
                  >{m.label}</button>
                ))}
              </div>
            </div>
            {/* meter block — grid: IN/OUT centred over L+R (col-span-2), scale aligned with the LED row, L/R labels below */}
            <div className="grid shrink-0 grid-cols-[14px_14px_16px] grid-rows-[auto_1fr_auto] gap-1.5">
              <div className="col-span-2 mb-1.5 flex justify-center">
                <div className="flex shrink-0 overflow-hidden rounded border border-cyan-500/30 font-mono text-[8px]">
                  <button onClick={() => setMonitor('in')} className={`w-9 text-center py-0.5 transition-colors ${monitor === 'in' ? 'bg-cyan-400 text-black' : 'text-cyan-300/60 hover:bg-white/10'}`}>IN</button>
                  <button onClick={() => setMonitor('out')} className={`w-9 text-center py-0.5 transition-colors ${monitor === 'out' ? 'bg-cyan-400 text-black' : 'text-cyan-300/60 hover:bg-white/10'}`}>OUT</button>
                </div>
              </div>
              <div className="col-start-1 row-start-2 flex flex-col-reverse gap-[1.5px]">
                {segments.map((db, i) => <Segment key={i} db={db} i={i} row={0} v />)}
              </div>
              <div className="col-start-2 row-start-2 flex flex-col-reverse gap-[1.5px]">
                {segments.map((db, i) => <Segment key={i} db={db} i={i} row={1} v />)}
              </div>
              <div className="col-start-3 row-start-2 flex flex-col justify-between text-[7px] font-mono leading-none text-slate-500">
                {vScale.map((l) => <span key={l}>{l}</span>)}
              </div>
              <span className="col-start-1 row-start-3 text-center text-[9px] font-mono text-slate-400">L</span>
              <span className="col-start-2 row-start-3 text-center text-[9px] font-mono text-slate-400">R</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Channel label="L" row={0} />
          <Channel label="R" row={1} />
          <div className="mt-0.5 flex justify-between pl-6 pr-1">
            {hScale.map((l) => <span key={l} className="text-[7px] font-mono text-slate-500">{l}</span>)}
          </div>
          <div className="mt-2">
            <MultiMeter engine={engine} orientation="horizontal" monitor={monitor} />
          </div>
          <div className="mt-2 min-h-0 flex-1">
            <SpectrumBars
              analyzerNode={monitor === 'in' ? inAnalyzer : outAnalyzer}
              ghostAnalyzerNode={monitor === 'in' ? outAnalyzer : inAnalyzer}
              audioContext={audioContext}
              fill
              label={monitor === 'in' ? 'IN SPECTRUM' : 'OUT SPECTRUM'}
              ghostLabel={monitor === 'in' ? 'OUT GHOST' : 'DRY GHOST'}
            />
          </div>
        </div>
      )}

      {!vertical && (
        <div className="mt-2 shrink-0">
          <LufsReadout engine={engine} compact={false} />
        </div>
      )}

      {pro && !vertical && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-white/10 pt-2 font-mono text-[9px]">
          <div className="flex justify-between"><span className="text-slate-500">L PK</span><span ref={(el) => (detail.current.lPeak = el)} className="text-slate-200">-∞</span></div>
          <div className="flex justify-between"><span className="text-slate-500">R PK</span><span ref={(el) => (detail.current.rPeak = el)} className="text-slate-200">-∞</span></div>
          <div className="flex justify-between"><span className="text-slate-500">L RMS</span><span ref={(el) => (detail.current.lRms = el)} className="text-slate-300">-∞</span></div>
          <div className="flex justify-between"><span className="text-slate-500">R RMS</span><span ref={(el) => (detail.current.rRms = el)} className="text-slate-300">-∞</span></div>
          <div className="flex justify-between"><span className="text-slate-500">MASTER</span><span ref={(el) => (detail.current.master = el)} className="text-slate-200">-∞</span></div>
          <div className="flex justify-between"><span className="text-slate-500">HEADROOM</span><span ref={(el) => (detail.current.headroom = el)} className="text-cyan-300">∞</span></div>
        </div>
      )}
    </div>
  );
}