import React from 'react';
import {
  Scroll, Target, SlidersHorizontal, FunctionSquare, LineChart, Equal,
  Workflow, BookOpen,
} from 'lucide-react';
import { PANEL_INFO, INFO_KEYS } from '../infoContent.js';
import InfoDiagram from '../components/InfoDiagrams.jsx';
import StereoImagerFlashCard from '../components/StereoImagerFlashCard.jsx';

/**
 * Shared, mode-aware educational booklet content — the single source used by
 * the /booklet web page. It preserves the in-app info modal's colours, fonts
 * and keyword-chip structure; only the chrome (header, page furniture) is new.
 *
 * Dark / light is driven entirely by CSS variables on the `.bk-root` element
 * (set via the `data-bk-mode` attribute), so no component branches on mode.
 * Every flow element that must never split across a page boundary carries
 * `data-atomic`; every header that must stay with the following block carries
 * `data-keep-next`. The browser's print engine reads these for clean breaks.
 *
 * Accents use -600 shades throughout so coloured headings stay readable on both
 * the dark and the light background.
 */

// The exact SCM logo plate + overlay image used by the main app header.
const SCM_LOGO_GRADIENT =
  'linear-gradient(to bottom right, #0a1a3f 0%, #123a6e 32%, #2bd4c0 68%, #38e0ff 100%)';
const SCM_ICON_URL =
  'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/ba6dff13c_image.png';

const BK_STYLE = `
.bk-root {
  --bk-bg:#070b13; --bk-surface:rgba(255,255,255,0.04); --bk-surface-2:rgba(255,255,255,0.03);
  --bk-surface-strong:rgba(255,255,255,0.06); --bk-border:rgba(255,255,255,0.10); --bk-border-strong:rgba(255,255,255,0.15);
  --bk-text:#cbd5e1; --bk-heading:#f1f5f9; --bk-muted:#94a3b8; --bk-faint:#64748b; --bk-code:#0e7490;
  --bk-plate:linear-gradient(120deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.25));
  --bk-plate-border:rgba(255,255,255,0.15); --bk-title:#c4d1ff; --bk-eyebrow:#94a3b8;
  --bk-diagram-bg:#0f172a;
  background:var(--bk-bg); color:var(--bk-text);
}
.bk-root[data-bk-mode="light"] {
  --bk-bg:#ffffff; --bk-surface:#f8fafc; --bk-surface-2:#ffffff; --bk-surface-strong:#f1f5f9;
  --bk-border:#e2e8f0; --bk-border-strong:#cbd5e1; --bk-text:#334155; --bk-heading:#0f172a;
  --bk-muted:#475569; --bk-faint:#64748b; --bk-code:#0e7490;
  --bk-plate:linear-gradient(120deg, #ffffff, #f8fafc 45%, #eef2f7);
  --bk-plate-border:#cbd5e1; --bk-title:#0f172a; --bk-eyebrow:#64748b;
  --bk-diagram-bg:#ffffff;
}
.bk-text{color:var(--bk-text)} .bk-heading{color:var(--bk-heading)} .bk-muted{color:var(--bk-muted)}
.bk-faint{color:var(--bk-faint)} .bk-eyebrow{color:var(--bk-eyebrow)} .bk-title{color:var(--bk-title)}
.bk-code{color:var(--bk-code)}
.bk-card{background:var(--bk-surface);border:1px solid var(--bk-border)}
.bk-card-2{background:var(--bk-surface-2);border:1px solid var(--bk-border)}
.bk-card-strong{background:var(--bk-surface-strong);border:1px solid var(--bk-border)}
.bk-plate{background:var(--bk-plate);border:1px solid var(--bk-plate-border)}
.bk-border{border-color:var(--bk-border)} .bk-root [id]{scroll-margin-top:6rem} .bk-print-only{display:none}
`;

export const SECTION_META = {
  history:   { label: 'History',                      Icon: Scroll,            color: '#0891b2' },
  purpose:   { label: "Why it’s used",                Icon: Target,            color: '#7c3aed' },
  params:    { label: 'Key parameters',              Icon: SlidersHorizontal, color: '#d97706' },
  equation:  { label: 'Transfer equation',            Icon: FunctionSquare,    color: '#c026d3' },
  frequency: { label: 'Frequency distribution',      Icon: Equal,             color: '#e11d48' },
  diagrams:  { label: 'Diagram',                     Icon: LineChart,         color: '#0284c7' },
  usage:     { label: 'Where it belongs in the chain', Icon: Workflow,        color: '#059669' },
};

