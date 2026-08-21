/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentTime, currentFrame */
// Per-character compressor AudioWorkletProcessor.
//
// True per-circuit DSP models — not knob presets on a stock node:
//   0 Digital      feed-forward, peak detector, exact ratio, no colour
//   1 VCA          feed-forward, RMS detector, linear gain cell, no colour
//   2 FET (1176)   peak detector, program-dependent ratio (rises to 20:1 over
//                  +10 dB), hard knee, subtle odd-order harmonic colour
//   3 Opto (LA-2A) RMS detector, no fixed ratio (smooth compressive curve),
//                  very soft knee, program-dependent release (lengthens as GR
//                  deepens), tube output-stage even-harmonic colour
//   4 VFET/Var-mu  FEEDBACK topology (detector reads the output), tube gain
//                  element with a soft nonlinear transfer, warm saturation,
//                  no hard knee
//
// Self-contained: no ES imports — runs in AudioWorkletGlobalScope where
// `registerProcessor`, `AudioWorkletProcessor`, `sampleRate`, `currentTime`
// are globals. The gain-computer logic mirrors compressorModel.js.

var CHAR_DIGITAL = 0;
var CHAR_VCA = 1;
var CHAR_FET = 2;
var CHAR_OPTO = 3;
var CHAR_VFET = 4;

function effectiveRatio(overDb, ratio, character) {
  if (overDb <= 0) return ratio;
  if (character === CHAR_FET) {
    var t = Math.min(1, overDb / 10);
    return ratio + t * (20 - ratio);
  }
  if (character === CHAR_OPTO) {
    var t2 = overDb / 10;
    return Math.min(20, ratio * (0.5 + 0.5 * t2) + t2 * t2 * (20 - ratio));
  }
  return ratio;
}

function characterKnee(knee, character) {
  if (character === CHAR_FET) return 0;
  if (character === CHAR_OPTO) return Math.max(knee, 24);
  if (character === CHAR_VFET) return Math.max(knee, 12);
  return knee;
}

function gainReductionDb(detDb, T, R, knee, character) {
  var kW = characterKnee(knee, character);
  var halfW = kW / 2;
  var overDb = detDb - T;
  if (overDb <= -halfW) return 0;
  var effR = Math.max(1, effectiveRatio(Math.max(0, overDb), R, character));
  if (overDb >= halfW) {
    return overDb * (1 - 1 / effR);
  }
  if (kW > 0) {
    var xx = overDb + halfW;
    return (1 - 1 / effR) * (xx * xx) / (2 * kW);
  }
  return overDb > 0 ? overDb * (1 - 1 / effR) : 0;
}

// Subtle per-character coloration: a gentle blend of clean + a character
// waveshaper. Drive stays low so the colour is a tint (FET ~0.3–1% THD under
// heavy GR, Opto/VFET ~1–3%); Digital / VCA are clean.
function colorize(x, character, drive) {
  if (character === CHAR_DIGITAL || character === CHAR_VCA || drive <= 0) return x;
  var k = 1 + drive * 2;
  if (character === CHAR_FET) {
    // subtle odd-order harmonics (tanh), low blend
    var w = drive * 0.3;
    return (1 - w) * x + w * Math.tanh(k * x);
  }
  // opto / vfet: tube output stage — warm even + odd harmonics
  var tube = Math.tanh(k * x) * 0.9 + 0.04 * x + 0.02 * x * x * (x < 0 ? -1 : 1);
  var ww = character === CHAR_VFET ? drive * 0.4 : drive * 0.3;
  return (1 - ww) * x + ww * tube;
}

