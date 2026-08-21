// Signal Utility controller — owns the AudioWorkletNode, converts the panel's
// dB level to linear gain, posts state to the worklet, and exposes live meters.
// Created by the engine and connected into the chain input so the oscillator
// feeds the full signal path (input trim → FX bus → limiter → output).

export const DEFAULT_SIGNAL_UTILITY = {
  enabled: false,
  type: 'sine',
  frequency: 1000,
  level: -20,          // dB (safe default — test tones are startling at higher levels)
  duty: 0.5,
  antiAliased: true,
  decorrelated: false,
  stereo: true,
  invert: 'none',
  dcOffset: 0,
  dim: false,
  sweepStart: 20,
  sweepEnd: 20000,
  sweepDuration: 4,
  sweepRate: 'log',
};

export function createSignalUtility(ctx, destination) {
  if (!ctx || !ctx.__signalUtilityReady) return null;
  let node;
  try {
    node = new AudioWorkletNode(ctx, 'signal-utility-processor', { numberOfOutputs: 1, outputChannelCount: [2] });
  } catch (e) {
    console.warn('[SignalUtility] worklet node creation failed', e);
    return null;
  }
  const out = ctx.createGain();
  out.gain.value = 1;
  node.connect(out);
  out.connect(destination);

  let meters = { peakL: -100, peakR: -100, rmsL: -100, rmsR: -100 };
  node.port.onmessage = (e) => { if (e.data && e.data.meters) meters = e.data.meters; };

  let state = { ...DEFAULT_SIGNAL_UTILITY };
  const send = () => {
    const lin = Math.pow(10, state.level / 20);
    node.port.postMessage({ ...state, level: lin });
  };
  send();

  return {
    update: (next) => { if (!next) return; state = { ...state, ...next }; send(); },
    getMeters: () => meters,
    trigger: () => { try { node.port.postMessage({ trigger: true }); } catch {} },
    dispose: () => { try { node.disconnect(); } catch {} try { out.disconnect(); } catch {} },
    getState: () => state,
  };
}