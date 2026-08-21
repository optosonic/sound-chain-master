/**
 * Simplified ITU-R BS.1770-4 integrated loudness (LUFS).
 * Two cascaded K-weighting biquads (pre-filter + RLB) using the published
 * 48 kHz coefficients, then a 400 ms block measurement with absolute (-70 LUFS)
 * and relative (-10 dB) gating. Good enough to drive a normalization target —
 * not a certified meter, but consistently close.
 */

// Stage 1 (pre-filter / head-shadow) and Stage 2 (RLB high-pass) — BS.1770-4 @ 48 kHz.
// The feedback (a1, a2) coefficients MUST be negative/positive respectively:
// the recursion is y = b0·x + b1·x1 + b2·x2 − a1·y1 − a2·y2, so the denominator
// is 1 + a1·z⁻¹ + a2·z⁻². With the signs below, both filters' poles sit inside
// the unit circle (|z| ≈ 0.86 and 0.995) — STABLE. The opposite signs make the
// filters unstable (pole at z ≈ −2.05), so the weighted output overflows to
// +Infinity for any real signal, the LUFS reads +∞, the normalize gain becomes
// 0, and the exported master is dead silence. This is the root cause.
const B1 = { b0: 1.53512485958697, b1: -2.69169618981112, b2: 1.19839281085285, a1: -1.69065629043395, a2: 0.73297751456439 };
const B2 = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.990148, a2: 0.9902216 };

// Difference equation: y = b0 x + b1 x1 + b2 x2 - a1 y1 - a2 y2
function biquad(data, c) {
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    // Sanitize: a non-finite (Infinity/NaN) sample would poison every
    // subsequent sample and make the whole measurement +∞/NaN. Treat any
    // non-finite value as silence.
    const x = isFinite(data[i]) ? data[i] : 0;
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

function kWeight(data) {
  return biquad(biquad(data, B1), B2);
}

export function integratedLufs(buffer) {
  const sr = buffer.sampleRate;
  const nch = buffer.numberOfChannels;
  // Channel weights: L/R/C = 1.0, surrounds = 0.707. Stereo → all 1.
  const weights = [];
  for (let c = 0; c < nch; c++) weights.push(c < 3 ? 1.0 : 0.707);
  const wSum = weights.reduce((a, b) => a + b, 0);

  const block = Math.max(1, Math.floor(sr * 0.4));
  const hop = Math.max(1, Math.floor(block * 0.25));
  const total = buffer.length;

  const weighted = [];
  for (let c = 0; c < nch; c++) weighted.push(kWeight(buffer.getChannelData(c)));

  const blockLufs = [];
  for (let start = 0; start + block <= total; start += hop) {
    let ms = 0;
    for (let c = 0; c < nch; c++) {
      const d = weighted[c];
      let s = 0;
      for (let i = start; i < start + block; i++) s += d[i] * d[i];
      ms += weights[c] * (s / block);
    }
    ms /= wSum;
    if (!isFinite(ms) || ms <= 0) continue;
    const lufs = -0.691 + 10 * Math.log10(ms);
    if (isFinite(lufs)) blockLufs.push(lufs);
  }
  if (!blockLufs.length) return -70;

  // Absolute gate: drop blocks below -70 LUFS.
  let gated = blockLufs.filter((l) => l > -70);
  if (!gated.length) gated = blockLufs;
  // Relative gate: -10 dB below the mean of the surviving blocks.
  const safePow = (l) => { const t = Math.pow(10, (l + 0.691) / 10); return isFinite(t) ? t : 0; };
  const meanMs = gated.reduce((a, l) => a + safePow(l), 0) / gated.length;
  const relGate = -0.691 + 10 * Math.log10(meanMs) - 10;
  const rel = gated.filter((l) => l > relGate);
  const used = rel.length ? rel : gated;
  const finalMs = used.reduce((a, l) => a + safePow(l), 0) / used.length;
  const result = -0.691 + 10 * Math.log10(finalMs);
  return isFinite(result) ? result : -70;
}