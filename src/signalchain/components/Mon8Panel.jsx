import React, { useState } from 'react';
import { CircleDot, Power, Radar } from 'lucide-react';
import Dial from './Dial';
import InfoButton from './InfoButton';
import Mon8Goniometer from './Mon8Goniometer';
import { DEFAULT_MON8 } from '../useSignalChainEngine';

const ACCENT = '#5b6cb8'; // muted indigo — reads on the muted faceplate

/**
 * Mon8 — Bass Mono / Low-Frequency Stereo Collapse.
 *
 * Faceplate: dark glassy upper visualizer zone + a muted, slightly-warm lower
 * faceplate whose top edge is a SINGLE smooth bell arch (one bump), rising at
 * the centre to the panel's vertical midpoint. Symmetric, machined bevel.
 *
 * Props: mon8, onChange
 */

// Single bell: y(x) = edgeY − bump·sin²(πx/W). 0 at edges, peak (−bump) at centre.
const bellFillPath = (W, H, edgeY, bump, n = 80) => {
  const top = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    const s = Math.sin((Math.PI * x) / W);
    const y = edgeY - bump * s * s;
    top.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${top[0]} L ${top.slice(1).join(' L ')} L ${W} ${H} L 0 ${H} Z`;
};
const bellEdgePath = (W, edgeY, bump, n = 80) => {
  const top = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    const s = Math.sin((Math.PI * x) / W);
    const y = edgeY - bump * s * s;
    top.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${top[0]} L ${top.slice(1).join(' L ')}`;
};

