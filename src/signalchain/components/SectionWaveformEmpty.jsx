import React from 'react';
import { useTheme } from '@/signalchain/themes.jsx';

/**
 * Empty state for the Section Mastering waveform area — shown when no audio
 * file is loaded. Renders a recessed "screen" gradient that follows the active
 * visual identity (darker than the panel, tinted with the theme accent), a
 * standard waveform grid (horizontal + vertical lines) and a centre axis so
 * the area reads as a reserved audio container, with a slightly larger
 * instructional label.
 *
 * B&K Lab keeps the lighter "Section A" blue-grey the Final Output uses.
 */
const THEME_STYLES = {
  dark:      { bg: 'linear-gradient(180deg,#142030,#0a1220)', grid: 'rgba(125,211,252,0.10)', axis: 'rgba(125,211,252,0.30)', text: '#9fd9f5' },
  glass:     { bg: 'linear-gradient(180deg,#2a2148,#140a2c)', grid: 'rgba(245,208,254,0.10)', axis: 'rgba(245,208,254,0.30)', text: '#f5d0fe' },
  titanium:  { bg: 'linear-gradient(180deg,#2a2d33,#181a1f)', grid: 'rgba(212,160,74,0.10)',  axis: 'rgba(212,160,74,0.32)',  text: '#e6d3a6' },
  retro:     { bg: 'linear-gradient(165deg,#241a0e,#140d07)', grid: 'rgba(255,184,77,0.10)',  axis: 'rgba(255,184,77,0.30)',  text: '#ffd56b' },
  hud:       { bg: 'linear-gradient(180deg,#02141c,#000408)', grid: 'rgba(0,240,255,0.14)',  axis: 'rgba(0,240,255,0.40)',  text: '#7df9ff' },
  bk:        { bg: 'linear-gradient(180deg,#8a99a4,#6b7a85)', grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.25)', text: '#eaf2f7' },
};

export default function SectionWaveformEmpty({ loading }) {
  const { theme } = useTheme();
  const s = THEME_STYLES[theme?.key] || THEME_STYLES.dark;
  const gridColor = s.grid;

  return (
    <div
      className="relative flex h-[220px] items-center justify-center rounded-lg border border-white/15 overflow-hidden"
      style={{
        background:
          `linear-gradient(${gridColor} 1px, transparent 1px) left top / 100% 44px,` +
          `linear-gradient(90deg, ${gridColor} 1px, transparent 1px) left top / 80px 100%,` +
          s.bg,
      }}
    >
      {/* centre (zero) axis — a hair brighter than the grid so it reads as the waveform baseline */}
      <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: s.axis }} />
      <span
        className="relative text-[14px] font-mono tracking-wide text-center px-4"
        style={{ color: s.text }}
      >
        {loading ? 'Decoding waveform…' : 'Load an audio file to see the waveform'}
      </span>
    </div>
  );
}