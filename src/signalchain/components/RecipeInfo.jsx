import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { KATZ_NOTE } from '../mastering/masterPresets.js';

const ACCENT = '#f59e0b';

/**
 * The AI-Recipe footer note: a one-line standard explanation, plus an
 * "Expanded" disclosure that opens a deep technical read on the K-System,
 * K-weighted loudness, the pink-noise reference, and how each is applied.
 */
export default function RecipeInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] text-white/45 leading-relaxed">{KATZ_NOTE}</p>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors"
        style={{ color: ACCENT }}
      >
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide expanded detail' : 'Expanded — why this works'}
      </button>

      {open && (
        <div className="mt-2.5 space-y-3 text-[10px] text-white/60 leading-relaxed">
          <Section title="The K-System — metering with headroom">
            <p>
              Bob Katz's K-System decouples <em>loudness</em> from <em>peak</em>. Three calibrated
              scales — <span className="text-amber-300">K-20</span>, <span className="text-amber-300">K-14</span>,
              <span className="text-amber-300"> K-12</span> — set the meter's 0 dB point to a known
              reference SPL (typically 83–85 dB SPL) and reserve the upper zone as <em>headroom</em> for
              musical dynamics rather than a target to fill. K-20 (~20 dB headroom) suits classical and
              jazz; K-14 aligns with streaming/album masters; K-12 is the loud pop/radio scale. Mixing
              <em> into</em> a K-scale — not chasing 0 dBFS — keeps transients alive and lets the final
              limiter work gently rather than as a wall.
            </p>
          </Section>

          <Section title="K-weighting &amp; ITU-R BS.1770">
            <p>
              Integrated loudness is measured in <span className="text-amber-300">LUFS</span> (Loudness Units
              Full Scale) per ITU-R BS.1770-4. The "K" filter pre-conditions the signal: a high-shelf boost
              above ~2 kHz (the ear's heightened speech sensitivity) plus a high-pass below ~38 Hz (removing
              inaudible rumble that would otherwise skew the reading). This perceptual weighting is why a
              bright vocal mix reads louder in LUFS than a bass-heavy mix at identical peak — and why LUFS,
              not dBFS, drives every streaming platform's normalization. The recipe targets a chosen
              integrated LUFS so the master lands where platforms apply <em>no</em> attenuation or gain.
            </p>
          </Section>

          <Section title="Pink-noise spectral reference (−3 dB/oct)">
            <p>
              A balanced mix, measured in third-octave bands, roughly traces a <span className="text-amber-300">−3 dB/octave</span>
              pink-noise slope — equal energy per octave, the spectrum human hearing perceives as "flat."
              Mastering tilts the spectrum <em>back toward</em> that reference: if an octave pokes out it
              fatigues and dominates; if one dips, the mix feels hollow or dark. The recipe therefore treats
              the pink-noise line as a neutral centerline, nudging EQ so no octave jumps out — preserving
              tonal balance instead of forcing a bright or bass-heavy character the source never had.
            </p>
          </Section>

          <Section title="How the recipe is applied">
            <p>
              The AI assistant reads your <em>medium</em> (cinematic → club), <em>style</em>, and target
              LUFS, then returns a recipe that maps to real chain parameters: EQ band gains (toward the
              pink reference), compression threshold/ratio/attack (dynamic glue without pumping), saturation
              drive (harmonic weight), and a final limiter ceiling (true-peak safe). <code className="text-amber-300/90">applyRecipe()</code>
              writes those values straight onto the signal chain for live preview; the offline render then
              runs the whole chain on the decoded file, measures integrated LUFS K-weighted, and applies a
              single transparent gain to hit the target — guaranteeing a clip-safe 24-bit master.
            </p>
          </Section>

          <Section title="Aesthetic &amp; engineering value">
            <p>
              Aesthetically, K-system masters retain <em>impact, depth, and air</em>: the kick still hits,
              the reverb tail still breathes, and the top end stays open instead of crushed flat.
              Engineering-wise, working to a loudness target (not a peak target) future-proofs the master
              across Spotify, Apple Music, YouTube and broadcast — each normalizes to its own LUFS, so a
              master that already sits at the platform's target is heard <em>exactly as you rendered it</em>,
              with no platform limiter re-coloring the dynamics.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70 mb-1">{title}</div>
      {children}
    </div>
  );
}