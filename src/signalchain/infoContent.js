/**
 * University-grade educational content for every Sound Chain Master panel.
 *
 * Each entry is keyed by a panel id and provides four sections, in the order
 * the user requested for the info modal:
 *   1. history  — the origin / evolution of the technique
 *   2. purpose  — why the processor is used
 *   3. params   — the most important parameters and how each changes the sound
 *   4. usage    — where it belongs in the production / signal chain
 *
 * history, purpose and usage may be EITHER a plain string (rendered as one
 * paragraph) OR an array of educational blocks:
 *     { p: 'short paragraph' }                      → a paragraph
 *     { bullets: [{ kw: 'Keyword', text: '…' }] }   → a keyworded bullet list
 * The block form is preferred — it makes the page scan like a textbook
 * sidebar instead of a wall of text.
 *
 * Used by InfoButton.jsx. Add a new panel by appending an entry here.
 */
export const PANEL_INFO = {
  eq: {
    title: 'Parametric EQ',
    diagrams: ['eq-shapes'],
    history: [
      { p: 'Equalization is as old as the telephone — early 20th-century engineers at Western Electric and Bell Labs built “line equalizers” to compensate for the high-frequency loss of long cables.' },
      { p: 'Studio “tone controls” appeared on 1930s cinema and broadcast consoles. The parametric EQ — where every band lets you set frequency, gain AND bandwidth (Q) independently — was invented by George Massenburg in 1969 and commercialized in the ITIParametric.' },
      { bullets: [
        { kw: '1930s', text: 'First studio tone controls on cinema & broadcast consoles.' },
        { kw: '1969', text: 'George Massenburg invents the parametric EQ (freq + gain + Q).' },
        { kw: '1980s', text: 'Neve, API and Sontec make fully-parametric mixing the standard.' },
        { kw: 'Digital era', text: 'Weiss, Waves and FabFilter turn EQ into the most-used tool in the box.' },
      ]},
    ],
    purpose: [
      { p: 'An EQ changes the balance of frequencies in a signal — cutting mud, lifting clarity, removing rumble or shaping tone.' },
      { p: 'It is the single most important corrective and creative tool in mixing.' },
      { bullets: [
        { kw: 'Carve space', text: 'So instruments do not mask each other in a dense mix.' },
        { kw: 'Fix problems', text: 'A boomy kick, a harsh vocal, rumble captured at recording.' },
        { kw: 'Colour', text: 'Boost or cut characterful frequency zones to shape tone.' },
        { kw: 'Everywhere', text: 'Used on every channel, every bus and the master.' },
      ]},
    ],
    params: [
      { name: 'Frequency', desc: 'The centre (or corner) of the band you are affecting. Lower numbers act on bass, higher on treble. Pick the frequency of the problem or the character you want.' },
      { name: 'Gain', desc: 'How much you boost or cut that band, in dB. +3 dB is audible; +12 dB is dramatic. Cut more than you boost — subtractive EQ keeps headroom clean.' },
      { name: 'Q (bandwidth)', desc: 'How wide the band is. A high Q is a narrow surgical notch (removing a resonance); a low Q is a broad musical tilt over many frequencies.' },
      { name: 'Shelf / Cut', desc: 'Low and high shelves lift or cut everything below/above a corner frequency at once; cuts (high-pass / low-pass) remove a whole end of the spectrum, e.g. cutting rumble below a vocal.' },
      { name: 'Mid/Side', desc: 'M/S mode encodes L/R into Mid (L+R) and Side (L−R), EQs each channel on its own filter chain, then decodes back to L/R. Use the M|S selector to shape Mid and Side independently — e.g. cut highs on Side only to tame harsh stereo width without touching the centre. The inactive channel is shown as a dashed ghost curve; unity at default.' },
    ],
    /* Distribution of frequencies — what each band IS, and what boosting or
       cutting it does to the sound. This is the "map" an engineer reads to
       decide where to point an EQ band. */
    frequencyGuide: [
      { band: 'Sub-bass', range: '20–60 Hz', boost: 'Power & felt weight — the chest-thump of a kick or bass.', cut: 'Cleans rumble, mic handling noise and DC-like mud; protects headroom.' },
      { band: 'Bass', range: '60–250 Hz', boost: 'Warmth, fullness and fundament of bass instruments.', cut: 'Tightens a flabby low end and removes boom from a kick or bass.' },
      { band: 'Low mids', range: '250–500 Hz', boost: 'Body, wood and "cardboard" thickness.', cut: 'Clears muddiness and boxiness — the most common corrective cut.' },
      { band: 'Mids', range: '500 Hz–2 kHz', boost: 'Presence, honk and nasal forwardness.', cut: 'Removes nasal/honk and de-clutters a cluttered mix.' },
      { band: 'High mids', range: '2–4 kHz', boost: 'Attack, definition and the "edge" that helps things cut.', cut: 'Softens harshness and takes the fatigue off bright sources.' },
      { band: 'Presence', range: '4–6 kHz', boost: 'Clarity and bite, especially on vocals and snare.', cut: 'Reduces harshness and listener fatigue on bright material.' },
      { band: 'Sibilance', range: '6–8 kHz', boost: 'Air and breath on vocals; brightness on cymbals.', cut: 'De-esses vocals and tames sharp cymbal harshness.' },
      { band: 'Brilliance', range: '8–12 kHz', boost: 'Sheen, openness and perceived detail.', cut: 'Hides tape/tape-style hiss or dulls a too-bright top end.' },
      { band: 'Air', range: '12–20 kHz', boost: 'Sparkle, space and "expensive" openness.', cut: 'Tames digital harshness or brittle highs.' },
    ],
    /* Show the hand-curated instrument frequency chart (instrumental +
       perceptual tabs) inside the EQ info modal. */
    chart: true,
    usage: [
      { p: 'EQ belongs near the start of every chain and on every bus.' },
      { bullets: [
        { kw: 'Channel', text: 'Remove problems and shape tone BEFORE dynamics, so the compressor reacts to the right frequencies.' },
        { kw: 'Buses', text: 'Use EQ on group buses for glue and tonal balance.' },
        { kw: 'Master', text: 'Apply final tonal balance at the end of the chain.' },
        { kw: 'Order', text: 'High-pass cut → corrective cuts → broad tonal shelves → optional broad boost.' },
      ]},
    ],
  },

  dynamiceq: {
    title: 'Dynamic EQ',
    diagrams: ['dynamiceq-architecture'],
    history: [
      { p: 'Dynamic EQ merges two ideas that matured separately: the parametric EQ (Massenburg, 1969) and the frequency-conscious compressor or “de-esser” (1980s, e.g. the Orban 526 / 622A).' },
      { p: 'Engineers needed a tool that only cuts a frequency WHEN it gets too loud, not all the time — to tame sibilance, a snare ring or a resonant bass note without deadening the sound at rest.' },
      { bullets: [
        { kw: '1969', text: 'Parametric EQ gives frequency + gain + Q control.' },
        { kw: '1980s', text: 'The de-esser adds frequency-conscious compression.' },
        { kw: 'Modern', text: 'FabFilter Pro-Q 3, TDR Nova and Sonnox wrap a tiny compressor inside each EQ band.' },
      ]},
    ],
    purpose: [
      { p: 'Dynamic EQ is used for problems that are only problems some of the time: a vocal that gets harsh on loud words, a bass that booms on certain notes, a snare with an occasional ring.' },
      { p: 'Unlike static EQ it never removes the frequency when it is quiet, so it preserves the natural tone.' },
      { bullets: [
        { kw: 'Conditional', text: 'Ducks a frequency only when it crosses a threshold.' },
        { kw: 'Transparent', text: 'Leaves the tone untouched at rest — no static colouring.' },
        { kw: 'De-esser', text: 'The modern replacement for a de-esser on vocals and masters.' },
        { kw: 'Resonances', text: 'Tames a ringing bass note or snare ring surgically.' },
      ]},
    ],
    params: [
      { name: 'Frequency / Q', desc: 'Same as static EQ — where the band sits and how wide it is. A narrow Q (3–6) targets a single resonance; a wider Q tames a zone.' },
      { name: 'Threshold', desc: 'The level the band must exceed before it is ducked. Lower it so the band only reacts to the loud moments you want to tame, not the whole performance.' },
      { name: 'Ratio', desc: 'How hard the band is reduced once over threshold. 2:1–4:1 is transparent; higher ratios make it behave like a narrow frequency limiter.' },
      { name: 'Attack / Release', desc: 'How fast it grabs and lets go. Fast attack catches sibilance; a slightly slower release avoids pumping. Log-scale dials let you dial 1 ms to 200 ms.' },
      { name: 'Mid/Side', desc: 'M/S mode runs independent Mid and Side band trees (L+R and L−R), each with its own per-band threshold/ratio. Use the M|S selector to tame, say, harsh Side content only when it gets loud while leaving the centre untouched. The inactive channel is shown as a ghost; unity at default.' },
    ],
    equation: {
      intro: 'Each band wraps a tiny saturator around its compressor (a de-esser: out = dry + comp(band) − compIdle(band)). The per-band saturator is deliberately far gentler than the main Saturation panel: there is no pre-boost, and the curve drive coefficient is 0.2× — so a band can warm its zone without distorting it. Because there is no pre-boost, the plotted transfer curve is exactly what you hear.',
      rows: [
        { label: 'Pre-boost', formula: 'none — satDrive = 1 (unity)', note: 'vs Saturation g = 1+9·drive' },
        { label: 'Tube curve (per band)', formula: 'y = tanh(k · x) · 0.9  +  0.05 · x  +  0.03 · x² · sgn(x)' },
        { label: 'Curve drive (0.2× the Saturation coefficient)', formula: 'k = 1 + 1.8 · drive', note: '9 → 1.8' },
        { label: 'Effective tanh drive', formula: '1 + 1.8 · drive', note: 'linear, not squared' },
        { label: 'Examples', formula: 'drive 0 → 1× (unity)   drive 0.3 → 1.54×   drive 1.0 → 2.8×', note: 'gentle warmth' },
        { label: 'Neutral identity (sat off or below threshold)', formula: 'out = dry + comp(band) − compIdle(band)  →  dry', note: 'true pass-through' },
      ],
    },
    usage: [
      { p: 'Dynamic EQ sits between corrective static EQ and the main compressor, or acts as the last surgical stage on a vocal bus.' },
      { bullets: [
        { kw: 'Position', text: 'After corrective static EQ, before (or instead of) the main compressor.' },
        { kw: 'Master', text: 'Place it late to catch harshness that survives compression.' },
        { kw: 'Aggressive', text: 'Safe to drive hard — it only acts on transient problems, not the whole signal.' },
      ]},
    ],
  },

  compressor: {
    title: 'Compressor',
    diagrams: ['compressor-transfer', 'compressor-gr'],
    history: [
      { p: 'Compression grew out of the needs of radio and vinyl in the 1930s: signals had to be kept within a narrow level window or the transmitter would over-modulate and the cutter would jump the groove.' },
      { p: 'The first commercially successful limiter was the Western Electric 110A (1937); Bill Putnam Sr. built the first recording-studio compressor in 1959.' },
      { bullets: [
        { kw: '1937', text: 'Western Electric 110A — the first peak limiter for AM radio.' },
        { kw: '1959', text: 'Bill Putnam Sr. builds the first studio compressor.' },
        { kw: '1965', text: 'Teletronix LA-2A — the opto classic.' },
        { kw: '1967', text: 'UREI 1176 — the FET classic that defined rock & pop.' },
        { kw: '1980s', text: 'SSL bus compressor gives mix engineers “glue.”' },
        { kw: '1990s', text: 'Digital plug-ins put a compressor on every channel.' },
      ]},
    ],
    purpose: [
      { p: 'A compressor reduces the dynamic range of a signal — it turns down the loudest parts so the quiet parts can come up, making a performance sound even, controlled and loud.' },
      { bullets: [
        { kw: 'Control peaks', text: 'A snare hit, a vocal shout.' },
        { kw: 'Punch & weight', text: 'Add body and impact to drums and bass.' },
        { kw: 'Glue', text: 'Bind a group together on a drum or mix bus.' },
        { kw: 'Seat the vocal', text: 'Make a vocal sit on top of a track instead of jumping out.' },
        { kw: 'Without it', text: 'Vocals and instruments jump out of a mix; with it, everything stays in place.' },
      ]},
    ],
    params: [
      { name: 'Threshold', desc: 'The level above which compression begins. Lower the threshold to compress more of the signal; the input must cross it for any gain reduction to happen.' },
      { name: 'Ratio', desc: 'How much the over-threshold signal is turned down. 2:1 is gentle, 4:1 moderate, 10:1+ near limiting. Higher ratios squeeze the dynamics harder and sound more aggressive.' },
      { name: 'Attack', desc: 'How fast it reacts once the signal crosses threshold. Fast attack (1–5 ms) tames transients but can dull a drum; slow attack (20–80 ms) lets the transient through for punch.' },
      { name: 'Release', desc: 'How fast it recovers after the signal drops. Too fast pumps; too slow squashes. Aim for release that breathes with the tempo (50–300 ms).' },
      { name: 'Knee', desc: 'How gradually compression engages around the threshold. A soft knee (wide) eases in transparently; a hard knee (narrow) grips suddenly for an obvious effect.' },
      { name: 'Makeup Gain', desc: 'Output gain added back after compression so the processed signal matches the original loudness — lets you A/B the effect of compression, not just the level change.' },
      { name: 'Mid/Side', desc: 'M/S mode encodes L/R into Mid (L+R) and Side (L−R), compresses each channel independently, then decodes back. Edit the Mid and Side channels separately with the M|S selector — e.g. a firmer ratio on Side narrows width only when the sides get loud. The Mid and Side compressors are sample-aligned; unity at default.' },
    ],
    characters: [
      { name: 'Digital', desc: 'Clean feed-forward, exact ratio, ~0% THD.' },
      { name: 'VCA (dbx/SSL)', desc: 'Feed-forward RMS detector, linear gain cell, very low THD (<0.1%). Character = detector smoothness, transparent GR. Attack/release fixed.' },
      { name: 'FET (1176)', desc: 'Peak detector with program-dependent ratio (ratio rises as input exceeds threshold — ~4:1→20:1 across +10 dB), very fast attack. The FET gain element adds subtle odd-order harmonics under heavy GR (~0.3–1% THD).' },
      { name: 'Opto (LA-2A)', desc: 'RMS detector with no fixed ratio (gain reduction is a smooth compressive function, "2:1→∞:1" continuously), and program-dependent release (release time constant lengthens as GR deepens — ~60 ms light → ~5 s deep). Tube output stage adds warm even harmonics (~1–3% THD).' },
      { name: 'VFET / Variable-mu (Fairchild/Manley)', desc: 'Feedback topology with a tube gain element that has a soft nonlinear transfer, warm saturation when pushed, no hard knee.' },
    ],
    equation: {
      intro: 'A compressor maps input level to output level with a bend at the threshold. The five character buttons select true per-circuit DSP models — feed-forward (Digital, VCA, FET) vs feedback (VFET), peak vs RMS detectors, program-dependent ratio (FET) and program-dependent release (Opto) — each with a subtle, character-appropriate harmonic colour.',
      rows: [
        { label: 'Transfer (hard knee)', formula: 'out = in,  in ≤ thr   |   thr + (in − thr)/ratio,  in > thr' },
        { label: 'Gain reduction', formula: 'GR = in − out  =  (in − thr) · (1 − 1/ratio),  in > thr' },
        { label: 'Level in dBFS', formula: 'dBFS = 20 · log₁₀( |x| )' },
        { label: 'RMS (loudness-ish)', formula: 'RMS = √( 1/N · Σ x² )' },
        { label: 'Makeup', formula: 'out = comp(in) · 10^(makeup/20)' },
      ],
    },
    usage: [
      { p: 'On a channel, compress after corrective EQ so the compressor hears the cleaned signal.' },
      { bullets: [
        { kw: 'Channel chain', text: 'EQ → compressor → saturator/space → fader.' },
        { kw: 'Bus', text: 'Low ratio (2:1) on a drum or mix bus for glue.' },
        { kw: 'Vocal', text: '3:1–5:1 to control level and seat the vocal.' },
        { kw: 'Master', text: 'Always place the final brickwall limiter AFTER compression.' },
      ]},
    ],
  },

  limiter: {
    title: 'Brickwall Limiter',
    diagrams: ['limiter-ceiling'],
    history: [
      { p: 'The limiter is the extreme end of compression — a compressor with an infinite ratio and (ideally) zero attack, invented to protect transmitters and disc cutters from overload.' },
      { p: 'The “brickwall” concept — a ceiling no signal can cross — became essential in the 1990s digital loudness race.' },
      { bullets: [
        { kw: '1937', text: 'Western Electric 110A “peak limiter” guards AM radio.' },
        { kw: '1970s', text: 'Neve 2254 and dbx 160 bring limiting into studios.' },
        { kw: '1990s', text: 'The digital loudness race makes the brickwall ceiling essential.' },
        { kw: 'Today', text: 'The last processor on every modern master — a clip-free file for streaming and CD.' },
      ]},
    ],
    purpose: [
      { p: 'A brickwall limiter prevents any sample from exceeding a set ceiling, so the output never clips.' },
      { p: 'It is used to maximize loudness by shaving only the loudest peaks, raising perceived loudness without distorting the body of the track.' },
      { bullets: [
        { kw: 'Max loudness', text: 'Push the input into the ceiling to raise perceived level.' },
        { kw: 'Safety net', text: 'Guarantees a clip-free master for streaming and CD.' },
        { kw: 'Competitive', text: 'Delivers a commercially competitive level.' },
        { kw: 'Peak only', text: 'Shaves peaks while leaving the body of the track untouched.' },
      ]},
    ],
    params: [
      { name: 'Ceiling', desc: 'The absolute output ceiling — no sample (and, in True-Peak mode, no inter-sample peak) leaves the limiter above it. Set just below 0 dBFS (−0.1 to −1 dB) and drive the input into it for loudness.' },
      { name: 'Input / Output Gain', desc: 'Input drives the signal harder into the ceiling to raise loudness; Output trims the final level after limiting so you can match loudness before/after. Both are controlled by the Input and Output dials in the control bay, AND by the pair of light-scheme vertical gain faders that flank the GR meter in the meter bay — Input meters → IN fader → GR → OUT fader → Output meters — so the meters, faders and dials read as one gain-staging surface. The faders and dials stay in sync; Alt-click a fader to snap it back to 0 dB unity.' },
      { name: 'Release / Auto', desc: 'How fast gain reduction recovers after a peak. Manual dials 5–500 ms (fast = loud but can pump, slow = transparent); Auto adapts the time to the amount of gain reduction — faster under heavy GR, gentler when light.' },
      { name: 'Lookahead', desc: 'Pre-delay (0–20 ms) bought with latency so the detector can react before a peak arrives — longer = more transparent catching of transients at the cost of delay.' },
      { name: 'Stereo Link', desc: 'Links L/R detection. 100% = one stereo compressor (the loudest channel pulls both down, safest); below 50% = dual-mono (independent, a wider image but each side must stay clean).' },
      { name: 'Style', desc: 'The limiting character: Transparent (clean), Punchy (shorter release for energy), Modern (very fast, loud), Warm (soft knee + slower release) and Classical (long release that preserves dynamics). XFADE morphs continuously between neighbouring styles on the track above the pills.' },
      { name: 'Oversampling / True-Peak', desc: 'Oversampling (1/2/4×) runs an oversampled soft-clip ceiling that suppresses inter-sample peaks; True-Peak adds 0.3 dB of ceiling headroom and meters in dBTP for streaming/broadcast compliance.' },
      { name: 'Mix', desc: 'Parallel limiting — blend the dry (unlimited) signal with the limited wet signal. Below 100% lets transients through for a more natural, less crushed sound.' },
      { name: 'Dither / Scale', desc: 'Dither (TPDF) is applied to the rendered WAV/MP3 on download for correct bit-depth reduction. Scale switches the meter range (24/32/48 dB, or the K-12/14/20 K-System headroom scales).' },
    ],
    equation: {
      intro: 'A brickwall limiter enforces a hard ceiling: any sample (or inter-sample peak, in True-Peak mode) above the ceiling is pulled down to it. A limiter only ever reduces gain — never boosts.',
      rows: [
        { label: 'Ceiling', formula: 'out = min(in, ceiling)   (per sample)' },
        { label: 'Gain reduction', formula: 'GR = max(0, in − ceiling)' },
        { label: 'True peak (inter-sample)', formula: 'TP = max over up-sampled peaks;  ceiling − 0.3 dB if on' },
        { label: 'Integrated loudness', formula: 'LUFS = −0.691 + 10·log₁₀( mean of K-weighted 400 ms blocks² )' },
      ],
    },
    usage: [
      { p: 'The limiter is the LAST processor on the master bus, after EQ, compression and any colour.' },
      { bullets: [
        { kw: 'Position', text: 'Final stage — after EQ, compression and any colour.' },
        { kw: 'Set ceiling', text: 'Just below 0 dBFS (−0.1 to −1 dB).' },
        { kw: 'Drive', text: 'Push the input to your target loudness; stop when you hear pumping or harshness.' },
        { kw: 'After it', text: 'Nothing except dither/encoding — ever.' },
      ]},
    ],
  },

  multibandcomp: {
    title: 'Multi-Band Compressor',
    diagrams: ['mbc-crossover'],
    history: [
      { p: 'Splitting the audio into frequency bands and compressing each separately was first done for broadcasting in the 1960s to keep vocals present over music; the Ward-Beck and Studer broadcast processors did it with analog crossovers.' },
      { p: 'In mastering, Bob Katz’s work on the K-system and units like the TC Electronic Finalizer (1996) made multi-band compression the loudness tool of the 1990s CD era.' },
      { bullets: [
        { kw: '1960s', text: 'Broadcast processors split the spectrum with analog crossovers.' },
        { kw: '1990s', text: 'TC Electronic Finalizer makes multi-band a mastering loudness tool.' },
        { kw: 'K-system', text: 'Bob Katz’s headroom reference for loudness metering.' },
        { kw: 'Today', text: 'Lives in mastering chains, de-essers and the “maximizer” stage.' },
      ]},
    ],
    purpose: [
      { p: 'A multi-band compressor applies different compression to low, mid and high frequencies separately, so a loud bass note does not pull down the vocal, and a bright cymbal does not duck the body.' },
      { bullets: [
        { kw: 'Master bus', text: 'Control the spectrum without squashing the whole mix.' },
        { kw: 'Drum bus', text: 'Tighten the low end independently.' },
        { kw: 'Problem instruments', text: 'Tame energy concentrated in one band.' },
        { kw: 'Transparent', text: 'Balances a whole mix that a single-band compressor would squash.' },
      ]},
    ],
    params: [
      { name: 'Crossovers', desc: 'The frequencies that split the bands (e.g. 120 Hz / 1.2 kHz / 8 kHz). Move them to isolate the problem range — the bass, the mids, the air.' },
      { name: 'Per-band Threshold / Ratio', desc: 'Each band has its own compressor: set the threshold so only the band\'s loud moments compress, and the ratio for how hard. Typical: gentle 2:1 on lows, firmer on mids.' },
      { name: 'Attack / Release (per band)', desc: 'Fast on highs to tame harshness, slower on lows to keep bass punch. Mismatched times are how multi-band gains its transparency over single-band.' },
      { name: 'Solo / Bypass / Makeup', desc: 'Solo a band to hear what it is doing, bypass to compare, and add makeup per band so the compressed output matches the input loudness.' },
      { name: 'Mid/Side', desc: 'M/S mode encodes L/R into Mid (L+R) and Side (L−R), runs separate Mid and Side band trees (shared crossovers, independent per-band compressors), then decodes. Edit each channel\'s bands with the M|S selector — e.g. compress the Side lows to tighten wide bass without affecting the centre. Unity at default.' },
    ],
    equation: {
      intro: 'A multi-band compressor splits the spectrum with Linkwitz-Riley crossovers, compresses each band separately, then sums the bands back. LR4 (24 dB/oct) crossovers sum flat at the crossover frequency.',
      rows: [
        { label: 'Crossover (Linkwitz-Riley LR4)', formula: 'LP = 2nd-order lowpass²,  HP = 2nd-order highpass²  →  −6 dB at f₀, sum = flat' },
        { label: 'Band i', formula: 'band_i = comp_i( LR_split_i(input) )' },
        { label: 'Output', formula: 'out = Σᵢ band_i · 10^(makeup_i/20)' },
      ],
    },
    usage: [
      { p: 'Use it on the master bus AFTER EQ and single-band compression but BEFORE the final brickwall limiter, or on a drum/bass group bus.' },
      { bullets: [
        { kw: 'Master order', text: 'EQ → single-band comp → multi-band → brickwall limiter.' },
        { kw: 'Group bus', text: 'Drum or bass bus to tighten a specific range.' },
        { kw: 'Subtle', text: '1–3 dB of gain reduction per band is usually enough.' },
        { kw: 'A/B', text: 'Always compare against the bypassed signal — it is powerful but easy to overdo.' },
      ]},
    ],
  },

  saturation: {
    title: 'Saturation',
    diagrams: ['saturation-curves'],
    history: [
      { p: 'Saturation is the “good” distortion every analogue device added: vacuum tubes, transformers and tape all bent the signal slightly as it passed through, adding harmonics and soft compression.' },
      { p: 'The warm sound of 1950s–60s recordings (RCA, Abbey Road) IS tube and tape saturation. When digital arrived clean in the 1980s engineers missed it — so plug-ins recreated the harmonic characters of tube, tape, transistor and opto circuits as a deliberate colour tool.' },
      { bullets: [
        { kw: '1950s–60s', text: 'Tube & tape saturation define the warm sound of the era.' },
        { kw: '1970s', text: 'Driven tape and consoles become a desirable sound.' },
        { kw: '1980s', text: 'Digital arrives clean — engineers miss the colour.' },
        { kw: 'Plugin era', text: 'Soundtoys Decapitator, FabFilter Saturn recreate it as a colour tool.' },
      ]},
    ],
    purpose: [
      { p: 'Saturation adds harmonics and gentle level-dependent compression, making a sound warmer, fatter, brighter and louder — and more “present” in a mix.' },
      { bullets: [
        { kw: 'Character', text: 'Add warmth and vibe to sterile digital sounds.' },
        { kw: 'Cut-through', text: 'Make a vocal or synth cut through without raising level.' },
        { kw: 'Glue', text: 'Bind a drum bus together.' },
        { kw: 'Loudness', text: 'Drive a master into perceived loudness.' },
        { kw: 'Colour ≠ clean', text: 'Unlike a limiter it colours as it compresses — the most-used “vibe” processor.' },
      ]},
    ],
    params: [
      { name: 'Character (Tube/Tape/Transistor/Opto/Clean)', desc: 'The harmonic signature. Tube adds even harmonics (warm, fat); Tape is smooth with compression; Transistor is bright and edgy; Opto is smooth and slow; Clean keeps the tone and only adds level.' },
      { name: 'Drive', desc: 'How hard the signal is pushed into the curve. More drive = more harmonics, more compression, more perceived loudness — and more obvious distortion.' },
      { name: 'Grit', desc: 'Adds noise modulation to the curve for a looser, rougher texture, mimicking component noise and a slightly unstable analogue path.' },
      { name: 'Mix', desc: 'Wet/dry blend. A low mix gives subtle thickening; 100% is full distortion character. Parallel saturation (low mix) is the modern transparent trick.' },
      { name: 'Tone / Output', desc: 'Tone trims the top end of the saturated signal; Output sets the final level after saturation so you can match loudness when comparing.' },
    ],
    equation: {
      intro: 'Every mode is a different waveshaper y = f(drive, x). The drive is applied twice — first as a linear pre-boost into the shaper, then again inside the curve — so the effective tanh drive squares. That double drive is what gives this panel its strong, harmonic-rich character. (The Dynamic EQ per-band saturator uses the same curve with 0.2× the coefficient and no pre-boost — see its notes.)',
      rows: [
        { label: 'Pre-boost (input gain into the shaper)', formula: 'g = 1 + 9 · drive' },
        { label: 'Curve drive (shared by all five modes)', formula: 'k = 1 + 9 · drive' },
        { label: 'Tube curve (the default mode)', formula: 'y = tanh(k · x) · 0.9  +  0.05 · x  +  0.03 · x² · sgn(x)' },
        { label: 'Tape / Transistor / Opto / Clean', formula: 'tanh(k·x·0.85) · (1−0.08|x|)  /  sgn(a)·(1−e^−|a|·2.5)·0.95  /  0.45x+0.55·tanh(k·x·0.5)  /  0.7x+0.3·tanh(k·x)', note: 'same k, different shape' },
        { label: 'Effective tanh drive (g feeds the curve)', formula: '≈ (1 + 9 · drive)²' },
        { label: 'Examples', formula: 'drive 0 → 1× (clean)   drive 0.4 → ≈21×   drive 1.0 → 100×', note: 'strong colour' },
      ],
    },
    usage: [
      { p: 'On a channel, saturate after compression to add excitement, or before it to feed the compressor a hotter signal.' },
      { bullets: [
        { kw: 'Channel', text: 'After compression for excitement, or before it to feed a hotter signal.' },
        { kw: 'Buses', text: 'Glues a group together.' },
        { kw: 'Master', text: 'A small amount (1–2 dB) adds loudness and glue.' },
        { kw: 'After it', text: 'Always place the final limiter after it — it adds harmonics and level.' },
        { kw: 'Watch', text: 'Keep an eye on cumulative distortion across the chain.' },
      ]},
    ],
  },

  clip: {
    title: 'Clip Distortion',
    diagrams: ['clip-transfer'],
    history: [
      { p: 'Clipping is the hardest form of saturation — when a signal exceeds a circuit’s headroom the top of the waveform is simply chopped off.' },
      { p: 'Engineers first did this deliberately on tape and consoles to get loud, aggressive sounds (the “driven” rock vocal, the clipped snare), and clipping became a signature of heavy genres.' },
      { bullets: [
        { kw: 'Analog', text: 'Driven tape and consoles for loud, aggressive sounds.' },
        { kw: 'Heavy genres', text: 'Clipping becomes a signature character.' },
        { kw: 'Digital hard-clip', text: 'Harsh — so modern clippers use soft-clip curves.' },
        { kw: 'Modern', text: 'Standard Clip, GClip, Pro-L2’s clip stage shave peaks for loudness with less damage.' },
        { kw: 'Sits between', text: 'A saturator and a limiter.' },
      ]},
    ],
    purpose: [
      { p: 'A clipper cuts the loudest peaks off the waveform, raising loudness more aggressively than a limiter because it does not try to hide the gain reduction — it simply removes the peak.' },
      { bullets: [
        { kw: 'Loudness', text: 'Raises level more aggressively than a limiter.' },
        { kw: 'Character', text: 'Adds an edgy, aggressive character to drums and masters.' },
        { kw: 'Shave stage', text: 'Sits before a limiter so the limiter has less work to do.' },
        { kw: 'Trade-off', text: 'Trades transient detail and cleanliness for raw level.' },
      ]},
    ],
    params: [
      { name: 'Drive', desc: 'How much the signal is amplified into the clipping curve. More drive = louder output but more of the waveform flattened, more harmonics and a harder sound.' },
      { name: 'Symmetry', desc: 'Off-centres the clip so positive and negative halves clip differently. Asymmetry adds even harmonics and a "rectified" character; symmetry stays cleaner and odd-harmonic.' },
      { name: 'Input / Output Gain', desc: 'Input sets how hard you drive the clip; Output brings the result back to a sensible level so you can compare loudness before/after.' },
      { name: 'Clip / Tone / Shelf filters', desc: 'Pre- and post-filters shape which frequencies get clipped and how the result sounds — clip only the highs for harshness control, or protect the lows from being clipped flat.' },
      { name: 'Mix', desc: 'Parallel blend of clipped and clean signal — a low mix shaves peaks for loudness while keeping the body of the original transient intact.' },
    ],
    equation: {
      intro: 'The clipper is an asymmetric soft-clip. Drive pushes the signal harder into a tanh curve; symmetry offsets the positive/negative halves to add even harmonics. Subtracting the DC term keeps the curve centred.',
      rows: [
        { label: 'Transfer', formula: 'y = tanh( drive · (x + s) ) − tanh( drive · s )' },
        { label: 'Symmetry', formula: 's = symmetry / 100   ( −1 … +1 )' },
        { label: 'Drive', formula: 'drive = 10^(driveDb/20)' },
        { label: 'Identity', formula: 'drive = 1, s = 0  →  y = tanh(x)  (clean soft-clip)' },
      ],
    },
    usage: [
      { p: 'On a drum bus or master, place a clipper BEFORE the final limiter to shave the sharpest peaks so the limiter does not have to clamp them (cleaner loudness).' },
      { bullets: [
        { kw: 'Master', text: 'Before the final limiter — shave peaks for cleaner loudness.' },
        { kw: 'Channel', text: 'Aggressive distortion for guitars, drums and bass.' },
        { kw: 'Lows', text: 'Avoid clipping low-heavy material flat — it makes audible DC-like distortion; filter the lows first.' },
      ]},
    ],
  },

  tape: {
    title: 'Tape Machine',
    diagrams: ['tape-response'],
    history: [
      { p: 'Magnetic tape recording arrived with the German Magnetophon (1940s) and came to studios after WWII via Bing Crosby’s Ampex Model 200 (1947).' },
      { p: 'For forty years everything was recorded to analog tape, and its sound became “the sound of a record.” As digital took over in the 1990s the tape character became a desirable effect, recreated by plug-ins so a clean digital recording can be given an analog soul.' },
      { bullets: [
        { kw: '1940s', text: 'German Magnetophon — the first magnetic tape recorder.' },
        { kw: '1947', text: 'Bing Crosby’s Ampex Model 200 brings tape to studios.' },
        { kw: 'Classic decks', text: 'Studer A800, Ampex ATR-102, Otari MTR-90, Nagra IV-S.' },
        { kw: '1990s', text: 'Digital takes over — tape character becomes a desirable effect.' },
        { kw: 'Plugins', text: 'UAD Studer A800, Satin, J37 give digital an analog soul.' },
      ]},
    ],
    purpose: [
      { p: 'A tape simulator adds the analogue character of recording to magnetic tape: gentle saturation that compresses and warms the signal, high-frequency loss that tames harshness, a low-frequency “head bump” that adds weight, plus the pitch wobble (wow & flutter) and hiss of a real machine.' },
      { bullets: [
        { kw: 'Glue & warmth', text: 'Gentle saturation compresses and warms the signal.' },
        { kw: 'Tame harshness', text: 'High-frequency loss softens the top end.' },
        { kw: 'Head bump', text: 'A low-frequency resonance adds bass weight.' },
        { kw: 'Vintage feel', text: 'Wow & flutter and hiss recreate a real machine.' },
        { kw: 'Master use', text: 'Make a track sound like it was committed to tape.' },
      ]},
    ],
    params: [
      { name: 'Speed (7.5 / 15 / 30 ips)', desc: 'Tape speed sets the bandwidth and character. Faster (30 ips) is cleaner with more highs and less wow; slower (7.5 ips) is warmer, darker and more wobbly — choose the vibe for the track.' },
      { name: 'Drive / Saturation / Bias', desc: 'Drive pushes the tape into compression; Saturation sets the harmonic depth; Bias trades noise for linearity (more bias = cleaner highs, less distortion).' },
      { name: 'Wow / Flutter / Noise', desc: 'Wow is slow pitch drift, flutter fast wobble — together they give the "unsteady" tape feel. Noise adds the background tape hiss of a real machine.' },
      { name: 'Head Bump / HF Loss', desc: 'Head Bump is a low-frequency resonance that fatten the bass; HF Loss rolls off the treble, smoothing harshness the way real tape does. These shape the tonal colour.' },
      { name: 'Mix / I/O Gain', desc: 'Mix blends wet tape against dry source for parallel warmth; Input/Output gain stage the signal into and out of the tape stage.' },
    ],
    equation: {
      intro: 'Tape colour comes from three stages in series: a saturation curve (tanh) for harmonic compression, a head-bump low shelf for bass weight, and a speed-dependent high-frequency loss that tames the top.',
      rows: [
        { label: 'Saturation', formula: 'y = tanh( (1 + drive·8) · (1 − bias·0.5) · x )' },
        { label: 'Head bump', formula: 'lowshelf,  fc ≈ 90 Hz,  gain = headBump · 10 dB' },
        { label: 'HF loss', formula: 'lowpass fc = 18k / 12k / 8k  (30 / 15 / 7.5 ips) − hfLoss' },
        { label: 'Wow & flutter', formula: 'delay = D + wow·sin(2π·0.7t) + flutter·sin(2π·6t)' },
      ],
    },
    usage: [
      { p: 'Use tape at the start of the chain or on a bus to commit a sound to “tape” early (like tracking to analog), or on the master after EQ/dynamics for final glue.' },
      { bullets: [
        { kw: 'Start of chain', text: 'Commit a sound to “tape” early, like tracking to analog.' },
        { kw: 'Master', text: 'After EQ/dynamics for final glue.' },
        { kw: 'Before limiter', text: 'It adds compression, loss and noise — so it comes before, not after, the final limiter.' },
        { kw: 'Parallel', text: 'Low mix adds warmth without losing clarity.' },
      ]},
    ],
  },

  delay: {
    title: 'Delay',
    diagrams: ['delay-taps'],
    history: [
      { p: 'Delay began as a physical phenomenon — tape echo. Sam Howlett and later Charlie Watkins (Watkins Copicat, 1958) created the first tape-echo units by routing audio through a loop of magnetic tape with a movable playback head.' },
      { p: 'The Roland RE-201 Space Echo (1974) became the studio classic. Digital delay brought clean, long, modulated echoes, and the plugin era made tempo-synced, modulated delay a staple for vocals, guitars and electronic music.' },
      { bullets: [
        { kw: '1958', text: 'Watkins Copicat — the first tape-echo unit.' },
        { kw: '1974', text: 'Roland RE-201 Space Echo — the studio classic.' },
        { kw: '1980s', text: 'Lexicon PCM42 — clean, long, modulated digital delay.' },
        { kw: 'Plugin era', text: 'Tempo-synced, modulated delay becomes a staple.' },
      ]},
    ],
    purpose: [
      { p: 'A delay repeats the signal after a set time, with each repeat quieter (feedback) so the echoes decay.' },
      { bullets: [
        { kw: 'Space & depth', text: 'Add a sense of space without a full reverb.' },
        { kw: 'Rhythm', text: 'Tempo-synced echoes on a vocal or guitar create rhythmic interest.' },
        { kw: 'Slap-back', text: 'A single short repeat for rockabilly-style slap.' },
        { kw: 'Throws', text: 'Dramatic echo throws at phrase ends.' },
        { kw: 'Controllable', text: 'The most precise, musical spatial effect — easy to fit into a tempo.' },
      ]},
    ],
    params: [
      { name: 'Time', desc: 'The gap between the dry sound and its first echo. In Free mode you dial milliseconds; in Sync mode the echo locks to the BPM as a note value (1/8, 1/4 dotted…) so it sits in the groove.' },
      { name: 'Feedback', desc: 'How many times the echo repeats. Low = a single slap; high = a long decaying tail. Keep below 100% or it builds forever.' },
      { name: 'Mix', desc: 'Wet/dry balance — how loud the echoes are against the original. A low mix is a subtle echo; a high mix drowns the dry signal for ambient effects.' },
      { name: 'Tempo / Sync', desc: 'Set the BPM (or use the host tempo) and Sync so the echoes land exactly on the beat, essential for rhythmic delay on vocals and guitars.' },
    ],
    equation: {
      intro: 'A feedback delay feeds the output back into the input, so each echo is the last echo multiplied by the feedback. The echo train decays geometrically.',
      rows: [
        { label: 'Difference equation', formula: 'y[n] = x[n] + feedback · y[n − D]' },
        { label: 'Echo k amplitude', formula: 'a_k = feedback^k' },
        { label: 'Synced time', formula: 'D = (60 / BPM) · note   (1/4 = 1, 1/8 = 0.5, dotted = ×1.5)' },
      ],
    },
    usage: [
      { p: 'Insert delay on a channel or, better, on a parallel send so you can keep the dry signal untouched.' },
      { bullets: [
        { kw: 'Send', text: 'Prefer a parallel send — keep the dry signal untouched.' },
        { kw: 'Late in chain', text: 'After EQ, dynamics and saturation — you delay the finished sound.' },
        { kw: 'Vocal', text: 'Tempo-synced 1/8 or 1/4 echoes on a vocal send are a classic move.' },
        { kw: 'Feedback', text: 'Keep it modest so the echo decays cleanly into the next phrase.' },
      ]},
    ],
  },

  reverb: {
    title: 'Reverb',
    diagrams: ['reverb-decay'],
    history: [
      { p: 'Reverberation is the natural sound of a space — the many reflections that reach the listener after the direct sound.' },
      { p: 'Studios first captured it in echo chambers (EMI Abbey Road, Capitol Studios, 1950s) and mechanical plates and springs. Digital reverb arrived in the 1970s, inventing algorithmic reverb, and convolution reverb let us sample real halls.' },
      { bullets: [
        { kw: '1950s', text: 'Echo chambers (Abbey Road, Capitol) and mechanical plates.' },
        { kw: '1957', text: 'EMT 140 plate reverb.' },
        { kw: 'Springs', text: 'AKG BX and Fender spring reverbs.' },
        { kw: '1976–78', text: 'EMT 250 and Lexicon 224 invent algorithmic reverb.' },
        { kw: '2000s', text: 'Convolution reverb (Altiverb) samples real halls.' },
      ]},
    ],
    purpose: [
      { p: 'Reverb adds a sense of space, distance and depth, placing a dry sound in a virtual room, hall or plate.' },
      { bullets: [
        { kw: 'Place in space', text: 'Put a dry sound in a virtual room, hall or plate.' },
        { kw: 'Glue', text: 'Glue disparate elements into a shared acoustic.' },
        { kw: 'Depth', text: 'More reverb pushes a sound further back in the mix.' },
        { kw: 'Emotion', text: 'Add lushness and emotion to a sound.' },
        { kw: 'Everywhere', text: 'Used on vocals, drums, instruments and the master.' },
      ]},
    ],
    params: [
      { name: 'Decay', desc: 'How long the reverb tail lasts. Short (0.5–1 s) is a room or plate; long (3–5 s) is a hall. Match decay to the tempo so the tail clears before the next phrase.' },
      { name: 'Damping', desc: 'How much the reverb darkens over time. High damping mimics a soft, absorbent space (the highs decay first); low damping is bright and metallic. Damp to keep reverb out of the way of the dry signal.' },
      { name: 'Mix', desc: 'Wet/dry balance. On an insert keep the mix low (5–20%) for a subtle space; on a send you run the reverb at 100% wet and blend with the dry fader.' },
    ],
    equation: {
      intro: 'This reverb is convolution-based: a synthetic impulse response (decaying noise) is convolved with the signal. The tail envelope and damping filter set the room character.',
      rows: [
        { label: 'Impulse envelope', formula: 'env(t) = (1 − t/T)² · noise(t)' },
        { label: 'Convolution', formula: 'y[n] = Σ_k h[k] · x[n − k]' },
        { label: 'Damping', formula: 'lowpass fc = 500 + damping · 19500 Hz' },
        { label: 'Size / length', formula: 'length = sampleRate · decay · (0.7 + size·0.6)' },
      ],
    },
    usage: [
      { p: 'Put reverb late in the chain — after EQ, dynamics and saturation — so you reverberate the finished sound, not the problems.' },
      { bullets: [
        { kw: 'Late in chain', text: 'After EQ, dynamics and saturation — reverberate the finished sound.' },
        { kw: 'Send bus', text: 'The pro approach: keep channels dry and send to a shared reverb so all instruments share one space.' },
        { kw: 'Room/plate', text: 'Short room/plate for drums and vocals.' },
        { kw: 'Hall', text: 'A longer hall for pads and ambience.' },
        { kw: 'Low end', text: 'High-pass the send to keep reverb out of the lows and avoid mud.' },
      ]},
    ],
  },

  mastering: {
    title: 'Mastering Studio',
    diagrams: ['mastering-chain'],
    history: [
      { p: 'Mastering began in the vinyl era: the “transfer engineer” cut a lacquer from the final mix, balancing levels and protecting the cutter from overload.' },
      { p: 'As formats multiplied (cassette, CD, streaming) mastering became a dedicated art — the last creative and quality-control step, handled by specialists like Bob Ludwig and Emily Lazar.' },
      { bullets: [
        { kw: 'Vinyl era', text: 'The transfer engineer cuts a lacquer from the final mix.' },
        { kw: 'Multi-format', text: 'Cassette, CD and streaming make mastering a dedicated art.' },
        { kw: '1990s', text: 'The loudness war pushes masters louder and louder.' },
        { kw: '2010s', text: 'Streaming loudness normalisation (Spotify/Apple ≈ −14 LUFS) brings standards back.' },
        { kw: 'Today', text: 'AI mastering services assist with the recipe.' },
      ]},
    ],
    purpose: [
      { p: 'Mastering is the final polish of a finished mix.' },
      { bullets: [
        { kw: 'Balance', text: 'Balance the spectrum with EQ.' },
        { kw: 'Dynamics', text: 'Control dynamics with compression and limiting.' },
        { kw: 'Loudness', text: 'Reach a target loudness for the destination medium.' },
        { kw: 'Quality', text: 'Ensure the file is clean and transferable.' },
        { kw: 'This studio', text: 'Generates an AI recipe, applies it, renders offline, normalises to target LUFS and exports a clip-free WAV or MP3.' },
      ]},
    ],
    params: [
      { name: 'Target Medium', desc: 'The destination — album, streaming, club, broadcast — each with a recommended target loudness (e.g. streaming ≈ −14 LUFS, club louder). It sets the normalisation goal.' },
      { name: 'Style', desc: 'How aggressive the recipe is: gentle keeps dynamics and transients; loud pushes the limiter harder for a competitive level. Match the genre and your taste.' },
      { name: 'Target LUFS', desc: 'The integrated loudness the finished master is normalised to. Streaming platforms normalise to about −14 LUFS; louder targets sound punchier but lose dynamic range.' },
      { name: 'Format (WAV / MP3)', desc: 'WAV is the lossless archive/delivery master (24-bit here); MP3 is the compressed distribution copy at 320 kbps.' },
      { name: 'Factory Presets', desc: 'A curated lane of AI-authored mastering recipes (Streaming Pop, Club Banger, …), each a partial recipe — EQ, dynamics, tape, limiter and multi-band — merged onto the module defaults so only the fields that matter are specified. Index 0 (Init Preset) is the neutral reset. The preset menu in the studio carousel applies any preset to the live chain in one click; in Section Mastering each preset becomes a section letter.' },
      { name: 'Preset Glide', desc: 'Between two presets the engine does not hard-switch: across a glide zone every DSP parameter is interpolated continuously (EQ/compressor parameter lerp, limiter/tape/saturation mix-scaling, multi-band weight crossfade), so moving from one recipe to the next is a smooth morph with no audible snap. See Section Mastering for the cross-parameterization math.' },
      { name: 'Render & Export', desc: 'Render & Download runs the whole chain offline over the loaded file, normalises the result to the Target LUFS, applies TPDF dither on bit-depth reduction, and exports a clip-free 24-bit WAV (lossless master) or a 320 kbps MP3 (distribution copy).' },
    ],
    equation: {
      intro: 'Mastering balances the spectrum and reaches a target loudness. The K-system defines reference headroom (0 K-meter = a fixed dB below 0 dBFS), and streaming platforms normalise to roughly −14 LUFS.',
      rows: [
        { label: 'K-system', formula: 'K-20: 0 K = −20 dBFS   K-14: 0 K = −14 dBFS   K-12: 0 K = −12 dBFS' },
        { label: 'Streaming target', formula: '≈ −14 LUFS integrated (Spotify / Apple normalize to this)' },
        { label: 'True-peak ceiling', formula: 'ceiling ≤ −1 dBTP for lossy encodes (codec overs)' },
      ],
    },
    usage: [
      { p: 'Mastering is the FINAL stage — run it on a finished, approved mix, not a work-in-progress.' },
      { bullets: [
        { kw: 'Finished mix', text: 'Run it on an approved mix, not a work-in-progress.' },
        { kw: 'Apply & preview', text: 'Apply the recipe, then A/B against the dry source with Bypass.' },
        { kw: 'Render', text: 'Render & Download the clip-free file.' },
        { kw: 'Chain order', text: 'EQ → dynamics → saturation/tape → multi-band → brickwall limiter → loudness normalise → encode.' },
      ]},
    ],
  },

  sectionmastering: {
    title: 'Section Mastering',
    history: [
      { p: 'Section mastering is the art of treating different parts of a track — intro, verse, chorus, outro — with different processing, because a single static master is a compromise across material that changes in level, tone and energy.' },
      { p: 'On the analog console this was done with automation — riding levels, EQ and limiter thresholds across the song — or by mastering each section separately and editing the results together. In the box, parameter automation solved the level side; the DSP that morphs between settings in real time is the modern extension.' },
      { bullets: [
        { kw: 'Automation', text: 'Console engineers rode faders, EQ and limiter thresholds per section.' },
        { kw: 'Edit mastering', text: 'Each section mastered separately then joined — accurate but laborious.' },
        { kw: 'Parameter morph', text: 'Modern engines interpolate every DSP parameter continuously between presets.' },
        { kw: 'Here', text: 'Divides the file into 1–5 sections, each mapped to a factory preset, and cross-fades the whole recipe across a glide zone at each boundary.' },
      ]},
    ],
    purpose: [
      { p: 'Section mastering lets one track be mastered for its own dynamics — a quiet intro can stay open and dynamic while the chorus is pushed loud, with a smooth morph between them instead of an audible snap.' },
      { bullets: [
        { kw: 'Per-section recipe', text: 'Each of up to five sections carries its own mastering preset (EQ, dynamics, tape, limiter…).' },
        { kw: 'Glide zones', text: 'A cross-parameterization band straddling each boundary morphs every parameter continuously — no clicks.' },
        { kw: 'Live Follow', text: 'As the playhead crosses each section the recipe auto-applies; inside a glide zone the blend drives the chain directly.' },
        { kw: 'Audition', text: 'Click a section to audition its preset on the live chain instantly.' },
      ]},
    ],
    params: [
      { name: 'Section count (1–5)', desc: 'How many timed sections the file is split into. The cue points start evenly spaced; 1 section is a single static master (no glides).' },
      { name: 'Preset letters (A–E)', desc: 'Each of the five coloured letters maps to any factory mastering preset via its dropdown. Drag a letter onto a waveform section to assign it — section i plays the preset its letter points to.' },
      { name: 'Cue handles', desc: 'The white handles on the waveform are the section boundaries. Drag a handle left/right to move its boundary to the right musical moment (a verse change, a drop).' },
      { name: 'Glide handles (✕)', desc: 'The ✕ handle on each boundary drags up/down to set the glide amount — how wide the cross-parameterization zone spreads around the cue, drawn as a triangle between the two adjacent section colours. 0 = a hard switch at the boundary; full = the longest smooth morph.' },
      { name: 'Live Follow', desc: 'On, the playhead drives the whole system: in the stable region of a section the section\'s preset is hard-applied once; inside a glide zone the engine morphs between the two adjacent presets every frame, with no React re-render (the 60 fps loop drives the DSP directly).' },
      { name: 'Audition / On / Reset', desc: 'Click any section to audition its preset on the live chain immediately. On/Off globally enables or disables section automation; Reset restores 3 sections and the default A–E letters.' },
    ],
    equation: {
      intro: 'Across a glide zone of half-width h around cue c, the playhead position t (0 at the left edge, 1 at the right) blends every parameter between the two adjacent preset recipes. EQ and Compressor interpolate parameters using a neutral (flat / ratio-1) state when a side has the module off, so the effect ramps in/out. Limiter, Tape and Saturation scale their wet/dry mix by each side\'s presence. Multi-band uses a continuous crossfade weight (0..1) so it passes through with no graph rewire.',
      rows: [
        { label: 'Zone position', formula: 't = (frac − (c − h)) / (2h),   0 ≤ t ≤ 1' },
        { label: 'Zone half-width', formula: 'h = glide · min(leftSpan, rightSpan, 0.18)' },
        { label: 'Presence', formula: 'left = 1 − t,   right = t   (at edges t=0/t=1 the blend = pure preset)' },
        { label: 'EQ gain (parameter lerp)', formula: 'g = g_A·(1−t) + g_B·t' },
        { label: 'Mix module (limiter/tape/sat)', formula: 'mix = mix_A·(1−t) + mix_B·t   (ON side\'s params)' },
        { label: 'Multi-band weight', formula: 'w = (onA ? 1−t : 0) + (onB ? t : 0)   → engine crossfade, no rewire' },
        { label: 'Hand-off', formula: 'at zone edges the blend = pure preset → continuous, no audible snap' },
      ],
    },
    usage: [
      { p: 'Use Section Mastering when one static master cannot serve the whole track — a dynamic intro that needs to breathe and a loud chorus that needs to hit.' },
      { bullets: [
        { kw: 'Sections', text: 'Set the count, drag the cue handles to the musical boundaries (verse / chorus / drop).' },
        { kw: 'Assign', text: 'Drag a letter onto each section and pick the preset each letter maps to.' },
        { kw: 'Glide', text: 'Open the ✕ handles to morph smoothly between presets, or close them for a deliberate hard change.' },
        { kw: 'Live Follow', text: 'Enable to have playback drive the whole sequence; click a section to audition it standalone.' },
        { kw: 'Above Mastering', text: 'It sits above the Mastering Studio and drives the same chain — the Mastering Studio recipe is the single-section fallback.' },
      ]},
    ],
  },

  masteredoutput: {
    title: 'Mastered Output',
    history: [
      { p: 'The waveform of a finished master has always arrived too late. On vinyl you saw the groove after the lacquer was cut. On tape you saw the trace after the pass. In the DAW you see the source file the moment it is loaded — but the mastered file only after you bounce, render, or export. Until then the work has no picture of itself.' },
      { p: 'Meters tell you what is happening in this buffer. The source overview is a picture of a file that already exists on disk. Neither is an image of the master as a whole, because recording culture decided that proof of a finished sound-work is storage.' },
      { p: 'Mastered Output inverts that order. It draws the full duration of audio that has been through the live chain but has not been written to any path. No bounce. No object in the filesystem. You are looking at how the master would look — an image of a file that does not exist yet.' },
      { p: 'That idea is Dr Ivan Zavada’s. Senior Lecturer and AI Champion in Composition & Music Technology at the Sydney Conservatorium of Music, The University of Sydney, he is a composer and digital media designer whose work examines the relationship between concrete sounds on a fixed recorded medium and visual elements of abstraction. Mastered Output is that question made into a studio view: a picture of a sound-work before it has been inscribed. Record: https://profiles.sydney.edu.au/ivan.zavada' },
      { bullets: [
        { kw: 'After the cut', text: 'Lacquer, tape and bounce: the picture arrived only after inscription.' },
        { kw: 'Meters', text: 'The living buffer — this instant, not the whole work.' },
        { kw: 'Source wave', text: 'A file that already is: archaeology of the loaded mix.' },
        { kw: 'Zavada', text: 'Dr Ivan Zavada, Sydney Conservatorium of Music — the pre-inscriptive master: an image of a file that does not exist yet.' },
      ]},
    ],
    purpose: [
      { p: 'This is not a courtesy preview and not a render waiting to finish. It is a third kind of image: neither the living meter nor the stored source, but the would-be file — the whole duration, as it will be if you export right now, while the thing itself still only exists as process.' },
      { p: 'The motto of Sound Chain Master is The best master is yet to come… In the studio it means the bounce is still ahead — you are looking at a master that has not been born. The same words carry an older hope: that the finest has not yet arrived, that the Master is still coming. Those layers are not a pun. Sound has always lived in all of them at once — as craft, as vibration, as listening, as devotion, as a signal on a chain. A picture of a file that does not exist yet is the studio form of that hope: the work is still becoming.' },
      { p: 'Once you take that seriously, the faders are not cosmetics on a graph. Pull Limiter Out and you are editing an artifact that has not been born. Move the automation lane and the future object changes its body in time. Seeing the master before it becomes a file is the innovation — created and designed by Ivan Zavada (Spher8 · SCM), © 2026.' },
      { bullets: [
        { kw: 'Not a bounce', text: 'Never writes audio. Never waits on a full-file render. It is a live hypothesis.' },
        { kw: 'Live', text: 'Limiter, mix, I/O faders, ceiling, ride and section recipes redraw the picture on the next frame.' },
        { kw: 'Whole duration', text: 'Quiet verses stay thin; slammed choruses fatten and flatten at the ceiling — the classic mastered look.' },
        { kw: 'Section-aware', text: 'With Section Mastering on, each letter’s recipe has its own density so a verse can stay open while a chorus bricks up.' },
        { kw: 'Studio', text: 'The export has not happened. This wave is the master before it is a file.' },
        { kw: 'Belief', text: 'The older promise that the best — and the Master — is still arriving.' },
        { kw: 'Sound', text: 'Craft, listening, signal, devotion: sound is never only storage.' },
      ]},
    ],
    params: [
      { name: 'The motto', desc: 'The best master is yet to come… sits on this panel because the picture is of a file that does not exist yet. In the studio the finest bounce is still ahead. In belief the finest — and the Master — is still coming. Across sound’s roles the work is never only what has already been inscribed.' },
      { name: 'How it would look', desc: 'Display only — no knobs on this panel. The picture is a hypothesis drawn over the loaded-file peak overview. The source wave above is the file you have; this wave is the file you do not have yet.' },
      { name: 'Target LUFS vs Detect', desc: 'Makeup is the lift from detected loudness (or −18 LUFS if you have not Detected) toward the Mastering Studio target. Detect makes the picture honest; without it the hypothesis still runs.' },
      { name: 'Limiter ceiling', desc: 'The dashed amber line is the brickwall the shape leans into. Peaks fatten and flatten there as drive and loudness rise — that is the mastered silhouette.' },
      { name: 'Limiter In / METERS IN', desc: 'These trims drive into the shape, so slamming the input fattens the wave toward the ceiling instead of merely scaling a finished envelope.' },
      { name: 'Limiter Out / METERS OUT', desc: 'These trims scale after the shape, so pulling output down collapses the whole picture immediately. They are not absorbed by the ceiling.' },
      { name: 'Mix, clip, glue', desc: 'Limiter mix, clipper mix and compressor ratio thicken the drive. More mix, more clip, more glue — denser, more brickwalled look.' },
      { name: 'Automation / AUTO', desc: 'When AUTO is on, the Master Effect lane rides the picture along the timeline. When AUTO is off, the master-trim control is the static ride. Drag the lane and the would-be file moves with it.' },
      { name: 'Section recipes', desc: 'With Section Mastering on, each timed region uses its assigned factory preset’s target LUFS and ceiling, so the picture can change density at every cue.' },
    ],
    equation: {
      intro: 'The picture is a live hypothesis, not a DSP bounce. Source peaks x are shaped by a brickwall tanh at the limiter ceiling, then scaled by the output trims. That is why Out faders move the wave, and why In faders fatten it into the ceiling.',
      rows: [
        { label: 'Hypothesis', formula: 'y = c · tanh((x · pre · makeup / c) · drive) · post' },
        { label: 'Makeup', formula: 'makeup ← 10^((targetLUFS − sourceLUFS) / 20)   (clamped, then ridden by fx)' },
        { label: 'Ceiling', formula: 'c = 10^(min(0, ceiling dB) / 20)' },
        { label: 'Drive', formula: 'drive = 1.06 + 1.55·limMix + fx·(0.45·clipMix + glue)' },
        { label: 'Into the shape', formula: 'pre = limiter In × master In' },
        { label: 'After the shape', formula: 'post = limiter Out × master Out × mix blend' },
        { label: 'Ride', formula: 'fx = 1 + masterTrim   (AUTO lane, or the trim control)' },
      ],
    },
    usage: [
      { p: 'Mastered Output sits under Section Mastering. Load a file, then watch the picture while you master. The source wave is the file you have. This wave is the file you do not have yet.' },
      { bullets: [
        { kw: 'Load a file', text: 'Without a source there is nothing to hypothesize.' },
        { kw: 'Detect', text: 'Tighter LUFS estimate, so the makeup — and the picture — is honest.' },
        { kw: 'Move the chain', text: 'Limiter, mix, I/O faders, Style and the automation lane all redraw on the next frame.' },
        { kw: 'Sections', text: 'With Section Mastering on, each letter’s recipe shows as its own density.' },
        { kw: 'Export is birth', text: 'Render & Export is when the image becomes a file. Until then this is how it would look.' },
        { kw: 'Record', text: 'Dr Ivan Zavada — Senior Lecturer, Composition & Music Technology, Sydney Conservatorium of Music, The University of Sydney. https://profiles.sydney.edu.au/ivan.zavada' },
      ]},
    ],
  },

  vu: {
    title: 'VU Meter',
    diagrams: ['vu-scale'],
    history: [
      { p: 'The VU (Volume Unit) meter was standardised in 1939 by a joint NBC/CBS/Bell Labs committee to give broadcasters a consistent reading of programme loudness.' },
      { p: 'Its d’Arsonval needle movement has a defined 300 ms rise (the “VU ballistic”), and 0 VU was calibrated to a reference level. The Weston and Simpson VU meters became the studio standard for forty years.' },
      { bullets: [
        { kw: '1939', text: 'Standardised by an NBC/CBS/Bell Labs committee.' },
        { kw: 'VU ballistic', text: 'A defined 300 ms needle rise — it averages like the ear.' },
        { kw: 'Reference', text: '0 VU is calibrated to a fixed reference level.' },
        { kw: 'Digital', text: '0 VU typically corresponds to −18 dBFS, leaving headroom above it.' },
      ]},
    ],
    purpose: [
      { p: 'A VU meter shows the perceived loudness of a signal, not its peaks — its slow needle averages the level the way the ear hears it.' },
      { p: 'It is used for gain staging.' },
      { bullets: [
        { kw: 'Loudness', text: 'Shows perceived loudness, not peaks — the slow needle averages like the ear.' },
        { kw: 'Gain staging', text: 'Set the input so the needle sits around 0 VU on the loudest passages.' },
        { kw: 'Headroom', text: 'A consistent, musical level into the next device, with safe headroom.' },
        { kw: 'Level matching', text: 'The classic tool for matching levels and avoiding over/under-driving a chain.' },
      ]},
    ],
    params: [
      { name: '0 VU calibration', desc: 'Here 0 VU is aligned to −18 dBFS RMS, the modern studio standard. The needle reaching 0 means your RMS level is at the reference; the +3 red zone shows the top of the headroom.' },
      { name: 'Round / Rect', desc: 'The two visual variants use the same VU ballistic and calibration — the circular gauge is the classic studio look, the rectangular one is a compact mixing-console style.' },
    ],
    usage: [
      { p: 'Use a VU meter at the START of the chain to set input gain, and at the end to confirm output level.' },
      { bullets: [
        { kw: 'Input', text: 'At the start — set input gain so the needle hovers 0 VU on the loudest parts.' },
        { kw: 'Output', text: 'At the end — confirm the output level.' },
        { kw: 'Pair with peak', text: 'VU for loudness/gain staging, peak for clipping.' },
        { kw: 'Warning', text: 'It reads RMS — it will NOT warn you about fast peaks. Always pair it with a peak/level meter.' },
      ]},
    ],
  },

  level: {
    title: 'Master Level Meter',
    diagrams: ['level-scale', 'lufs-diagram'],
    history: [
      { p: 'Peak meters replaced VU meters as digital recording needed sample-accurate overload detection: a single sample over 0 dBFS clips, something the slow VU needle cannot show.' },
      { p: 'LED-segment meters and digital ppm/peak meters became standard in the 1980s–90s. Modern meters show peak, RMS, headroom and true-peak (intersample) so an engineer can both avoid clipping and judge loudness.' },
      { bullets: [
        { kw: 'Digital need', text: 'Sample-accurate overload detection — a single sample over 0 dBFS clips.' },
        { kw: 'LED meters', text: 'The Dorrough shows simultaneous peak + RMS.' },
        { kw: '1980s–90s', text: 'Digital ppm/peak meters become standard.' },
        { kw: 'Modern', text: 'Peak, RMS, headroom and true-peak (intersample) in one meter.' },
      ]},
    ],
    purpose: [
      { p: 'This segmented meter shows the peak level of the signal in dBFS so you know exactly how close you are to clipping (0 dBFS).' },
      { p: 'In PRO mode it adds RMS, per-channel peak and headroom, letting you gain-stage accurately and confirm the master leaves safe headroom.' },
      { bullets: [
        { kw: 'Peak', text: 'Shows the loudest sample so you know how close you are to clipping.' },
        { kw: 'RMS', text: 'Shows perceived loudness.' },
        { kw: 'Headroom', text: 'Shows how many dB remain to 0 dBFS.' },
        { kw: 'Safety', text: 'The level-checking and clipping-safety tool for every stage of the chain.' },
      ]},
    ],
    params: [
      { name: 'IN / OUT', desc: 'Monitor the level at the input of the chain (pre-processing) or the output (post-processing) so you can compare what came in with what comes out.' },
      { name: 'I/O gain faders', desc: 'Vertical log-taper gain-trim faders (the Ozone-style strip) flank the meters and trim the chain input and output levels. Unity (0 dB) sits 3/4 up the track; +12 dB at the top, −36 dB at the bottom, with most of the travel in the cut region for fine gain-staging. Alt-click a fader to snap it back to 0 dB unity.' },
      { name: 'L/R Link', desc: 'Toggle to link the left and right input/output faders into a single stereo pair (LINK), or unlink them (L·R) for independent left and right gain — useful to balance a lopsided source. The same control appears on the studio meter aside.' },
      { name: 'Peak / RMS / Headroom', desc: 'Peak shows the loudest sample (clipping warning); RMS shows perceived loudness; Headroom shows how many dB remain to 0 dBFS. Keep peak below 0 and leave 0.3–1 dB of headroom on a master.' },
      { name: 'Pro detail', desc: 'Per-channel L/R peak and RMS plus a master readout — for precise stereo gain staging and confirming neither channel clips.' },
      { name: 'K-weighting filter (LUFS)', desc: 'A two-stage filter: a high-shelf pre-filter (+4 dB above 1 kHz, modelling head diffraction) followed by a high-pass at 38 Hz (removing sub-bass the ear does not hear as loud). Applied before measuring RMS for the LUFS readout.' },
      { name: 'Momentary LUFS', desc: '400 ms sliding RMS of K-weighted signal — the fastest loudness window. Reacts to individual words, kicks or snare hits. Used to check that transients are not too loud.' },
      { name: 'Short-Term LUFS', desc: '3-second sliding RMS. Tells you the loudness of phrases, choruses and verses. Most engineers watch this in the mix and aim to keep it close to the integrated target.' },
      { name: 'Integrated LUFS', desc: 'The full-programme average from the beginning (or last reset). This is the number to hit for your delivery standard: −14 LUFS for streaming, −23 LUFS for broadcast.' },
    ],
    equation: {
      intro: 'LUFS (Loudness Units relative to Full Scale) is computed in four steps: K-weighting → mean square → time-window average → log. The integrated measure adds a gating stage that ignores silence.',
      rows: [
        { label: 'K-weighting pre-filter (head diffraction)', formula: 'H₁(s): high shelf, fc = 1681.8 Hz, gain ≈ +4 dB' },
        { label: 'K-weighting high-pass (sub-bass cut)', formula: 'H₂(s): 2nd-order Butterworth HPF, fc = 38.1 Hz' },
        { label: 'Mean square (per channel)', formula: 'z_i = (1/T) · ∫ |K(x_i(t))|² dt   over window T' },
        { label: 'Loudness (stereo, L+R)', formula: 'L = −0.691 + 10 · log₁₀( z_L + z_R )   [LUFS]' },
        { label: 'Momentary (M)', formula: 'T = 400 ms, rectangular sliding window, hop = 100 ms' },
        { label: 'Short-Term (S)', formula: 'T = 3000 ms, rectangular sliding window, hop = 100 ms' },
        { label: 'Integrated (I)', formula: 'T = ∞ (gated: ignore blocks where L < -70 LUFS, then < Γ − 10 LU)' },
        { label: 'True Peak (dBTP)', formula: 'Upsample ×4, find max |x|, convert to dB — catches inter-sample overs' },
      ],
    },
    usage: [
      { p: 'Watch the level meter at the END of the chain (OUT mode) to confirm the master never clips and leaves headroom, and at the input (IN mode) to set source gain.' },
      { bullets: [
        { kw: 'OUT mode', text: 'At the end — confirm the master never clips and leaves headroom.' },
        { kw: 'IN mode', text: 'At the input — set the source gain.' },
        { kw: 'Pair with VU', text: 'Peak here for clipping, VU for loudness.' },
        { kw: 'Master target', text: 'Aim for peaks just under 0 dBFS (−0.3 to −1 dB) and a streaming-friendly RMS.' },
      ]},
    ],
  },

  output: {
    title: 'Final Output Visualizer',
    diagrams: ['output-anatomy'],
    history: [
      { p: 'Spectrum analyzers entered studios with the Kay Elementrics and Hewlett-Packard analyzers of the 1960s–70s and the dedicated RTA (real-time analyzer) used in live sound and mastering.' },
      { p: 'The oscilloscope is older still — cathode-ray waveform viewing from the 1930s. In the plugin era the combined spectrum + scope + loudness meter became the default “what does my master actually look like” display for mastering engineers.' },
      { bullets: [
        { kw: '1960s–70s', text: 'Kay & HP analyzers and the RTA enter studios.' },
        { kw: '1930s', text: 'The oscilloscope — cathode-ray waveform viewing.' },
        { kw: 'Plugin era', text: 'Voxengo SPAN and iZotope Insight combine spectrum + scope + loudness.' },
        { kw: 'Default', text: 'The standard “what does my master look like” display.' },
      ]},
    ],
    purpose: [
      { p: 'This visualizer shows the spectrum (level per frequency), the waveform (oscilloscope), and a live peak/RMS readout of the final output, plus a ghost trace of the dry pre-chain source so you can A/B the mastered signal against the original on the same analyzer.' },
      { bullets: [
        { kw: 'Spectrum', text: 'Level per frequency — the tonal balance.' },
        { kw: 'Scope', text: 'The waveform — time-domain shape.' },
        { kw: 'Peak/RMS', text: 'Live numbers for the final output.' },
        { kw: 'Dry ghost', text: 'The pre-chain source behind the output, for an instant A/B.' },
        { kw: 'Confirmation', text: 'Does the master look balanced — holes, build-ups, vs the dry source.' },
      ]},
    ],
    params: [
      { name: 'Spectrum bars', desc: 'The log-frequency spectrum from 20 Hz–20 kHz; the cyan→violet→pink gradient and decaying peak-hold caps show the tonal balance and any build-ups or holes to fix upstream.' },
      { name: 'Oscilloscope', desc: 'The waveform overlay in the lower third shows the time-domain shape — useful for spotting clipping, DC offset and transient behaviour.' },
      { name: 'Peak / RMS readout', desc: 'Live numbers for the output peak (red if over 0) and RMS — confirms the master is loud enough and not clipping.' },
      { name: 'Dry ghost trace', desc: 'The amber line is the pre-chain source spectrum/scope shown behind the mastered output, so the difference the chain makes is visible at a glance.' },
    ],
    usage: [
      { p: 'Read this at the END of the chain (it taps the post-master analyzer).' },
      { bullets: [
        { kw: 'Position', text: 'At the end of the chain — it taps the post-master analyzer.' },
        { kw: 'Compare', text: 'Mastered spectrum vs the dry ghost — confirm holes are filled and build-ups tamed.' },
        { kw: 'Peak', text: 'Watch the peak readout stays under 0 dBFS.' },
        { kw: 'Diagnostic', text: 'It is not a processor — use it to decide what to adjust upstream.' },
      ]},
    ],
  },

  source: {
    title: 'Audio Source & Signal Chain',
    diagrams: ['signal-flow'],
    history: [
      { p: 'The concept of routing a signal through a fixed order of processors — the “signal chain” — comes from the analog studio, where a microphone, preamp, EQ, compressor and tape machine were wired in sequence on a patchbay.' },
      { p: 'The order mattered then and it matters now: each processor feeds the next, and moving one changes how they interact.' },
      { bullets: [
        { kw: 'Patchbay', text: 'A mic → preamp → EQ → compressor → tape machine wired in sequence.' },
        { kw: 'Order matters', text: 'Each processor feeds the next — moving one changes the interaction.' },
        { kw: 'Software', text: 'This harness recreates that chain with a file or live mic as the source.' },
        { kw: 'Reorderable', text: 'A bypassable series of effects feeding the meters and master.' },
      ]},
    ],
    purpose: [
      { p: 'The Audio Source loads a file or your microphone, plays it through the chain, and gives transport, output volume, a global bypass and a reset.' },
      { p: 'It is the entry point of the whole signal chain — everything below processes whatever you feed it here.' },
      { bullets: [
        { kw: 'File or Mic', text: 'Load an audio file or use your live microphone input.' },
        { kw: 'Transport', text: 'Play / pause / stop the loaded file.' },
        { kw: 'Output volume', text: 'Master output gain applied at the end of the chain.' },
        { kw: 'Bypass', text: 'Global A/B against the untouched dry source.' },
        { kw: 'Reset', text: 'Restore every effect panel to its default state.' },
      ]},
    ],
    params: [
      { name: 'Play / Pause / Stop', desc: 'Transport for the loaded file. Stop returns to the start; Pause holds position.' },
      { name: 'Mic', desc: 'Switches the source from the loaded file to your live microphone input, for real-time processing of voice or instruments.' },
      { name: 'Bypass', desc: 'A/B switch — compares the full chain output against the untouched dry source, so you can hear exactly what your processing is doing.' },
      { name: 'Out volume', desc: 'Master output gain in dB, applied at the very end of the chain before the meters. −∞ is muted.' },
      { name: 'Playhead scrubber', desc: 'A seekable timeline between the transport and the Monitor Out fader. Click or drag anywhere on the bar to jump the source to that position — playback can start from anywhere in the file, not only the beginning. The playhead follows the pointer while dragging and the clock while playing; elapsed and total time read out at each end.' },
      { name: 'Mono', desc: 'Collapses the chain output to mono — a quick mono-compatibility check (if a wide mix thins out in mono, the sides are out of phase; pull the imager width back). Available on the studio meter aside.' },
      { name: 'Reset', desc: 'Restores every effect panel to its default state — useful to start a chain from scratch.' },
    ],
    usage: [
      { p: 'This is the START of the chain — load or mic your source here, set a sensible output level, then build your effect chain below.' },
      { bullets: [
        { kw: 'Start here', text: 'Load or mic your source and set a sensible output level.' },
        { kw: 'Build below', text: 'Construct your effect chain in the panels below.' },
        { kw: 'Bypass often', text: 'Use Bypass constantly to confirm each processor is helping, not hurting.' },
        { kw: 'Signal flow', text: 'Source → Effect Chain → Master → Meters → Output.' },
      ]},
    ],
  },

  signalchain: {
    title: 'Signal Chain & Routing',
    diagrams: ['signal-flow', 'mastering-chain'],
    history: [
      { p: 'The signal chain is the spine of every record. In the analog studio a signal travelled a fixed physical path — microphone → preamp → EQ → compressor → tape machine — wired in sequence on a patchbay, and the order was set by which sockets you patched.' },
      { p: 'Moving a processor in the chain changed how it interacted with the next: a compressor before an EQ reacts to an un-shaped signal; an EQ before a compressor lets you de-ess before it gets grabbed. Parallel routing is just as old.' },
      { bullets: [
        { kw: 'Patchbay', text: 'Analog studios wired processors in sequence on a patchbay.' },
        { kw: 'Order matters', text: 'Compressor-before-EQ ≠ EQ-before-compressor — they interact.' },
        { kw: 'Parallel comp', text: '“New York” compression was summed on the console bus.' },
        { kw: 'Send/return', text: 'Echo chambers and plate reverbs used send/return loops long before plugins.' },
        { kw: 'This harness', text: 'Rebuilds that patchbay in software — reorderable serial chain, a parallel lane, and patch-cord send/return cables you draw yourself.' },
      ]},
    ],
    purpose: [
      { p: 'The order of processors is as important as the processors themselves. The same EQ and compressor sound different in different orders, and effects like reverb and delay are often better in parallel so the dry signal stays untouched.' },
      { bullets: [
        { kw: 'Reorder', text: 'Drag the grip handle to move a module earlier or later in the chain.' },
        { kw: 'Toggle', text: 'Press and hold a module to bypass it — the quick A/B.' },
        { kw: 'Serial', text: 'IN → modules → OUT — the classic single-line chain.' },
        { kw: 'Parallel', text: 'A second lane runs a wet copy alongside the dry signal and blends back in.' },
        { kw: 'Send cable', text: 'Drag a serial module’s blue dot down to the parallel input to tap the signal there.' },
        { kw: 'Return cable', text: 'Drag a parallel module’s yellow dot up to a serial dot to set where the wet signal blends back in.' },
      ]},
    ],
    params: [
      { name: 'Serial / Parallel mode', desc: 'Serial routes every module in one line, IN → modules → OUT — the classic chain. Parallel opens a second lane and lets a wet processed copy run alongside the dry signal and blend back in, the way an aux-send reverb or parallel compressor works on a console.' },
      { name: 'Reorder (grip)', desc: 'Drag the grip handle (top-left of a module) to move it earlier or later. Order matters: EQ before a compressor shapes what the compressor reacts to; a compressor before EQ tames dynamics first, then you shape tone.' },
      { name: 'Hold to toggle', desc: 'Press and hold a module to turn it on or off (bypass) without removing it — the quick A/B for “is this processor helping?”. The green dot shows it is active.' },
      { name: 'Send cable (blue)', desc: 'In Parallel mode, drag a serial module’s bottom blue dot down to the parallel input to tap the signal there. Where you send defines what the parallel lane hears — before the EQ, after the compressor, and so on.' },
      { name: 'Return cable (yellow)', desc: 'Drag a parallel module’s bottom yellow dot up to a serial dot to set where the wet parallel signal blends back in. The return must always land after the send, so the parallel output never feeds its own input (no feedback loop).' },
      { name: 'IN / OUT anchors', desc: 'Once cables exist, two draggable dots let you slide the send tap and return point along the chain without redrawing — repositioning the whole parallel loop in real time.' },
      { name: 'Wet', desc: 'The blend amount of the parallel lane into the serial signal. 0% is fully dry (parallel lane silent), 100% is fully wet. Parallel compression typically sits around 20–50%.' },
      { name: 'Panel carousel', desc: 'Below the chain, the full editor for each module lives in a horizontal carousel — one slide per module, plus a multimeter slide at the end. Click a module in the chain to jump to its editor; horizontal trackpad swipes (or shift + wheel) scroll the carousel, while a vertical wheel scrolls the page normally so the meters and panels stay navigable. The trailing multimeter slide switches between the View Meter (VU), the master Level meter and the Final Output analyzer.' },
    ],
    usage: [
      { p: 'Think of the chain in three stages: corrective → dynamic control → colour & space → level.' },
      { bullets: [
        { kw: 'Corrective', text: 'EQ cuts and de-essing — early, so dynamics react to the right material.' },
        { kw: 'Dynamics', text: 'Compressor / multi-band — control the level.' },
        { kw: 'Colour & space', text: 'Saturation, tape, delay, reverb — keep late or parallel so the dry signal stays present.' },
        { kw: 'Level', text: 'The brickwall limiter — always last.' },
        { kw: 'Parallel', text: 'Use it for New-York-style compression or parallel reverb/delay sends.' },
        { kw: 'A/B', text: 'Constantly toggle modules (hold) and bypass the whole chain to confirm every processor is improving the sound.' },
      ]},
    ],
  },

  lufs: {
    title: 'LUFS · Loudness Metering',
    diagrams: ['lufs-diagram'],
    history: [
      { p: 'LUFS (Loudness Units relative to Full Scale) was standardised in ITU-R BS.1770 (2006) and adopted by the EBU as EBU R 128 (2010). It replaced the competing — and often misleading — peak and RMS loudness metrics that drove the loudness war of the 1990s–2000s.' },
      { bullets: [
        { kw: '1990s', text: 'The loudness war: engineers max peaks to 0 dBFS to sound louder, crushing dynamics.' },
        { kw: '2006', text: 'ITU-R BS.1770 defines K-weighted loudness — a consistent, ear-model-based standard.' },
        { kw: '2010', text: 'EBU R 128 mandates −23 LUFS for broadcast in Europe.' },
        { kw: '2015+', text: 'Spotify, Apple Music, YouTube adopt LUFS normalisation (~−14 LUFS) — the war ends.' },
      ]},
    ],
    purpose: [
      { p: 'LUFS measures perceived loudness — not peak amplitude — using a K-weighting filter that models how the human ear hears. Three time windows serve different engineering purposes.' },
      { bullets: [
        { kw: 'Momentary (M)', text: '400 ms sliding average — the fastest window. Tells you the loudness of the current transient burst. Used for real-time visual feedback.' },
        { kw: 'Short-Term (S)', text: '3 s sliding average — breathes with the music. Shows the loudness of phrases and sections. The working loudness reference for most engineers.' },
        { kw: 'Integrated (I)', text: 'Running average for the whole programme since reset. The deliverable number — what streaming platforms measure and what you normalise to.' },
      ]},
    ],
    params: [
      { name: 'K-weighting filter', desc: 'A two-stage filter: a high-shelf pre-filter (+4 dB above 1 kHz, modelling head diffraction) followed by a high-pass at 38 Hz (removing sub-bass the ear does not hear as loud). Applied before measuring RMS.' },
      { name: 'Momentary LUFS', desc: '400 ms sliding RMS of K-weighted signal. The fastest loudness window — reacts to individual words, kicks or snare hits. Used to check that transients are not too loud.' },
      { name: 'Short-Term LUFS', desc: '3-second sliding RMS. Tells you the loudness of phrases, choruses and verses. Most engineers watch this in the mix and aim to keep it close to the integrated target.' },
      { name: 'Integrated LUFS', desc: 'The full-programme average from the beginning (or last reset). This is the number to hit for your delivery standard: −14 LUFS for streaming, −23 LUFS for broadcast.' },
      { name: 'LU (Loudness Unit)', desc: '1 LU = 1 dB in the loudness domain. A reading of −16 LUFS is 2 LU below −14 LUFS. The relative unit makes it easy to talk about loudness differences without specifying dBFS.' },
    ],
    equation: {
      intro: 'LUFS is computed in four steps: K-weighting → mean square → time-window average → log. The integrated measure adds a gating stage that ignores silence.',
      rows: [
        { label: 'K-weighting pre-filter (head diffraction)', formula: 'H₁(s): high shelf, fc = 1681.8 Hz, gain ≈ +4 dB' },
        { label: 'K-weighting high-pass (sub-bass cut)', formula: 'H₂(s): 2nd-order Butterworth HPF, fc = 38.1 Hz' },
        { label: 'Mean square (per channel)', formula: 'z_i = (1/T) · ∫ |K(x_i(t))|² dt   over window T' },
        { label: 'Loudness (stereo, L+R)', formula: 'L = −0.691 + 10 · log₁₀( z_L + z_R )   [LUFS]' },
        { label: 'Momentary (M)', formula: 'T = 400 ms, rectangular sliding window, hop = 100 ms' },
        { label: 'Short-Term (S)', formula: 'T = 3000 ms, rectangular sliding window, hop = 100 ms' },
        { label: 'Integrated (I)', formula: 'T = ∞ (gated: ignore blocks where L < -70 LUFS, then < Γ − 10 LU)' },
        { label: 'True Peak (dBTP)', formula: 'Upsample ×4, find max |x|, convert to dB — catches inter-sample overs' },
      ],
    },
    diagrams: ['lufs-diagram'],
    usage: [
      { p: 'Watch Short-Term while mixing; deliver to an Integrated LUFS target for your platform.' },
      { bullets: [
        { kw: 'Mixing', text: 'Watch Short-Term LUFS — keep it near your target to avoid large loudness normalisation shifts later.' },
        { kw: 'Mastering', text: 'Hit the Integrated target: −14 LUFS for Spotify/Apple; −16 LUFS for YouTube; −23 LUFS for EBU broadcast.' },
        { kw: 'Momentary', text: 'Use it to catch loud transient spikes — keep below −9 to −6 LUFS for a balanced master.' },
        { kw: 'Loudness war', text: 'Do NOT chase 0 dBFS peaks — streaming platforms turn you down to −14 LUFS anyway. Dynamics are your friend.' },
        { kw: 'True Peak', text: 'Set the limiter ceiling to −1 dBTP or lower for streaming so inter-sample peaks do not clip after encoding.' },
      ]},
    ],
  },

  stereoimager: {
    title: 'Stereo Imager / Direction Mixer',
    diagrams: ['stereoimager-ms'],
    flashCard: true,
    history: [
      { p: 'Stereo imaging is the art of controlling where sound sits between the left and right speakers — its width, its centre, and its place in the soundstage.' },
      { p: 'It grew out of the Mid/Side (M/S) microphone technique invented by EMI engineer Alan Blumlein in the 1930s: a cardioid Mid mic captures L+R, a figure-8 Side mic captures L−R, and the two are matrixed back to stereo. That same matrix is the engine of every modern imager.' },
      { bullets: [
        { kw: '1930s', text: 'Blumlein invents the M/S microphone technique — the matrix behind all imagers.' },
        { kw: '1960s–70s', text: 'Console width controls and the Orban/Eventide boxes let engineers widen or narrow a mix.' },
        { kw: 'Logic', text: 'The Direction Mixer adds Direction rotation and a frequency Split for the low end.' },
        { kw: 'Mastering', text: 'Imaging is now a dedicated mastering stage — width, M/S EQ, goniometer and correlation meter in one.' },
      ]},
    ],
    purpose: [
      { p: 'An imager reshapes the stereo field — making a mix wider or narrower, collapsing the bass to the centre, rebalancing a lopsided image, or gently rotating the stereo perspective.' },
      { bullets: [
        { kw: 'Width', text: 'Widen a narrow mix or narrow an over-wide one without touching tonal balance.' },
        { kw: 'Bass centre', text: 'Collapse the low end to mono so it punches and translates on any speaker.' },
        { kw: 'Direction', text: 'Rotate the stereo image to re-centre a lopsided recording.' },
        { kw: 'M/S EQ', text: 'EQ the Mid and Side separately — brighten the sides, tighten the centre.' },
        { kw: 'Safety', text: 'A correlation meter warns when the image is out-of-phase and will disappear in mono.' },
      ]},
    ],
    params: [
      { name: 'Input (LR / MS)', desc: 'Tells the imager what it is receiving. LR = a normal stereo signal. MS = an encoded Mid/Side signal (L is the Mid, R is the Side), which is decoded to L/R before processing. Use MS when you are working with an M/S recording or an M/S-encoded bus.' },
      { name: 'Split', desc: 'Turns on a frequency split so the low and high bands can have different widths. With Split on, frequencies below the Crossover use the Spread low handle and frequencies above use the Spread high handle (the Width dial). With Split off the whole spectrum shares one width. Split on + low width 0 = mono bass.' },
      { name: 'Crossover', desc: 'The frequency that divides the two Spread bands. A typical value is 80–250 Hz: everything below is the bass band you keep narrow or mono, everything above keeps its width. Only active when Split is on.' },
      { name: 'Direction', desc: 'Rotates the stereo image by an angle θ in degrees. 0° is centred. Positive/negative rotates the image around the listener — useful to re-centre a recording that leans to one side. At ±90° the channels are fully rotated; small angles are corrective.' },
      { name: 'Spread (double-range)', desc: 'A two-handle width control. The low handle sets the width of the band below the Crossover; the high handle sets the width above it (and is linked to the Width dial). The green bar shows the selected range. When Split is off both handles lock to Width. 0 = mono for that band, 1 = original, >1 = wider.' },
      { name: 'Width', desc: 'The overall / high-band width factor (0 = mono, 1 = original, >1 = wider). It scales only the Side (difference) channel, so it changes width without changing level or tone. Linked to the Spread high handle so the dial and slider always agree.' },
    ],
    equation: {
      intro: 'The imager works in the Mid/Side domain. The stereo signal is encoded to Mid (the centre) and Side (the width), the Side is scaled by the width factor(s), then everything is decoded back to L/R. Direction applies a rotation matrix on the final L/R.',
      rows: [
        { label: 'Encode L/R → M/S', formula: 'M = (L + R) / 2,   S = (L − R) / 2' },
        { label: 'Width (single band)', formula: 'L = M + w·S,   R = M − w·S' },
        { label: 'Spread (two bands, Split on)', formula: 'S_out = wLo · LP(S, fc) + wHi · HP(S, fc)' },
        { label: 'Direction rotation', formula: "L' = cosθ·L − sinθ·R,   R' = sinθ·L + cosθ·R" },
        { label: 'Identity (defaults)', formula: 'w = 1, θ = 0  →  L = M + S = L,  R = M − S = R', note: 'passthrough' },
        { label: 'Mono (w = 0)', formula: 'L = R = M  →  fully mono' },
      ],
    },
    usage: [
      { p: 'Put the imager late in the mastering chain — after EQ and dynamics, before or just before the limiter — so it shapes the finished sound.' },
      { bullets: [
        { kw: 'Master', text: 'Last tonal/dynamics stage — widen the sides, mono the bass, check the goniometer.' },
        { kw: 'Bass', text: 'Split on, Crossover ~200 Hz, low width 0 → tight, mono-compatible low end.' },
        { kw: 'Widen', text: 'Width 1.2–1.5 for air; never push so far the correlation meter swings past 0.' },
        { kw: 'Re-centre', text: 'Small Direction angles to fix a lopsided image; re-check in mono.' },
        { kw: 'Mono check', text: 'Always audition in mono — if it thins out, the sides are out of phase; pull width back.' },
      ]},
    ],
  },

  visualidentity: {
    title: 'Visual Identity & Layout',
    history: [
      { p: 'A studio\'s look is part of its identity — the teal of a Neve console, the amber LEDs of a tape machine, the green faceplate of a Brüel & Kjær analyser. Plugin designers have long offered skins so the same DSP can wear several studio personalities.' },
      { p: 'Sound Chain Master ships six full visual identities, each a complete token set — page background, ambient glow, logo and title gradients, accent colour and a signature overlay (frosted glass caustic, brushed-metal grain, CRT scanlines, a HUD grid) — so the panels read as materially different instruments, not just recoloured chrome.' },
      { bullets: [
        { kw: 'Skins', text: 'Plugin skins let one DSP wear several studio personalities.' },
        { kw: 'Tokens', text: 'Each identity is a token set — bg, glow, logo, title, accent + an fx overlay.' },
        { kw: 'Always legible', text: 'Themes stay dark-leaning so white-on-dark panel text reads in every identity; B&K Lab is the light exception, with its own faceplate text rules.' },
      ]},
    ],
    purpose: [
      { p: 'The identity selector re-skins the whole studio in one click; the panel-layout selector controls how many panels sit side-by-side; and the display mode switches the viewing chrome.' },
      { bullets: [
        { kw: 'Identity', text: 'Re-skin every panel — chrome, glow, accent and signature overlay — in one click.' },
        { kw: 'Layout', text: 'Choose how dense the panel grid is (wide / medium / narrow).' },
        { kw: 'Display mode', text: 'Switch the viewing chrome for the studio.' },
        { kw: 'Persistent', text: 'The chosen theme is remembered across sessions.' },
      ]},
    ],
    params: [
      { name: 'Precision Studio', desc: 'Clean pro-audio dark — crisp panels lit with a cool cyan accent and a subtle dot-grid overlay. The default identity.' },
      { name: 'Ethereal Glass', desc: 'Frosted liquid glass — luminous jewel-bright panels with heavy backdrop blur, saturated radial glows and a multi-hue gradient title.' },
      { name: 'Forge Titanium', desc: 'Brushed industrial metal — gunmetal panels with amber accents, riveted corner bevels and a real brushed-metal plate texture (three plates cycle across panels).' },
      { name: 'Analog Rack', desc: 'Warm 80s studio rack — walnut panels, amber LED headings and a CRT scanline + vignette overlay for a vintage console feel.' },
      { name: 'Neural Lab', desc: 'Cyberpunk command centre — near-black with a bright neon-cyan grid, angular corner brackets and glowing edge outlines on every control.' },
      { name: 'B&K Lab', desc: 'Brüel & Kjær measurement instrument — light mint faceplates with black labels, four corner mounting screws and a graphite-green console; the one light identity, with dedicated rules so charts and meters stay readable on the light surface.' },
      { name: 'Panel Layout (Wide / Medium / Narrow)', desc: 'Sets the column density of the desktop grid and the container width, not the panel aspect ratio. Wide = up to 4 columns (max-w-6xl); Medium = up to 2 columns (max-w-4xl); Narrow = a single column (max-w-3xl). Panels keep their fixed professional heights and reflow internally — they are not scaled or re-proportioned to the 5:8 / 3:4 / 1:1 hints.' },
      { name: 'Display Mode', desc: 'Switches the viewing chrome of the studio (the surrounding frame and presentation) independently of the visual identity.' },
    ],
    usage: [
      { p: 'Pick an identity to match the session\'s mood or the material, then choose a panel layout for the screen width.' },
      { bullets: [
        { kw: 'Default', text: 'Precision Studio for a clean, neutral working view.' },
        { kw: 'Character', text: 'Analog Rack or Forge Titanium for a tactile, hardware feel.' },
        { kw: 'Focus', text: 'Narrow layout for a single-panel focus on a laptop; Wide for a multi-panel desktop.' },
        { kw: 'Measurement', text: 'B&K Lab to read the meters and graphs like a lab instrument.' },
      ]},
    ],
  },

  mon8: {
    title: 'Mon8 — Bass Mono',
    history: [
      { p: 'Low frequencies carry almost no directional cue — the human ear localises bass poorly, and stereo bass is summed to mono on nearly every playback system (phones, Bluetooth, club PAs, radio).' },
      { p: 'Bass-mono processors — Tone Projects Basslane (2008), bx_shredspread and Ableton\'s Bass Mono — were built to collapse the low end to the centre before that summing happens, so the bass stays full and phase-coherent everywhere instead of thinning or cancelling in mono.' },
      { bullets: [
        { kw: '1930s', text: 'Blumlein\'s M/S matrix — the same encode/decode used to isolate the Side channel.' },
        { kw: '2008', text: 'Tone Projects Basslane popularises the dedicated bass-mono plugin.' },
        { kw: 'Mastering', text: 'Now a standard mastering step for translation and mono-compatibility.' },
      ]},
    ],
    purpose: [
      { p: 'Mon8 mono-izes (or partially narrows) only the low-frequency content below a chosen cutoff, leaving the mid and high frequencies in their original stereo field.' },
      { bullets: [
        { kw: 'Mono-compat', text: 'Stops low-end phase cancellation when the master is summed to mono.' },
        { kw: 'Focus', text: 'Punches the bass and kick to the centre for a tighter, louder low end.' },
        { kw: 'Translation', text: 'Keeps the low end consistent across phones, Bluetooth, club and radio.' },
        { kw: 'Surgical', text: 'Only the Side signal is filtered — the Mid sum is never touched.' },
      ]},
    ],
    params: [
      { name: 'Frequency (cutoff)', desc: 'The frequency below which the low end is collapsed toward mono. Typical 80–200 Hz; up to 500 Hz for aggressive narrowing. Everything above this keeps its original stereo width.' },
      { name: 'Image Narrowing (Width)', desc: 'How much the low-end Side is attenuated. 0% = no change (full stereo). 100% = fully mono below the cutoff. Intermediate values apply proportional side attenuation only in the low band.' },
      { name: 'Slope (12 / 24 dB/oct)', desc: 'The steepness of the Side high-pass. 24 dB/oct (Linkwitz-Riley) is the default — a sharp, surgical split. 12 dB/oct is gentler, with a wider transition band.' },
    ],
    equation: {
      intro: 'Processing is done in the Mid/Side domain. The Side (difference) signal is high-passed at the cutoff; the Mid (sum) is untouched. The Width dial blends the full-band Side with the high-passed Side.',
      rows: [
        { label: 'Encode L/R → M/S', formula: 'M = (L + R)/2,   S = (L − R)/2' },
        { label: 'High-pass the Side at fc', formula: 'S_HP = HPF(S, fc)' },
        { label: 'Narrowing blend (w = width)', formula: "S' = w·S_HP + (1 − w)·S   (w = 1 → mono below fc)" },
        { label: 'Decode M/S → L/R', formula: "L' = M + S',   R' = M − S'" },
      ],
    },
    usage: [
      { p: 'Place Mon8 early in the chain — before stereo widening and the limiter — so the bass is centred before it is widened or limited.' },
      { bullets: [
        { kw: 'Master bus', text: 'On the master, set 80–150 Hz cutoff, 100% narrowing for a focused, mono-compatible low end.' },
        { kw: 'Sub-bass', text: 'For sub-heavy electronic, narrow everything below ~120 Hz to keep the sub centred.' },
        { kw: 'Group bus', text: 'On a drum or bass group, narrow the lows before they hit a stereo imager.' },
        { kw: 'Listen', text: 'Check in mono after narrowing — the low end should stay full, not thinner.' },
      ]},
    ],
  },
  analogueDensity: {
    title: 'Analogue Density',
    history: [
      { p: 'The Black Box Analog Design HG-2 is a hardware tube density processor built around custom input/output transformers and a 6U8A valve run in both pentode and triode configurations, with a parallel 12AX7 saturation path.' },
      { p: 'Brainworx modelled the unit in software, adding digital-only controls (Density, Input Gain, Calibration, Air Amount, Mix) that make the hardware’s “make it louder without raising peaks” trick precise and repeatable.' },
    ],
    purpose: [
      { p: 'Analogue Density adds rich, musical harmonics, natural soft-knee compression and transformer warmth while staying transparent at low drive — it makes material sound denser, fuller and more “expensive” at the same peak level.' },
      { bullets: [
        { kw: 'RMS / loudness', text: 'Raises perceived loudness and RMS without lifting the peak ceiling — the mastering “nicerizer”.' },
        { kw: 'Even vs odd', text: 'Pentode adds even-order warmth; Triode adds odd-order grit and glue — blend them independently.' },
        { kw: 'Air', text: 'A silvery high-frequency lift above 10 kHz that reads as expensive top-end, never harsh.' },
        { kw: 'Density', text: 'Simultaneously drives both tubes and compensates output so the sound gets heavier at constant loudness.' },
      ]},
    ],
    params: [
      { name: 'Pentode', desc: 'Even-order harmonic drive (2nd, 4th) — the warm, guitar-amp “glow”. Push harder for more weight and compression.' },
      { name: 'Triode', desc: 'Odd-order harmonic drive (3rd, 5th) — tape-like grit and density. Stacks after the pentode, so driving the pentode also pushes the triode.' },
      { name: 'Saturation (parallel)', desc: 'A parallel 12AX7 path blended back before the pentode. Use Sat. Freq to focus it on lows (weight), highs (sparkle) or full-band, and Alt Tube for a more aggressive voicing.' },
      { name: 'Air / Air Amount', desc: 'Gentle high-shelf lift from ~10 kHz. Adds silvery, open top-end without harshness.' },
      { name: 'Density', desc: 'Bipolar −100 % to +100 %. Positive ("push") adds drive to both tubes AND attenuates output to compensate — denser, heavier sound at the same loudness. Negative ("pull") does the opposite: it backs the tubes off, subtracting drive from whatever the Pentode/Triode knobs set, softening and cleaning the saturation (clamped at zero, so it only does something when those knobs are above zero). At 0 it is a no-op.' },
      { name: 'Mode (Stereo / Mid-Side)', desc: 'In Stereo the tubes process L/R. In M/S the signal is encoded to Mid (L+R) and Side (L−R), the tubes run on each component, then it is decoded back to L/R — so saturation lands on the centre vs the width rather than on left vs right. In M/S mode the single Density dial splits into Mid Density and Side Density, each running the full bipolar push/pull mapping independently, so you can drive the Mid hard (forward, thick centre) while pulling the Side back (clean, wide sides). The shaper curve follows the harder-driven channel; the softer channel gets a proportionally lower pre-gain so it saturates less. Unity at default.' },
      { name: 'Output', desc: 'Final attenuation / make-up. Unity at 5; lower to trim the extra level the tubes add.' },
      { name: 'Input Gain / Calibration', desc: 'Input Gain drives the transformers harder; Calibration (Dark / Normal / Bright) is a global high-frequency trim matching the hardware’s internal calibration.' },
      { name: 'Mix', desc: 'Wet/dry blend of the full tube chain against the clean input. 100 % is fully processed (hardware default).' },
    ],
    equation: {
      intro: 'Density is bipolar: d ∈ [−1, +1] (dial %÷100). Positive d pushes drive into both tubes and attenuates the output to hold loudness; negative d subtracts drive (relaxes the tubes). The Pentode and Triode knobs add base drive that Density then pushes or pulls relative to.',
      rows: [
        { label: 'Push / pull', formula: 'push = max(0, d)·0.55,   pull = max(0, −d)·0.25' },
        { label: 'Per-tube drive', formula: 'drive = max(0, (pentode + push − pull)·0.6)' },
        { label: 'Output comp (loudness hold)', formula: 'out = 1 / (1 + max(0, d)·0.85·0.6)   (positive d only)' },
        { label: 'Negative d', formula: 'no push, no comp — only subtracts drive → cleans/softens' },
        { label: 'M/S encode', formula: 'M = (L + R)/2,   S = (L − R)/2' },
        { label: 'M/S per-channel density', formula: 'drive_M = mapping(midDensity),   drive_S = mapping(sideDensity)' },
        { label: 'Curve / pre-gain', formula: 'curve set for max(drive_M, drive_S); softer channel scaled by its ratio' },
        { label: 'M/S decode', formula: "L' = M + S,   R' = M − S" },
      ],
    },
    usage: [
      { p: 'Place Analogue Density in the pre-master, after corrective EQ and before the limiter — it is a colour / density stage, not a level stage.' },
      { bullets: [
        { kw: 'Mix bus', text: 'Subtle Pentode + low Saturation for glue and weight; Density +20 % for a heavier, “finished” feel.' },
        { kw: 'Master', text: 'Small Pentode/Triode + Air for expensive top-end; keep Density modest so it stays transparent.' },
        { kw: 'Drum bus', text: 'Higher Triode + Alt Tube parallel for crunch and punch without losing transients.' },
        { kw: 'Vocals', text: 'Light Pentode + Air for presence and sheen; use Mix to parallel-blend.' },
      ]},
    ],
  },
};

export const INFO_KEYS = Object.keys(PANEL_INFO);