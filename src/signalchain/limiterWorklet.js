/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Brickwall Limiter AudioWorklet — true-peak (oversampled) lookahead limiting
// with program-dependent release and Mid/Side processing.
//
// Replaces the native DynamicsCompressor+WaveShaper core with a per-sample DSP
// engine that the native Web Audio nodes can't do: oversampling beyond 4×,
// true inter-sample-peak limiting, a real program-dependent release envelope,
// and Mid/Side detection.
//
// Signal flow (per base-rate sample):
//   xL,xR → upsample ×N → [M/S encode] → lookahead limit @ N·fs →
//   [M/S decode] → downsample ×N → outL,outR
//
// The lookahead limiter core (per processing-rate sample):
//   - delay line of `W` samples (the emitted sample is W samples old)
//   - sliding-window max (monotonic deque, O(1)) over the window
//     [emitted .. emitted+W] = the peak the emitted sample must survive
//   - gain envelope: instant attack (clamped by the window peak — the lookahead
//     means the reduction begins before the transient arrives), program-
//     dependent release (dual fast/slow from transient density + release shape)
//   - ceiling applied to the window peak; oversampling makes that peak the
//     reconstructed (true) peak
//
// GR is reported back to the main thread via port.postMessage (native
// DynamicsCompressor.reduction is not available on an AudioWorkletNode) so the
// panel's GR meter tracks the worklet.
//
// The DSP math (windowed-sinc polyphase, sliding-max deque, one-pole release)
// transfers directly to C++; only the AudioWorkletProcessor shell is JS-specific.

// ── Polyphase FIR design ────────────────────────────────────────────────
// Upsample filter: h[i] = sinc((i-c)/N)·hamming, normalised to DC gain N so
// each polyphase phase sums to 1 (fractional-delay interpolator property).
// Downsample filter = upsample filter / N (DC gain 1; the N phases accumulate
// to 1). Returns N phases, each `tapsPerPhase` taps.
function designFir(N, tapsPerPhase) {
  const L = N * tapsPerPhase;
  const c = (L - 1) / 2;
  const h = new Float32Array(L);
  let sum = 0;
  for (let i = 0; i < L; i++) {
    const x = (i - c) / N;
    const s = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (L - 1)); // Hamming
    h[i] = s * w;
    sum += h[i];
  }
  const scale = N / sum; // total DC gain → N (each phase ≈ 1)
  const phases = [];
  for (let p = 0; p < N; p++) {
    const t = new Float32Array(tapsPerPhase);
    for (let k = 0; k < tapsPerPhase; k++) t[k] = h[p + k * N] * scale;
    phases.push(t);
  }
  return phases;
}

// Streaming polyphase 2-channel upsample. One input sample → N output samples.
class UpSampler {
  constructor(N, P) {
    this.N = N; this.P = P;
    this.phases = designFir(N, P);
    this.hL = new Float32Array(P); this.hR = new Float32Array(P);
    this.wpL = 0; this.wpR = 0;
  }
  // ch: 0|1. Writes N outputs into out[ch][off .. off+N-1].
  process(ch, x, out, off) {
    const N = this.N, P = this.P;
    const h = ch === 0 ? this.hL : this.hR;
    let wp = ch === 0 ? this.wpL : this.wpR;
    h[wp] = x;
    const dst = out[ch];
    for (let p = 0; p < N; p++) {
      const taps = this.phases[p];
      let acc = 0, idx = wp;
      for (let k = 0; k < P; k++) { acc += taps[k] * h[idx]; idx = (idx - 1 + P) % P; }
      dst[off + p] = acc;
    }
    if (ch === 0) this.wpL = (wp + 1) % P; else this.wpR = (wp + 1) % P;
  }
}

