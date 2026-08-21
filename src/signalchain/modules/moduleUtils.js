import { satTransfer } from '../satModel.js';

/** Clamp a dB value to a sane range and convert to linear gain, so a bad recipe
 * value can never blow a gain node up to Infinity/NaN. */
export const dbToGain = (db) => {
  const d = Math.max(-100, Math.min(60, Number(db) || 0));
  const g = Math.pow(10, d / 20);
  return isFinite(g) ? g : 1;
};

// Toggle click suppression: when a module's enable (or topology) state flips,
// ramp its throughput gains over ~12 ms instead of jumping them. `ramp` is true
// only on the frame the state actually changes, so dragging a parameter while a
// module is already on stays sample-accurate (no laggy ramp on every slider tick).
export const FADE_TAU = 0.012;
export function fadeGain(node, val, now, ramp) {
  if (ramp) node.gain.setTargetAtTime(val, now, FADE_TAU);
  else node.gain.setValueAtTime(val, now);
}

/** A dry/wet insert: input → (dry + wet) → output. dry defaults to 1, wet to 0. */
export function makeInsert(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0;
  input.connect(dry);
  dry.connect(output);
  // CRITICAL: the wet (processed) path must sum into the output. Without this
  // every effect that routes through `wet` is completely silent — only the dry
  // bypass reaches the output, so no fader has any audible effect.
  wet.connect(output);
  return { input, output, dry, wet };
}

/** Identity transfer curve (bypass). */
export function identityCurve() {
  const samples = 4096;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) curve[i] = (i * 2) / samples - 1;
  return curve;
}

/** Saturation transfer curve for a given mode + drive. */
export function createSatCurve(mode, drive) {
  const samples = 4096;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.max(-1, Math.min(1, satTransfer(mode, drive, x)));
  }
  return curve;
}

// Asymmetric soft-clip: tanh(drive·(x+s)) − tanh(drive·s). The symmetry offset
// shifts where the positive/negative halves clip, injecting even harmonics;
// subtracting the DC term keeps the curve centred.
export function createClipCurve(driveDb, symmetry) {
  const samples = 4096;
  const curve = new Float32Array(samples);
  const drive = Math.pow(10, Math.max(0, driveDb) / 20);
  const s = Math.max(-1, Math.min(1, symmetry / 100));
  const dc = Math.tanh(drive * s);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const v = Math.tanh(drive * (x + s)) - dc;
    curve[i] = Math.max(-1, Math.min(1, v));
  }
  return curve;
}

// Tape saturation curve — tanh soft-clip. Drive sets the saturation amount,
// saturation scales how much of the drive reaches the curve, and bias softens
// it (analog bias reduces low-level distortion → a gentler slope).
export function createTapeCurve(drive, bias, saturation) {
  const samples = 4096;
  const curve = new Float32Array(samples);
  const d = 1 + (drive * 8) * (0.4 + saturation * 0.6);
  const b = 1 - bias * 0.5; // 0.5..1
  const eff = Math.max(0.1, d * b);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.max(-1, Math.min(1, Math.tanh(eff * x)));
  }
  return curve;
}

// Soft-clip ceiling curve: identity below the (linear) ceiling, gently rounded
// above it toward the ceiling — used by the oversampled stage to suppress
// inter-sample peaks (true-peak mode).
export function createLimCeilingCurve(ceilingDb) {
  const ceil = Math.pow(10, Math.min(0, ceilingDb) / 20);
  const head = Math.max(1e-4, 1 - ceil);
  const samples = 4096;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const ax = Math.abs(x);
    let y;
    if (ax <= ceil) y = x;
    else {
      const over = (ax - ceil) / head;
      const soft = ceil + head * Math.tanh(over * 2.5) / 2.5;
      y = Math.sign(x) * Math.min(1, soft);
    }
    curve[i] = Math.max(-1, Math.min(1, y));
  }
  return curve;
}