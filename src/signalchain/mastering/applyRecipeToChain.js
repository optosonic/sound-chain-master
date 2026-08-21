import {
  DEFAULT_EQ, DEFAULT_DYNAMIC_EQ, DEFAULT_DYNAMICS, DEFAULT_MULTIBAND_COMP,
  DEFAULT_TAPE, DEFAULT_SATURATION, DEFAULT_CLIP, DEFAULT_STEREO_IMAGER,
} from '@/signalchain/useSignalChainEngine';

/**
 * Apply a mastering recipe directly to a SignalChain instance's audio graph
 * (NO React state). Used by the dual-chain morph system to load the incoming
 * preset onto the silent "morph" chain before its crossfade ramps in.
 *
 * Mirrors applyRecipe()'s normalization exactly (merge each module onto its
 * defaults; a module the recipe omits is turned OFF) so the morph chain holds
 * precisely the preset's chain. Creative delay/reverb are intentionally left
 * untouched here — the engine syncs those separately from the live user state
 * so both chains share identical creative effects during the crossfade.
 */
export function applyRecipeToChain(chain, recipe) {
  if (!chain) return;

  if (!recipe) {
    chain.updateEQ({ ...DEFAULT_EQ, enabled: false });
    chain.updateDynamics({
      compressor: { ...DEFAULT_DYNAMICS.compressor, enabled: false },
      limiter: { ...DEFAULT_DYNAMICS.limiter, enabled: false },
    });
    chain.updateMultiBandComp({ ...DEFAULT_MULTIBAND_COMP, enabled: false });
    chain.updateTape({ ...DEFAULT_TAPE, enabled: false });
    chain.updateSaturation({ ...DEFAULT_SATURATION, enabled: false });
    chain.updateClip({ ...DEFAULT_CLIP, enabled: false });
    chain.updateDynamicEQ({ ...DEFAULT_DYNAMIC_EQ, enabled: false });
    chain.updateStereoImager({ ...DEFAULT_STEREO_IMAGER, enabled: false });
    return;
  }

  if (recipe.eq) {
    const mids = Array.isArray(recipe.eq.mids) ? recipe.eq.mids : DEFAULT_EQ.mids;
    chain.updateEQ({
      enabled: recipe.eq.enabled !== false,
      bandCount: recipe.eq.bandCount || DEFAULT_EQ.bandCount,
      low: { ...DEFAULT_EQ.low, ...recipe.eq.low },
      mids: mids.map((m, i) => ({ ...DEFAULT_EQ.mids[Math.min(i, DEFAULT_EQ.mids.length - 1)], ...m })),
      high: { ...DEFAULT_EQ.high, ...recipe.eq.high },
    });
  } else {
    chain.updateEQ({ ...DEFAULT_EQ, enabled: false });
  }

  chain.updateDynamics({
    compressor: {
      ...DEFAULT_DYNAMICS.compressor,
      enabled: !!(recipe.compressor && recipe.compressor.enabled !== false),
      ...recipe.compressor,
    },
    limiter: {
      ...DEFAULT_DYNAMICS.limiter,
      enabled: recipe.limiter ? recipe.limiter.enabled !== false : true,
      ...recipe.limiter,
    },
  });

  if (recipe.mbc) {
    const bands = Array.isArray(recipe.mbc.bands) ? recipe.mbc.bands : [];
    chain.updateMultiBandComp({
      enabled: !!recipe.mbc.enabled,
      bandCount: recipe.mbc.bandCount || DEFAULT_MULTIBAND_COMP.bandCount,
      crossovers: Array.isArray(recipe.mbc.crossovers) ? recipe.mbc.crossovers : DEFAULT_MULTIBAND_COMP.crossovers,
      bands: bands.map((b, i) => ({ ...DEFAULT_MULTIBAND_COMP.bands[Math.min(i, DEFAULT_MULTIBAND_COMP.bands.length - 1)], ...b })),
      globalMakeup: recipe.mbc.globalMakeup ?? 0,
    });
  } else {
    chain.updateMultiBandComp({ ...DEFAULT_MULTIBAND_COMP, enabled: false });
  }

  chain.updateTape({ ...DEFAULT_TAPE, enabled: !!(recipe.tape && recipe.tape.enabled), ...recipe.tape });
  chain.updateSaturation({ ...DEFAULT_SATURATION, enabled: !!(recipe.saturation && recipe.saturation.enabled), ...recipe.saturation });
  chain.updateClip({ ...DEFAULT_CLIP, enabled: false });
  chain.updateDynamicEQ({ ...DEFAULT_DYNAMIC_EQ, enabled: false });
  chain.updateStereoImager({ ...DEFAULT_STEREO_IMAGER, enabled: false });
}