// Streaming polyphase 2-channel downsample (decimate by N). Each phase keeps
// its own length-P history (the input subsequence at stride N). N input feeds
// → 1 emitted output.
class DownSampler {
  constructor(N, P, upPhases) {
    this.N = N; this.P = P;
    this.phases = upPhases.map((t) => {
      const a = new Float32Array(P);
      for (let i = 0; i < P; i++) a[i] = t[i] / N; // downsample gain = up/N
      return a;
    });
    this.hL = []; this.hR = []; this.wpL = []; this.wpR = [];
    for (let p = 0; p < N; p++) {
      this.hL.push(new Float32Array(P)); this.hR.push(new Float32Array(P));
      this.wpL.push(0); this.wpR.push(0);
    }
    this.accL = 0; this.accR = 0; this.phase = 0;
  }
  feed(xL, xR, out0, out1, i) {
    const N = this.N, P = this.P, ph = this.phase;
    const hL = this.hL[ph], hR = this.hR[ph];
    let wpL = this.wpL[ph], wpR = this.wpR[ph];
    hL[wpL] = xL; hR[wpR] = xR;
    const taps = this.phases[ph];
    let aL = this.accL, aR = this.accR, iL = wpL, iR = wpR;
    for (let k = 0; k < P; k++) { aL += taps[k] * hL[iL]; aR += taps[k] * hR[iR]; iL = (iL - 1 + P) % P; iR = (iR - 1 + P) % P; }
    this.accL = aL; this.accR = aR;
    this.wpL[ph] = (wpL + 1) % P; this.wpR[ph] = (wpR + 1) % P;
    if (++this.phase === N) {
      out0[i] = aL; out1[i] = aR;
      this.accL = 0; this.accR = 0; this.phase = 0;
    }
  }
}

// Sliding-window maximum (monotonic deque, O(1) amortised). Zero per-sample
// allocation: values + monotonic positions live in fixed typed arrays and the
// deque of ring-slot indices is a fixed Int32Array ring. (Allocating an object
// per push on the audio thread causes GC drops.)
class MaxWindow {
  constructor(W) {
    this.W = W;
    this.cap = W + 2;
    this.val = new Float32Array(this.cap);
    this.pos = new Int32Array(this.cap);   // global counter stored per slot
    this.wp = 0;                           // ring write index
    this.n = 0;
    this.dq = new Int32Array(this.cap);    // deque of ring-slot indices
    this.dqHead = 0; this.dqLen = 0;
  }
  push(v) {
    const cap = this.cap;
    const wp = this.wp;
    this.val[wp] = v;
    this.pos[wp] = ++this.n;
    while (this.dqLen > 0) {
      const back = this.dq[(this.dqHead + this.dqLen - 1) % cap];
      if (this.val[back] <= v) this.dqLen--; else break;
    }
    this.dq[(this.dqHead + this.dqLen) % cap] = wp;
    this.dqLen++;
    const lim = this.n - this.W; // keep positions > lim → window size W
    while (this.dqLen > 0) {
      const front = this.dq[this.dqHead % cap];
      if (this.pos[front] <= lim) { this.dqHead = (this.dqHead + 1) % cap; this.dqLen--; } else break;
    }
    this.wp = (wp + 1) % cap;
    return this.val[this.dq[this.dqHead % cap]];
  }
}

// Style → release bias (manual mode). Auto mode derives its own timings.
const STYLE_BIAS = {
  transparent: 1.0, punchy: 0.7, modern: 0.85, warm: 1.4, classical: 1.8,
};
const STYLE_BIAS_KEYS = ['transparent', 'punchy', 'modern', 'warm', 'classical'];

function styleBias(p) {
  if (typeof p.stylePos === 'number' && Number.isFinite(p.stylePos)) {
    const x = Math.max(0, Math.min(4, p.stylePos));
    const i = Math.floor(x);
    const j = Math.min(4, i + 1);
    const t = x - i;
    const a = STYLE_BIAS[STYLE_BIAS_KEYS[i]] || 1;
    const b = STYLE_BIAS[STYLE_BIAS_KEYS[j]] || 1;
    return a + (b - a) * t;
  }
  return STYLE_BIAS[p.style] || 1;
}

class LimiterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sr = sampleRate;
    this.p = {
      enabled: true, ceiling: 0.9, lookaheadMs: 1, release: 0.1, releaseMode: 'auto',
      releaseShape: 'adaptive', attack: 0, style: 'transparent', stereoLink: 100,
      msMode: false, truePeak: false,
    };
    this.os = 1;
    this.up = null; this.down = null;
    this.tmp = [new Float32Array(1), new Float32Array(1)];
    this.W = 1;
    this.delay = [new Float32Array(1), new Float32Array(1)];
    this.dwp = [0, 0];
    this.mx = [new MaxWindow(2), null];
    this.g = [1, 1];
    this.detPrev = [0, 0];
    this.trans = [0, 0];
    this.gr = 0;
    this._grDecay = Math.exp(-1 / (0.5 * this.sr)); // ~0.5s GR-meter decay @ 1×
    this.linked = true;
    this.blockCount = 0;
    this.W = Math.max(1, Math.round((this.p.lookaheadMs / 1000) * this.sr));
    this._resize();
    this.port.onmessage = (e) => this._apply(e.data || {});
  }

  _linked() { return this.p.stereoLink >= 50 || this.p.msMode; }

  _resize() {
    for (let c = 0; c < 2; c++) { this.delay[c] = new Float32Array(this.W); this.dwp[c] = 0; }
    this.linked = this._linked();
    this.mx = this.linked
      ? [new MaxWindow(this.W + 1), null]
      : [new MaxWindow(this.W + 1), new MaxWindow(this.W + 1)];
    this.g = [1, 1];
  }

  _setupOversampler(N) {
    this.os = N;
    this._grDecay = Math.exp(-1 / (0.5 * this.sr * N)); // ~0.5s GR-meter decay (time-based)
    if (N > 1) {
      const P = N >= 8 ? 12 : 16;
      this.up = new UpSampler(N, P);
      this.down = new DownSampler(N, P, this.up.phases);
      this.tmp = [new Float32Array(N), new Float32Array(N)];
    } else {
      this.up = null; this.down = null;
    }
  }

  _apply(m) {
    const p = this.p;
    if (typeof m.enabled === 'boolean') p.enabled = m.enabled;
    if (typeof m.ceiling === 'number') p.ceiling = Math.pow(10, Math.min(0, m.ceiling) / 20);
    if (typeof m.lookahead === 'number') p.lookaheadMs = m.lookahead;
    if (typeof m.release === 'number') p.release = m.release;
    if (typeof m.releaseMode === 'string') p.releaseMode = m.releaseMode;
    if (typeof m.releaseShape === 'string') p.releaseShape = m.releaseShape;
    if (typeof m.attack === 'number') p.attack = m.attack;
    if (typeof m.style === 'string') p.style = m.style;
    if (typeof m.stylePos === 'number' && Number.isFinite(m.stylePos)) p.stylePos = m.stylePos;
    if (typeof m.stereoLink === 'number') p.stereoLink = m.stereoLink;
    if (typeof m.msMode === 'boolean') p.msMode = m.msMode;
    if (typeof m.truePeak === 'boolean') p.truePeak = m.truePeak;
    let N = m.oversampling || this.os;
    if (p.truePeak && N < 2) N = 2; // true-peak needs ≥2× to see between samples
    if (N !== this.os) this._setupOversampler(N);
    const effRate = this.sr * this.os;
    const W = Math.max(1, Math.round((p.lookaheadMs / 1000) * effRate));
    const linkedChanged = this.linked !== this._linked();
    if (W !== this.W || linkedChanged) { this.W = W; this._resize(); }
  }

  // Emit the oldest delayed sample and push the new one into the delay line.
  _delay(c, x) {
    const buf = this.delay[c], wp = this.dwp[c];
    const out = buf[wp];
    buf[wp] = x;
    this.dwp[c] = (wp + 1) % this.W;
    return out;
  }

  // Program-dependent release coefficient (per processing-rate sample).
  _releaseRate(c) {
    const p = this.p;
    const effRate = this.sr * this.os;
    let T;
    if (p.releaseMode === 'auto') {
      const trans = this.trans[c];
      const gr = this.g[c] < 1 ? -20 * Math.log10(this.g[c]) : 0;
      if (trans > 0.5) T = 0.02;       // transient burst → fast
      else if (gr > 6) T = 0.06;        // heavy sustained GR → medium-slow
      else if (gr > 2) T = 0.12;        // moderate → medium
      else T = 0.25;                    // light → slow
    } else {
      T = Math.max(0.001, p.release) * styleBias(p);
    }
    if (p.releaseShape === 'linear') return 1 / (T * effRate);
    return 1 - Math.exp(-1 / (T * effRate)); // exp / adaptive
  }

  _envelope(c, target) {
    let g = this.g[c];
    if (target < g) {
      g = target; // instant attack; the lookahead makes it smooth in the output
    } else {
      const rate = this._releaseRate(c);
      const shape = this.p.releaseShape;
      if (shape === 'linear') g = Math.min(1, g + rate);
      else if (shape === 'adaptive') {
        // heavy GR → exponential (smooth, avoids pumping); light GR → linear (faster, loudness)
        const gr = g < 1 ? -20 * Math.log10(g) : 0;
        g = gr > 3 ? g + (1 - g) * rate : Math.min(1, g + rate);
        if (g > 1) g = 1;
      } else { g = g + (1 - g) * rate; if (g > 1) g = 1; } // exp
    }
    this.g[c] = g;
    const cur = g < 1 ? -20 * Math.log10(g) : 0;
    if (cur > this.gr) this.gr = cur; else this.gr *= this._grDecay; // hold + decay
  }

  // Core limiter step at the processing (base or upsampled) rate.
  _limit(xL, xR) {
    const p = this.p;
    if (p.msMode) {
      const m = (xL + xR) * 0.5, s = (xL - xR) * 0.5;
      const det = Math.abs(m) + Math.abs(s); // |M|+|S| bounds |L|,|R| → brickwall
      this.trans[0] = this.trans[0] * 0.95 + Math.abs(det - this.detPrev[0]) * 0.05;
      this.detPrev[0] = det;
      const peak = this.mx[0].push(det);
      const target = Math.min(1, p.ceiling / Math.max(1e-9, peak));
      this._envelope(0, target);
      const g = this.g[0];
      const eM = this._delay(0, m), eS = this._delay(1, s);
      const oM = g * eM, oS = g * eS;
      return [oM + oS, oM - oS];
    }
    if (this.linked) {
      const det = Math.max(Math.abs(xL), Math.abs(xR));
      this.trans[0] = this.trans[0] * 0.95 + Math.abs(det - this.detPrev[0]) * 0.05;
      this.detPrev[0] = det;
      const peak = this.mx[0].push(det);
      const target = Math.min(1, p.ceiling / Math.max(1e-9, peak));
      this._envelope(0, target);
      const g = this.g[0];
      return [g * this._delay(0, xL), g * this._delay(1, xR)];
    }
    // unlinked dual-mono
    const d0 = Math.abs(xL), d1 = Math.abs(xR);
    this.trans[0] = this.trans[0] * 0.95 + Math.abs(d0 - this.detPrev[0]) * 0.05; this.detPrev[0] = d0;
    this.trans[1] = this.trans[1] * 0.95 + Math.abs(d1 - this.detPrev[1]) * 0.05; this.detPrev[1] = d1;
    this._envelope(0, Math.min(1, p.ceiling / Math.max(1e-9, this.mx[0].push(d0))));
    this._envelope(1, Math.min(1, p.ceiling / Math.max(1e-9, this.mx[1].push(d1))));
    return [this.g[0] * this._delay(0, xL), this.g[1] * this._delay(1, xR)];
  }

  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    if (!input || !input.length) return true;
    const in0 = input[0], in1 = input[1] || input[0];
    const out0 = output[0], out1 = output[1] || output[0];
    const n = in0.length;
    const p = this.p;
    if (!p.enabled) {
      for (let i = 0; i < n; i++) { out0[i] = in0[i]; out1[i] = in1[i]; }
      this.gr *= 0.5; // fast GR reset when the limiter is disabled
      return true;
    }
    const N = this.os;
    if (N === 1) {
      for (let i = 0; i < n; i++) {
        const r = this._limit(in0[i], in1[i]);
        out0[i] = r[0]; out1[i] = r[1];
      }
    } else {
      for (let i = 0; i < n; i++) {
        this.up.process(0, in0[i], this.tmp, 0);
        this.up.process(1, in1[i], this.tmp, 0);
        for (let j = 0; j < N; j++) {
          const r = this._limit(this.tmp[0][j], this.tmp[1][j]);
          this.down.feed(r[0], r[1], out0, out1, i);
        }
      }
    }
    if ((++this.blockCount & 1) === 0) { try { this.port.postMessage({ gr: this.gr }); } catch {} }
    return true;
  }
}

registerProcessor('limiter-processor', LimiterProcessor);