export default function Mon8Panel({ mon8, onChange, analyzers }) {
  const safe = { ...DEFAULT_MON8, ...(mon8 || {}) };
  const set = (k, v) => onChange?.({ ...safe, [k]: v });
  const [showGonio, setShowGonio] = useState(false);
  const freq = safe.frequency;
  const width = safe.width;
  const slope = safe.slope === 12 ? 12 : 24;

  // Lower faceplate SVG geometry (viewBox mapped to the lower zone).
  // Peak of the bell reaches y=0 (the panel's vertical midpoint); edges sit
  // ~62 units below — a gentle single bump.
  const CW = 360, CH = 235, edgeY = 64, bump = 64;
  const fillD = bellFillPath(CW, CH, edgeY, bump);
  const edgeD = bellEdgePath(CW, edgeY, bump);

  // Field-visualizer values.
  const fNorm = (Math.log10(Math.max(20, freq)) - Math.log10(20)) / (Math.log10(500) - Math.log10(20));
  const cutX = 36 + fNorm * 288;
  const monoOpacity = 0.28 + width * 0.55;
  const fLabel = freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)}`;

  const seg = (active, onClick, label) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all rounded ${active ? 'text-white shadow-sm' : 'text-[#2E2A27]/70 hover:text-[#2E2A27]'}`}
      style={active ? { background: ACCENT, boxShadow: '0 0 8px rgba(91,108,184,0.45)' } : { background: 'rgba(46,42,39,0.06)', border: '1px solid rgba(46,42,39,0.2)' }}
    >{label}</button>
  );

  return (
    <div>
      <div data-fx="mon8" className="relative overflow-hidden rounded-xl h-[470px] flex flex-col border border-indigo-500/30 bg-[#0a0c14]">
        {/* ── Dark glassy upper zone — full 50%, large field visualizer ── */}
        <div className="relative shrink-0" style={{ height: '50%' }}>
          {/* glassy recessed background */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 0%, rgba(91,108,184,0.10), transparent 55%), linear-gradient(180deg, #0c0f18, #070910)' }} />
          <div className="absolute inset-0" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 30px rgba(0,0,0,0.55)' }} />

          {/* floating header — overlays the visualizer so the graphic fills the zone */}
          <div className="absolute left-3 top-2.5 z-10 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20"><CircleDot className="w-4 h-4 text-indigo-300" /></div>
            <span className={`text-sm font-medium transition-all ${safe.enabled ? 'text-indigo-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'text-white/80'}`}>Mon8</span>
            <span className="ml-1 rounded border border-indigo-500/30 px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider text-indigo-300/80">Bass Mono</span>
          </div>
          <div className="absolute right-3 top-2.5 z-10 flex items-center gap-2">
            <button
              onClick={() => setShowGonio((v) => !v)}
              title="Toggle bass goniometers (pre/post, below 500 Hz)"
              className={`flex items-center gap-1 rounded-full border px-2 py-1.5 transition-all ${showGonio ? 'border-[#5b9cff]/60 bg-[#5b9cff]/20 text-[#aecbff]' : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'}`}
              style={showGonio ? { boxShadow: '0 0 8px rgba(91,156,255,0.4)' } : undefined}
            >
              <Radar className="w-3.5 h-3.5" /><span className="text-[9px] font-bold uppercase">Gonio</span>
            </button>
            <InfoButton panelId="mon8" accent={ACCENT} />
            <button onClick={() => set('enabled', !safe.enabled)} className="sc-power-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all" style={safe.enabled ? { background: ACCENT, borderColor: ACCENT, color: '#1a1d3a', boxShadow: '0 0 10px rgba(91,108,184,0.5)' } : { background: 'var(--sc-off-bg, rgba(255,255,255,0.05))', borderColor: 'var(--sc-off-border, rgba(255,255,255,0.1))', color: 'var(--sc-off-text, rgba(255,255,255,0.5))' }}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>

          {/* large field visualizer — fills the whole upper zone.
              Flex row: left goniometer lane · centered graph · right goniometer lane.
              The graph sizes by its 360:170 aspect ratio (intrinsic width), and
              each side lane is flex-1 + justify-center, so a goniometer sits
              visually centered between the panel edge and the graph at every
              width — equidistant, no overlap. */}
          <div className="absolute inset-0 px-3 pt-12 pb-3 flex items-center">
            <div className="flex min-w-0 flex-1 items-center justify-center">
              {showGonio && analyzers && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-[#5b9cff]/85">Pre</span>
                  <Mon8Goniometer leftAnalyser={analyzers.mon8InLeft} rightAnalyser={analyzers.mon8InRight} size={96} />
                </div>
              )}
            </div>
            <div className="h-full max-w-full flex-shrink-0 aspect-[360/170]">
            <svg viewBox="0 0 360 170" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
              <defs>
                <linearGradient id="mon8-field-bg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(91,108,184,0.10)" />
                  <stop offset="100%" stopColor="rgba(8,10,16,0)" />
                </linearGradient>
                <linearGradient id="mon8-mono-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.12} />
                </linearGradient>
              </defs>
              {/* glassy field backdrop */}
              <rect x="20" y="14" width="320" height="136" rx="6" fill="url(#mon8-field-bg)" stroke="rgba(255,255,255,0.06)" />
              {/* baseline */}
              <line x1="36" y1="128" x2="324" y2="128" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
              {/* mono region */}
              <rect x="36" y="30" width={Math.max(0, cutX - 36)} height="98" rx="4" fill="url(#mon8-mono-fill)" opacity={monoOpacity} />
              <line x1={(36 + cutX) / 2} y1="40" x2={(36 + cutX) / 2} y2="118" stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" opacity={0.4 + width * 0.6} />
              {/* stereo field lines */}
              <line x1={cutX + 14} y1="48" x2="320" y2="48" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
              <line x1={cutX + 14} y1="110" x2="320" y2="110" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
              {/* stereo width shading */}
              <path d={`M ${cutX + 14} 48 L 320 48 L 320 110 L ${cutX + 14} 110 Z`} fill="#5eead4" opacity={0.08} />
              {/* cutoff line */}
              <line x1={cutX} y1="22" x2={cutX} y2="134" stroke={ACCENT} strokeWidth="1.6" strokeDasharray="5 3" opacity="0.95" />
              <circle cx={cutX} cy="22" r="3.5" fill={ACCENT} style={{ filter: 'drop-shadow(0 0 4px rgba(91,108,184,0.9))' }} />
              {/* labels */}
              <text x="36" y="150" fill="rgba(255,255,255,0.5)" fontSize="8.5" fontFamily="monospace">20Hz</text>
              <text x={Math.max(40, cutX - 16)} y="150" fill={ACCENT} fontSize="9" fontFamily="monospace" fontWeight="bold">{fLabel}Hz</text>
              <text x="300" y="150" fill="rgba(255,255,255,0.5)" fontSize="8.5" fontFamily="monospace">500Hz</text>
              <text x={(36 + cutX) / 2} y="18" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="1.2">MONO</text>
              <text x={(cutX + 320) / 2} y="18" fill="#5eead4" fontSize="8" fontFamily="monospace" textAnchor="middle" opacity="0.85" letterSpacing="1.2">STEREO</text>
            </svg>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center">
              {showGonio && analyzers && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-[#5b9cff]/85">Post</span>
                  <Mon8Goniometer leftAnalyser={analyzers.mon8OutLeft} rightAnalyser={analyzers.mon8OutRight} size={96} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Lower faceplate — single bell arch, muted slightly-warm finish ── */}
        <div className="relative flex-1" style={{ background: '#070910' }}>
          <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="mon8-cream" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4cfc2" />
                <stop offset="45%" stopColor="#cbc6ba" />
                <stop offset="100%" stopColor="#b6b1a5" />
              </linearGradient>
              <linearGradient id="mon8-arch-shadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(60,64,84,0.35)" />
                <stop offset="100%" stopColor="rgba(60,64,84,0)" />
              </linearGradient>
              <filter id="mon8-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer><feFuncA type="linear" slope="0.04" /></feComponentTransfer>
                <feComposite operator="in" in2="SourceGraphic" />
              </filter>
            </defs>
            {/* muted faceplate with single bell top edge */}
            <path d={fillD} fill="url(#mon8-cream)" />
            <path d={fillD} fill="#2E2A27" filter="url(#mon8-grain)" opacity="0.4" />
            {/* soft indigo-tinted shadow under the arch (blends with dark zone) */}
            <path d={fillD} fill="url(#mon8-arch-shadow)" opacity="0.6" />
            {/* machined bevel */}
            <path d={edgeD} fill="none" stroke="rgba(46,42,39,0.22)" strokeWidth="1.4" transform="translate(0,1.4)" />
            <path d={edgeD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" />
          </svg>

          {/* rack label — light gray on the dark glass above the curve */}
          <div className="absolute left-4 top-2.5 z-10 flex items-center gap-1.5">
            <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#cbc6ba]/85">Mon8</span>
            <span className="rounded-[3px] border border-[#cbc6ba]/25 bg-[#cbc6ba]/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#cbc6ba]/80">Bass Mono</span>
          </div>

          {/* Slope — left, raised so button centres align with the Width knob */}
          <div className="absolute left-24 z-10 flex flex-col items-center gap-1.5" style={{ bottom: '60px' }}>
            <span className="text-[10px] uppercase tracking-wider text-[#2E2A27]/70">Slope</span>
            <div className="flex gap-1.5">
              {seg(slope === 12, () => set('slope', 12), '12')}
              {seg(slope === 24, () => set('slope', 24), '24')}
            </div>
            <span className="text-[8px] font-mono text-[#2E2A27]/50">dB/oct</span>
          </div>

          {/* Frequency — centered, raised & cradled by the bell (twice the width dial) */}
          <div className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: '12%' }}>
            <Dial value={freq} onChange={(v) => set('frequency', v)} defaultValue={DEFAULT_MON8.frequency} min={20} max={500} step={1} scale="log" label="Frequency" unit="Hz" size="xlarge" accent={ACCENT} faceplate="light" />
          </div>

          {/* Width — right, bottom-anchored (keeps its size) */}
          <div className="absolute right-24 bottom-7 z-10 flex flex-col items-center">
            <Dial value={Math.round(width * 100)} onChange={(v) => set('width', v / 100)} defaultValue={Math.round(DEFAULT_MON8.width * 100)} min={0} max={100} step={1} label="Width" unit="%" size="large" accent={ACCENT} faceplate="light" />
          </div>

        </div>
      </div>
    </div>
  );
}