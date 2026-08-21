import React from 'react';

/**
 * Quiet 12AX7 preamp schematic — native AppShell::paintTubeSchematic twin.
 * Faint SVG layer on leftover header plate. pointer-events none.
 */
export default function TubeSchematic({ gem = '#38e0ff', light = false }) {
  const ink = light ? gem : gem;
  const a = light ? 0.13 : 0.11;
  const stroke = ink;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1280 128"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ opacity: a }}
    >
      <g fill="none" stroke={stroke} strokeWidth="0.9" strokeLinecap="round">
        <line x1="420" y1="16" x2="1180" y2="16" />
        <line x1="420" y1="112" x2="1180" y2="112" />
        <text x="422" y="13" fill={stroke} stroke="none" fontSize="7" fontWeight="700" letterSpacing="0.18em">B+</text>
        {[0, 1, 2].map((i) => {
          const cx = 620 + i * 175;
          const cy = 58;
          const r = 20;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} />
              <line x1={cx - 8} y1={cy - 8} x2={cx + 8} y2={cy - 8} strokeWidth="1.05" />
              <line x1={cx} y1={cy - 8} x2={cx} y2={cy - r} />
              <line x1={cx - 10} y1={cy} x2={cx + 9} y2={cy} strokeDasharray="1.55 1.15" />
              <line x1={cx - 10} y1={cy} x2={cx - r} y2={cy} />
              <path d={`M${cx - 8} ${cy + 5} V${cy + 7.4} H${cx + 8} V${cy + 5}`} />
              <line x1={cx} y1={cy + 7.4} x2={cx} y2={cy + r} />
              <text x={cx + 6} y={cy + r + 8} fill={stroke} stroke="none" fontSize="6.5" fontWeight="700" letterSpacing="0.16em">12AX7</text>
            </g>
          );
        })}
        <line x1="430" y1="58" x2="600" y2="58" />
        <line x1="640" y1="58" x2="775" y2="58" />
        <line x1="815" y1="58" x2="950" y2="58" />
        <line x1="990" y1="58" x2="1170" y2="58" />
      </g>
    </svg>
  );
}
