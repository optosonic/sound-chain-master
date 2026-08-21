// Factory presets for the Signal Utility / Test Oscillator.
// Calibration tones use the standard mastering reference levels (-18 / -20 dBFS).
export const SIGNAL_UTILITY_PRESETS = [
  { name: '1 kHz Sine −12 dB', state: { type: 'sine', frequency: 1000, level: -12, antiAliased: true } },
  { name: '1 kHz Sine −18 dBFS', state: { type: 'sine', frequency: 1000, level: -18, antiAliased: true } },
  { name: '1 kHz Sine −20 dBFS', state: { type: 'sine', frequency: 1000, level: -20, antiAliased: true } },
  { name: 'Pink −18 dB (stereo)', state: { type: 'pink', level: -18, decorrelated: true, stereo: true } },
  { name: 'White −12 dB (stereo)', state: { type: 'white', level: -12, decorrelated: true, stereo: true } },
  { name: 'Needle Pulse 4 Hz', state: { type: 'needle', frequency: 4, level: -6, antiAliased: false } },
  { name: 'Sweep 20→20 kHz Log 4s', state: { type: 'sweep', sweepStart: 20, sweepEnd: 20000, sweepDuration: 4, sweepRate: 'log', level: -12 } },
  { name: 'Sweep 20→20 kHz Lin 8s', state: { type: 'sweep', sweepStart: 20, sweepEnd: 20000, sweepDuration: 8, sweepRate: 'linear', level: -12 } },
  { name: 'Square 100 Hz −12 dB', state: { type: 'square', frequency: 100, level: -12, duty: 0.5, antiAliased: true } },
  { name: 'Saw 220 Hz −12 dB', state: { type: 'saw', frequency: 220, level: -12, antiAliased: true } },
  { name: 'Triangle 440 Hz −12 dB', state: { type: 'triangle', frequency: 440, level: -12, antiAliased: true } },
];