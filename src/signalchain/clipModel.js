/**
 * Clip Distortion — asymmetric soft-clipper with pre/post tone shaping.
 * State shape consumed by SignalChain.updateClip / createClipCurve and the
 * ClipDistortionPanel UI.
 */
export const DEFAULT_CLIP = {
  enabled: false,
  inputGain: 0,        // dB, -30..30  (pre-gain into the clipper)
  drive: 0,            // dB, 0..50    (folds into the tanh shaper coefficient)
  clipFilterType: 'lowpass', // 'lowpass' | 'highpass'  (shapes what gets clipped)
  clipFilterFreq: 4400, // Hz, 20..20000
  symmetry: 0,        // %, -100..100  (asymmetric clipping → even harmonics)
  tone: 170,          // Hz, 20..20000 (post-clip high-pass tone)
  highShelfFreq: 980, // Hz, 20..20000
  highShelfGain: 0,   // dB, -24..24
  lpFilterFreq: 6600, // Hz, 20..20000
  mix: 0.2,          // 0..1 wet/dry
  outputGain: 0,      // dB, -30..30
};

export function defaultClip() {
  return { ...DEFAULT_CLIP };
}