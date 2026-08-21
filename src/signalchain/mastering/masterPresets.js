/**
 * Mastering presets — target mediums, musical styles, and streaming-loudness
 * targets, anchored to Bob Katz's K-System and the "pink noise reference".
 *
 * Pink-noise reference (Katz): a balanced mix roughly follows a -3 dB/octave
 * pink-noise slope when measured in third-octave bands; mastering tilts the
 * spectrum back toward that reference so no octave jumps out. The K-System
 * (K-20 / K-14 / K-12) ties 0 dB on the meter to a known SPL and reserves
 * headroom for musical dynamics instead of chasing peak.
 */
export const MEDIUMS = {
  cinematic: { label: 'Cinematic', lufs: -23, ceiling: -2, note: 'Wide dynamic range, dialogue-level loudness, gentle limiting, true peak ≤ -2 dBFS.' },
  podcast:   { label: 'Podcast',   lufs: -16, ceiling: -1, note: 'Speech-optimized, consistent level, present midrange, true peak ≤ -1 dBFS.' },
  radio:     { label: 'Radio',      lufs: -9,  ceiling: -0.5, note: 'Loud & competitive, dense, bright, tight low end.' },
  album:     { label: 'Album',      lufs: -14, ceiling: -1, note: 'Balanced streaming-ready master, musical dynamics preserved.' },
  ep:        { label: 'EP',         lufs: -11, ceiling: -1, note: 'Punchy, modern streaming-loud single.' },
  video:     { label: 'Video',      lufs: -18, ceiling: -1, note: 'YouTube/broadcast-safe, consistent level, true peak ≤ -1 dBFS.' },
  streaming: { label: 'Streaming',  lufs: -14, ceiling: -1, note: 'Spotify/Apple Music normalization target, balanced and clean.' },
  club:       { label: 'Club',       lufs: -8,  ceiling: -0.5, note: 'Loud, weighty low end, maximum impact for sound systems.' },
};

export const STYLES = {
  edm:         { label: 'EDM' },
  jazz:        { label: 'Jazz' },
  classical:   { label: 'Classical' },
  independent: { label: 'Independent' },
  loud:        { label: 'Loud' },
  medium:      { label: 'Medium' },
  soft:        { label: 'Soft' },
};

export const LUFS_OPTIONS = [-23, -16, -14, -11, -9];

export const KATZ_NOTE =
  'Recipes use Bob Katz\'s K-System headroom philosophy and a third-octave ' +
  'pink-noise spectral reference (-3 dB/oct) so the master stays balanced ' +
  'and dynamic instead of peak-chased. LUFS is measured K-weighted (ITU-R BS.1770).';