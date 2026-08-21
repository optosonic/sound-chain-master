/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// Dual-tap crossfading delay line — click-free delay-time changes.
//
// A single shared circular buffer per channel with TWO independent read taps.
// Only one tap is audible at any instant. When the `delayTime` parameter
// changes, the new delay is assigned to the currently SILENT tap and an
// equal-power crossfade transitions the output from the old tap to the new
// one. The silent tap's read position JUMPS instantly to the new delay (no
// Doppler / pitch shift), and the crossfade masks the jump (no click, no
// zipper). After the crossfade the previously active tap becomes the silent
// one and is ready for the next change.
//
// Overlapping changes (a new time arrives mid-crossfade) restart the crossfade
// cleanly from whichever tap is dominant at that instant.
//
// Fractional-delay: linear interpolation between adjacent buffer samples —
// sub-sample accurate, stable in the feedback loop, free of read artifacts.

const MAX_DELAY_SEC = 4.0;

class DelayXfadeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'delayTime', defaultValue: 0.15, minValue: 0, maxValue: MAX_DELAY_SEC, automationRate: 'k-rate' },
      { name: 'feedback',  defaultValue: 0.3,  minValue: 0, maxValue: 0.99,         automationRate: 'k-rate' },
      { name: 'xfadeMs',  defaultValue: 15,    minValue: 1, maxValue: 200,           automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.sr = sampleRate; // global in AudioWorkletGlobalScope
    this.len = Math.ceil(MAX_DELAY_SEC * this.sr) + 4;
    this.bufL = new Float32Array(this.len);
    this.bufR = new Float32Array(this.len);
    this.writePos = 0;

    // Two read taps (delay in samples, fractional) + which is dominant.
    this.tapDelay = [0, 0];
    this.active = 0;
    this.initialized = false;

    // Crossfade state.
    this.cfActive = false;
    this.cfFrom = 0;
    this.cfTo = 1;
    this.cfProgress = 0;     // 0..1
    this.cfDur = 1;          // samples

    // Smoothed feedback (one-pole) to avoid zipper on feedback changes.
    this.fbSmooth = 0.3;
    this.fbAlpha = 1 - Math.exp(-1 / (this.sr * 0.02)); // ~20ms time constant

    this._wrap = (i) => {
      const m = i % this.len;
      return m < 0 ? m + this.len : m;
    };
  }

  _read(buf, delaySamples) {
    // Fractional read at (writePos - delaySamples) with linear interpolation.
    const pos = this.writePos - delaySamples;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = buf[this._wrap(i0)];
    const b = buf[this._wrap(i0 - 1)];
    return a + (b - a) * frac;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const stereo = output.length >= 2;
    const inL = (input && input[0] && input[0].length) ? input[0] : null;
    const inR = (input && input[1] && input[1].length) ? input[1] : null;

    const dtTarget = parameters.delayTime[0] * this.sr; // samples
    const fbTarget = parameters.feedback[0];
    const xfMs = parameters.xfadeMs[0];

    // First block: seed both taps to the initial delay so the start doesn't
    // trigger a crossfade.
    if (!this.initialized) {
      this.tapDelay[0] = dtTarget;
      this.tapDelay[1] = dtTarget;
      this.active = 0;
      this.fbSmooth = fbTarget;
      this.initialized = true;
    }

    // Detect a delay-time change → (re)start the crossfade to the silent tap.
    if (Math.abs(dtTarget - this.tapDelay[this.active]) > 0.5 /* sample */) {
      const silent = 1 - this.active;
      this.tapDelay[silent] = dtTarget;
      if (this.cfActive) {
        // Mid-crossfade: restart from whichever tap is dominant right now.
        const dom = (this.cfProgress < 0.5) ? this.cfFrom : this.cfTo;
        const other = 1 - dom;
        this.tapDelay[other] = dtTarget;
        this.cfFrom = dom;
        this.cfTo = other;
      } else {
        this.cfFrom = this.active;
        this.cfTo = silent;
      }
      this.cfActive = true;
      this.cfProgress = 0;
      this.cfDur = Math.max(1, Math.round((xfMs / 1000) * this.sr));
      this.active = this.cfTo;
    }

    const blockLen = output[0].length;
    const outL = output[0];
    const outR = output[1];
    const HALF_PI = Math.PI * 0.5;

    for (let i = 0; i < blockLen; i++) {
      // Crossfade gains (equal-power). cg = cos(p·π/2), sg = sin(p·π/2).
      let g0, g1;
      if (this.cfActive) {
        const cg = Math.cos(this.cfProgress * HALF_PI);
        const sg = Math.sin(this.cfProgress * HALF_PI);
        g0 = (this.cfFrom === 0) ? cg : sg;
        g1 = (this.cfFrom === 0) ? sg : cg;
        this.cfProgress += 1 / this.cfDur;
        if (this.cfProgress >= 1) { this.cfProgress = 1; this.cfActive = false; }
      } else {
        g0 = (this.active === 0) ? 1 : 0;
        g1 = (this.active === 1) ? 1 : 0;
      }

      // Smooth feedback toward target.
      this.fbSmooth += (fbTarget - this.fbSmooth) * this.fbAlpha;

      // Read both taps per channel.
      const s0L = this._read(this.bufL, this.tapDelay[0]);
      const s1L = this._read(this.bufL, this.tapDelay[1]);
      const oL = g0 * s0L + g1 * s1L;
      let oR;
      if (stereo) {
        const s0R = this._read(this.bufR, this.tapDelay[0]);
        const s1R = this._read(this.bufR, this.tapDelay[1]);
        oR = g0 * s0R + g1 * s1R;
      } else {
        oR = oL;
      }

      outL[i] = oL;
      if (outR) outR[i] = oR;

      // Write input + feedback × (crossfaded output) into the shared buffer.
      const inSampL = inL ? inL[i] : 0;
      const inSampR = inR ? inR[i] : (stereo ? inSampL : inSampL);
      this.bufL[this.writePos] = inSampL + this.fbSmooth * oL;
      this.bufR[this.writePos] = inSampR + this.fbSmooth * oR;

      this.writePos = this._wrap(this.writePos + 1);
    }

    return true;
  }
}

registerProcessor('delay-xfade', DelayXfadeProcessor);