export const PANEL_ACCENT = {
  eq: '#d97706', dynamiceq: '#7c3aed', compressor: '#64748b', limiter: '#dc2626',
  multibandcomp: '#059669', saturation: '#ea580c', clip: '#16a34a', tape: '#c2410c',
  delay: '#d97706', reverb: '#0d9488', mastering: '#7c3aed', vu: '#d97706',
  level: '#0891b2', output: '#0891b2', source: '#059669', signalchain: '#2563eb',
  lufs: '#0891b2', stereoimager: '#0d9488',
  sectionmastering: '#7c3aed', visualidentity: '#8b5cf8',
};

export const REFERENCES = [
  { title: 'Bob Katz — Mastering Audio: The Art and the Science', desc: '3rd ed., Focal Press. Origin of the K-System (K-12 / K-14 / K-20) and a definitive text on the mastering chain.' },
  { title: 'ITU-R BS.1770-4', desc: '“Algorithms to measure audio programme loudness and true-peak audio level.” Defines LUFS and K-weighting used by the loudness meter.' },
  { title: 'EBU R 128', desc: '“Loudness normalisation and permitted maximum level of audio signals.” The broadcast −23 LUFS standard.' },
  { title: 'George Massenburg — Parametric Equalization', desc: 'AES Convention Paper, 1972. Invention of the fully parametric EQ (frequency + gain + Q).' },
  { title: 'Alan Blumlein — UK Patent 394,326 (1931)', desc: '“Improvements in and relating to Electrical Transmission.” The Mid/Side technique behind the stereo imager.' },
  { title: 'W3C — Web Audio API', desc: 'The real-time DSP engine that powers every processor, filter, compressor and analyser in this application.' },
  { title: 'Lucide Icons', desc: 'Open-source icon library; the mnemonic symbol used to identify each section throughout this booklet.' },
  { title: 'Sound Chain Master (Spher8 · SCM)', desc: 'The application this booklet documents — scm.spher8.com. Created and designed by Ivan Zavada, © 2026.' },
];

/* ── branded header — the EXACT SCM icon used by the main app header ─────── */
export function BookletHeader() {
  return (
    <div data-atomic data-keep-next className="bk-plate relative overflow-hidden rounded-2xl p-6 sm:p-7" style={{ boxShadow: '0 6px 18px rgba(15,23,42,0.10)' }}>
      <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full blur-[100px]" style={{ background: 'rgba(56,224,255,0.18)' }} />
      <div className="relative flex items-center gap-5">
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-24 sm:w-24"
          style={{ backgroundImage: SCM_LOGO_GRADIENT, boxShadow: '0 0 34px rgba(56,224,255,0.40), inset 0 1px 0 rgba(255,255,255,0.25)' }}
        >
          <img
            src={SCM_ICON_URL}
            alt="SCM"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
            style={{ opacity: 0.45, mixBlendMode: 'screen', transform: 'scale(1.08)', maskImage: 'linear-gradient(to top, transparent 10%, rgba(0,0,0,0.7) 100%)', WebkitMaskImage: 'linear-gradient(to top, transparent 10%, rgba(0,0,0,0.7) 100%)' }}
          />
          <span className="relative text-2xl font-black tracking-tighter text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-3xl">SCM</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="bk-eyebrow block text-[9px] font-semibold uppercase tracking-[0.42em]">Professional Audio DSP · Component Lab</span>
          <h1 className="bk-title mt-1 text-3xl font-black leading-none tracking-tight">Sound Chain Master</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-px w-8" style={{ background: '#38e0ff' }} />
            <p className="bk-muted text-xs">A focused mastering and signal-chain toolkit</p>
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-mono font-bold tracking-wider" style={{ color: '#059669' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> DSP · LIVE
          </span>
          <span className="bk-card bk-muted rounded-full px-3 py-1 text-[11px] font-mono font-semibold tracking-wider">44.1 kHz · 32-bit float</span>
          <span className="bk-faint text-[9px] font-mono uppercase tracking-[0.28em]">v1.0 · WebAudio Engine</span>
        </div>
      </div>
    </div>
  );
}

