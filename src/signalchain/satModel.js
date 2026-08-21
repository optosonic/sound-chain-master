// Shared saturation transfer-characteristic model.
// Used by both the DSP (SignalChain.createSatCurve) and the UI graph
// (SaturationPanel) so the plotted curve is the *actual* processing curve.

/**
 * Transfer function y = f(mode, drive, x), x,y in [-1,1].
 * Each mode is a deliberately different waveshape — not a single generic curve.
 */
export function satTransfer(mode, drive, x) {
  // Drive spans 0–1; a 1.5× coefficient keeps the full travel subtle and
  // musical — gentle tube-like saturation right up to the top of the dial
  // instead of slamming into hard clipping. Shared by the DSP curve and the
  // UI graph so the plotted transfer is the actual processing curve.
  const k = 1 + drive * 1.5;
  switch (mode) {
    case 'tube':
      // Asymmetric soft clip: tanh + small linear term + a 2nd-harmonic term
      // → mixed even & odd harmonics, the signature "tube warmth".
      return Math.tanh(x * k) * 0.9 + 0.05 * x + 0.03 * x * x * Math.sign(x);
    case 'tape':
      // Symmetric tanh with a gentle top-end tuck and slight bias smoothing
      // → smooth, gluey compression, "tape warmth".
      return Math.tanh(x * k * 0.85) * (1 - 0.08 * Math.abs(x));
    case 'transistor': {
      // Harder exponential symmetric clip — sharper knee, punchier, more odd harmonics.
      const a = x * k;
      return Math.sign(a) * (1 - Math.exp(-Math.abs(a) * 2.5)) * 0.95;
    }
    case 'opto':
      // Opto element: very soft, slow, compression-like curve with rounded
      // shoulders — stays near-linear longer then gently rounds off.
      return 0.45 * x + 0.55 * Math.tanh(x * k * 0.5);
    case 'clean':
    default:
      // Clean: mostly linear with a subtle soft-clip blend — minimal coloration.
      return 0.7 * x + 0.3 * Math.tanh(x * k);
  }
}