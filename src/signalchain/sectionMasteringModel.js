/**
 * Section Mastering model — divides the loaded file into N timed sections
 * (1..5), each assigned a mastering preset "letter" (A..E). Cue points are
 * stored as fractions of the file duration (0..1); glides are 0..1 amounts
 * controlling how far the cross-parameterization zone spreads around each
 * cue (0 = hard switch, 1 = maximum glide).
 */

export const SECTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const SECTION_COLORS = {
  A: '#68b4e1', // blue
  B: '#c4a5f4', // purple
  C: '#7ed9a8', // green
  D: '#f5d377', // amber
  E: '#f4a5a5', // rose
};
export const MAX_SECTIONS = 5;

/** Evenly spaced cue fractions for a given section count (N-1 cues). */
export function defaultCues(count) {
  const out = [];
  for (let i = 1; i < count; i++) out.push(Math.round((i / count) * 1000) / 1000);
  return out;
}

/** Default glide amounts (one per cue). */
export function defaultGlides(count) {
  return new Array(Math.max(0, count - 1)).fill(0.35);
}

/** Default letter assignment — section i → letter i. */
export function defaultAssignment(count) {
  return SECTION_LETTERS.slice(0, count);
}

/** Average two #rrggbb colours → #rrggbb. */
export function mixHex(a, b) {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ar = parseInt(pa.slice(0, 2), 16), ag = parseInt(pa.slice(2, 4), 16), ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16), bg = parseInt(pb.slice(2, 4), 16), bb = parseInt(pb.slice(4, 6), 16);
  const h = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h((ar + br) / 2)}${h((ag + bg) / 2)}${h((ab + bb) / 2)}`;
}

/**
 * Down-sample a decoded AudioBuffer into `columns` min/max peak pairs
 * (mono-summed L+R) for waveform rendering. Returns an array of {min,max}
 * in the range -1..1, or null for an empty/invalid buffer.
 */
export function computePeaks(buffer, columns = 800) {
  if (!buffer || !buffer.length) return null;
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const len = ch0.length;
  const block = Math.max(1, Math.floor(len / columns));
  const out = [];
  for (let c = 0; c < columns; c++) {
    const start = c * block;
    const end = Math.min(len, start + block);
    let mx = 0, mn = 0;
    for (let i = start; i < end; i++) {
      const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      if (v > mx) mx = v;
      else if (v < mn) mn = v;
    }
    out.push({ min: mn, max: mx });
  }
  return out;
}