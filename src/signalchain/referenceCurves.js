/**
 * Reference curves for the EQ graph overlay.
 *
 * Fletcher-Munson / ISO 226 equal-loudness contours (stylised) + the pink-noise
 * -3 dB/octave spectral balance line. These are soft visual references only —
 * they help a mixer see how their EQ sits relative to human hearing sensitivity
 * and the pink-noise balance target, not certified measurements.
 */

// 0-phon (threshold of hearing) SPL anchors, approx ISO 226.
const FM_FREQS = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000];
const FM_THRESH = [78.5, 68.7, 59.5, 51.1, 44, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4, 11.4, 8.6, 6.2, 4.3, 3, 2.2, 2.4, 3.5, 1.7, -1.3, -4.2, -6, -5.4, -1.8, 2.5, 4, 4.5, 9, 18, 30];

export function thresholdSPL(freq) {
  if (freq <= FM_FREQS[0]) return FM_THRESH[0];
  const last = FM_FREQS.length - 1;
  if (freq >= FM_FREQS[last]) return FM_THRESH[last];
  for (let i = 0; i < last; i++) {
    if (freq >= FM_FREQS[i] && freq <= FM_FREQS[i + 1]) {
      const la = Math.log(FM_FREQS[i]);
      const lb = Math.log(FM_FREQS[i + 1]);
      const t = (Math.log(freq) - la) / (lb - la);
      return FM_THRESH[i] + t * (FM_THRESH[i + 1] - FM_THRESH[i]);
    }
  }
  return FM_THRESH[0];
}

/**
 * Fletcher-Munson equal-loudness contour for `phon`, mapped into a ±~24 dB
 * display range (0 dB at 1 kHz). Higher phon levels flatten the low-frequency
 * lift, as the real contours do.
 */
export function fmContourDb(freq, phon, scale = 0.32) {
  const t1k = thresholdSPL(1000);
  const factor = 1 - (0.6 * Math.min(100, phon)) / 100;
  return (thresholdSPL(freq) - t1k) * factor * scale;
}

/** Pink-noise reference: -3 dB/octave, anchored at 0 dB at 1 kHz. */
export function pinkNoiseDb(freq, scale = 1) {
  return -9.0309 * Math.log10(freq / 1000) * scale;
}