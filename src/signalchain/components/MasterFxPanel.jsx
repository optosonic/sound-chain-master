import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FX_ORDER, FX_SLOT } from '../fxSlots.js';
import SignalPathPanel from './SignalPathPanel.jsx';
import SaturationPanel from './SaturationPanel.jsx';
import EQPanel from './EQPanel.jsx';
import DynamicEQPanel from './DynamicEQPanel.jsx';
import MultiBandCompPanel from './MultiBandCompPanel.jsx';
import CompressorPanel from './CompressorPanel.jsx';
import LimiterPanel from './LimiterPanel.jsx';
import DelayPanel from './DelayPanel.jsx';
import ReverbPanel from './ReverbPanel.jsx';
import ClipDistortionPanel from './ClipDistortionPanel.jsx';
import TapeMachinePanel from './TapeMachinePanel.jsx';
import StereoImagerPanel from './StereoImagerPanel.jsx';

/**
 * Full master FX rail. The effect panels below the signal path are now rendered
 * in the live signal-chain order (main chain, or the parallel chain when editing
 * it), so reordering the boxes above instantly reorders the panels below.
 *
 * The old merged "Dynamics" (compressor + limiter) and "Effects" (delay + reverb
 * + EQ) panels have been split into one panel per effect slot, so every slot maps
 * to exactly one reorderable panel.
 */
