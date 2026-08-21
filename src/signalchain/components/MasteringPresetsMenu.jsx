import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { FACTORY_PRESETS } from '@/signalchain/mastering/factoryPresets.js';
import { applyRecipe } from '@/signalchain/mastering/applyRecipe.js';

/**
 * Compact `< STREAMING POP ▾ >` factory browser.
 * Chain header and Mastering Studio right rail share `engine.factoryPreset`.
 */
export default function MasteringPresetsMenu({ engine, className = '' }) {
  const [open, setOpen] = useState(false);
  const n = FACTORY_PRESETS.length;
  const active = Math.max(0, Math.min(n - 1, engine?.factoryPreset ?? 0));

  const apply = (i) => {
    const p = FACTORY_PRESETS[i];
    if (!p) return;
    if (!p.recipe) engine?.handleReset?.();
    else {
      applyRecipe(engine, p.recipe);
      engine?.setFactoryPreset?.(i);
    }
    setOpen(false);
  };
  const step = (dir) => {
    if (!n) return;
    apply((active + dir + n) % n);
  };

  const activeName = FACTORY_PRESETS[active]?.name ?? 'Presets';
  const arrowCls =
    'flex items-center justify-center rounded-md border border-white/15 bg-black/40 text-white/55 transition-all hover:bg-white/10 hover:text-white';

  return (
    <div className={`relative z-30 flex w-full items-center gap-1 ${className}`}>
      <button type="button" onClick={() => step(-1)} title="Previous preset" className={arrowCls} style={{ height: 24, width: 22 }}>
        <ChevronLeft size={14} />
      </button>
      <div className="relative z-30 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={activeName}
          className="flex h-6 w-full items-center gap-1.5 rounded-md border border-white/15 bg-black/40 px-2.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-white/70 transition-all hover:bg-white/10"
        >
          <span className="min-w-0 flex-1 truncate text-left">{activeName}</span>
          <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-8 z-50 w-[312px] rounded-lg border border-white/15 bg-[#060b14] p-1 shadow-2xl">
              <div className="px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-white/40">Mastering Presets</div>
              <div className="max-h-[60vh] overflow-y-auto">
                {FACTORY_PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => apply(i)}
                    title={p.info}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] transition-all ${i === active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10'}`}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-[8px] text-white/35">{p.targetLufs}L</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={() => step(1)} title="Next preset" className={arrowCls} style={{ height: 24, width: 22 }}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
