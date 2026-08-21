/**
 * Analog Tape Machine — 2-track tape simulation.
 * State consumed by SignalChain.updateTape and the TapeMachinePanel UI.
 *
 * DSP stages (SignalChain._buildModules / updateTape):
 *   input → inputGain → delay(wow/flutter LFO pitch wobble) → hysteresis(allpass)
 *         → preGain → saturation shaper (tanh, bias softens) → head-loss lowpass
 *         → head-bump lowshelf → outputGain → wet
 *   pink hiss noise → bandpass → noiseGain → wet
 *
 * Tape speed (ips) scales HF bandwidth, head bump and wow/flutter rate.
 */
export const TAPE_PRESETS = {
  studera800:  { label: 'Studer A800',   speed: 15,  drive: 0.40, saturation: 0.50, bias: 0.55, hysteresis: 0.25, wow: 0.15, flutter: 0.08, noise: 0.08, headBump: 0.25, hfLoss: 0.30 },
  ampexatr102: { label: 'Ampex ATR-102',  speed: 15,  drive: 0.30, saturation: 0.40, bias: 0.60, hysteresis: 0.20, wow: 0.10, flutter: 0.06, noise: 0.06, headBump: 0.15, hfLoss: 0.25 },
  studera810:  { label: 'Studer A810',    speed: 7.5, drive: 0.50, saturation: 0.60, bias: 0.45, hysteresis: 0.35, wow: 0.25, flutter: 0.12, noise: 0.12, headBump: 0.35, hfLoss: 0.50 },
  otarimtr90:  { label: 'Otari MTR-90',   speed: 15,  drive: 0.50, saturation: 0.55, bias: 0.50, hysteresis: 0.30, wow: 0.20, flutter: 0.10, noise: 0.10, headBump: 0.30, hfLoss: 0.35 },
  mmm79:       { label: '3M M79',          speed: 15,  drive: 0.45, saturation: 0.50, bias: 0.50, hysteresis: 0.30, wow: 0.22, flutter: 0.11, noise: 0.11, headBump: 0.28, hfLoss: 0.40 },
  nagraivs:    { label: 'Nagra IV-S',      speed: 7.5, drive: 0.55, saturation: 0.65, bias: 0.40, hysteresis: 0.40, wow: 0.30, flutter: 0.15, noise: 0.15, headBump: 0.40, hfLoss: 0.55 },
  tascammsr:   { label: 'Tascam MSR-16',  speed: 7.5, drive: 0.70, saturation: 0.75, bias: 0.30, hysteresis: 0.50, wow: 0.35, flutter: 0.20, noise: 0.20, headBump: 0.45, hfLoss: 0.70 },
  studera800_30: { label: 'Studer A800 (30 ips)', speed: 30, drive: 0.35, saturation: 0.45, bias: 0.60, hysteresis: 0.18, wow: 0.10, flutter: 0.05, noise: 0.06, headBump: 0.18, hfLoss: 0.18 },
};

export const DEFAULT_TAPE = {
  enabled: false,
  preset: 'studera800',
  speed: 15,            // 7.5 | 15 | 30 ips
  inputGain: 0,         // dB
  drive: 0.40,          // 0..1  saturation amount
  saturation: 0.50,     // 0..1  transfer-curve depth
  bias: 0.55,           // 0..1  HF bias (softens the curve → cleaner low levels)
  hysteresis: 0.25,     // 0..1  frequency-dependent phase distortion (allpass)
  wow: 0.15,            // 0..1  slow pitch drift (LFO-modulated delay)
  flutter: 0.08,        // 0..1  fast pitch wobble
  noise: 0.08,          // 0..1  tape hiss
  headBump: 0.25,       // 0..1  low-frequency head resonance boost
  hfLoss: 0.30,         // 0..1  high-frequency tape loss
  mix: 0.5,            // 0..1  wet/dry
  outputGain: 0,        // dB
};

export function defaultTape() {
  return { ...DEFAULT_TAPE };
}

/** Merge a preset's DSP values into the current state (keeps enabled/mix/gains). */
export function applyTapePreset(state, key) {
  const p = TAPE_PRESETS[key];
  if (!p) return state;
  const { label, ...vals } = p;
  return { ...state, preset: key, ...vals };
}