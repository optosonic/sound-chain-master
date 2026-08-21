import React from 'react';
import { useTheme, THEMES } from '@/signalchain/themes.jsx';

/**
 * Switches the live visual identity of Sound Chain Master across the five
 * magazine styles. Active style is filled with its accent colour.
 */
export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {THEMES.map((t, i) => {
        const active = theme.key === t.key;
        // The Visual Identity panel is a light faceplate in B&K, so its theme
        // buttons need a light style — and the active B&K button is a cool
        // lit-up highlight instead of a heavy dark-green block.
        const onLight = theme.key === 'bk';
        const last = THEMES.length % 2 === 1 && i === THEMES.length - 1;
        const idle = onLight
          ? 'bg-black/[0.04] border-black/15 text-black/70 hover:bg-black/10 hover:text-black'
          : 'bg-black/35 border-white/25 text-white/90 hover:bg-black/55 hover:text-white';
        return (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            title={t.blurb}
            className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-medium border transition-all ${
              last ? 'col-span-2 ' : ''
            }${active ? 'text-black' : idle}`}
            style={
              active
                ? onLight
                  ? { background: 'linear-gradient(160deg,#eef6ef,#d4e8dc)', borderColor: '#2C5F52', boxShadow: '0 0 16px rgba(125,211,252,0.45), inset 0 0 10px rgba(167,224,246,0.55), inset 0 1px 0 rgba(255,255,255,0.6)' }
                  : { background: t.accent, borderColor: t.accent, boxShadow: `0 0 14px ${t.accent}66` }
                : undefined
            }
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}