import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Bookmark } from 'lucide-react';
import { FACTORY_PRESETS } from '../mastering/factoryPresets.js';
import { MEDIUMS, STYLES } from '../mastering/masterPresets.js';
import { applyRecipe } from '../mastering/applyRecipe.js';
import { useUserPresets, toLaneEntry } from './useUserPresets.js';

const ACCENT = '#a78bfa';

/**
 * PresetNavBar — Vital-style pill preset browser for the FACTORY mastering
 * presets. Centre label shows the current preset name; the left/right
 * chevrons step through the lane (wrapping). Selecting a preset applies its
 * recipe to the live engine; "Init Preset" (index 0) performs a full reset.
 *
 * A metadata strip beneath the pill shows the preset's target medium, style
 * and target LUFS plus the author/info line — the JSON "lane" made visible.
 */
export default function PresetNavBar({ engine }) {
  const userPresets = useUserPresets();
  const lane = useMemo(() => [...FACTORY_PRESETS, ...userPresets.map(toLaneEntry)], [userPresets]);
  const [idx, setIdx] = useState(0);
  const count = lane.length;
  const safeIdx = Math.min(idx, count - 1);
  const current = lane[safeIdx];

  const apply = (i) => {
    const p = lane[i];
    if (!p) return;
    if (p.userState) {
      engine?.applyState?.(p.userState);
    } else if (!p.recipe) {
      engine?.handleReset?.();
    } else {
      applyRecipe(engine, p.recipe);
    }
  };

  const step = (dir) => {
    const next = (safeIdx + dir + count) % count;
    setIdx(next);
    apply(next);
  };

  const reset = () => {setIdx(0);apply(0);};

  const medium = MEDIUMS[current?.medium] || MEDIUMS.album;
  const style = STYLES[current?.style] || STYLES.medium;

  return (
    <div className="rounded-lg border border-white/15 bg-black/40 p-2.5">
      <div className="flex items-center justify-center gap-3">
        {/* left chevron */}
        <button
          onClick={() => step(-1)}
          title="Previous preset"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white">
          
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* pill */}
        <div className="flex min-w-[220px] items-center justify-center rounded-full border border-white/15 bg-[#4a524d] px-6 py-2">
          <Bookmark className="mr-2 h-3.5 w-3.5" style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold tracking-tight text-neutral-200">{current.name}</span>
          <span className="ml-2 text-[10px] font-mono text-neutral-400">{idx + 1}/{count}</span>
        </div>

        {/* right chevron */}
        <button
          onClick={() => step(1)}
          title="Next preset"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white">
          
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={reset}
          title="Reset to Init"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white">
          
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* metadata lane — medium · style · target LUFS + info */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
        <span className="rounded-md border border-violet-400/50 bg-violet-600/55 px-2 py-0.5 font-mono font-semibold text-violet-100">{medium.label}</span>
        <span className="rounded-md border border-cyan-400/50 bg-cyan-600/55 px-2 py-0.5 font-mono font-semibold text-cyan-100">{style.label}</span>
        <span className="rounded-md border border-amber-400/50 bg-amber-600/55 px-2 py-0.5 font-mono font-semibold text-amber-100">{current.targetLufs} LUFS</span>
        <span className="text-white/40">·</span>
        <span className="font-mono text-white/40">{current.author}</span>
      </div>
      <p className="mt-1.5 text-center text-[10px] leading-relaxed text-white/55">{current.info}</p>
    </div>);

}