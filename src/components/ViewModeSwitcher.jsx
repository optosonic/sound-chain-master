import React from 'react';
import { Maximize2, Monitor } from 'lucide-react';

const MODES = [
  { key: 'plugin', label: 'Plug in', hint: '1200×800', icon: Maximize2 },
  { key: 'full', label: 'Desktop', hint: 'Full studio', icon: Monitor },
];

export default function ViewModeSwitcher({ mode, onChange, floating = true }) {
  if (floating) {
    return (
      <div className="fixed top-3 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/65 px-1.5 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">View</span>
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => onChange(m.key)}
              title={`${m.label} — ${m.hint}`}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all ${active ? 'bg-white text-black shadow' : 'text-white/70 hover:bg-white/10'}`}
            >
              <Icon size={12} /> {m.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            title={`${m.label} — ${m.hint}`}
            className={`group flex items-center gap-2 rounded-xl border px-2 py-2 text-left transition-all ${
              active
                ? 'border-white/80 bg-white text-black shadow-[0_0_14px_rgba(255,255,255,0.25)]'
                : 'border-white/10 bg-black/30 text-white/70 hover:border-white/25 hover:bg-white/5'
            }`}
          >
            <Icon size={13} className={`shrink-0 ${active ? 'text-black' : 'text-white/55 group-hover:text-white/80'}`} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[11px] font-semibold leading-tight">{m.label}</span>
              <span className={`text-[8px] leading-tight tracking-wide ${active ? 'text-black/55' : 'text-white/35'}`}>{m.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
