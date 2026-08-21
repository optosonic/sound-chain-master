import React from 'react';
import { Loader2, Download } from 'lucide-react';

/**
 * Render-progress popup — shown while Render & Download runs.
 *
 * The offline render is a single OfflineAudioContext.startRendering() call with
 * no per-sample progress callback (a Web Audio limit), so a smooth 0–100% bar
 * isn't possible. Instead this reports the render's discrete stages — decode →
 * render passes → finalize → encode — whose boundaries ARE exact. The bar
 * advances to each stage's band; the active stage pulses while in flight.
 */
const STAGES = [
  { key: 'decode',   label: 'Decoding source',        band: [0, 8] },
  { key: 'render',   label: 'Rendering chain',        band: [8, 84] },
  { key: 'fallback', label: 'Fallback render',        band: [84, 88] },
  { key: 'finalize', label: 'True-peak ceiling',      band: [88, 92] },
  { key: 'encode',   label: 'Encoding',               band: [92, 100] },
];

export default function RenderProgress({ progress }) {
  if (!progress) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress.pct ?? 0)));
  const activeKey = progress.stage || 'render';
  const activeIdx = STAGES.findIndex((s) => s.key === activeKey);
  const done = progress.stage === 'done';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(6,8,12,0.78)', backdropFilter: 'blur(3px)' }}>
      <div
        className="sc-panel relative w-[min(420px,90vw)] p-5"
        style={{ background: 'linear-gradient(160deg,#24272d,#13161b)', border: '1px solid rgba(245,158,11,0.28)', boxShadow: '0 18px 50px rgba(0,0,0,0.7), 0 0 24px rgba(245,158,11,0.12)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          {done
            ? <Download className="w-4 h-4 text-amber-400" />
            : <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
          <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/90">
            {done ? 'Master exported' : 'Rendering master'}
          </h3>
        </div>
        <p className="text-[11px] font-mono text-white/70 mb-3 truncate">{progress.label || 'Working…'}</p>

        {/* bar */}
        <div className="relative h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg,#ffcf6a,#f59e0b)',
              boxShadow: '0 0 10px rgba(245,158,11,0.7)',
            }}
          />
          {/* indeterminate shimmer on the active (non-done) render stage */}
          {!done && (
            <div
              className="absolute inset-y-0 w-1/3 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                animation: 'sc-render-shimmer 1.1s linear infinite',
              }}
            />
          )}
        </div>

        {/* stage list */}
        <ul className="mt-3 space-y-1">
          {STAGES.map((s, i) => {
            const state = done || i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending';
            return (
              <li key={s.key} className="flex items-center gap-2 text-[10px] font-mono">
                <span
                  className="grid place-items-center w-3.5 h-3.5 rounded-full text-[8px]"
                  style={{
                    background: state === 'done' ? 'rgba(16,185,129,0.22)' : state === 'active' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${state === 'done' ? 'rgba(16,185,129,0.6)' : state === 'active' ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.14)'}`,
                    color: state === 'done' ? '#34d399' : state === 'active' ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {state === 'done' ? '✓' : state === 'active' ? '•' : ''}
                </span>
                <span style={{ color: state === 'pending' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)' }}>{s.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 text-right text-[10px] font-mono text-white/55">{pct}%</div>

        <style>{`@keyframes sc-render-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(420%); } }`}</style>
      </div>
    </div>
  );
}