// Per-character compressor DSP model — shared by the UI transfer-curve plot
// and the CompressorNode factory. The AudioWorklet (compressorWorklet.js) holds
// an identical copy of the gain-computer logic because worklets run in their
// own scope and cannot import application modules.

export const CHAR_ENUM = { platinum: 0, vca: 1, fet: 2, opto: 3, vfet: 4 };

// Fixed, subtle per-character coloration drive (part of the model, not a dial).
// Kept low so the colour is a tint, not distortion ("subtle, subtle, subtle").
export const CHARACTER_DRIVE = { platinum: 0, vca: 0, fet: 0.2, opto: 0.25, vfet: 0.3 };

// Program-dependent ratio: FET ratio rises toward 20:1 as the input exceeds
// threshold by +10 dB; Opto has no fixed ratio — a smooth compressive curve
// that climbs from ~half the dialed ratio toward 20:1. Digital / VCA / VFET
// use the dialed ratio directly.
export function effectiveRatio(overDb, ratio, character) {
  if (overDb <= 0) return ratio;
  if (character === CHAR_ENUM.fet) {
    const t = Math.min(1, overDb / 10);
    return ratio + t * (20 - ratio);
  }
  if (character === CHAR_ENUM.opto) {
    const t = overDb / 10;
    return Math.min(20, ratio * (0.5 + 0.5 * t) + t * t * (20 - ratio));
  }
  return ratio;
}

// Knee width per character: FET is hard-knee (1176); Opto is very soft with no
// hard knee; VFET is soft (tube gain element); Digital / VCA use the dialed knee.
export function characterKnee(knee, character) {
  if (character === CHAR_ENUM.fet) return 0;
  if (character === CHAR_ENUM.opto) return Math.max(knee, 24);
  if (character === CHAR_ENUM.vfet) return Math.max(knee, 12);
  return knee;
}

// Gain reduction in dB (positive = reduction) for a detector level, using the
// Zölzer knee gain-computer with the character-specific ratio + knee.
export function gainReductionDb(detDb, T, R, knee, character) {
  const kW = characterKnee(knee, character);
  const halfW = kW / 2;
  const overDb = detDb - T;
  if (overDb <= -halfW) return 0;
  const effR = Math.max(1, effectiveRatio(Math.max(0, overDb), R, character));
  if (overDb >= halfW) {
    return overDb * (1 - 1 / effR);
  }
  if (kW > 0) {
    const xx = overDb + halfW;
    return (1 - 1 / effR) * (xx * xx) / (2 * kW);
  }
  return overDb > 0 ? overDb * (1 - 1 / effR) : 0;
}

/**
 * Model-blended gain reduction — the static gain-computer the transfer-curve
 * plot uses. `model` = 1 → full character (program-dependent ratio + character
 * knee); `model` = 0 → clean Digital reference (fixed dialed ratio + dialed
 * knee). Values between linearly interpolate, mirroring the worklet's audible
 * blend. Detector / topology / colour (time-domain) aren't visible on a static
 * transfer curve, so only the gain-computer is blended here.
 */
export function gainReductionDbModeled(detDb, T, R, knee, character, model) {
  // Model amount blends Digital ↔ full character and now EXTRAPOLATES past 1
  // (up to 2). 0 = clean Digital, 1 = full character, >1 pushes the character
  // curve harder (more program-dependent ratio / softer knee) and, in the
  // worklet, more detector-topology character + colour. The transfer-curve
  // plot only shows the gain-computer extrapolation; topology/colour are
  // time-domain and not visible on a static curve.
  const m = Math.max(0, model == null ? 1 : model);
  if (character === CHAR_ENUM.platinum) return gainReductionDb(detDb, T, R, knee, character);
  if (m === 0) return gainReductionDb(detDb, T, R, knee, CHAR_ENUM.platinum);
  const grDig = gainReductionDb(detDb, T, R, knee, CHAR_ENUM.platinum);
  const grChar = gainReductionDb(detDb, T, R, knee, character);
  return grDig * (1 - m) + grChar * m;
}