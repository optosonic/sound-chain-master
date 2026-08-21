import {
  DEFAULT_EQ, DEFAULT_DYNAMIC_EQ, DEFAULT_DYNAMICS, DEFAULT_MULTIBAND_COMP,
  DEFAULT_TAPE, DEFAULT_SATURATION, DEFAULT_ANALOGUE_DENSITY, DEFAULT_CLIP, DEFAULT_STEREO_IMAGER,
} from '@/signalchain/useSignalChainEngine';

/**
 * Apply a mastering recipe to the live engine state so the user hears the
 * mastered chain in real time (and the same state drives the offline render).
 *
 * The recipe is AUTHORITATIVE for every mastering module's on/off: a module
 * the recipe includes is engaged (with its params); a module the recipe omits
 * is turned OFF. So loading a preset always yields exactly that preset's
 * chain — a manually-enabled module doesn't bleed across presets. Creative
 * delay/reverb are left untouched (they're the user's effects, not part of a
 * mastering preset).
 *
 * Each module is merged onto its defaults so the recipe only needs to specify
 * the fields it cares about.
 */
export function applyRecipe(engine, recipe) {
  if (!engine) return;

  // Init / neutral recipe (e.g. an "Init" section in section mastering): every
  // mastering module OFF. Delay/reverb are left to the user.
  if (!recipe) {
    engine.handleEQChange({ ...DEFAULT_EQ, enabled: false });
    engine.handleDynamicsChange({
      compressor: { ...DEFAULT_DYNAMICS.compressor, enabled: false },
      limiter: { ...DEFAULT_DYNAMICS.limiter, enabled: false },
    });
    engine.handleMbcChange({ ...DEFAULT_MULTIBAND_COMP, enabled: false });
    engine.handleTapeChange({ ...DEFAULT_TAPE, enabled: false });
    engine.handleSaturationChange({ ...DEFAULT_SATURATION, enabled: false });
    engine.handleAnalogueDensityChange({ ...DEFAULT_ANALOGUE_DENSITY, enabled: false });
    engine.handleClipChange({ ...DEFAULT_CLIP, enabled: false });
    engine.handleDynamicEQChange({ ...DEFAULT_DYNAMIC_EQ, enabled: false });
    engine.handleStereoImagerChange({ ...DEFAULT_STEREO_IMAGER, enabled: false });
    return;
  }

  // ── EQ ── on unless the recipe explicitly disables it.
  if (recipe.eq) {
    const mids = Array.isArray(recipe.eq.mids) ? recipe.eq.mids : DEFAULT_EQ.mids;
    const eq = {
      enabled: recipe.eq.enabled !== false,
      bandCount: recipe.eq.bandCount || DEFAULT_EQ.bandCount,
      low: { ...DEFAULT_EQ.low, ...recipe.eq.low },
      mids: mids.map((m, i) => ({ ...DEFAULT_EQ.mids[Math.min(i, DEFAULT_EQ.mids.length - 1)], ...m })),
      high: { ...DEFAULT_EQ.high, ...recipe.eq.high },
    };
    engine.handleEQChange(eq);
  } else {
    engine.handleEQChange({ ...DEFAULT_EQ, enabled: false });
  }

  // ── Compressor + Limiter ── the compressor follows the recipe (a preset
  //    with no compressor — e.g. Classical Dynamic — now correctly leaves it
  //    OFF, instead of forcing it on with non-neutral default params). The
  //    limiter is the safety ceiling: on for any real recipe, off only when
  //    the recipe explicitly disables it.
  engine.handleDynamicsChange({
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

  // ── Multi-Band Comp ── on only if the recipe includes it.
  if (recipe.mbc) {
    const bands = Array.isArray(recipe.mbc.bands) ? recipe.mbc.bands : [];
    const mbc = {
      enabled: !!recipe.mbc.enabled,
      bandCount: recipe.mbc.bandCount || DEFAULT_MULTIBAND_COMP.bandCount,
      crossovers: Array.isArray(recipe.mbc.crossovers) ? recipe.mbc.crossovers : DEFAULT_MULTIBAND_COMP.crossovers,
      bands: bands.map((b, i) => ({ ...DEFAULT_MULTIBAND_COMP.bands[Math.min(i, DEFAULT_MULTIBAND_COMP.bands.length - 1)], ...b })),
      globalMakeup: recipe.mbc.globalMakeup ?? 0,
    };
    engine.handleMbcChange(mbc);
  } else {
    engine.handleMbcChange({ ...DEFAULT_MULTIBAND_COMP, enabled: false });
  }

  // ── Tape / Saturation ── on only if the recipe includes them.
  engine.handleTapeChange({ ...DEFAULT_TAPE, enabled: !!(recipe.tape && recipe.tape.enabled), ...recipe.tape });
  engine.handleSaturationChange({ ...DEFAULT_SATURATION, enabled: !!(recipe.saturation && recipe.saturation.enabled), ...recipe.saturation });
  engine.handleAnalogueDensityChange({ ...DEFAULT_ANALOGUE_DENSITY, enabled: !!(recipe.analogueDensity && recipe.analogueDensity.enabled), ...recipe.analogueDensity });

  // ── Dynamic EQ ── on only if the recipe includes it. Merged onto the
  //    default band geometry (shelf + bells) so the recipe only needs to
  //    specify the dynamic fields (threshold / ratio / attack / release) per
  //    band. Used by presets like Streaming Pop for gentle de-essing + low-mid
  //    control without a full multi-band compressor.
  if (recipe.dynamicEq) {
    const mids = Array.isArray(recipe.dynamicEq.mids) ? recipe.dynamicEq.mids : DEFAULT_DYNAMIC_EQ.mids;
    const deq = {
      enabled: recipe.dynamicEq.enabled !== false,
      bandCount: recipe.dynamicEq.bandCount || DEFAULT_DYNAMIC_EQ.bandCount,
      msMode: !!recipe.dynamicEq.msMode,
      msChannel: recipe.dynamicEq.msChannel || 'mid',
      low: { ...DEFAULT_DYNAMIC_EQ.low, ...recipe.dynamicEq.low },
      mids: mids.map((m, i) => ({ ...DEFAULT_DYNAMIC_EQ.mids[Math.min(i, DEFAULT_DYNAMIC_EQ.mids.length - 1)], ...m })),
      high: { ...DEFAULT_DYNAMIC_EQ.high, ...recipe.dynamicEq.high },
      mix: recipe.dynamicEq.mix ?? 100,
    };
    engine.handleDynamicEQChange(deq);
  } else {
    engine.handleDynamicEQChange({ ...DEFAULT_DYNAMIC_EQ, enabled: false });
  }

  // ── Mastering modules the recipe never defines ── forced OFF so the
  //    preset is the exact chain. A manually-enabled clip / stereo imager
  //    doesn't bleed across presets. Creative delay/reverb are intentionally
  //    left untouched.
  engine.handleClipChange({ ...DEFAULT_CLIP, enabled: false });
  engine.handleStereoImagerChange({ ...DEFAULT_STEREO_IMAGER, enabled: false });
}