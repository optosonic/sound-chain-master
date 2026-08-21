import { makeInsert, fadeGain, createSatCurve, identityCurve } from './moduleUtils.js';

// Dynamic EQ — per-band dynamic compression in the EQ zones (de-esser).
// Architecture per channel:
//   output_ch = dry_ch + Σ ( posGain·sat(comp(band_ch)) − compIdle(band_ch) ).
// Flat when idle; each band's loud content is ducked by its compressor.
// Stereo mode: one band tree on the linked stereo signal.
// M/S mode: encode L/R→M/S, run independent Mid & Side band trees, decode.
// Exposes `bands` (low/mids/high × stereo/mid/side) for the engine `dynNodes` memo.
export function buildDynamicEQ(ctx) {
  const dynMod = makeInsert(ctx);
  dynMod.dry.gain.value = 1;   // stereo dry (= input); set to 0 in M/S mode
  dynMod.wet.gain.value = 0;
  // Stereo band sum + its output level (muted in M/S mode).
  const dynSum = ctx.createGain(); dynSum.gain.value = 1;
  const dynStereoOut = ctx.createGain(); dynStereoOut.gain.value = 1;
  dynSum.connect(dynStereoOut);
  dynStereoOut.connect(dynMod.output);

  // M/S encode: M = (L+R)/2, S = (L−R)/2.
  const dynMSSplit = ctx.createChannelSplitter(2);
  const dynMidEncL = ctx.createGain(); dynMidEncL.gain.value = 0.5;
  const dynMidEncR = ctx.createGain(); dynMidEncR.gain.value = 0.5;
  const dynSideEncL = ctx.createGain(); dynSideEncL.gain.value = 0.5;
  const dynSideEncR = ctx.createGain(); dynSideEncR.gain.value = -0.5;
  const dynMidSrc = ctx.createGain(); dynMidSrc.gain.value = 1;
  const dynSideSrc = ctx.createGain(); dynSideSrc.gain.value = 1;
  dynMod.input.connect(dynMSSplit);
  dynMSSplit.connect(dynMidEncL, 0); dynMidEncL.connect(dynMidSrc);
  dynMSSplit.connect(dynMidEncR, 1); dynMidEncR.connect(dynMidSrc);
  dynMSSplit.connect(dynSideEncL, 0); dynSideEncL.connect(dynSideSrc);
  dynMSSplit.connect(dynSideEncR, 1); dynSideEncR.connect(dynSideSrc);

  // Per-channel band sums (mono). Dry is tapped from the encoded source so
  // output_ch = dry_ch + Σ band terms, matching the stereo de-esser.
  const dynSumMid = ctx.createGain(); dynSumMid.gain.value = 1;
  const dynSumSide = ctx.createGain(); dynSumSide.gain.value = 1;
  dynMidSrc.connect(dynSumMid);
  dynSideSrc.connect(dynSumSide);

  const mkDynBand = (src, sum) => {
    const splitter = ctx.createBiquadFilter();
    splitter.type = 'bandpass'; splitter.frequency.value = 1000; splitter.Q.value = 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 0; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.2;
    // Unity-reference compressor: identical node type/lookahead to `comp`, but
    // ratio 1 + threshold 0 so it passes the band with unity gain and the SAME
    // processing delay. Routing the negGain (raw-band) path through it makes
    // `posGain·satShaper(comp(band))` and `negGain·band` sample-aligned —
    // without this the subtractive de-esser never cancels cleanly (the raw
    // band bypasses the compressor's lookahead delay) and leaves a
    // comb-filter residue that reads as distortion + low-frequency rumble.
    const compIdle = ctx.createDynamicsCompressor();
    compIdle.threshold.value = 0; compIdle.knee.value = 0; compIdle.ratio.value = 1;
    compIdle.attack.value = 0.003; compIdle.release.value = 0.25;
    // Per-band saturator: sits in the compressed (positive) path so that
    //   output = dry + Σ [ posGain · satShaper(comp(band)) − compIdle(band) ].
    const satDrive = ctx.createGain(); satDrive.gain.value = 1;
    const satShaper = ctx.createWaveShaper();
    satShaper.oversample = '4x';
    satShaper.channelCount = 2;
    satShaper.channelCountMode = 'explicit';
    satShaper.channelInterpretation = 'speakers';
    satShaper.curve = identityCurve();
    // Two selectable paths from the compressor to posGain:
    //   • dryPath  — comp → dryPath → posGain            (saturation OFF, shaper bypassed)
    //   • satPath  — comp → satDrive → satShaper → satPath → posGain (saturation ON)
    // The WaveShaper hard-clamps any sample outside ±1.0 to the curve's
    // endpoints. With an identity curve that means a hot band (a high-Q
    // bandpass can push peaks above 1.0 even from a 0 dBFS source) gets
    // hard-clipped — audible distortion even though "saturation is off".
    // Bypassing the shaper node entirely (dryPath) when saturation is off
    // removes the clamp; the compressor handles hot bands gracefully.
    const satPath = ctx.createGain(); satPath.gain.value = 0;
    const dryPath = ctx.createGain(); dryPath.gain.value = 1;
    const posGain = ctx.createGain(); posGain.gain.value = 1;
    const negGain = ctx.createGain(); negGain.gain.value = -1;
    src.connect(splitter);
    splitter.connect(comp);
    comp.connect(satDrive); satDrive.connect(satShaper); satShaper.connect(satPath); satPath.connect(posGain);
    comp.connect(dryPath); dryPath.connect(posGain);
    posGain.connect(sum);
    splitter.connect(compIdle); compIdle.connect(negGain); negGain.connect(sum);
    return { splitter, comp, compIdle, posGain, negGain, satDrive, satShaper, satPath, dryPath };
  };
  // Stereo tree (linked) — taps the stereo input, sums to dynSum.
  const low = mkDynBand(dynMod.input, dynSum); low.splitter.type = 'lowpass';
  const mids = [];
  for (let i = 0; i < 6; i++) mids.push(mkDynBand(dynMod.input, dynSum));
  const high = mkDynBand(dynMod.input, dynSum); high.splitter.type = 'highpass';
  // Mid tree — taps the Mid source, sums to dynSumMid.
  const midLow = mkDynBand(dynMidSrc, dynSumMid); midLow.splitter.type = 'lowpass';
  const midMids = [];
  for (let i = 0; i < 6; i++) midMids.push(mkDynBand(dynMidSrc, dynSumMid));
  const midHigh = mkDynBand(dynMidSrc, dynSumMid); midHigh.splitter.type = 'highpass';
  // Side tree — taps the Side source, sums to dynSumSide.
  const sideLow = mkDynBand(dynSideSrc, dynSumSide); sideLow.splitter.type = 'lowpass';
  const sideMids = [];
  for (let i = 0; i < 6; i++) sideMids.push(mkDynBand(dynSideSrc, dynSumSide));
  const sideHigh = mkDynBand(dynSideSrc, dynSumSide); sideHigh.splitter.type = 'highpass';

  // M/S decode: L = M + S, R = M − S.
  const dynMSMerger = ctx.createChannelMerger(2);
  const dynDecML = ctx.createGain(); dynDecML.gain.value = 1;
  const dynDecMR = ctx.createGain(); dynDecMR.gain.value = 1;
  const dynDecSL = ctx.createGain(); dynDecSL.gain.value = 1;
  const dynDecSR = ctx.createGain(); dynDecSR.gain.value = -1;
  dynSumMid.connect(dynDecML); dynDecML.connect(dynMSMerger, 0, 0);
  dynSumMid.connect(dynDecMR); dynDecMR.connect(dynMSMerger, 0, 1);
  dynSumSide.connect(dynDecSL); dynDecSL.connect(dynMSMerger, 0, 0);
  dynSumSide.connect(dynDecSR); dynDecSR.connect(dynMSMerger, 0, 1);
  const dynMSOut = ctx.createGain(); dynMSOut.gain.value = 0; // muted in stereo mode
  dynMSMerger.connect(dynMSOut);
  dynMSOut.connect(dynMod.output);

  let _enabled = false, _ms = false;
  return {
    input: dynMod.input,
    output: dynMod.output,
    bands: { low, mids, high, midLow, midMids, midHigh, sideLow, sideMids, sideHigh },
    update(deq) {
      const now = ctx.currentTime;
      const enabled = !!deq?.enabled;
      const ms = !!deq?.msMode;
      const dRamp = (_enabled !== enabled) || (_ms !== ms);
      _enabled = enabled; _ms = ms;
      // Global dry/wet mix — scales every band's contribution equally. Both
      // the posGain (compressed) and negGain (idle-alignment) paths scale by
      // the same factor so the subtractive de-esser cancellation stays
      // sample-aligned at every mix value (no comb residue).
      const mix = Math.max(0, Math.min(1, (deq?.mix ?? 100) / 100));
      // Topology: stereo mode passes dry(input)+stereo tree; M/S mode routes
      // through the encode/decode path (which carries its own dry). Disabled
      // bypasses to the dry input.
      fadeGain(dynMod.dry, enabled && ms ? 0 : 1, now, dRamp);
      fadeGain(dynStereoOut, enabled && !ms ? 1 : 0, now, dRamp);
      fadeGain(dynMSOut, enabled && ms ? 1 : 0, now, dRamp);

      const setBand = (obj, splitterType, band, on) => {
        const { splitter, comp, posGain, negGain, satDrive, satShaper, satPath, dryPath } = obj;
        const onChanged = obj._on !== on; obj._on = on;
        splitter.type = splitterType;
        splitter.frequency.setValueAtTime(band.freq || 1000, now);
        splitter.Q.setValueAtTime(band.q || 0.707, now);
        if (on) {
          const bandGain = band.gain ?? 0;
          const bandRatio = Math.max(1, Math.min(12, band.ratio ?? 1)); // capped at 1:12 (1:20 was too radical)
          const bandThreshold = band.threshold ?? -24;
          // A band is fully neutral (hard-bypassed) at 1:1 ratio with no static gain —
          // the compressor cannot affect the sound, so zero both paths to keep the
          // band perfectly transparent (no lookahead-delay residue, no curve change).
          // Raising the ratio above 1:1 engages the de-esser; the threshold then sets
          // the level at which the band's bell-shaped zone starts ducking.
          const isNeutral = bandRatio <= 1.0001 && Math.abs(bandGain) < 0.01;
          // Smooth (setTargetAtTime) parameter ramps. Instant setValueAtTime on
          // ratio/threshold makes the de-esser's subtractive gain jump the moment
          // the ratio crosses 1:1 (threshold steps 0 → -24 instantly) → an audible
          // click on every dial move. A short time constant glides the compressor
          // params so the gain reduction transitions without zipper noise.
          const TAU = 0.02;
          comp.threshold.setTargetAtTime(isNeutral ? 0 : bandThreshold, now, TAU);
          comp.ratio.setTargetAtTime(bandRatio, now, TAU);
          comp.attack.setTargetAtTime(band.attack ?? 0.01, now, TAU);
          comp.release.setTargetAtTime(band.release ?? 0.2, now, TAU);
          comp.knee.setTargetAtTime(0, now, TAU);
          fadeGain(posGain, isNeutral ? 0 : mix * Math.pow(10, bandGain / 20), now, onChanged);
          fadeGain(negGain, isNeutral ? 0 : -mix, now, onChanged);
          // Per-band saturation: drive scales the shaper input; the curve is
          // swapped between identity (off) and a tube tanh (on). Cached per band
          // so dragging other params doesn't rebuild the 4096-sample curve.
          const satOn = !!(band.satEnabled ?? false);
          const drive = band.satDrive ?? 0.3;
          // Per-band saturation is a gentle harmonic tint, not distortion: the
          // curve drive is a small fraction of the dial so even at full it stays
          // subtle. Log/audio taper (gamma) so the lower ~70% of travel is a
          // gentle tint and the full 0.15 is reached only near the top.
          const satAmt = 0.15 * Math.pow(drive, 2.2);
          // Amount 0 (or saturation off) must be CLEAN: the tube transfer curve
          // is not identity even at drive 0 (tanh(x)·0.9 + 0.05x + 0.03x²·sgn ≠ x),
          // so routing through the shaper at "0%" still colors the band. Bypass
          // the WaveShaper entirely via dryPath whenever there is no saturation
          // to apply — the band passes through the compressor unchanged.
          const effectivelyClean = !satOn || satAmt < 0.0005;
          fadeGain(satPath, effectivelyClean ? 0 : 1, now, onChanged);
          fadeGain(dryPath, effectivelyClean ? 1 : 0, now, onChanged);
          satDrive.gain.setValueAtTime(1, now);
          const key = effectivelyClean ? 'off' : `on:${satAmt.toFixed(3)}`;
          if (obj._satKey !== key) {
            obj._satKey = key;
            satShaper.curve = effectivelyClean ? identityCurve() : createSatCurve('tube', satAmt);
          }
        } else {
          comp.threshold.setTargetAtTime(0, now, 0.02);
          comp.ratio.setTargetAtTime(1, now, 0.02);
          fadeGain(posGain, 0, now, onChanged);
          fadeGain(negGain, 0, now, onChanged);
          satDrive.gain.setValueAtTime(1, now);
          fadeGain(satPath, 0, now, onChanged);
          fadeGain(dryPath, 1, now, onChanged);
          if (obj._satKey !== 'off') { obj._satKey = 'off'; satShaper.curve = identityCurve(); }
        }
      };

      const midBands = { low: deq?.low, mids: deq?.mids, high: deq?.high };
      const sideBands = ms ? { low: deq?.sideLow, mids: deq?.sideMids, high: deq?.sideHigh } : null;

      const setTree = (lowObj, midObjs, highObj, bands, on) => {
        const all = [bands.low, ...(bands.mids || []), bands.high];
        const anySolo = all.some((b) => b && b.solo);
        const active = (b) => on && !!b && b.enabled !== false && (!anySolo || !!b.solo);
        setBand(lowObj, 'lowpass', bands.low || { freq: 200 }, active(bands.low));
        const m = bands.mids || [];
        for (let i = 0; i < 6; i++) setBand(midObjs[i], 'bandpass', m[i] || { freq: 1000, q: 1 }, active(m[i]));
        setBand(highObj, 'highpass', bands.high || { freq: 5000 }, active(bands.high));
      };

      // Stereo tree (uses the Mid band set; active only in stereo mode).
      setTree(low, mids, high, midBands, enabled && !ms);
      // Mid tree (active in M/S mode).
      setTree(midLow, midMids, midHigh, midBands, enabled && ms);
      // Side tree (active in M/S mode; uses the independent Side band set).
      setTree(sideLow, sideMids, sideHigh, sideBands || midBands, enabled && ms);
    },
  };
}