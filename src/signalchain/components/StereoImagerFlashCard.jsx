import React from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';

/**
 * "How to read a stereo imager / vectorscope" — a standalone learning flash
 * card inspired by the @dazeplex audio flash-card series. Self-contained and
 * mode-aware (`mode="dark"` for the in-app info modal, `"light"` for the
 * printable booklet) so the same card renders on the dark modal and the white
 * booklet page.
 *
 * Layout: title → L|⊙|R divider → 2×3 illustrated cards (each with a mini
 * vectorscope trace) → correlation meter → yellow takeaway box.
 */

const ACCENT = '#3498db';
const YELLOW = '#f1c40f';
const RED = '#e74c3c';
const GREEN = '#2ecc71';

const CARDS = [
  { n: 1, shape: 'mono',     title: 'Mono / Centered',      text: 'A tight vertical shape means the signal is mostly centered and mono-compatible.' },
  { n: 2, shape: 'wide',     title: 'Wide but Balanced',     text: 'A wider, symmetrical shape usually means healthy stereo width with good left/right balance.' },
  { n: 3, shape: 'toowide',   title: 'Too Wide / Risky',     text: 'If it spreads too far sideways, the mix may lose focus or collapse in mono.' },
  { n: 4, shape: 'outphase', title: 'Out of Phase',         text: 'Messy sideways or inverted-looking readings can point to phase problems and weak mono playback.', warn: true },
  { n: 5, shape: 'left',      title: 'Left-Heavy Mix',       text: 'If the reading leans left, the stereo image is unbalanced toward the left channel.' },
  { n: 6, shape: 'right',     title: 'Right-Heavy Mix',      text: 'If the reading leans right, the stereo image is unbalanced toward the right channel.' },
];

/* deterministic PRNG so the scatter clouds are stable between renders */
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Build a connected goniometer trace (L vs R over time) as an ordered point
   list — rendered as a single thin polyline so each mini-scope reads like a
   real vectorscope trace instead of a scatter of dots. */
function pathFor(shape, n = 90) {
  const r = mulberry(shape.length * 97 + n * 13);
  const out = [];
  const clamp = (x, y) => [Math.max(6, Math.min(94, x)), Math.max(8, Math.min(92, y))];
  switch (shape) {
    case 'mono':
      for (let i = 0; i < n; i++) { const y = 10 + 80 * (i / (n - 1)); const x = 50 + Math.sin(i * 0.9) * 2.4 + (r() - 0.5) * 2.6; out.push(clamp(x, y)); }
      break;
    case 'wide':
      for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * Math.PI * 4; const x = 50 + Math.cos(t) * 30 + (r() - 0.5) * 3.5; const y = 50 + Math.sin(t) * 27 + (r() - 0.5) * 3.5; out.push(clamp(x, y)); }
      break;
    case 'toowide':
      for (let i = 0; i < n; i++) { const x = 10 + 80 * (i / (n - 1)); const y = 50 + Math.sin(i * 0.5) * 7 + (r() - 0.5) * 9; out.push(clamp(x, y)); }
      break;
    case 'outphase':
      for (let i = 0; i < n; i++) { const x = 10 + 80 * (i / (n - 1)); const y = 50 + Math.sin(i * 1.7) * 3 + (r() - 0.5) * 6; out.push(clamp(x, y)); }
      break;
    case 'left':
      for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * Math.PI * 4; const x = 33 + Math.cos(t) * 22 + (r() - 0.5) * 3; const y = 34 + Math.sin(t) * 20 + (r() - 0.5) * 3; out.push(clamp(x, y)); }
      break;
    case 'right':
      for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * Math.PI * 4; const x = 67 + Math.cos(t) * 22 + (r() - 0.5) * 3; const y = 34 + Math.sin(t) * 20 + (r() - 0.5) * 3; out.push(clamp(x, y)); }
      break;
    default:
      for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * Math.PI * 4; out.push(clamp(50 + Math.cos(t) * 24, 50 + Math.sin(t) * 24)); }
  }
  return out;
}

