/**
 * FACTORY_PRESETS — an AI-authored "lane" of mastering presets, stored as a
 * plain JSON-style array. Each entry carries:
 *
 *   name        : display name (shown in the pill nav bar)
 *   medium      : key into MEDIUMS (cinematic / podcast / radio / album / …)
 *   style       : key into STYLES (edm / jazz / classical / loud / medium / …)
 *   targetLufs  : integrated loudness target (LUFS, K-weighted)
 *   author      : preset author / signature
 *   info        : short description of the sonic goal
 *   recipe      : partial mastering recipe consumed by applyRecipe()
 *                 (each module is merged onto its defaults, so only the
 *                 fields that matter for this preset need to be specified)
 *
 * Index 0 is always "Init Preset" — the neutral default (no recipe), which
 * the nav bar applies as a full reset.
 */
export const FACTORY_PRESETS = [
  {
    name: 'Init Preset',
    medium: 'album',
    style: 'medium',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Neutral default — all modules at unity, nothing engaged. The starting point.',
    recipe: null,
  },
  {
    name: 'Streaming Pop',
    medium: 'streaming',
    style: 'medium',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Balanced, streaming-ready pop master. Gentle glue, airy top, dynamic de-ess + low-mid control, slight 3-band glue, true-peak ceiling at -1 dBFS.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 55, gain: 1.2 }, mids: [{ freq: 3000, gain: -1.2, q: 1.1 }, { freq: 9000, gain: 1.8, q: 0.9 }], high: { freq: 12000, gain: 1.5 } },
      compressor: { threshold: -18, ratio: 2.5, attack: 0.008, release: 0.18, knee: 24, makeupGain: 1.5 },
      // Slight multi-band glue — low ratios, gentle thresholds so it only rides
      // the loudest peaks per band without pumping or flattening dynamics.
      mbc: {
        enabled: true, bandCount: 3, crossovers: [150, 2500], globalMakeup: 1, bands: [
          { threshold: -18, ratio: 1.8, attack: 0.012, release: 0.22, makeupGain: 1 },
          { threshold: -16, ratio: 1.6, attack: 0.010, release: 0.20, makeupGain: 1 },
          { threshold: -18, ratio: 1.6, attack: 0.005, release: 0.14, makeupGain: 1 },
        ],
      },
      // Dynamic EQ — only ducks problem zones when they get loud, otherwise transparent.
      // Sub control (tames boomy bass builds), low-mid clean-up, and a de-esser for harsh 4–5 kHz sibilance.
      dynamicEq: {
        enabled: true, bandCount: 4, mix: 100,
        low: { freq: 90, threshold: -18, ratio: 1.6, attack: 0.020, release: 0.30 },
        mids: [
          { freq: 280, q: 1.2, threshold: -22, ratio: 1.5, attack: 0.020, release: 0.30 },
          { freq: 4800, q: 1.6, threshold: -20, ratio: 2.0, attack: 0.003, release: 0.10 },
        ],
        high: { freq: 9000, threshold: -16, ratio: 1.5, attack: 0.003, release: 0.12 },
      },
      limiter: { ceiling: -1, release: 0.05, style: 'transparent', oversampling: 2, stereoLink: 100, truePeak: true },
      tape: { enabled: true, drive: 0.25, bias: 0.5, saturation: 0.35, mix: 0.35, headBump: 0.25, hfLoss: 0.15 },
      notes: 'Streaming Pop: light 2.5:1 glue, airy HF, slight 3-band MBC (1.6–1.8:1), dynamic de-ess at 4.8 kHz + sub/low-mid control, transparent true-peak limit at -1 dBFS.',
    },
  },
  {
    name: 'Club Banger',
    medium: 'club',
    style: 'edm',
    targetLufs: -8,
    author: 'SignalChain',
    info: 'Loud, weighty low end and maximum impact for sound systems. Multi-band glue + hard ceiling.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 45, gain: 2.5 }, mids: [{ freq: 2500, gain: -1.5, q: 1.2 }, { freq: 8000, gain: 2.5, q: 0.8 }], high: { freq: 11000, gain: 2 } },
      compressor: { threshold: -14, ratio: 4, attack: 0.004, release: 0.12, knee: 12, makeupGain: 3 },
      mbc: { enabled: true, bandCount: 4, crossovers: [120, 800, 5000], bands: [
        { threshold: -18, ratio: 3, attack: 0.006, release: 0.18, makeupGain: 1.5 },
        { threshold: -16, ratio: 2.5, attack: 0.008, release: 0.2, makeupGain: 1 },
        { threshold: -14, ratio: 3, attack: 0.004, release: 0.12, makeupGain: 1.5 },
        { threshold: -12, ratio: 3.5, attack: 0.003, release: 0.1, makeupGain: 2 },
      ], globalMakeup: 1.5 },
      limiter: { ceiling: -0.5, release: 0.04, style: 'punchy', oversampling: 4, stereoLink: 100, truePeak: true },
      saturation: { enabled: true, mode: 'tube', drive: 0.35, mix: 0.25, tone: 9000 },
      notes: 'Club Banger: 4-band glue, sub-lift at 45 Hz, punchy limit at -0.5 dBFS, ~-8 LUFS.',
    },
  },
  {
    name: 'Cinematic Score',
    medium: 'cinematic',
    style: 'classical',
    targetLufs: -23,
    author: 'SignalChain',
    info: 'Wide dynamic range, dialogue-level loudness, gentle limiting. True peak ≤ -2 dBFS.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 30, gain: 0.8 }, mids: [{ freq: 1200, gain: -0.8, q: 0.7 }, { freq: 6000, gain: 1.2, q: 0.7 }], high: { freq: 14000, gain: 1 } },
      compressor: { threshold: -24, ratio: 1.8, attack: 0.012, release: 0.3, knee: 30, makeupGain: 1 },
      limiter: { ceiling: -2, release: 0.12, style: 'transparent', oversampling: 2, stereoLink: 100, truePeak: true, attack: 0.002 },
      notes: 'Cinematic Score: minimal glue 1.8:1, wide knee, true-peak ceiling at -2 dBFS, -23 LUFS.',
    },
  },
  {
    name: 'Podcast Voice',
    medium: 'podcast',
    style: 'soft',
    targetLufs: -16,
    author: 'SignalChain',
    info: 'Speech-optimized. Present midrange, consistent level, de-essed highs. True peak ≤ -1 dBFS.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 80, gain: -2, cut: false }, mids: [{ freq: 250, gain: -2, q: 1 }, { freq: 5000, gain: 2.5, q: 1.2 }], high: { freq: 10000, gain: 1.5 } },
      compressor: { threshold: -20, ratio: 4, attack: 0.003, release: 0.2, knee: 18, makeupGain: 4 },
      limiter: { ceiling: -1, release: 0.06, style: 'transparent', oversampling: 2, stereoLink: 100, truePeak: true },
      notes: 'Podcast Voice: HPF rumble cut, presence boost at 5 kHz, 4:1 leveling, -16 LUFS.',
    },
  },
  {
    name: 'Radio Single',
    medium: 'radio',
    style: 'loud',
    targetLufs: -9,
    author: 'SignalChain',
    info: 'Loud and competitive. Dense, bright, tight low end for FM broadcast.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 50, gain: 1 }, mids: [{ freq: 3000, gain: 2, q: 1 }, { freq: 10000, gain: 3, q: 0.7 }], high: { freq: 14000, gain: 2.5 } },
      compressor: { threshold: -16, ratio: 4, attack: 0.003, release: 0.1, knee: 10, makeupGain: 3 },
      mbc: { enabled: true, bandCount: 3, crossovers: [200, 3000], bands: [
        { threshold: -14, ratio: 3, attack: 0.006, release: 0.14, makeupGain: 1.5 },
        { threshold: -12, ratio: 3, attack: 0.004, release: 0.1, makeupGain: 1.5 },
        { threshold: -10, ratio: 3.5, attack: 0.003, release: 0.08, makeupGain: 2 },
      ], globalMakeup: 1 },
      limiter: { ceiling: -0.5, release: 0.03, style: 'modern', oversampling: 4, stereoLink: 100, truePeak: false },
      notes: 'Radio Single: bright sheen, 3-band density, modern fast limit, ~-9 LUFS.',
    },
  },
  {
    name: 'Vinyl Warm',
    medium: 'album',
    style: 'jazz',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Tape warmth, rolled extremes, analog character. Musical and forgiving.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 40, gain: -1 }, mids: [{ freq: 2000, gain: 0.8, q: 0.8 }, { freq: 7000, gain: 1.2, q: 0.7 }], high: { freq: 16000, gain: -1.5 } },
      compressor: { threshold: -20, ratio: 2, attack: 0.01, release: 0.25, knee: 28, makeupGain: 1.5 },
      tape: { enabled: true, drive: 0.45, bias: 0.6, saturation: 0.5, mix: 0.55, headBump: 0.4, hfLoss: 0.35, wow: 0.2, flutter: 0.1, noise: 0.05, speed: 15 },
      saturation: { enabled: true, mode: 'tape', drive: 0.3, mix: 0.3, tone: 10000 },
      analogueDensity: { enabled: true, density: 25, saturation: 2, satFreq: 'flat', pentode: 1.5, triode: 2, air: true, airAmount: 1.5, output: 5, calibration: 'normal', mix: 60 },
      limiter: { ceiling: -1, release: 0.08, style: 'warm', oversampling: 2, stereoLink: 100, truePeak: true, knee: 5 },
      notes: 'Vinyl Warm: tape drive 0.45, rolled HF at 16 kHz, tube density glue, warm knee limiter, -14 LUFS.',
    },
  },
  {
    name: 'Lo-Fi Chill',
    medium: 'streaming',
    style: 'soft',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Soft, tape-saturated, slightly reduced bandwidth. Bedtime-room vibe.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 60, gain: 1 }, mids: [{ freq: 1000, gain: -1, q: 0.7 }, { freq: 5000, gain: 0.8, q: 0.8 }], high: { freq: 12000, gain: -2 } },
      compressor: { threshold: -22, ratio: 2.2, attack: 0.01, release: 0.22, knee: 26, makeupGain: 1.5 },
      tape: { enabled: true, drive: 0.4, bias: 0.65, saturation: 0.55, mix: 0.6, headBump: 0.35, hfLoss: 0.45, wow: 0.25, flutter: 0.12, noise: 0.08, speed: 7.5 },
      limiter: { ceiling: -1, release: 0.07, style: 'warm', oversampling: 2, stereoLink: 100, truePeak: true },
      notes: 'Lo-Fi Chill: heavy tape at 7.5 ips, narrowed bandwidth, soft glue, -14 LUFS.',
    },
  },
  {
    name: 'Rock Wall',
    medium: 'ep',
    style: 'loud',
    targetLufs: -11,
    author: 'SignalChain',
    info: 'Dense, punchy rock. Mid-forward, tight bass, aggressive but controlled.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 70, gain: 1.5 }, mids: [{ freq: 1500, gain: 1.5, q: 1 }, { freq: 6000, gain: 2, q: 0.9 }], high: { freq: 12000, gain: 1.5 } },
      compressor: { threshold: -16, ratio: 4, attack: 0.004, release: 0.14, knee: 14, makeupGain: 2.5 },
      mbc: { enabled: true, bandCount: 3, crossovers: [150, 2500], bands: [
        { threshold: -14, ratio: 3.5, attack: 0.006, release: 0.16, makeupGain: 1.5 },
        { threshold: -14, ratio: 3, attack: 0.005, release: 0.12, makeupGain: 1.2 },
        { threshold: -12, ratio: 3, attack: 0.004, release: 0.1, makeupGain: 1.8 },
      ], globalMakeup: 1.5 },
      saturation: { enabled: true, mode: 'tube', drive: 0.4, mix: 0.2, tone: 8000 },
      analogueDensity: { enabled: true, density: 40, saturation: 3, altTube: true, pentode: 3, triode: 2, air: false, output: 5, calibration: 'bright', mix: 50 },
      limiter: { ceiling: -1, release: 0.04, style: 'punchy', oversampling: 4, stereoLink: 100, truePeak: true },
      notes: 'Rock Wall: punchy 3-band glue, aggressive tube density, punchy limit, -11 LUFS.',
    },
  },
  {
    name: 'Classical Dynamic',
    medium: 'cinematic',
    style: 'classical',
    targetLufs: -23,
    author: 'SignalChain',
    info: 'Preserves full dynamics. Minimal intervention, only safety limiting.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 30, gain: 0.5 }, mids: [{ freq: 2000, gain: 0.5, q: 0.6 }, { freq: 8000, gain: 0.8, q: 0.6 }], high: { freq: 16000, gain: 0.5 } },
      limiter: { ceiling: -2, release: 0.15, style: 'classical', oversampling: 2, stereoLink: 100, truePeak: true, attack: 0.003 },
      notes: 'Classical Dynamic: near-flat EQ, safety-only true-peak limit at -2 dBFS, -23 LUFS.',
    },
  },
  {
    name: 'EDM Festival',
    medium: 'club',
    style: 'edm',
    targetLufs: -8,
    author: 'SignalChain',
    info: 'Hypersaturated drops, piercing highs, sub authority. Built for big rigs.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 40, gain: 3 }, mids: [{ freq: 2200, gain: -2, q: 1.2 }, { freq: 9000, gain: 3, q: 0.7 }], high: { freq: 13000, gain: 2.5 } },
      mbc: { enabled: true, bandCount: 4, crossovers: [100, 900, 6000], bands: [
        { threshold: -16, ratio: 4, attack: 0.005, release: 0.16, makeupGain: 2 },
        { threshold: -14, ratio: 3, attack: 0.006, release: 0.2, makeupGain: 1.5 },
        { threshold: -12, ratio: 3.5, attack: 0.003, release: 0.1, makeupGain: 2 },
        { threshold: -10, ratio: 4, attack: 0.002, release: 0.08, makeupGain: 2.5 },
      ], globalMakeup: 2 },
      saturation: { enabled: true, mode: 'transistor', drive: 0.45, mix: 0.3, tone: 9500 },
      limiter: { ceiling: -0.5, release: 0.035, style: 'punchy', oversampling: 4, stereoLink: 100, truePeak: true },
      notes: 'EDM Festival: 4-band crunch, transistor grit, hard punchy limit, -8 LUFS.',
    },
  },
  {
    name: 'Hip-Hop Modern',
    medium: 'streaming',
    style: 'loud',
    targetLufs: -9,
    author: 'SignalChain',
    info: 'Punchy 808s, vocal presence, wide stereo image. Modern streaming loud.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 50, gain: 2 }, mids: [{ freq: 3000, gain: 1.5, q: 1 }, { freq: 10000, gain: 2.5, q: 0.8 }], high: { freq: 13000, gain: 2 } },
      compressor: { threshold: -18, ratio: 3.5, attack: 0.005, release: 0.12, knee: 16, makeupGain: 2 },
      mbc: { enabled: true, bandCount: 3, crossovers: [120, 2500], bands: [
        { threshold: -14, ratio: 4, attack: 0.005, release: 0.16, makeupGain: 1.8 },
        { threshold: -14, ratio: 2.5, attack: 0.006, release: 0.14, makeupGain: 1 },
        { threshold: -12, ratio: 3, attack: 0.004, release: 0.1, makeupGain: 1.5 },
      ], globalMakeup: 1.5 },
      limiter: { ceiling: -1, release: 0.04, style: 'modern', oversampling: 4, stereoLink: 100, truePeak: true },
      notes: 'Hip-Hop Modern: 808 lift, 3-band glue, modern fast limit, -9 LUFS.',
    },
  },
  {
    name: 'Acoustic Shine',
    medium: 'album',
    style: 'medium',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Natural, open, detailed. Light glue and air for acoustic instruments.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 45, gain: 0.8 }, mids: [{ freq: 2500, gain: -0.8, q: 0.9 }, { freq: 10000, gain: 1.5, q: 0.7 }], high: { freq: 14000, gain: 1.2 } },
      compressor: { threshold: -22, ratio: 2, attack: 0.01, release: 0.22, knee: 28, makeupGain: 1 },
      limiter: { ceiling: -1, release: 0.07, style: 'transparent', oversampling: 2, stereoLink: 100, truePeak: true },
      tape: { enabled: true, drive: 0.2, bias: 0.55, saturation: 0.3, mix: 0.25, headBump: 0.2, hfLoss: 0.1 },
      notes: 'Acoustic Shine: subtle glue 2:1, airy HF, transparent true-peak limit, -14 LUFS.',
    },
  },
  {
    name: 'Trap Heavy',
    medium: 'club',
    style: 'loud',
    targetLufs: -9,
    author: 'SignalChain',
    info: 'Sub-deep 808s, crisp hats, wide stereo. Heavy but controlled low end.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 38, gain: 3.5 }, mids: [{ freq: 2800, gain: 1, q: 1 }, { freq: 11000, gain: 3, q: 0.7 }], high: { freq: 15000, gain: 2 } },
      mbc: { enabled: true, bandCount: 4, crossovers: [90, 800, 5000], bands: [
        { threshold: -12, ratio: 4.5, attack: 0.006, release: 0.18, makeupGain: 2.5 },
        { threshold: -14, ratio: 2.5, attack: 0.008, release: 0.2, makeupGain: 1 },
        { threshold: -12, ratio: 3, attack: 0.004, release: 0.1, makeupGain: 1.5 },
        { threshold: -10, ratio: 3.5, attack: 0.003, release: 0.08, makeupGain: 2 },
      ], globalMakeup: 2 },
      saturation: { enabled: true, mode: 'tube', drive: 0.3, mix: 0.15, tone: 9000 },
      limiter: { ceiling: -0.5, release: 0.04, style: 'punchy', oversampling: 4, stereoLink: 100, truePeak: true },
      notes: 'Trap Heavy: deep 808 lift, 4-band glue, punchy limit, -9 LUFS.',
    },
  },
  {
    name: 'Jazz Club Live',
    medium: 'album',
    style: 'jazz',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'Warm room, natural dynamics, intimate. Light tape and gentle glue.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 50, gain: 1 }, mids: [{ freq: 1500, gain: 0.5, q: 0.7 }, { freq: 6500, gain: 1, q: 0.7 }], high: { freq: 13000, gain: 0.8 } },
      compressor: { threshold: -24, ratio: 1.8, attack: 0.012, release: 0.28, knee: 30, makeupGain: 1 },
      tape: { enabled: true, drive: 0.3, bias: 0.6, saturation: 0.4, mix: 0.4, headBump: 0.3, hfLoss: 0.25 },
      limiter: { ceiling: -1, release: 0.1, style: 'warm', oversampling: 2, stereoLink: 100, truePeak: true },
      notes: 'Jazz Club Live: gentle 1.8:1 glue, warm tape, soft-knee limit, -14 LUFS.',
    },
  },
  {
    name: 'Broadcast Safe',
    medium: 'video',
    style: 'medium',
    targetLufs: -18,
    author: 'SignalChain',
    info: 'YouTube/broadcast-safe. Consistent level, true peak ≤ -1 dBFS, no surprises.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 60, gain: 0.5 }, mids: [{ freq: 2000, gain: 0.8, q: 0.8 }, { freq: 8000, gain: 1.5, q: 0.8 }], high: { freq: 12000, gain: 1 } },
      compressor: { threshold: -20, ratio: 3, attack: 0.006, release: 0.16, knee: 20, makeupGain: 2 },
      limiter: { ceiling: -1, release: 0.06, style: 'transparent', oversampling: 4, stereoLink: 100, truePeak: true },
      notes: 'Broadcast Safe: 3:1 leveling, airy presence, true-peak limit at -1 dBFS, -18 LUFS.',
    },
  },
  {
    name: 'Tube Density Glue',
    medium: 'album',
    style: 'medium',
    targetLufs: -14,
    author: 'SignalChain',
    info: 'HG-2-style tube density front-end. Pentode + triode harmonic glue with air, gentle bus comp, transparent ceiling.',
    recipe: {
      eq: { enabled: true, bandCount: 3, low: { freq: 50, gain: 0.8 }, mids: [{ freq: 2500, gain: -0.6, q: 0.9 }, { freq: 10000, gain: 1, q: 0.7 }], high: { freq: 14000, gain: 1 } },
      analogueDensity: { enabled: true, inputGain: 1, density: 35, saturation: 2.5, satFreq: 'flat', satIn: true, pentode: 2.5, triode: 2, air: true, airAmount: 2, output: 5, calibration: 'normal', mix: 70 },
      compressor: { threshold: -20, ratio: 2.2, attack: 0.01, release: 0.2, knee: 24, makeupGain: 1.5 },
      limiter: { ceiling: -1, release: 0.06, style: 'transparent', oversampling: 2, stereoLink: 100, truePeak: true },
      notes: 'Tube Density Glue: 6U8A pentode+triode density 35, air shelf at 2, light 2.2:1 bus glue, transparent -1 dBFS ceiling.',
    },
  },
];