import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Palette } from 'lucide-react';
import { THEMES, useTheme } from '@/signalchain/themes.jsx';

const ACCENT = '#9B86D4';

/**
 * ThemePresetNav — compact Vital-style navigator for the six visual-identity
 * themes, sized to sit in the transport bar's empty middle of the plugin
 * windows. Left/right chevrons step through the lane (wrapping); the reset
 * button returns to the first theme (Precision Studio). The centre capsule
 * shows the active theme name + index, mirroring the mastering PresetNavBar.
 */
export default function ThemePresetNav() {
  const { theme, setTheme } = useTheme();
  const count = THEMES.length;
  const [idx, setIdx] = useState(() => {
    const i = THEMES.findIndex((t) => t.key === theme.key);
    return i < 0 ? 0 : i;
  });

  // Keep the capsule in sync if the theme changes elsewhere.
  useEffect(() => {
    const i = THEMES.findIndex((t) => t.key === theme.key);
    if (i >= 0) setIdx(i);
  }, [theme.key]);

  const step = (dir) => {
    const next = (idx + dir + count) % count;
    setIdx(next);
    setTheme(THEMES[next].key);
  };
  const reset = () => { setIdx(0); setTheme(THEMES[0].key); };

  const btn =
    'flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white';

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => step(-1)} title="Previous theme" className={btn}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <div className="flex min-w-[150px] items-center rounded-full border border-white/15 bg-[#4B4E4D] px-3 py-1">
        <Palette className="mr-1.5 h-3 w-3 shrink-0" style={{ color: ACCENT }} />
        <span className="truncate text-[11px] font-semibold tracking-tight text-neutral-100">{THEMES[idx].name}</span>
        <span className="ml-2 shrink-0 font-mono text-[9px] text-neutral-400">{idx + 1}/{count}</span>
      </div>
      <button onClick={() => step(1)} title="Next theme" className={btn}>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button onClick={reset} title="Reset theme" className={btn}>
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}