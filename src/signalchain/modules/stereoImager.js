import { makeInsert } from './moduleUtils.js';

// Stereo Imager / Direction Mixer.
//   Input (LR or MS-decode) → M/S encode → Spread (two-band width split at the
//   Crossover) → M/S decode → Direction rotation → output.
// Defaults (width 1, direction 0, split off) = identity, so the panel is
// full-wet with no audible change until a control is moved.
export function buildStereoImager(ctx) {
  const im = makeInsert(ctx);
  // dry/wet mix handled in update() (parallel widening). Default mix = 100%.

  // Input stage — decode an encoded MS input to LR when inputMs is on.
  // LR: L_out=L, R_out=R.  MS: L_out=M+S=L+R, R_out=M−S=L−R.
  const imInSplit = ctx.createChannelSplitter(2);
  const imInDecLL = ctx.createGain(); imInDecLL.gain.value = 1;
  const imInDecLR = ctx.createGain(); imInDecLR.gain.value = 0;
  const imInDecRL = ctx.createGain(); imInDecRL.gain.value = 0;
  const imInDecRR = ctx.createGain(); imInDecRR.gain.value = 1;
  const imInMerger = ctx.createChannelMerger(2);
  im.input.connect(imInSplit);
  imInSplit.connect(imInDecLL, 0); imInDecLL.connect(imInMerger, 0, 0);
  imInSplit.connect(imInDecLR, 1); imInDecLR.connect(imInMerger, 0, 0);
  imInSplit.connect(imInDecRL, 0); imInDecRL.connect(imInMerger, 0, 1);
  imInSplit.connect(imInDecRR, 1); imInDecRR.connect(imInMerger, 0, 1);

  // Encode L/R → M/S:  M = (L+R)/2, S = (L−R)/2
  const imSplitter = ctx.createChannelSplitter(2);
  const imML = ctx.createGain(); imML.gain.value = 0.5;
  const imMR = ctx.createGain(); imMR.gain.value = 0.5;
  const imSL = ctx.createGain(); imSL.gain.value = 0.5;
  const imSR = ctx.createGain(); imSR.gain.value = -0.5;
  const imMidSum = ctx.createGain(); imMidSum.gain.value = 1;
  const imSideSum = ctx.createGain(); imSideSum.gain.value = 1;
  imInMerger.connect(imSplitter);
  imSplitter.connect(imML, 0); imML.connect(imMidSum);
  imSplitter.connect(imMR, 1); imMR.connect(imMidSum);
  imSplitter.connect(imSL, 0); imSL.connect(imSideSum);
  imSplitter.connect(imSR, 1); imSR.connect(imSideSum);

  // Spread — two-band width split at the Crossover (Linkwitz-Riley LR2, Q=0.5,
  // so the LP+HP side sum is flat when both widths are equal). Split OFF uses
  // a single full-band width path; the per-band paths are gain-muted.
  const imSplitLP = ctx.createBiquadFilter(); imSplitLP.type = 'lowpass';
  imSplitLP.frequency.value = 200; imSplitLP.Q.value = 0.5;
  const imSplitHP = ctx.createBiquadFilter(); imSplitHP.type = 'highpass';
  imSplitHP.frequency.value = 200; imSplitHP.Q.value = 0.5;
  const imWidthLo = ctx.createGain(); imWidthLo.gain.value = 0;
  const imWidthHi = ctx.createGain(); imWidthHi.gain.value = 0;
  const imWidthSingle = ctx.createGain(); imWidthSingle.gain.value = 1;
  const imSideOut = ctx.createGain(); imSideOut.gain.value = 1;
  imSideSum.connect(imSplitLP); imSplitLP.connect(imWidthLo);
  imSideSum.connect(imSplitHP); imSplitHP.connect(imWidthHi);
  imSideSum.connect(imWidthSingle);
  imWidthLo.connect(imSideOut);
  imWidthHi.connect(imSideOut);
  imWidthSingle.connect(imSideOut);

  // Decode M/S → L/R:  L = M + S, R = M − S
  const imMerger = ctx.createChannelMerger(2);
  const imDecML = ctx.createGain(); imDecML.gain.value = 1;
  const imDecMR = ctx.createGain(); imDecMR.gain.value = 1;
  const imDecSL = ctx.createGain(); imDecSL.gain.value = 1;
  const imDecSR = ctx.createGain(); imDecSR.gain.value = -1;
  imMidSum.connect(imDecML); imDecML.connect(imMerger, 0, 0);
  imMidSum.connect(imDecMR); imDecMR.connect(imMerger, 0, 1);
  imSideOut.connect(imDecSL); imDecSL.connect(imMerger, 0, 0);
  imSideOut.connect(imDecSR); imDecSR.connect(imMerger, 0, 1);

  // Direction — rotate the (L,R) stereo image by θ.
  //   L' = cosθ·L − sinθ·R,  R' = sinθ·L + cosθ·R   (θ=0 → identity)
  const imRotSplit = ctx.createChannelSplitter(2);
  const imRotLL = ctx.createGain(); imRotLL.gain.value = 1;
  const imRotLR = ctx.createGain(); imRotLR.gain.value = 0;
  const imRotRL = ctx.createGain(); imRotRL.gain.value = 0;
  const imRotRR = ctx.createGain(); imRotRR.gain.value = 1;
  const imRotMerger = ctx.createChannelMerger(2);
  imMerger.connect(imRotSplit);
  imRotSplit.connect(imRotLL, 0); imRotLL.connect(imRotMerger, 0, 0);
  imRotSplit.connect(imRotLR, 1); imRotLR.connect(imRotMerger, 0, 0);
  imRotSplit.connect(imRotRL, 0); imRotRL.connect(imRotMerger, 0, 1);
  imRotSplit.connect(imRotRR, 1); imRotRR.connect(imRotMerger, 0, 1);
  imRotMerger.connect(im.wet);
  return {
    input: im.input,
    output: im.output,
    update(state = {}) {
      const now = ctx.currentTime;
      const enabled = !!state.enabled;
      const width = Math.max(0, Math.min(3, state.width ?? 1));      // linked spread-high
      const direction = Math.max(-180, Math.min(180, state.direction ?? 0));
      const split = !!state.split;
      const crossover = Math.max(20, Math.min(2000, state.crossover ?? 200));
      const spreadLo = Math.max(0, Math.min(3, state.spreadLo ?? 0));
      const inputMs = !!state.inputMs;

      // Input decode: LR pass-through vs MS→LR (L=M+S, R=M−S).
      imInDecLL.gain.setValueAtTime(1, now);
      imInDecLR.gain.setValueAtTime(inputMs ? 1 : 0, now);
      imInDecRL.gain.setValueAtTime(inputMs ? 1 : 0, now);
      imInDecRR.gain.setValueAtTime(inputMs ? -1 : 1, now);

      // Spread two-band width. Disabled → unity single path. Split OFF → one
      // full-band width. Split ON → low band × spreadLo, high band × width.
      imSplitLP.frequency.setValueAtTime(crossover, now);
      imSplitHP.frequency.setValueAtTime(crossover, now);
      if (!enabled) {
        imWidthSingle.gain.setValueAtTime(1, now);
        imWidthLo.gain.setValueAtTime(0, now);
        imWidthHi.gain.setValueAtTime(0, now);
      } else if (split) {
        imWidthSingle.gain.setValueAtTime(0, now);
        imWidthLo.gain.setValueAtTime(spreadLo, now);
        imWidthHi.gain.setValueAtTime(width, now);
      } else {
        imWidthSingle.gain.setValueAtTime(width, now);
        imWidthLo.gain.setValueAtTime(0, now);
        imWidthHi.gain.setValueAtTime(0, now);
      }

      // Direction rotation (θ=0 → identity; disabled forces θ=0).
      const th = (enabled ? direction : 0) * Math.PI / 180;
      const c = Math.cos(th), s = Math.sin(th);
      imRotLL.gain.setValueAtTime(c, now);
      imRotLR.gain.setValueAtTime(-s, now);
      imRotRL.gain.setValueAtTime(s, now);
      imRotRR.gain.setValueAtTime(c, now);
      // Per-module MIX (parallel widening): dry = 1−mix, wet = mix. Disabled → dry.
      const mix = Math.max(0, Math.min(1, (state.mix ?? 100) / 100));
      im.dry.gain.setValueAtTime(enabled ? (1 - mix) : 1, now);
      im.wet.gain.setValueAtTime(enabled ? mix : 0, now);
    },
  };
}