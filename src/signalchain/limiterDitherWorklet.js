/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// Limiter dither + noise-shaping — final-stage AudioWorkletProcessor.
//
// Placed AFTER the limiter's output trim so it is the ABSOLUTE last processing
// stage: it only colours the signal when the bit depth is reduced (16- or
// 24-bit delivery). "Off" = transparent 32-bit float passthrough.
//
// DSP:
//   • TPDF dither (two uniform samples → triangular, ±1 LSB) decorrelates the
//     quantization error from the signal so the noise floor is a constant
//     hiss instead of harmonic distortion.
//   • Error-feedback noise shaping pushes the quantization+noise energy away
//     from sensitive bands. Four curves are provided:
//       - none      : no feedback (plain TPDF)
//       - basic     : 1st-order high-pass  [1.0]
//       - optimized : 2nd-order Wannamaker [1.6, -0.7]  (good all-rounder)
//       - weighted  : 5-tap psychoacoustic [2.0, -1.4, 0.6, -0.2, 0.05]
//                     (pushes noise toward HF where the ear is least sensitive)
//
// The math transfers directly to C++ (per-sample float, round-to-nearest);
// the only platform-specific part is AudioWorkletProcessor::process().

// Error-feedback FIR coefficients for each noise-shaping option.
const SHAPES = {
  none:      [],
  basic:     [1.0],
  optimized: [1.6, -0.7],
  weighted:  [2.0, -1.4, 0.6, -0.2, 0.05],
};

class LimiterDitherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  constructor() {
    super();
    this.bitDepth = 0;        // 0 = off (transparent passthrough)
    this.coeffs = SHAPES.none;
    this.err = [[], []];      // per-channel quantization-error history
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (typeof m.bitDepth === 'number') this.bitDepth = m.bitDepth;
      if (typeof m.noiseShape === 'string' && SHAPES[m.noiseShape]) {
        this.coeffs = SHAPES[m.noiseShape];
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;

    const ch = input.length;
    const bd = this.bitDepth;
    const coeffs = this.coeffs;
    const useShape = coeffs.length > 0;

    // Off → transparent passthrough (no bit-depth reduction, no dither).
    if (bd <= 0) {
      for (let c = 0; c < ch; c++) {
        const i = input[c], o = output[c];
        for (let n = 0; n < i.length; n++) o[n] = i[n];
      }
      return true;
    }

    // Quantizer step for a signal normalised to [-1, 1]: Δ = 2 / 2^bits.
    const delta = Math.pow(2, 1 - bd);
    const invDelta = 1 / delta;
    const L = coeffs.length;

    for (let c = 0; c < ch; c++) {
      const i = input[c], o = output[c];
      // Lazy per-channel error history (handles 1- or 2-channel, and hot-reload).
      let hist = this.err[c] || (this.err[c] = []);
      if (hist.length !== L) { hist = new Array(L).fill(0); this.err[c] = hist; }

      for (let n = 0; n < i.length; n++) {
        const x = i[n];
        // TPDF dither: (rand - rand) * Δ → triangular, ±1 LSB.
        const dith = (Math.random() - Math.random()) * delta;
        // Error feedback: add the weighted sum of past quantization errors.
        let s = x + dith;
        if (useShape) {
          for (let k = 0; k < L; k++) s += coeffs[k] * hist[k];
        }
        // Quantize to the nearest step (round-half-up is fine for dithered
        // audio — the dither removes the correlation that makes the rounding
        // rule matter).
        const q = Math.round(s * invDelta) * delta;
        // Total quantization error (includes dither) feeds the next sample.
        const err = q - s;
        if (useShape) {
          for (let k = L - 1; k > 0; k--) hist[k] = hist[k - 1];
          hist[0] = err;
        }
        o[n] = q;
      }
    }
    return true;
  }
}

registerProcessor('limiter-dither-processor', LimiterDitherProcessor);