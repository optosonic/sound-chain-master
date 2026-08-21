import { CHAR_ENUM, CHARACTER_DRIVE } from './compressorModel.js';

/**
 * Create a per-character compressor node.
 *
 * When the AudioWorklet module has been registered on the context
 * (ctx.__characterCompressorReady, set by the engine after addModule), this
 * returns an AudioWorkletNode running the true per-circuit DSP (feed-forward /
 * feedback detector, program-dependent ratio + release, subtle harmonic
 * colour). Otherwise it falls back to the stock DynamicsCompressorNode so the
 * app keeps working (Digital character, no colour).
 *
 * The returned node exposes:
 *   - connect / disconnect  (standard AudioNode — the worklet IS the node)
 *   - reduction             (gain reduction in dB; the worklet reports via port)
 *   - setParams(state)      (maps compressor state → AudioParams)
 */
export function createCharacterCompressor(ctx, opts = {}) {
  const stereo = opts.channels !== 1;

  if (ctx.__characterCompressorReady) {
    const node = new AudioWorkletNode(ctx, 'character-compressor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: stereo ? 2 : 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      parameterData: { enabled: 0 },
    });
    let gr = 0;
    Object.defineProperty(node, 'reduction', { get: () => gr, configurable: true });
    node.port.onmessage = (e) => {
      if (e && e.data && e.data.type === 'gr') gr = e.data.value;
    };
    node.setParams = (p) => setWorkletParams(node, p);
    return node;
  }

  // Fallback — stock compressor (Digital character, no colour).
  const node = ctx.createDynamicsCompressor();
  node.setParams = (p) => setStockParams(node, p);
  return node;
}

function setWorkletParams(node, p) {
  const t = node.context ? node.context.currentTime : 0;
  const set = (name, v) => {
    const param = node.parameters.get(name);
    if (param) param.setValueAtTime(v, t);
  };
  set('threshold', p.threshold ?? -24);
  set('ratio', p.ratio ?? 4);
  set('knee', p.knee ?? 30);
  set('attack', p.attack ?? 0.003);
  set('release', p.release ?? 0.25);
  set('character', CHAR_ENUM[p.type] ?? 0);
  set('drive', CHARACTER_DRIVE[p.type] ?? 0);
  set('model', p.model ?? 1);
  set('link', p.link ?? 1);
  set('enabled', p.enabled ? 1 : 0);
}

function setStockParams(node, p) {
  const t = node.context ? node.context.currentTime : 0;
  node.threshold.setValueAtTime(p.enabled ? (p.threshold ?? -24) : 0, t);
  node.ratio.setValueAtTime(p.ratio ?? 4, t);
  node.knee.setValueAtTime(p.knee ?? 30, t);
  node.attack.setValueAtTime(p.attack ?? 0.003, t);
  node.release.setValueAtTime(p.release ?? 0.25, t);
}