class CharacterCompressor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -24, minValue: -60, maxValue: 0, automationRate: 'k-rate' },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'knee', defaultValue: 30, minValue: 0, maxValue: 40, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.003, minValue: 0.0001, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.25, minValue: 0.001, maxValue: 5, automationRate: 'k-rate' },
      { name: 'character', defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'drive', defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'model', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'link', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this._gainDb = 0;        // smoothed gain (dB)
    this._rmsWindow = 0;     // one-pole RMS detector state
    this._gr = 0;             // current gain reduction (dB, +ve = reduction)
    this._lastPost = 0;       // last GR post time
    this._prevOut = [0, 0];   // previous output samples (feedback detector)
  }

  process(inputs, outputs, params) {
    var input = inputs[0];
    var output = outputs[0];
    if (!input || input.length === 0) return true;
    var ch = input.length;
    var sr = sampleRate;
    var T = params.threshold[0];
    var R = params.ratio[0];
    var knee = params.knee[0];
    var atk = params.attack[0];
    var rel = params.release[0];
    var character = Math.round(params.character[0]);
    var drive = params.drive[0];
    var model = Math.max(0, params.model[0]);
    var link = params.link[0];
    var enabled = params.enabled[0] >= 0.5;

    var atkCoef = 1 - Math.exp(-1 / (Math.max(0.0001, atk) * sr));
    var baseRelCoef = 1 - Math.exp(-1 / (Math.max(0.0001, rel) * sr));
    var isFeedback = character === CHAR_VFET;
    var useRms = character === CHAR_VCA || character === CHAR_OPTO;
    var rmsAlpha = useRms ? (1 - Math.exp(-1 / (0.005 * sr))) : 0;
    // Model amount blends every character-specific behaviour toward the clean
    // Digital reference (feed-forward peak detector, fixed ratio, dialed knee,
    // no colour, fixed release). 0 = pure Digital, 1 = full character.
    var fbAmount = isFeedback ? model : 0;
    var rmsAmount = useRms ? model : 0;

    var blockLen = input[0].length;
    for (var i = 0; i < blockLen; i++) {
      // Detector source — feed-forward reads the input, feedback reads the
      // previous output (VFET). Blended by `model` so 0 = feed-forward.
      var inAbs = 0;
      for (var c = 0; c < ch; c++) {
        var iv = Math.abs(input[c][i]);
        if (iv > inAbs) inAbs = iv;
      }
      var detLin;
      if (fbAmount > 0) {
        var prevAbs = 0;
        for (var c2 = 0; c2 < ch; c2++) {
          var pv = Math.abs(this._prevOut[c2] || 0);
          if (pv > prevAbs) prevAbs = pv;
        }
        detLin = (1 - fbAmount) * inAbs + fbAmount * prevAbs;
      } else {
        detLin = inAbs;
      }

      // RMS detector (VCA / Opto) blended toward peak by `model`.
      if (rmsAmount > 0) {
        this._rmsWindow = (1 - rmsAlpha) * this._rmsWindow + rmsAlpha * (detLin * detLin);
        var rmsLin = Math.sqrt(Math.max(0, this._rmsWindow));
        detLin = (1 - rmsAmount) * detLin + rmsAmount * rmsLin;
      } else {
        this._rmsWindow = 0;
      }

      var detDb = detLin > 1e-6 ? 20 * Math.log10(detLin) : -120;
      // Gain computer: blend Digital (fixed ratio, dialed knee) ↔ full character.
      var grDig = gainReductionDb(detDb, T, R, knee, CHAR_DIGITAL);
      var grChar = gainReductionDb(detDb, T, R, knee, character);
      var gr = enabled ? grDig * (1 - model) + grChar * model : 0;

      // Program-dependent release (Opto) blended toward fixed release by `model`.
      var relCoef = baseRelCoef;
      if (enabled && character === CHAR_OPTO) {
        var baseMs = Math.max(60, rel * 1000);
        var progMs = Math.min(8000, baseMs * (1 + gr * 4));
        var effMs = (1 - model) * baseMs + model * progMs;
        relCoef = 1 - Math.exp(-1 / (Math.max(0.001, effMs / 1000) * sr));
      }

      // Gain ballistics: attack when gain is reducing, release when recovering.
      var targetGainDb = -gr;
      if (targetGainDb < this._gainDb) {
        this._gainDb += (targetGainDb - this._gainDb) * atkCoef;
      } else {
        this._gainDb += (targetGainDb - this._gainDb) * relCoef;
      }
      var gainLin = enabled ? Math.pow(10, this._gainDb / 20) : 1;

      for (var cc = 0; cc < ch; cc++) {
        var s = input[cc][i] * gainLin;
        // Colour scales with `model`. 0–1 blends linearly (subtle tint); past 1
        // (up to 2) the drive ramps quadratically so the waveshaper bends
        // progressively harder — pushing the character model forward into
        // real harmonic grit/distortion, not just a louder version of itself.
        if (enabled && model > 0) {
          var colourDrive = drive * (model <= 1 ? model : model * model);
          s = colorize(s, character, colourDrive);
        }
        output[cc][i] = s;
        if (isFeedback) this._prevOut[cc] = s;
      }
      this._gr = gr;
    }

    // Report GR to the main thread ~20×/s for the meter.
    var now = currentTime;
    if (now - this._lastPost > 0.05) {
      this._lastPost = now;
      this.port.postMessage({ type: 'gr', value: enabled ? this._gr : 0 });
    }
    return true;
  }
}

registerProcessor('character-compressor', CharacterCompressor);