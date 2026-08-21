# SignalChain Lab

A minimal, standalone **reusable component library + live test harness** for the Web Audio effects from [optosonic/signalchain](https://github.com/optosonic/signalchain).

> This is a test resource for the signalchain effects. Use the panels as drop-in reusable components.

## What it is

Not a full audio production app — a playground so you can:

1. **Visually inspect and interact** with every effect UI component using the exact "Signal Pass" design language from the repo (dark glassmorphic cards, per-effect colour theming, enable toggles, dials, sliders, meters, drag-to-reorder signal path).
2. **Test that every DSP component works** with real audio (file upload or microphone).
3. **Copy the components** into any other new or existing app later.

## Exposed effects (only these)

- **3-Band Parametric EQ** — high/low shelf *or* cut, with selectable slopes (12/24/36/48 dB).
- **Dynamics** — Compressor + Soft Clipper + Brickwall Limiter.
- **Delay** — free (ms) or tempo-synced.
- **Reverb** — Convolver with damping.

## Run

```bash
npm install
npm run dev
```

Open the app — the single page is the lab:

- **Top:** audio source / player (drag & drop a file, optional mic, play / pause / stop, volume).
- **Below:** the three effect panels via `MasterFxPanel` — Signal Path → Dynamics → Delay/Reverb/EQ.

Audio is wired live: `source → SignalChain.input → SignalChain.output → masterGain → destination`. When any panel changes, the matching `updateEQ` / `updateEffects` / `updateDynamics` / `setFxOrder` is called on the live `SignalChain` instance.

## Reusable components

Everything lives under `src/signalchain/` and is self-contained (its own `ui/` and `lib/`), so panels can be copied independently of the test harness.

```
src/signalchain/
  SignalChain.js          # DSP engine (Web Audio) — use as-is
  fxSlots.js              # FX slot IDs, metadata, order helpers
  index.js                # barrel export
  components/
    Dial.jsx              # rotary dial (drag vertically)
    SignalPathPanel.jsx   # drag-to-reorder master FX chain (PHOTONE-style)
    EQPanel.jsx           # 3-band parametric EQ + canvas response curve
    DynamicsPanel.jsx     # compressor + soft clip + brickwall limiter + meters
    EffectsPanel.jsx     # delay + reverb (+ embeds EQPanel)
    MasterFxPanel.jsx     # signal path + dynamics + effects/EQ composed
    ui/slider.jsx, ui/switch.jsx
    lib/utils.js          # cn() class helper
```

### Drop into another app

```jsx
import { MasterFxPanel, DEFAULT_FX_ORDER } from '@/signalchain';
// or copy the src/signalchain folder into your project and import relatively:
// import { MasterFxPanel, DEFAULT_FX_ORDER } from './signalchain';

const [fxOrder, setFxOrder] = useState(DEFAULT_FX_ORDER);

const handleOrderChange = (next) => {
  setFxOrder(next);
  chain.setFxOrder(next);  // live audio rewire
};

<MasterFxPanel
  fxOrder={fxOrder}
  onFxOrderChange={handleOrderChange}
  effects={effects}
  onEffectsChange={setEffects}
  dynamics={dynamics}
  onDynamicsChange={setDynamics}
  eq={eq}
  onEQChange={setEq}
  bpm={120}
  audioContext={audioCtx}
  analyzers={analyzers}   // optional — for dynamics meters
  nodes={nodes}           // optional — { compressor, limiter } for gain-reduction
/>
```

### Using a single panel

Each panel is independently importable:

```jsx
import EQPanel from '@/signalchain/components/EQPanel';
import DynamicsPanel from '@/signalchain/components/DynamicsPanel';
import EffectsPanel from '@/signalchain/components/EffectsPanel';
import SignalPathPanel from '@/signalchain/components/SignalPathPanel';
```

### Wiring the DSP

```js
import { SignalChain } from '@/signalchain/SignalChain';

const audioCtx = new AudioContext();
const chain = new SignalChain(audioCtx);
source.connect(chain.input);
chain.connect(audioCtx.destination);

chain.updateEQ({ enabled: true, lowGain: 3, midGain: -2, highGain: 1 });
chain.updateEffects({ delay: { enabled: true, mix: 0.3, time: 0.25, feedback: 0.4 }, reverb: { enabled: true, mix: 0.2, damping: 0.5 } });
chain.updateDynamics({ compressor: { enabled: true, threshold: -20, ratio: 4, makeupGain: 2 }, limiter: { enabled: true, threshold: -0.1 } });
chain.setFxOrder(['compressor', 'eq', 'delay', 'reverb', 'distortion', 'limiter']);
```

## Notes

- `AudioContext` is resumed on the first user gesture (play / mic), per browser autoplay policy.
- `DynamicsPanel` meters are optional: pass `analyzers` (`{ compressorInput, compressorOutput, limiterInput, limiterOutput }`) and `nodes` (`{ compressor, limiter }`). Without them the meters rest at −60 dB and the panel still works.
- The test harness re-taps the dynamics analyzers after every signal-path reorder, because `SignalChain.rebuildChain()` disconnects module inputs/outputs.
- Default chain order: `CMP → DST → DEL → REV → EQ → LIM`.