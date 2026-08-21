import React, { useState } from 'react';

/**
 * InstrumentFrequencyChart — an educational reference chart shown inside the
 * EQ info modal. Two tabs:
 *   1. Instrumental — fundamental frequency ranges of common instruments,
 *      grouped/coloured by family (voices, percussion, brass & winds,
 *      strings / bass / piano, pipe organ) on a 20 Hz–20 kHz log scale.
 *   2. Perceptual  — the descriptive frequency zones per instrument
 *      (Boom, Boxiness, Attack, Warmth, Air …) so an engineer knows which
 *      frequency to boost or cut to achieve a subjective character.
 *
 * All data is hand-curated from standard studio EQ reference charts so the
 * lab owns its own copy (no external dependency).
 */

const F_MIN = 20;
const F_MAX = 20000;
const P_MIN = 20;
const P_MAX = 16000;

const logPos = (f, lo, hi) => {
  const v = (Math.log10(Math.max(f, 1)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  return Math.min(100, Math.max(0, v * 100));
};

const fmtHz = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

const SCALE_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const PERCEPT_TICKS = [0, 30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000];

/* ── Instrumental data (family → colour → rows) ── */
const FAMILIES = [
  {
    name: 'Human Voices',
    color: '#7d7d7d',
    rows: [
      ['Coloratura Soprano', 262, 1047],
      ['Mezzo Soprano', 247, 1000],
      ['Alto', 175, 698],
      ['Tenor', 130, 523],
      ['Baritone', 110, 392],
      ['Bass', 82, 294],
    ],
  },
  {
    name: 'Orchestral Percussion',
    color: '#7c3aed',
    rows: [
      ['Tubular Chimes', 262, 2093],
      ['Vibraphone', 131, 2093],
      ['Marimba', 220, 2093],
      ['Timpani', 73, 196],
    ],
  },
  {
    name: 'Strings / Bass / Piano',
    color: '#22d3ee',
    rows: [
      ['Violin & Mandolin', 196, 3136],
      ['Viola & Mandola', 131, 1047],
      ['Cello & Mandocello', 65, 659],
      ['Cello', 65, 1047],
      ['Concert Harp', 31, 3136],
      ['Grand Piano', 27, 4186],
      ['Electric & Acoustic Guitar', 82, 1175],
      ['Bass Guitar (4-string)', 41, 392],
      ['Bass Viol (5-string)', 31, 247],
    ],
  },
  {
    name: 'Brass & Winds',
    color: '#d63384',
    rows: [
      ['Piccolo', 587, 4186],
      ['Flute', 262, 2349],
      ['Harmonica', 262, 1568],
      ['Oboe', 233, 1568],
      ['Soprano Saxophone', 208, 2217],
      ['Clarinet', 165, 1975],
      ['Trumpet', 165, 1047],
      ['English Horn', 165, 932],
      ['Alto Saxophone', 139, 830],
      ['Tenor Saxophone', 117, 622],
      ['French Horn', 87, 880],
      ['Trombone', 82, 660],
      ['Baritone Saxophone', 69, 522],
      ['Bass Clarinet', 69, 659],
      ['Bass Trombone', 62, 349],
      ['Bassoon', 58, 622],
      ['Bass Saxophone', 52, 329],
      ['Bass Tuba', 43, 349],
      ['Double Bassoon', 29, 172],
    ],
  },
  {
    name: 'Pipe Organ',
    color: '#f59e0b',
    rows: [['Pipe Organ', 16, 8372]],
  },
];

/* ── Perceptual data (instrument → descriptive bands) ── */
const PERCEPT_COLOR_BY_TERM = {
  Boom: '#87cefa', Bottom: '#87cefa', Bass: '#20b2aa', Rumble: '#20b2aa',
  Warmth: '#191970', Fullness: '#4682b4', Body: '#4682b4', Fatness: '#4682b4',
  Boxiness: '#c71585', Hardness: '#c71585', Boom: '#c71585', Honk: '#c71585',
  Attack: '#4682b4', Bite: '#c71585', Slap: '#c71585', Pluck: '#4682b4',
  Clarity: '#ffa500', Presence: '#ffa500', Crisp: '#ffa500', Air: '#ffa500',
  Sizzle: '#ffa500', Ringing: '#4682b4', Rasp: '#c71585', Shrill: '#c71585',
  Scratch: '#c71585', Gong: '#87cefa', Clunk: '#87cefa', Excitement: '#ffa500',
  Hum: '#87cefa',
};

const PERCEPT = [
  { inst: 'Kick Drum', bands: [['Boom', 60, 80], ['Boxiness', 500, 500], ['Attack', 2000, 6000]] },
  { inst: 'Snare Drum', bands: [['Fatness', 240, 240], ['Slap', 2500, 2500]] },
  { inst: 'Hi-Hat', bands: [['Gong', 200, 200], ['Bite', 2000, 2000], ['Crisp', 4000, 7000], ['Sizzle', 9000, 12000]] },
  { inst: 'Cymbals', bands: [['Clunk', 100, 300], ['Ringing', 1000, 6000], ['Sizzle', 8000, 12000]] },
  { inst: 'Bass Guitar', bands: [['Rumble', 20, 30], ['Bottom', 60, 80], ['Pluck', 500, 500], ['Excitement', 2500, 2500]] },
  { inst: 'Electric Guitar', bands: [['Hum', 50, 60], ['Fullness', 240, 240], ['Bite', 2500, 2500]] },
  { inst: 'Acoustic Guitar', bands: [['Bottom', 80, 100], ['Body', 240, 240], ['Hardness', 500, 900], ['Clarity', 2000, 2500]] },
  { inst: 'Electric Organ', bands: [['Bottom', 80, 120], ['Presence', 2500, 2500]] },
  { inst: 'Piano', bands: [['Bass', 30, 50], ['Bottom', 80, 120], ['Presence', 2500, 5000], ['Shrill', 5000, 7500], ['Air', 10000, 10000]] },
  { inst: 'Brass', bands: [['Warmth', 200, 400], ['Honk', 1000, 3500], ['Rasp', 6000, 8000], ['Shrill', 8000, 12000]] },
  { inst: 'Strings', bands: [['Fullness', 200, 300], ['Scratch', 7500, 10000]] },
  { inst: 'Vocals', bands: [['Fullness', 120, 120], ['Boom', 200, 250], ['Presence', 5000, 5000], ['Air', 7000, 10000]] },
];

function Axis({ ticks, lo, hi }) {
  return (
    <div className="relative h-4 w-full">
      {ticks.map((t) => {
        const left = t < lo ? 0 : logPos(t, lo, hi);
        return (
          <span
            key={t}
            className="absolute -translate-x-1/2 text-[8px] font-mono text-white/40"
            style={{ left: `${left}%` }}
          >
            {t === 0 ? '0' : fmtHz(t)}
          </span>
        );
      })}
    </div>
  );
}

function InstrumentalTab() {
  return (
    <div>
      {/* legend */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {FAMILIES.map((f) => (
          <span key={f.name} className="flex items-center gap-1.5 text-[10px] text-white/65">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
            {f.name}
          </span>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
        {/* rows */}
        <div className="space-y-[3px]">
          {FAMILIES.map((fam) =>
            fam.rows.map(([name, lo, hi]) => {
              const left = logPos(lo, F_MIN, F_MAX);
              const right = logPos(hi, F_MIN, F_MAX);
              const width = Math.max(right - left, 0.6);
              return (
                <div key={fam.name + name} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-[10px] text-white/70">{name}</span>
                  <div className="relative h-3.5 flex-1 rounded-sm bg-white/[0.03]">
                    <div
                      className="absolute top-0 h-full rounded-[2px]"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: fam.color,
                        opacity: 0.85,
                        boxShadow: `0 0 5px ${fam.color}66`,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[8px] text-white/40">
                    {lo}–{fmtHz(hi)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 pl-44 pr-16">
          <Axis ticks={SCALE_TICKS} lo={F_MIN} hi={F_MAX} />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-white/45">
        Fundamental pitch range only — harmonics extend far higher. Use it to anticipate where an instrument lives before you EQ.
      </p>
    </div>
  );
}

function PerceptualTab() {
  return (
    <div>
      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="w-40 shrink-0 text-[9px] font-bold uppercase tracking-wider text-white/50">Instrument</span>
          <div className="flex-1 pl-1">
            <Axis ticks={PERCEPT_TICKS} lo={P_MIN} hi={P_MAX} />
          </div>
        </div>
        <div className="space-y-[5px]">
          {PERCEPT.map((row) => (
            <div key={row.inst} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-[10px] text-white/70">{row.inst}</span>
              <div className="relative h-5 flex-1 rounded-sm bg-white/[0.03]">
                {row.bands.map(([term, lo, hi], i) => {
                  const left = logPos(lo, P_MIN, P_MAX);
                  const right = logPos(hi, P_MIN, P_MAX);
                  const width = Math.max(right - left, 1.4);
                  const color = PERCEPT_COLOR_BY_TERM[term] || '#87cefa';
                  return (
                    <div
                      key={i}
                      className="absolute top-0 flex h-full items-center justify-center overflow-hidden rounded-[2px] px-1"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: color,
                        color: '#06121f',
                      }}
                      title={`${term} · ${lo}${hi !== lo ? `–${fmtHz(hi)}` : ''} Hz`}
                    >
                      <span className="truncate text-[8px] font-bold leading-none">{term}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {['#87cefa', '#4682b4', '#191970', '#20b2aa', '#c71585', '#ffa500'].map((c, i) => (
          <span key={c} className="flex items-center gap-1.5 text-[9px] text-white/55">
            <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
            {['Low energy', 'Body / fullness', 'Warmth', 'Bass', 'Problem / hardness', 'Clarity / air'][i]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/45">
        Boost a term to enhance that character, cut it to remove the problem. e.g. cut “Boxiness” at 500 Hz on a kick, boost “Air” at 10 kHz on a vocal.
      </p>
    </div>
  );
}

export default function InstrumentFrequencyChart() {
  const [tab, setTab] = useState('instrumental');
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">
          Instrument Frequency Reference
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-white/15 text-[10px]">
          <button
            onClick={() => setTab('instrumental')}
            className={`px-2.5 py-1 font-semibold transition-all ${tab === 'instrumental' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            Instrumental
          </button>
          <button
            onClick={() => setTab('perceptual')}
            className={`px-2.5 py-1 font-semibold transition-all ${tab === 'perceptual' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            Perceptual
          </button>
        </div>
      </div>
      {tab === 'instrumental' ? <InstrumentalTab /> : <PerceptualTab />}
    </div>
  );
}