function MiniScope({ shape, mode }) {
  const C = mode === 'light' ? { grid: 'rgba(15,23,42,0.10)', axis: 'rgba(15,23,42,0.28)' } : { grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.18)' };
  const poly = pathFor(shape).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-full" style={{ display: 'block' }}>
      <rect x="2" y="2" width="96" height="96" rx="4" fill="none" stroke={C.grid} strokeWidth="1" />
      <line x1="2" y1="50" x2="98" y2="50" stroke={C.axis} strokeWidth="0.7" strokeDasharray="3 3" />
      <line x1="50" y1="2" x2="50" y2="98" stroke={C.axis} strokeWidth="0.7" strokeDasharray="3 3" />
      <polyline points={poly} fill="none" stroke={ACCENT} strokeWidth="0.6" opacity="0.9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Wave() {
  const bars = Array.from({ length: 9 }, (_, i) => 4 + Math.abs(Math.sin(i * 0.9)) * 10);
  return (
    <svg viewBox="0 0 60 18" className="h-4 w-16" style={{ display: 'block' }}>
      {bars.map((h, i) => (
        <rect key={i} x={i * 6.4 + 1} y={9 - h / 2} width="3.2" height={h} rx="1.6" fill="currentColor" opacity="0.7" />
      ))}
    </svg>
  );
}

export default function StereoImagerFlashCard({ mode = 'dark' }) {
  const light = mode === 'light';
  const C = light
    ? { bg: '#ffffff', panel: '#f8fafc', text: '#0f172a', sub: '#475569', faint: '#94a3b8', border: '#e2e8f0', cardBorder: ACCENT + '55', cardBg: '#f1f5f9' }
    : { bg: '#0e0e0e', panel: '#161616', text: '#ffffff', sub: '#cbd5e1', faint: '#94a3b8', border: '#262626', cardBorder: ACCENT + '66', cardBg: '#121620' };

  return (
    <div
      data-atomic
      className="overflow-hidden rounded-xl border"
      style={{ background: C.bg, borderColor: C.border, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 text-center" style={{ background: C.panel }}>
        <h3 className="text-[15px] font-extrabold uppercase tracking-[0.04em]" style={{ color: C.text }}>
          How to Read a Stereo Imager / Vectorscope
        </h3>
        <p className="mt-1 text-[11px]" style={{ color: C.sub }}>Understand width, balance and mono compatibility at a glance</p>
        <div className="mt-3 flex items-center justify-center gap-2" style={{ color: C.faint }}>
          <span className="text-[10px] font-bold">L</span>
          <span className="h-px w-10" style={{ background: C.border }} />
          <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold" style={{ borderColor: ACCENT, color: ACCENT }}>⊙</span>
          <span className="h-px w-10" style={{ background: C.border }} />
          <span className="text-[10px] font-bold">R</span>
        </div>
      </div>

      {/* 2×3 grid */}
      <div className="grid grid-cols-2 gap-2.5 p-4">
        {CARDS.map((c) => (
          <div key={c.n} className="rounded-lg border p-2.5" style={{ borderColor: c.warn ? YELLOW : C.cardBorder, background: C.cardBg }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: ACCENT, color: '#fff' }}>{c.n}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.text }}>{c.title}</span>
              {c.warn && <AlertTriangle className="ml-auto h-4 w-4" style={{ color: YELLOW }} />}
            </div>
            <MiniScope shape={c.shape} mode={mode} />
            <p className="mt-1.5 text-[10.5px] leading-snug" style={{ color: C.sub }}>{c.text}</p>
          </div>
        ))}
      </div>

      {/* Correlation meter */}
      <div className="px-4 pb-3">
        <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>
          <span>Correlation Meter</span>
          <span style={{ color: C.faint }}>−1 → 0 → +1</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${RED} 0%, ${YELLOW} 50%, ${GREEN} 100%)` }}>
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: 'rgba(0,0,0,0.35)' }} />
        </div>
        <div className="mt-1 flex justify-between text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: C.faint }}>
          <span style={{ color: RED }}>Out of phase (mono problems)</span>
          <span style={{ color: '#b45309' }}>Okay (some risk)</span>
          <span style={{ color: GREEN }}>In phase (mono safe)</span>
        </div>
      </div>

      {/* Takeaway */}
      <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-lg border p-3" style={{ borderColor: YELLOW, background: light ? '#fffbeb' : 'rgba(241,196,15,0.06)' }}>
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: YELLOW }} />
        <p className="text-[10.5px] leading-snug" style={{ color: C.text }}>
          <span className="font-bold">Quick takeaway:</span> A good stereo image is not just wide. It should also be balanced, focused and mono-safe. Use your ears first, then let the vectorscope confirm what you hear.
        </p>
      </div>

    </div>
  );
}