/* ── content primitives ───────────────────────────────────────────────────── */
function InfoBlocks({ value, accent }) {
  if (value == null) return null;
  if (typeof value === 'string') {
    return <p data-atomic className="bk-text text-[12.5px] leading-6">{value}</p>;
  }
  return (
    <div className="space-y-3">
      {value.map((block, i) => block.bullets ? (
        <ul key={i} className="space-y-2">
          {block.bullets.map((b, j) => (
            <li key={j} data-atomic className="bk-card flex items-start gap-2.5 rounded-lg px-3 py-2">
              <span
                className="mt-px shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ color: accent || '#475569', borderColor: (accent || '#94a3b8') + '66', background: (accent || '#94a3b8') + '1a' }}
              >
                {b.kw}
              </span>
              <span className="bk-text text-[12px] leading-5">{b.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p key={i} data-atomic className="bk-text text-[12.5px] leading-6">{block.p}</p>
      ))}
    </div>
  );
}

function Section({ kind, info, accent, mode = 'dark' }) {
  const meta = SECTION_META[kind];
  if (!meta) return null;
  let body = null;
  if (kind === 'history' || kind === 'purpose' || kind === 'usage') {
    body = <InfoBlocks value={info[kind]} accent={accent} />;
  } else if (kind === 'params') {
    body = (
      <dl className="space-y-2">
        {info.params.map((p) => (
          <div key={p.name} data-atomic className="bk-card rounded-lg px-3 py-2">
            <dt className="bk-heading text-[12px] font-semibold">{p.name}</dt>
            <dd className="bk-muted mt-0.5 text-[12px] leading-5">{p.desc}</dd>
          </div>
        ))}
      </dl>
    );
  } else if (kind === 'equation') {
    body = (
      <>
        <p data-atomic className="bk-muted mb-2 text-[12px] leading-5">{info.equation.intro}</p>
        <div className="space-y-2">
          {info.equation.rows.map((r, i) => (
            <div key={i} data-atomic className="bk-card rounded-lg px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="bk-heading text-[12px] font-semibold">{r.label}</span>
                {r.note && <span className="bk-faint text-[9px] uppercase tracking-wide">{r.note}</span>}
              </div>
              <code className="bk-code mt-1 block font-mono text-[11px] leading-5 whitespace-pre-wrap break-words">{r.formula}</code>
            </div>
          ))}
        </div>
      </>
    );
  } else if (kind === 'frequency') {
    body = (
      <div className="bk-card overflow-hidden rounded-lg">
        <table className="w-full text-[10.5px]">
          <thead data-atomic data-keep-next style={{ background: 'var(--bk-surface-strong)' }}>
            <tr className="bk-muted">
              <th className="px-2 py-1.5 text-left font-semibold">Band</th>
              <th className="px-2 py-1.5 text-left font-semibold">Range</th>
              <th className="px-2 py-1.5 text-left font-semibold text-emerald-600">Boost →</th>
              <th className="px-2 py-1.5 text-left font-semibold text-rose-600">Cut →</th>
            </tr>
          </thead>
          <tbody>
            {info.frequencyGuide.map((b, i) => (
              <tr key={b.band} data-atomic style={i % 2 ? { background: 'var(--bk-surface-2)' } : undefined}>
                <td className="bk-heading px-2 py-1.5 font-semibold">{b.band}</td>
                <td className="bk-faint px-2 py-1.5 font-mono">{b.range}</td>
                <td className="bk-text px-2 py-1.5">{b.boost}</td>
                <td className="bk-text px-2 py-1.5">{b.cut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (kind === 'diagrams') {
    body = (
      <div className="space-y-3">
        {info.diagrams.map((d) => (
          <div key={d} data-atomic className="bk-border overflow-hidden rounded-lg" style={{ background: 'var(--bk-diagram-bg)' }}>
            <InfoDiagram diagram={d} mode={mode} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <section className="mt-5">
      <h3 data-atomic data-keep-next className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: meta.color }}>
        <meta.Icon size={15} strokeWidth={2.5} color={meta.color} />
        {meta.label}
      </h3>
      {body}
    </section>
  );
}

export function PanelBlock({ id, idx, mode = 'dark' }) {
  const info = PANEL_INFO[id];
  if (!info) return null;
  const accent = PANEL_ACCENT[id] || '#0891b2';
  return (
    <div id={id}>
      <div data-atomic data-keep-next className="mt-6">
        <span className="bk-faint text-[10px] font-mono tracking-[0.2em]">PANEL {String(idx).padStart(2, '0')}</span>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: accent }}>{info.title}</h2>
        <div className="mt-1 h-[3px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>
      <Section kind="history" info={info} accent={accent} />
      <Section kind="purpose" info={info} accent={accent} />
      <Section kind="params" info={info} accent={accent} />
      {info.equation && <Section kind="equation" info={info} accent={accent} />}
      {info.frequencyGuide && <Section kind="frequency" info={info} accent={accent} />}
      {info.diagrams && info.diagrams.length > 0 && <Section kind="diagrams" info={info} accent={accent} mode={mode} />}
      {info.flashCard && (
        <div className="mt-5">
          <StereoImagerFlashCard mode={mode} />
        </div>
      )}
      <Section kind="usage" info={info} accent={accent} />
    </div>
  );
}

export function Cover() {
  return (
    <div id="cover">
      <BookletHeader />
      <div id="intro" className="mt-6">
        <h2 data-atomic data-keep-next className="bk-heading mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em]">
          <BookOpen size={16} color="#0891b2" /> Introduction
        </h2>
        <div className="space-y-3">
          <p data-atomic className="bk-text text-[12.5px] leading-6">Sound Chain Master — Professional Audio DSP · Component Lab — is a focused mastering and signal-chain toolkit. This booklet collects, in one printable reference, the educational material behind every panel of the application: the history, purpose, key parameters, transfer equations, mnemonic diagrams and signal-chain placement of each processor.</p>
          <p data-atomic className="bk-text text-[12.5px] leading-6">A signal chain is the ordered sequence of processors a sound passes through — corrective equalisation first, then dynamic control, then colour and space, and finally level. The order matters as much as the processors themselves: the same EQ and compressor sound different in different positions, and effects such as reverb and delay are usually better in parallel so the dry signal stays untouched.</p>
          <p data-atomic className="bk-text text-[12.5px] leading-6">Every entry follows the same structure so processors can be compared on equal terms. <span className="bk-heading font-semibold">History</span> traces where each technique came from. <span className="bk-heading font-semibold">Why it’s used</span> explains its job. <span className="bk-heading font-semibold">Key parameters</span> maps the controls to the sound. The <span className="bk-heading font-semibold">Transfer equation</span> gives the maths where it is useful. The <span className="bk-heading font-semibold">Diagram</span> visualises the behaviour. And <span className="bk-heading font-semibold">Where it belongs</span> fixes the processor in the chain.</p>
          <p data-atomic className="bk-text text-[12.5px] leading-6">Loudness is treated throughout with the modern, perceptual standards. LUFS (ITU-R BS.1770) measures perceived loudness with a K-weighting filter across Momentary, Short-Term and Integrated windows. The Bob Katz K-System anchors the meter’s 0 dB mark at a headroom reference below 0 dBFS — K-12 for broadcast, K-14 for pop and home mastering, K-20 for the most dynamic material — so well-calibrated programme material sits around 0 dB and the headroom above it is visible at a glance. Streaming platforms normalise to roughly −14 LUFS; the days of chasing 0 dBFS peaks are over.</p>
          <p data-atomic className="bk-text text-[12.5px] leading-6">Use this booklet as a learning resource and a quick reference. Read the panels in chain order to see how a master is built; jump to a single processor to recall a control or a formula; and keep the references at the back for deeper study.</p>
        </div>
      </div>
    </div>
  );
}

export function ReferencesBlock() {
  return (
    <div id="references">
      <h2 data-atomic data-keep-next className="bk-heading mb-4 mt-6 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em]">
        <BookOpen size={16} color="#0891b2" /> References &amp; Further Reading
      </h2>
      <ul className="space-y-2">
        {REFERENCES.map((r, i) => (
          <li key={i} data-atomic className="bk-card flex items-start gap-2.5 rounded-lg px-3 py-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#0891b2' }} />
            <span className="bk-text text-[12px] leading-5"><span className="bk-heading font-semibold">{r.title}</span> — {r.desc}</span>
          </li>
        ))}
      </ul>
      <p data-atomic className="bk-faint mt-5 text-center text-[10px] font-mono tracking-widest">Spher8 · SCM — Sound Chain Master · Educational Booklet</p>
    </div>
  );
}

export const BOOKLET_NAV_ITEMS = [
  { id: 'intro', label: 'Introduction' },
  ...INFO_KEYS.map((id) => ({ id, label: PANEL_INFO[id].title })),
  { id: 'references', label: 'References' },
];

function PrintContents() {
  return (
    <div className="bk-print-only" style={{ marginTop: '1.5rem' }}>
      <h2 className="bk-heading mb-3 text-[14px] font-bold uppercase tracking-[0.18em]">Contents</h2>
      <ul className="space-y-1 text-[12px] leading-6">
        {BOOKLET_NAV_ITEMS.map((it, i) => (
          <li key={it.id} className="flex gap-2">
            <span className="bk-faint font-mono text-[10px]">{String(i + 1).padStart(2, '0')}</span>
            <a href={`#${it.id}`} className="bk-text no-underline hover:underline">{it.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookletTree({ mode = 'dark' }) {
  return (
    <>
      <style>{BK_STYLE}</style>
      <div
        data-flow
        data-bk-mode={mode}
        className="bk-root"
        style={{
          width: '100%',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: '1.5rem 48px 0',
        }}
      >
        <Cover />
        <PrintContents />
        {INFO_KEYS.map((id, i) => (<PanelBlock key={id} id={id} idx={i + 1} mode={mode} />))}
        <ReferencesBlock />
      </div>
    </>
  );
}