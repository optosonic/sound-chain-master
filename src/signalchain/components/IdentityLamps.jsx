import React from 'react';
import { THEMES, useTheme } from '@/signalchain/themes.jsx';

/**
 * Six circular identity lamps — native AppShell paintIdentityLamp twin.
 * Gem LED in a milled metal disc. Selected lamp is brighter; not colour squares.
 */
export default function IdentityLamps() {
  const { theme, setTheme } = useTheme();
  const light = theme.key === 'bk';

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div
        className="flex items-center gap-2 rounded-[14px] px-2 py-1.5"
        style={{
          background: light
            ? 'linear-gradient(180deg, rgba(90,101,92,0.55), rgba(74,84,75,0.7))'
            : 'linear-gradient(180deg, rgba(16,19,26,0.85), rgba(10,12,16,0.92))',
          boxShadow: light
            ? 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.22)'
            : 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}
      >
        {THEMES.map((t) => {
          const on = theme.key === t.key;
          const gem = t.gem || t.accent;
          return (
            <button
              key={t.key}
              type="button"
              title={t.name}
              onClick={() => setTheme(t.key)}
              className="relative h-9 w-9 shrink-0 rounded-full"
              style={{
                background: light
                  ? 'linear-gradient(180deg, #c5cec6, #8f9e93)'
                  : 'linear-gradient(180deg, #2a303c, #12151c)',
                boxShadow: on
                  ? `0 1px 0 rgba(0,0,0,${light ? 0.18 : 0.5}), 0 0 10px ${gem}88`
                  : `0 1px 0 rgba(0,0,0,${light ? 0.18 : 0.5})`,
              }}
            >
              <span
                className="pointer-events-none absolute inset-[2px] rounded-full"
                style={{
                  border: `1.15px solid rgba(0,0,0,${light ? 0.28 : 0.55})`,
                  boxShadow: `inset 0 0 0 0.85px rgba(255,255,255,${light ? 0.2 : 0.1})`,
                }}
              />
              {on && (
                <span
                  className="pointer-events-none absolute inset-[4px] rounded-full"
                  style={{ boxShadow: `0 0 10px ${gem}aa`, border: `1.35px solid ${gem}` }}
                />
              )}
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background: gem,
                  opacity: on ? 1 : light ? 0.42 : 0.28,
                  boxShadow: on
                    ? `0 0 8px ${gem}, inset 0 0 2px rgba(255,255,255,0.7)`
                    : `inset 0 0 2px rgba(255,255,255,0.22)`,
                }}
              />
              <span
                className="pointer-events-none absolute left-[38%] top-[32%] h-[18%] w-[18%] rounded-full bg-white"
                style={{ opacity: on ? 0.65 : 0.22 }}
              />
            </button>
          );
        })}
      </div>
      <span
        className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.20em]"
        style={{ color: light ? 'rgba(26,26,26,0.72)' : theme.title ? undefined : 'rgba(255,255,255,0.78)' }}
      >
        <span style={{ backgroundImage: theme.title, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: light ? undefined : 'transparent', color: light ? '#1A1A1A' : undefined }}>
          {theme.name}
        </span>
      </span>
    </div>
  );
}
