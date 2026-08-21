/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentTime */
// Signal Utility / Test Oscillator Pro — zero-latency AudioWorklet generator.
// Synthesises per sample with no lookahead: sine, white/pink noise, polyBLEP
// anti-aliased square/saw/triangle, needle pulse (Dirac-like), triggered impulse,
// and a log/linear sine sweep. Stereo out, decorrelated noise, phase invert,
// DC offset, dim, and a true-peak-safe output clamp.

class SignalUtilityProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;          // [0,1) for periodic waveforms
    this.triState = 0;       // leaky integrator state for bandlimited triangle
    this.sweepPhase = 0;
    this.sweepElapsed = 0;
    this.pinkB = new Array(7).fill(0);   // L pink-noise filter state
    this.pinkBR = new Array(7).fill(0);  // R pink-noise filter state (decorrelated)
    this.needleCount = 0;
    this.needleTimer = 0;          // vinyl-crackle click scheduling (seconds)
    this.needleNext = 0.5 + Math.random() * 0.2;
    this.impulsePending = false;
    this.params = {
      type: 'sine', frequency: 1000, level: 0.251, duty: 0.5,
      antiAliased: true, decorrelated: false, stereo: true, invert: 'none',
      dcOffset: 0, dim: false, enabled: false,
      sweepStart: 20, sweepEnd: 20000, sweepDuration: 4, sweepRate: 'log',
    };
    this.peakL = 0; this.peakR = 0; this.sumL = 0; this.sumR = 0; this.cnt = 0; this.mTimer = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.trigger) { this.impulsePending = true; return; }
      if (d.type != null && d.type !== this.params.type) {
        // reset all generator state on type change so each waveform starts clean
        this.phase = 0; this.triState = 0; this.sweepPhase = 0; this.sweepElapsed = 0;
        this.needleCount = 0; this.needleTimer = 0; this.needleNext = 0.5 + Math.random() * 0.2;
        this.pinkB.fill(0); this.pinkBR.fill(0);
      }
      this.params = { ...this.params, ...d };
    };
  }

  // Paul Kellet "improved" pink-noise filter — accurate −3 dB/octave slope.
  pink(st, w) {
    st[0] = 0.99886 * st[0] + w * 0.0555179;
    st[1] = 0.99332 * st[1] + w * 0.0750759;
    st[2] = 0.96900 * st[2] + w * 0.1538520;
    st[3] = 0.86650 * st[3] + w * 0.3104856;
    st[4] = 0.55000 * st[4] + w * 0.5329522;
    st[5] = -0.7616 * st[5] - w * 0.0168980;
    const v = st[0] + st[1] + st[2] + st[3] + st[4] + st[5] + st[6] + w * 0.5362;
    st[6] = w * 0.115926;
    return v * 0.11;
  }

  // polyBLEP correction for value-discontinuity waveforms (saw/square/triangle).
  pblep(t, dt) {
    if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
    if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
    return 0;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    const p = this.params;
    const sr = sampleRate;
    const dt = 1 / sr;
    const en = p.enabled;
    const lvl = p.dim ? p.level * 0.1 : p.level;
    const invL = (p.invert === 'left' || p.invert === 'both') ? -1 : 1;
    const invR = (p.invert === 'right' || p.invert === 'both') ? -1 : 1;
    const stereo = p.stereo;
    const n = L.length;
    for (let i = 0; i < n; i++) {
      let sL = 0, sR = null;
      if (en) {
        const t = this.phase;
        switch (p.type) {
          case 'sine': sL = Math.sin(2 * Math.PI * t); break;
          case 'square': {
            const naive = t < p.duty ? 1 : -1;
            if (p.antiAliased) {
              const inc = p.frequency / sr;
              let sq = naive + this.pblep(t, inc);
              let t2 = t - p.duty + 1; t2 -= Math.floor(t2);
              sq -= this.pblep(t2, inc);
              sL = sq;
            } else sL = naive;
            break;
          }
          case 'saw': {
            const naive = 2 * t - 1;
            sL = p.antiAliased ? naive - this.pblep(t, p.frequency / sr) : naive;
            break;
          }
          case 'triangle': {
            // bandlimited triangle = integral of a bandlimited 50%-duty square.
            const inc = p.frequency / sr;
            let sq = (t < 0.5 ? 1 : -1) + this.pblep(t, inc);
            let t2 = t - 0.5 + 1; t2 -= Math.floor(t2);
            sq -= this.pblep(t2, inc);
            this.triState = this.triState * (1 - 1e-7) + sq * dt;
            sL = this.triState * 4 * p.frequency; // normalise to ±1 (integrated peak = 1/4f)
            break;
          }
          case 'white': {
            sL = Math.random() * 2 - 1;
            if (stereo && p.decorrelated) sR = Math.random() * 2 - 1;
            break;
          }
          case 'pink': {
            sL = this.pink(this.pinkB, Math.random() * 2 - 1);
            if (stereo && p.decorrelated) sR = this.pink(this.pinkBR, Math.random() * 2 - 1);
            break;
          }
          case 'needle': {
            // Vinyl dust click — a single 1-sample impulse at random intervals
            // (one click every ~500–600 ms). Sparse and continuous, like a
            // stylus catching dust in a record groove. Not tied to `frequency`.
            this.needleTimer += dt;
            if (this.needleTimer >= this.needleNext) {
              const amp = 0.7 + Math.random() * 0.3;
              sL = (Math.random() < 0.5 ? -1 : 1) * amp;
              if (stereo && p.decorrelated) sR = (Math.random() < 0.5 ? -1 : 1) * amp;
              this.needleTimer = 0;
              this.needleNext = 0.5 + Math.random() * 0.2;
            }
            break;
          }
          case 'impulse': {
            if (this.impulsePending) { sL = 1; this.impulsePending = false; }
            break;
          }
          case 'sweep': sL = Math.sin(2 * Math.PI * this.sweepPhase); break;
          default: break;
        }
        if (sR === null) sR = sL;
        if (!stereo) sR = sL;
        sL += p.dcOffset; sR += p.dcOffset;
        sL *= lvl * invL; sR *= lvl * invR;
        if (sL > 1) sL = 1; else if (sL < -1) sL = -1;   // true-peak-safe clamp
        if (sR > 1) sR = 1; else if (sR < -1) sR = -1;
      }
      L[i] = sL; R[i] = sR;
      this.peakL = Math.max(this.peakL * 0.999, Math.abs(sL));
      this.peakR = Math.max(this.peakR * 0.999, Math.abs(sR));
      this.sumL += sL * sL; this.sumR += sR * sR; this.cnt++;
      // phase advance
      if (p.type === 'sweep') {
        this.sweepElapsed += dt;
        if (this.sweepElapsed >= p.sweepDuration) this.sweepElapsed = 0;
        const u = p.sweepDuration > 0 ? this.sweepElapsed / p.sweepDuration : 0;
        const f = p.sweepRate === 'log'
          ? p.sweepStart * Math.pow(p.sweepEnd / p.sweepStart, u)
          : p.sweepStart + (p.sweepEnd - p.sweepStart) * u;
        this.sweepPhase += f / sr;
        if (this.sweepPhase >= 1) this.sweepPhase -= Math.floor(this.sweepPhase);
      } else if (p.type === 'needle' || p.type === 'impulse' || p.type === 'white' || p.type === 'pink') {
        // no continuous phase (random / triggered generators)
      } else {
        this.phase += p.frequency / sr;
        if (this.phase >= 1) this.phase -= 1;
      }
    }
    // meter report ~ every 30 ms
    this.mTimer += n;
    if (this.mTimer >= sr * 0.03) {
      this.mTimer = 0;
      const rmsL = this.cnt > 0 ? Math.sqrt(this.sumL / this.cnt) : 0;
      const rmsR = this.cnt > 0 ? Math.sqrt(this.sumR / this.cnt) : 0;
      this.port.postMessage({ meters: {
        peakL: 20 * Math.log10(this.peakL || 1e-10),
        peakR: 20 * Math.log10(this.peakR || 1e-10),
        rmsL: 20 * Math.log10(rmsL || 1e-10),
        rmsR: 20 * Math.log10(rmsR || 1e-10),
      }});
      this.sumL = 0; this.sumR = 0; this.cnt = 0;
    }
    return true;
  }
}
registerProcessor('signal-utility-processor', SignalUtilityProcessor);