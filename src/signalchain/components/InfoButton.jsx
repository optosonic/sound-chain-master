import React, { useState } from 'react';
import { Info, X, Scroll, Target, SlidersHorizontal, FunctionSquare, LineChart, Equal, Workflow } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PANEL_INFO } from '../infoContent.js';
import InstrumentFrequencyChart from './InstrumentFrequencyChart.jsx';
import InfoDiagram from './InfoDiagrams.jsx';
import StereoImagerFlashCard from './StereoImagerFlashCard.jsx';

// Consistent per-section iconography — the same symbol identifies a section
// type across every info modal (textbook convention).
const SECTION_ICONS = {
  history: Scroll,
  purpose: Target,
  params: SlidersHorizontal,
  equation: FunctionSquare,
  diagrams: LineChart,
  frequency: Equal,
  usage: Workflow,
};

function SectionTitle({ icon: Icon, color, children }) {
  return (
    <h3 className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </h3>
  );
}

// Renders the body of a History / Why-it's-used / Usage section. Accepts either
// a legacy single string (one paragraph) or an array of educational blocks:
//   { p: 'short paragraph' }                       → a paragraph
//   { bullets: [{ kw: 'Keyword', text: '...' }] }  → a keyworded bullet list
// The keyword sits in a highlighted chip so the page scans like a textbook
// sidebar rather than a wall of text.
function InfoBlocks({ value }) {
  if (value == null) return null;
  if (typeof value === 'string') {
    return <p className="text-[13px] leading-7 text-white/80">{value}</p>;
  }
  return (
    <div className="space-y-3">
      {value.map((block, i) =>
        block.bullets ? (
          <ul key={i} className="space-y-2">
            {block.bullets.map((b, j) => (
              <li
                key={j}
                className="flex items-start gap-2.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <span className="mt-px shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90">
                  {b.kw}
                </span>
                <span className="text-[12px] leading-relaxed text-white/80">{b.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-[13px] leading-7 text-white/80">
            {block.p}
          </p>
        )
      )}
    </div>
  );
}

/**
 * InfoButton — a small "i" button that opens an educational modal.
 *
 * Placement: render it inside a panel header, next to (left of) the power/
 * on-off button. It is self-contained: pass a `panelId` matching a key in
 * infoContent.js and it pulls the title + four sections (history, purpose,
 * parameters, usage).
 *
 *   <InfoButton panelId="compressor" />
 *
 * The button is theme-agnostic (uses the panel accent colour when supplied,
 * otherwise a neutral zinc) so it reads on any of the five visual identities.
 */
export default function InfoButton({ panelId, accent, compact = false }) {
  const [open, setOpen] = useState(false);
  const info = PANEL_INFO[panelId];
  const box = compact ? 'h-4 w-4 text-[9px]' : 'h-7 w-7 text-[11px]';
  const iconCls = compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  const trigger = (
    <button
      type="button"
      onClick={() => info && setOpen(true)}
      title={info ? `About ${info.title}` : 'Info'}
      aria-label={info ? `About ${info.title}` : 'Info'}
      className={`sc-info-btn ${box} flex shrink-0 items-center justify-center rounded-full border font-bold leading-none transition-all hover:scale-105`}
      style={
        accent
          ? { borderColor: accent + '66', color: accent, background: accent + '1a' }
          : { borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.06)' }
      }
    >
      <Info className={iconCls} />
    </button>
  );

  if (!info) return trigger;

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#0b0e16]/95 text-white sm:max-w-[640px]">
          {/* Sticky header — title + close stay pinned so the modal can be dismissed at any scroll position. */}
          <div className="sticky top-0 z-30 -mx-6 -mt-6 mb-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0e16]/95 px-6 py-3 backdrop-blur-sm">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: (accent || '#38bdf8') + '22', color: accent || '#38bdf8' }}
              >
                <Info className="h-3.5 w-3.5" />
              </span>
              {info.title}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 pt-1 text-sm leading-relaxed text-white/80">
            <section>
              <SectionTitle icon={SECTION_ICONS.history} color="text-cyan-300/80">History</SectionTitle>
              <InfoBlocks value={info.history} />
            </section>

            <section>
              <SectionTitle icon={SECTION_ICONS.purpose} color="text-violet-300/80">Why it’s used</SectionTitle>
              <InfoBlocks value={info.purpose} />
            </section>

            <section>
              <SectionTitle icon={SECTION_ICONS.params} color="text-amber-300/80">Key parameters</SectionTitle>
              <dl className="space-y-2">
                {info.params.map((p) => (
                  <div key={p.name} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <dt className="text-[12px] font-semibold text-white">{p.name}</dt>
                    <dd className="mt-0.5 text-[12px] text-white/65">{p.desc}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {info.characters && (
              <section>
                <SectionTitle icon={SECTION_ICONS.params} color="text-sky-300/80">Character models</SectionTitle>
                <div className="space-y-2">
                  {info.characters.map((c) => (
                    <div key={c.name} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-[12px] font-semibold text-white">{c.name}</div>
                      <div className="mt-0.5 text-[12px] text-white/65">{c.desc}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {info.equation && (
              <section>
                <SectionTitle icon={SECTION_ICONS.equation} color="text-fuchsia-300/80">Transfer equation</SectionTitle>
                <p className="mb-2 text-[12px] text-white/60">{info.equation.intro}</p>
                <div className="space-y-2">
                  {info.equation.rows.map((r, i) => (
                    <div key={i} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[12px] font-semibold text-white">{r.label}</span>
                        {r.note && <span className="text-[10px] uppercase tracking-wide text-white/40">{r.note}</span>}
                      </div>
                      <code className="mt-1 block font-mono text-[11px] leading-relaxed text-cyan-200/90 whitespace-pre-wrap break-words">{r.formula}</code>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {info.diagrams && info.diagrams.length > 0 && (
              <section>
                <SectionTitle icon={SECTION_ICONS.diagrams} color="text-sky-300/80">Diagrams</SectionTitle>
                <div className="space-y-3">
                  {info.diagrams.map((d) => (
                    <InfoDiagram key={d} diagram={d} />
                  ))}
                </div>
              </section>
            )}

            {info.flashCard && (
              <section>
                <StereoImagerFlashCard mode="dark" />
              </section>
            )}

            {info.frequencyGuide && (
              <section>
                <SectionTitle icon={SECTION_ICONS.frequency} color="text-rose-300/80">
                  Frequency distribution — boosts &amp; cuts
                </SectionTitle>
                <p className="mb-2 text-[12px] text-white/60">
                  The audible spectrum divided into bands. Boost a band to enhance
                  that character, cut it to remove the problem.
                </p>
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-[11px]">
                    <thead className="bg-white/5 text-white/50">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">Band</th>
                        <th className="px-2 py-1 text-left font-semibold">Range</th>
                        <th className="px-2 py-1 text-left font-semibold text-emerald-300/80">Boost →</th>
                        <th className="px-2 py-1 text-left font-semibold text-rose-300/80">Cut →</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.frequencyGuide.map((b) => (
                        <tr key={b.band} className="border-t border-white/5 align-top">
                          <td className="px-2 py-1.5 font-semibold text-white">{b.band}</td>
                          <td className="px-2 py-1.5 font-mono text-white/55">{b.range}</td>
                          <td className="px-2 py-1.5 text-white/70">{b.boost}</td>
                          <td className="px-2 py-1.5 text-white/70">{b.cut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {info.chart && (
              <section>
                <InstrumentFrequencyChart />
              </section>
            )}

            <section>
              <SectionTitle icon={SECTION_ICONS.usage} color="text-emerald-300/80">Where it belongs in the chain</SectionTitle>
              <InfoBlocks value={info.usage} />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}