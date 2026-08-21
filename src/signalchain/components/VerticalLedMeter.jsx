import React, { useEffect, useRef } from 'react';
import LufsReadout from './LufsReadout';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';
import { K_REFS, isKMode, buildSegments, colorForSeg, buildVScaleMap, readMeterValues } from '../meteringMode.js';

/**
 * VerticalLedMeter — standalone segmented L/R LED level column that follows
 * the Master Level Meter's metering-mode selection (dBFS / K-12 / K-14 / K-20).
 * Pure presentational; the parent owns the engine and the metering mode — no
 * selector buttons here, it just mirrors the master meter's scale.
 *
 * Used beside the Final Output visualizer so the master out has a dedicated
 * digital LED meter without changing the spectrum/scope panel.
 */
export default function VerticalLedMeter({ engine, monitor = 'out', showLufs = true, meteringMode = 'dBFS', compact = false }) {
  const segRefs = useRef([[], []]);
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const disp = useRef([-100, -100]);
  const segments = buildSegments(meteringMode);
  const vScaleMap = buildVScaleMap(meteringMode);
  const kRef = K_REFS[meteringMode] || 0;
  const isK = isKMode(meteringMode);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      let l, r;
      if (standbyRef.current) {
        // No signal — decay the held level to silence so the meter drops to
        // -∞ instead of freezing on the last sample.
        if (disp.current[0] <= -100 && disp.current[1] <= -100) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const decay = 300 * dt;
        l = Math.max(-100, disp.current[0] - decay);
        r = Math.max(-100, disp.current[1] - decay);
      } else {
        [l, r] = readMeterValues(engine, monitor, meteringMode);
      }
      disp.current = [l, r];
      for (let row = 0; row < 2; row++) {
        const arr = segRefs.current[row];
        const db = row === 0 ? l : r;
        for (let i = 0; i < segments.length; i++) {
          const el = arr?.[i];
          if (!el) continue;
          const segDb = segments[i];
          const lit = segDb <= db;
          const col = colorForSeg(segDb, meteringMode);
          el.style.opacity = lit ? '1' : '0.12';
          el.style.boxShadow = lit ? `0 0 6px ${col}, 0 0 2px ${col}` : 'none';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine, monitor, meteringMode, segments]);

  const setRef = (row, i) => (el) => {
    if (!segRefs.current[row]) segRefs.current[row] = [];
    segRefs.current[row][i] = el;
  };

  const Channel = ({ label, row }) => (
    <div className="flex h-full flex-col items-center gap-1">
      {/* Track "well": a defined dark rounded background with 1px inset so the
          LED segments sit centered and contained — they can no longer spill
          over the track boundary or drift off the dB grid. */}
      <div className={`flex ${compact ? 'w-3 gap-[1px]' : 'w-3.5 gap-[1.5px]'} min-h-0 flex-1 flex-col-reverse rounded-sm bg-black/70 p-[1px]`}>
        {segments.map((db, i) => (
          <div
            key={i}
            ref={setRef(row, i)}
            className="w-full flex-1 rounded-[1px]"
            style={{ background: colorForSeg(db, meteringMode), opacity: 0.12, clipPath: 'polygon(0 0, 100% 0, 100% 92%, 0 100%)' }}
          />
        ))}
      </div>
      <span className={`font-mono text-slate-400 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>{label}</span>
    </div>
  );

  return (
    <div className={`flex h-full flex-col ${compact ? 'gap-1 rounded-lg border border-cyan-500/20 bg-black/80 px-1.5 py-1.5' : 'gap-1.5 rounded-xl border border-cyan-500/20 bg-black px-2 py-2'}`}>
      {!compact && (
        <span className="text-center text-[8px] font-mono tracking-widest text-cyan-200/50" title={isK ? `Bob Katz K-System · 0 dB ≡ −${kRef} dBFS` : 'Digital full-scale'}>
          {isK ? `K · 0≡−${kRef}` : 'dBFS'}
        </span>
      )}
      <div className={`flex min-h-0 ${compact ? 'flex-1 items-stretch justify-center gap-1' : 'flex-[3] items-stretch justify-center gap-2'}`}>
        <Channel label="L" row={0} />
        <Channel label="R" row={1} />
        {!compact && (
          /* Scale column — one slot per segment mirroring the segment flex
             layout (flex-col-reverse, same gap, same L/R spacer height), so each
             dB label sits exactly on its lit segment instead of being evenly
             distributed (which drifted off the dB grid: 0/-3/-6/-12/-20/-30 are
             not evenly spaced). */
          <div className="flex h-full flex-col gap-1">
            <div className="flex min-h-0 flex-1 flex-col-reverse gap-[1.5px]">
              {segments.map((db, i) => (
                <div key={i} className="flex flex-1 items-center justify-end">
                  {vScaleMap[db] ? (
                    <span className="px-0.5 text-[7px] font-mono leading-none text-slate-500 whitespace-nowrap">{vScaleMap[db]}</span>
                  ) : null}
                </div>
              ))}
            </div>
            <span className="text-[9px] font-mono opacity-0 select-none" aria-hidden>L</span>
          </div>
        )}
      </div>
      {showLufs && (
        <div className="shrink-0">
          <LufsReadout engine={engine} compact />
        </div>
      )}
    </div>
  );
}