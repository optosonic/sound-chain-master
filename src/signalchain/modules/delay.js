import { makeInsert, fadeGain } from './moduleUtils.js';

// Delay — dual-tap crossfading delay line (click-free time changes).
// A single shared circular buffer with two read taps; changing the delay time
// crossfades from the old tap to the new one (see delayXfadeWorklet.js) so the
// read position jumps on a SILENT tap — no Doppler, no click. Falls back to a
// native DelayNode if the worklet failed to load.
export function buildDelay(ctx) {
  const del = makeInsert(ctx);
  let delayWorklet = null, delayTimeParam = null, delayFeedbackParam = null, delayXfadeParam = null;
  let delayNode = null, delayFeedback = null;
  if (ctx.__delayXfadeReady) {
    delayWorklet = new AudioWorkletNode(ctx, 'delay-xfade', {
      numberOfInputs: 1, numberOfOutputs: 1,
      channelCount: 2, channelCountMode: 'max', outputChannelCount: [2],
    });
    delayTimeParam = delayWorklet.parameters.get('delayTime');
    delayFeedbackParam = delayWorklet.parameters.get('feedback');
    delayXfadeParam = delayWorklet.parameters.get('xfadeMs');
    delayTimeParam.value = 0.15;
    delayFeedbackParam.value = 0.3;
    delayXfadeParam.value = 15;
    del.input.connect(del.dry);
    del.input.connect(delayWorklet);
    delayWorklet.connect(del.wet);
  } else {
    delayNode = ctx.createDelay(4);
    delayNode.delayTime.value = 0.15;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3;
    del.input.connect(del.dry);
    del.input.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(del.wet);
  }
  let _enabled = false;
  return {
    input: del.input,
    output: del.output,
    update(delayState, bpm) {
      const now = ctx.currentTime;
      if (!delayState) return;
      if (delayState.syncNote !== undefined && bpm) {
        const beatDuration = 60 / bpm;
        const noteValues = [
          { value: 0, duration: beatDuration * 0.25 },
          { value: 1, duration: beatDuration * 0.375 },
          { value: 2, duration: beatDuration * 0.5 },
          { value: 3, duration: beatDuration * 0.75 },
          { value: 4, duration: beatDuration * 1.0 },
          { value: 5, duration: beatDuration * 1.5 },
        ];
        const syncedDelay = noteValues.find((n) => n.value === delayState.syncNote);
        if (syncedDelay) delayState.time = syncedDelay.duration;
      }
      if (delayWorklet) {
        // Abrupt setValueAtTime on delayTime — the worklet detects the step and
        // crossfades to a silent tap (no Doppler). Feedback is smoothed inside
        // the worklet; we still set the target here (ramped to avoid zipper).
        delayTimeParam.setValueAtTime(delayState.time || 0.15, now);
        delayFeedbackParam.setTargetAtTime(delayState.feedback ?? 0.3, now, 0.02);
        if (delayState.xfadeMs != null) delayXfadeParam.setValueAtTime(delayState.xfadeMs, now);
      } else {
        delayNode.delayTime.setValueAtTime(delayState.time || 0.15, now);
        delayFeedback.gain.setValueAtTime(delayState.feedback || 0.3, now);
      }
      const dOn = !!delayState.enabled;
      const ramp = _enabled !== dOn; _enabled = dOn;
      const mix = dOn ? delayState.mix || 0.2 : 0;
      fadeGain(del.wet, mix, now, ramp);
      del.dry.gain.setValueAtTime(1, now);
    },
  };
}