import React from 'react';

/**
 * Two-position milled metal rocker — native AppShell paintMetalRocker twin.
 * Used for Plug in / Desktop and Basic / PRO. Not giant white pills.
 */
export default function MetalRocker({
  options,
  value,
  onChange,
  gem = '#38e0ff',
  light = false,
  height = 42,
  className = '',
}) {
  const selected = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div
      className={`relative grid grid-cols-2 overflow-hidden rounded-lg ${className}`}
      style={{
        height,
        background: light
          ? 'linear-gradient(180deg, #5a655c, #6a756c)'
          : 'linear-gradient(180deg, #10131a, #171b24)',
        boxShadow: light
          ? 'inset 0 1px 0 rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.16)'
          : 'inset 0 1px 0 rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <span
        className="pointer-events-none absolute top-1.5 bottom-1.5 left-1/2 w-px"
        style={{ background: light ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.45)' }}
      />
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <button
            key={o.id}
            type="button"
            title={o.hint || o.label}
            onClick={() => onChange?.(o.id)}
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 px-1"
          >
            {on && (
              <span
                className="pointer-events-none absolute inset-[2.5px] rounded-md"
                style={{
                  background: light
                    ? 'linear-gradient(180deg, #d5ddd5, #b4c0b6)'
                    : `linear-gradient(180deg, color-mix(in srgb, #2c3340 90%, ${gem}), #161a22)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,${light ? 0.22 : 0.1})`,
                }}
              />
            )}
            {on && (
              <span
                className="pointer-events-none absolute left-2.5 right-2.5 top-[3.5px] h-0.5 rounded-full"
                style={{ background: gem }}
              />
            )}
            {o.icon && (
              <span className="relative z-10" style={{ color: on ? gem : light ? 'rgba(42,52,47,0.65)' : 'rgba(255,255,255,0.48)' }}>
                {o.icon}
              </span>
            )}
            <span
              className="relative z-10 text-[9px] font-bold uppercase tracking-[0.10em]"
              style={{
                color: on
                  ? (light ? '#1A1A1A' : 'rgba(255,255,255,0.94)')
                  : (light ? '#2a342f' : 'rgba(255,255,255,0.58)'),
              }}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
