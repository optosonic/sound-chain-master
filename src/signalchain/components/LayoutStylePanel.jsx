import React from 'react';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ViewModeSwitcher from '@/components/ViewModeSwitcher';
import InfoButton from './InfoButton.jsx';

/**
 * Layout & Style control panel.
 * Combines the Visual Identity controls (theme preset + display mode) with
 * the global panel-layout selector (wide / medium / narrow) into a single
 * surfaced panel. Uses the theme-neutral `sc-stable` chrome so the theme
 * switcher never inherits the identity it is switching.
 */
const LAYOUT_OPTIONS = [
  { id: 'wide', label: 'Wide', hint: '5:8' },
  { id: 'medium', label: 'Medium', hint: '3:4' },
  { id: 'narrow', label: 'Narrow', hint: '1:1' },
];

export default function LayoutStylePanel({
  layout = 'wide',
  onLayoutChange,
  mode,
  onModeChange,
  className = '',
}) {
  return (
    <section className={`sc-stable ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="sc-title text-center text-sm font-bold uppercase tracking-[0.18em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">Layout &amp; Style</h2>
        <div className="flex items-center gap-2">
          <InfoButton panelId="visualidentity" accent="#8b5cf8" />
          <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/40">
            {layout}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-2">
        <div className="flex flex-col items-stretch gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">Theme Preset</span>
          <ThemeSwitcher />
        </div>

        <div className="flex flex-col items-stretch gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">Display Mode</span>
          <ViewModeSwitcher mode={mode} onChange={onModeChange} floating={false} />
        </div>

        <div>
          <label className="text-xs text-white/50">Panel Layout</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {LAYOUT_OPTIONS.map((o) => {
              const active = layout === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onLayoutChange?.(o.id)}
                  className={`flex items-baseline gap-1.5 rounded-xl border px-2 py-2 text-left min-w-0 transition-all ${
                    active
                      ? 'border-violet-400/60 bg-gradient-to-br from-violet-500/30 to-cyan-500/20 shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                      : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className={`text-xs font-semibold leading-tight truncate ${active ? 'text-white' : 'text-white/70'}`}>
                    {o.label}
                  </span>
                  <span className="text-[10px] leading-snug text-white/45">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}