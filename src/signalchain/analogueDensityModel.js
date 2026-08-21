// Analogue Density — shared tube / transformer / air model.
// Used by both the DSP (module factory WaveShaper curves) and the UI (panel
// transfer plots + air response) so what you see is what you hear.
//
// Signal flow (Brainworx Black Box HG-2 style):
//   input transformer → [parallel 12AX7 sat path, freq-selective] →
//   6U8A Pentode (even-order) → 6U8A Triode (odd-order) →
//   Air shelving → output transformer → wet/dry mix.
//
// All transfer functions map x ∈ [-1,1] → y ∈ ~[-1,1]; curves are clamped.

// Global drive coefficient — scales the nonlinearity steepness of every tube
// stage so the overall effect is gentler. The factory voicing ran hot, making
// the wet signal harsh past ~20% mix; toning the curves down lets users push
// the mix much higher before it bites. 1.0 = original, <1 = softer.
export const DRIVE_COEFF = 0.6;

/** Clamp + build a WaveShaper curve for a given transfer. */
export function buildCurve(fn, samples = 4096) {
  const c = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    let y = fn(x);
    if (y > 1) y = 1; else if (y < -1) y = -1;
    c[i] = y;
  }
  return c;
}

// ── 6U8A Pentode — even-order emphasis (asymmetric soft clip) ──────────
// `drive` 0..1 (and beyond for density push). A positive bias shifts the
// clip point between halves → strong 2nd harmonic, "guitar-amp" warmth.
export function pentodeTransfer(drive, x) {
  const k = 1 + Math.max(0, drive) * 2.4;
  const bias = 0.14;
  return Math.tanh(k * (x + bias)) - Math.tanh(k * bias) + 0.05 * x;
}

// ── 6U8A Triode — odd-order emphasis (symmetric soft clip) ─────────────
// Symmetric tanh → 3rd / odd harmonics, tape-like grit + compression.
export function triodeTransfer(drive, x) {
  const k = 1 + Math.max(0, drive) * 2.8;
  return Math.tanh(k * x);
}

// ── Parallel 12AX7 / 12AT7 saturation stage ───────────────────────────
// `alt` selects the more aggressive (12AT7-style) voicing.
export function parallelTubeTransfer(drive, alt, x) {
  const d = Math.max(0, drive);
  if (alt) {
    // Harder exponential clip — punchier, edgier.
    const k = 1 + d * 3.4;
    return Math.sign(x) * (1 - Math.exp(-Math.abs(x) * k * 1.6)) * 0.92;
  }
  // Normal 12AX7 — warm tanh + a touch of 2nd harmonic.
  const k = 1 + d * 2.1;
  return Math.tanh(k * x) * 0.9 + 0.025 * x * x * Math.sign(x);
}

// ── Transformer — very subtle low-order colouration ─────────────────────
// Used at input and output; adds a faint 2nd-harmonic shimmer + tiny level.
export function transformerTransfer(x) {
  return x + 0.018 * Math.tanh(7 * x) - 0.004 * x;
}

// ── Density mapping ────────────────────────────────────────────────────
// density ∈ [-1,1]: pushes both tube stages harder and applies compensatory
// output attenuation so perceived loudness stays ~constant → denser sound.
export function densityMapping(density, pentode, triode) {
  const d = Math.max(-1, Math.min(1, density || 0));
  const push = Math.max(0, d) * 0.55;      // only positive density adds drive
  const pull = Math.max(0, -d) * 0.25;     // negative softens slightly
  return {
    pentodeDrive: Math.max(0, (pentode + push - pull) * DRIVE_COEFF),
    triodeDrive: Math.max(0, (triode + push - pull) * DRIVE_COEFF),
    outputComp: 1 / (1 + Math.max(0, d) * 0.85 * DRIVE_COEFF),  // attenuate to hold loudness
  };
}

// ── Air shelf response (for the UI plot) ──────────────────────────────
// Returns gain in dB at a given frequency for the air shelf + calibration.
// airAmount 0..10 → up to +4 dB shelf at 10 kHz; calibration trims ±1.5 dB.
export function airResponseDb(freq, airAmount, calibration) {
  const amt = Math.max(0, Math.min(10, airAmount)) / 10;       // 0..1
  const airGain = amt * 4;                                     // dB
  const fc = 10000;
  // 1-pole high-shelf magnitude approximation (smooth knee).
  const ratio = freq / fc;
  const shelf = airGain * (ratio * ratio) / (1 + ratio * ratio);
  const calib = calibration === 'dark' ? -1.5 : calibration === 'bright' ? 1.5 : 0;
  const cratio = freq / 5000;
  const cshelf = calib * (cratio * cratio) / (1 + cratio * cratio);
  return shelf + cshelf;
}

// ── Combined transfer (input transformer → pentode → triode → output) ─
// Used by the UI to plot the end-to-end character curve at the current
// drive settings (parallel sat path excluded — it's a parallel blend).
export function densityFullTransfer({ pentode, triode, density }, x) {
  const { pentodeDrive, triodeDrive } = densityMapping(density, pentode, triode);
  let y = transformerTransfer(x);
  y = pentodeTransfer(pentodeDrive, y);
  y = triodeTransfer(triodeDrive, y);
  y = transformerTransfer(y);
  return Math.max(-1, Math.min(1, y));
}