export default function MasterFxPanel({
  // main chain
  fxOrder = DEFAULT_FX_ORDER,
  onFxOrderChange,
  effects, onEffectsChange,
  dynamics, onDynamicsChange,
  saturation, onSaturationChange,
  clip, onClipChange,
  tape, onTapeChange,
  eq, onEQChange,
  dynamicEq, onDynamicEQChange,
  dynamicEqNodes,
  mbc, onMbcChange,
  mbcNodes,
  enabledMap, onToggle,
  bpm = 120,
  onBpmChange,
  audioContext, analyzers, nodes, eqAnalyzer,
  // send/return parallel loop
  routingMode = 'serial',
  onRoutingModeChange,
  sendPosition = 0,
  onSendPositionChange,
  returnPosition = DEFAULT_FX_ORDER.length,
  onReturnPositionChange,
  loopWet = 0.5,
  onLoopWetChange,
  loopFxOrder,
  onLoopFxOrderChange,
  loopEq, onLoopEQChange,
  loopDynamicEq, onLoopDynamicEQChange,
  loopEffects, onLoopEffectsChange,
  loopDynamics, onLoopDynamicsChange,
  loopSaturation, onLoopSaturationChange,
  loopClip, onLoopClipChange,
  loopTape, onLoopTapeChange,
  loopMbc, onLoopMbcChange,
  loopEnabledMap, onLoopToggle,
  stereoImager, onStereoImagerChange,
  loopStereoImager, onLoopStereoImagerChange,
  layout = 'wide',
  appMode = 'pro',
}) {
  const [target, setTarget] = useState('main');
  const isLoop = target === 'loop' && routingMode === 'loop';

  // The active lane label follows the routing mode: Serial → Serial Chain,
  // Parallel → Parallel Chain. Keeps the two lane labels consistent.
  useEffect(() => {
    setTarget(routingMode === 'loop' ? 'loop' : 'main');
  }, [routingMode]);

  const handleOrderChange = useCallback((next) => { onFxOrderChange?.(next); }, [onFxOrderChange]);

  // Bind every panel to the active target's state + handlers.
  const curEq = isLoop ? loopEq : eq;
  const curOnEQ = isLoop ? onLoopEQChange : onEQChange;
  const curEffects = isLoop ? loopEffects : effects;
  const curOnEffects = isLoop ? onLoopEffectsChange : onEffectsChange;
  const curDynamics = isLoop ? loopDynamics : dynamics;
  const curOnDynamics = isLoop ? onLoopDynamicsChange : onDynamicsChange;
  const curSaturation = isLoop ? loopSaturation : saturation;
  const curOnSaturation = isLoop ? onLoopSaturationChange : onSaturationChange;
  const curClip = isLoop ? loopClip : clip;
  const curOnClip = isLoop ? onLoopClipChange : onClipChange;
  const curTape = isLoop ? loopTape : tape;
  const curOnTape = isLoop ? onLoopTapeChange : onTapeChange;
  const curDynamicEq = isLoop ? loopDynamicEq : dynamicEq;
  const curOnDynamicEq = isLoop ? onLoopDynamicEQChange : onDynamicEQChange;
  const curMbc = isLoop ? loopMbc : mbc;
  const curOnMbc = isLoop ? onLoopMbcChange : onMbcChange;

  // Per-effect slices (the merged shapes are preserved: dynamics.compressor /
  // dynamics.limiter, effects.delay / effects.reverb).
  const compressor = curDynamics?.compressor;
  const onCompressorChange = (c) => curOnDynamics?.({ ...curDynamics, compressor: c });
  const limiter = curDynamics?.limiter;
  const onLimiterChange = (l) => curOnDynamics?.({ ...curDynamics, limiter: l });
  const delay = curEffects?.delay;
  const onDelayChange = (d) => curOnEffects?.({ ...curEffects, delay: d });
  const reverb = curEffects?.reverb;
  const onReverbChange = (rv) => curOnEffects?.({ ...curEffects, reverb: rv });
  const curStereoImager = isLoop ? loopStereoImager : stereoImager;
  const curOnStereoImager = isLoop ? onLoopStereoImagerChange : onStereoImagerChange;

  // Panels follow the active chain's FX order.
  const curOrder = (isLoop ? loopFxOrder : fxOrder) || DEFAULT_FX_ORDER;
  const live = !isLoop; // live meters only on the main chain
  // Graph-heavy modules keep full width; the rest share a 2-column bento so
  // smaller effects (compressor, limiter, delay…) stop hogging the whole row.
  const FULL_WIDTH = new Set();

  const renderSlot = (slot) => {
    switch (slot) {
      case FX_SLOT.compressor:
        return <CompressorPanel compressor={compressor} onChange={onCompressorChange} analyzers={live ? analyzers : undefined} node={live ? nodes?.compressor : undefined} nodeMid={live ? nodes?.compressorMid : undefined} nodeSide={live ? nodes?.compressorSide : undefined} />;
      case FX_SLOT.saturation:
        return <SaturationPanel saturation={curSaturation} onSaturationChange={curOnSaturation} layout={layout === 'narrow' ? 'wide' : layout} />;
      case FX_SLOT.clip:
        return <ClipDistortionPanel clip={curClip} onChange={curOnClip} />;
      case FX_SLOT.tape:
        return <TapeMachinePanel tape={curTape} onChange={curOnTape} />;
      case FX_SLOT.delay:
        return <DelayPanel delay={delay} onChange={onDelayChange} bpm={bpm} onBpmChange={onBpmChange} />;
      case FX_SLOT.reverb:
        return <ReverbPanel reverb={reverb} onChange={onReverbChange} />;
      case FX_SLOT.eq:
        return <EQPanel eq={curEq} onEQChange={curOnEQ} audioContext={audioContext} analyzerNode={live ? eqAnalyzer : undefined} />;
      case FX_SLOT.dynamicEq:
        return <DynamicEQPanel dynamicEq={curDynamicEq} onDynamicEQChange={curOnDynamicEq} audioContext={audioContext} analyzerNode={live ? eqAnalyzer : undefined} dynamicEqNodes={live ? dynamicEqNodes : undefined} />;
      case FX_SLOT.multiBandComp:
        return <MultiBandCompPanel mbc={curMbc} onMbcChange={curOnMbc} mbcNodes={live ? mbcNodes : undefined} analyzerNode={live ? analyzers?.spectrum : undefined} audioContext={audioContext} />;
      case FX_SLOT.limiter:
        return <LimiterPanel limiter={limiter} onChange={onLimiterChange} analyzers={live ? analyzers : undefined} node={live ? nodes?.limiter : undefined} getGR={live ? nodes?.limiterGR : undefined} />;
      case FX_SLOT.stereoImager:
        return <StereoImagerPanel stereoImager={curStereoImager} onChange={curOnStereoImager} analyzers={live ? analyzers : undefined} audioContext={audioContext} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <SignalPathPanel
        order={fxOrder}
        onOrderChange={handleOrderChange}
        enabledMap={enabledMap}
        onToggle={onToggle}
        layout={layout === 'narrow' ? 'wide' : layout}
        routingMode={routingMode}
        onRoutingModeChange={onRoutingModeChange}
        target={target}
        onTargetChange={setTarget}
        loopOrder={loopFxOrder}
        onLoopOrderChange={onLoopFxOrderChange}
        loopEnabledMap={loopEnabledMap}
        onLoopToggle={onLoopToggle}
        sendPosition={sendPosition}
        onSendPositionChange={onSendPositionChange}
        returnPosition={returnPosition}
        onReturnPositionChange={onReturnPositionChange}
        loopWet={loopWet}
        onLoopWetChange={onLoopWetChange}
      />
      {appMode !== 'basic' && (
        <div className={`grid grid-cols-1 gap-4 ${layout === 'narrow' ? '' : 'lg:grid-cols-2'} [grid-auto-flow:dense]`}>
          {curOrder.map((slot) => {
            // The Brickwall Limiter sits directly beneath the Stereo Imager
            // (same column, tight — no gap, following) instead of its own row.
            if (slot === FX_SLOT.limiter && curOrder.includes(FX_SLOT.stereoImager)) return null;
            return (
              <div key={slot} className={FULL_WIDTH.has(slot) ? 'lg:col-span-2' : ''}>
                {renderSlot(slot)}
                {slot === FX_SLOT.stereoImager && curOrder.includes(FX_SLOT.limiter) && (
                  <div className="mt-4">{renderSlot(FX_SLOT.limiter)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}