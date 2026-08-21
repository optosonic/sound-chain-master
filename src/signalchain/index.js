// Reusable signal-chain library barrel.
// Import from your app:  import { SignalChain, MasterFxPanel, DEFAULT_FX_ORDER } from '@/signalchain';
// Or copy this whole folder into another project and import relatively.

export { SignalChain } from './SignalChain.js';
export {
  FX_SLOT,
  FX_SLOT_LIST,
  FX_SLOT_META,
  DEFAULT_FX_ORDER,
  normalizeFxOrder,
  swapFxOrder,
} from './fxSlots.js';
export { default as Dial } from './components/Dial.jsx';
export { default as SignalPathPanel } from './components/SignalPathPanel.jsx';
export { default as EQPanel } from './components/EQPanel.jsx';
export { default as SaturationPanel } from './components/SaturationPanel.jsx';
export { default as DynamicsPanel } from './components/DynamicsPanel.jsx';
export { default as MultiBandCompPanel } from './components/MultiBandCompPanel.jsx';
export { default as EffectsPanel } from './components/EffectsPanel.jsx';
export { default as CompressorPanel } from './components/CompressorPanel.jsx';
export { default as LimiterPanel } from './components/LimiterPanel.jsx';
export { default as DelayPanel } from './components/DelayPanel.jsx';
export { default as ReverbPanel } from './components/ReverbPanel.jsx';
export { default as ClipDistortionPanel } from './components/ClipDistortionPanel.jsx';
export { default as TapeMachinePanel } from './components/TapeMachinePanel.jsx';
export { default as MasterFxPanel } from './components/MasterFxPanel.jsx';
export { default as LayoutStylePanel } from './components/LayoutStylePanel.jsx';
export { default as LevelMeter } from './components/LevelMeter.jsx';
export { default as VUMeter } from './components/VUMeter.jsx';