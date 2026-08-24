import React, { useMemo, useRef, useCallback, useState } from 'react';
import { RotateCcw, Power, Activity, Flame } from 'lucide-react';
import Dial from './Dial';
import EQGraph from './EQGraph';
import {
  BAND_COUNTS, MID_COLORS, MIN_DB, MAX_DB, MIN_FREQ, MAX_FREQ, computeEQCurve,
  getActiveBands, getInactiveBands, updateActiveBand, setActiveBandCount, resetActiveChannel, ensureSideBands,
  MS_MID_COLOR, MS_SIDE_COLOR, GAIN_RANGES, gainRangeOf,
} from '../eqModel.js';
import InfoButton from './InfoButton';

/**
 * Dynamic EQ — same hybrid-shelf band geometry as the Parametric EQ, but each
 * band also runs a compressor that ducks its frequency zone when the level
 * exceeds the band's threshold. The graph overlays live gain-reduction bars.
 *
 * DSP (SignalChain.updateDynamicEQ) uses a de-esser architecture per band:
 *   output = dry + Σ ( staticGain · compressedBand − band )
 * which is flat at idle and reduces loud bands dynamically.
 *
 * Props:
 *  - dynamicEq: { enabled, bandCount, low, mids[], high } (each band adds threshold/ratio/attack/release)
 *  - onDynamicEQChange(next)
 *  - audioContext, analyzerNode: forwarded to the shared graph
 *  - dynamicEqNodes: { low: compressor, mids: [compressor…], high: compressor } for live reduction readout
 */
const ACCENT = '#0d9488';

export default function DynamicEQPanel({ dynamicEq, onDynamicEQChange, audioContext, analyzerNode, dynamicEqNodes }) {
  const safe = useMemo(() => {
    const dynBand = (m) => ({ freq: 1000, gain: 0, q: 1, threshold: -24, ratio: 1, attack: 0.01, release: 0.2, satEnabled: false, satDrive: 0.3, ...m });
    const low = { freq: 200, gain: 0, threshold: -24, ratio: 1, attack: 0.01, release: 0.2, satEnabled: false, satDrive: 0.3, ...(dynamicEq?.low || {}) };
    const high = { freq: 5000, gain: 0, threshold: -24, ratio: 1, attack: 0.01, release: 0.2, satEnabled: false, satDrive: 0.3, ...(dynamicEq?.high || {}) };
    const mids = (dynamicEq?.mids || []).map(dynBand);
    const base = { enabled: false, bandCount: 4, msMode: false, msChannel: 'mid', gainRange: 'full', ...(dynamicEq || {}), low, high, mids };
    return ensureSideBands(base);
  }, [dynamicEq]);

  const msOn = !!safe.msMode;
  const channel = safe.msChannel === 'side' ? 'side' : 'mid';
  const channelColor = msOn ? (channel === 'side' ? MS_SIDE_COLOR : MS_MID_COLOR) : ACCENT;
  const range = gainRangeOf(safe.gainRange);

  // Switch the vertical gain range — clamps the active channel's band gains to
  // the new span so no dial holds a value outside the visible scale.
  const changeRange = (key) => {
    const r = gainRangeOf(key);
    const lo = -r.max, hi = r.max;
    const clampGain = (g) => Math.max(lo, Math.min(hi, g));
    if (msOn && channel === 'side') {
      const side = ensureSideBands(safe);
      onDynamicEQChange({
        ...side, gainRange: key,
        sideLow: { ...side.sideLow, gain: clampGain(side.sideLow.gain) },
        sideMids: side.sideMids.map((m) => ({ ...m, gain: clampGain(m.gain) })),
        sideHigh: { ...side.sideHigh, gain: clampGain(side.sideHigh.gain) },
      });
    } else {
      onDynamicEQChange({
        ...safe, gainRange: key,
        low: { ...safe.low, gain: clampGain(safe.low.gain) },
        mids: safe.mids.map((m) => ({ ...m, gain: clampGain(m.gain) })),
        high: { ...safe.high, gain: clampGain(safe.high.gain) },
      });
    }
  };
  const active = getActiveBands(safe);
  const ghost = getInactiveBands(safe);

  // Active channel's compressor nodes for the live GR overlay.
  const activeNodes = useMemo(() => {
    const n = dynamicEqNodes;
    if (!n) return null;
    if (msOn && n.mid && n.side) return channel === 'side' ? n.side : n.mid;
    return { low: n.low, mids: n.mids, high: n.high };
  }, [dynamicEqNodes, msOn, channel]);
  const nodesRef = useRef(activeNodes);
  nodesRef.current = activeNodes;

  const clampDb = (v) => Math.max(-range.max, Math.min(range.max, v));

  // Static EQ response (mirrors the audio curve) so the dynamic bell can be
  // drawn relative to it — the ducked curve dips *below* the static curve by the
  // live gain-reduction amount, shaped by the band's Q (FabFilter-style).
  const bandKey = useMemo(
    () => JSON.stringify({
      e: active.enabled,
      l: [active.low.freq, active.low.gain],
      m: active.mids.map((m) => [m.freq, m.gain, m.q]),
      h: [active.high.freq, active.high.gain],
    }),
    [active]
  );
  const staticCurve = useMemo(() => computeEQCurve(audioContext, active), [audioContext, bandKey]);
  const staticCurveRef = useRef(staticCurve);
  staticCurveRef.current = staticCurve;
  const filterCacheRef = useRef({});

  const update = (patch) => onDynamicEQChange({ ...safe, ...patch });
  const updBand = (id, p) => onDynamicEQChange(updateActiveBand(safe, id, p));
  const handleBandDrag = (id, p) => onDynamicEQChange(updateActiveBand(safe, id, p));
  const changeCount = (c) => onDynamicEQChange(setActiveBandCount(safe, c, true));
  const reset = () => onDynamicEQChange(resetActiveChannel(safe, true));
  const toggleMS = () => { const next = ensureSideBands(safe); onDynamicEQChange({ ...next, msMode: !safe.msMode, msChannel: 'mid' }); };
  const pickChannel = (ch) => update({ msChannel: ch });

  // Live dynamic overlay: for each band whose compressor is actively reducing,
  // draw a Q-shaped bell (peaking / low-shelf / high-shelf) dipping by the live
  // reduction dB, filled + stroked below the static EQ curve.
  const onDrawOverlay = useCallback((ctx, { freqToX, dbToY, bands }) => {
    const nodes = nodesRef.current;
    if (!nodes || !audioContext) return;
    const sc = staticCurveRef.current;
    if (!sc || !sc.length) return;

    // Interpolate static-curve dB at an arbitrary frequency.
    const staticDbAt = (f) => {
      const n = sc.length;
      if (f <= sc[0].freq) return sc[0].db;
      if (f >= sc[n - 1].freq) return sc[n - 1].db;
      const lf = Math.log(f);
      for (let i = 0; i < n - 1; i++) {
        if (sc[i].freq <= f && sc[i + 1].freq >= f) {
          const t = (lf - Math.log(sc[i].freq)) / (Math.log(sc[i + 1].freq) - Math.log(sc[i].freq));
          return sc[i].db + t * (sc[i + 1].db - sc[i].db);
        }
      }
      return sc[n - 1].db;
    };

    const redFor = (nn) => (nn ? Math.max(0, -nn.reduction) : 0);
    const reductions = { low: redFor(nodes.low), high: redFor(nodes.high) };
    bands.slice(1, -1).forEach((_, i) => { reductions[`mid${i}`] = redFor(nodes.mids?.[i]); });

    const N = 80;
    const lmin = Math.log10(MIN_FREQ), lmax = Math.log10(MAX_FREQ);
    const freqs = new Float32Array(N);
    const xs = new Array(N);
    for (let i = 0; i < N; i++) {
      freqs[i] = Math.pow(10, lmin + (i / (N - 1)) * (lmax - lmin));
      xs[i] = freqToX(freqs[i]);
    }
    const mag = new Float32Array(N);
    const phase = new Float32Array(N);

    bands.forEach((b) => {
      const R = reductions[b.id] || 0;
      if (R <= 0.1) return;
      let f = filterCacheRef.current[b.id];
      if (!f) { f = audioContext.createBiquadFilter(); filterCacheRef.current[b.id] = f; }
      f.type = b.kind === 'mid' ? 'peaking' : b.kind === 'low' ? 'lowshelf' : 'highshelf';
      f.frequency.value = b.freq;
      f.Q.value = b.q ?? 0.707;
      f.gain.value = -R; // negative bell = ducking of this band's zone
      f.getFrequencyResponse(freqs, mag, phase);

      // Filled area between static curve (top) and ducked dynamic curve (bottom).
      ctx.beginPath();
      ctx.moveTo(xs[0], dbToY(clampDb(staticDbAt(freqs[0]))));
      for (let i = 1; i < N; i++) ctx.lineTo(xs[i], dbToY(clampDb(staticDbAt(freqs[i]))));
      for (let i = N - 1; i >= 0; i--) {
        const bellDb = 20 * Math.log10(mag[i] || 1e-9);
        ctx.lineTo(xs[i], dbToY(clampDb(staticDbAt(freqs[i]) + bellDb)));
      }
      ctx.closePath();
      ctx.fillStyle = b.color + '2e';
      ctx.fill();

      // Bright dynamic bell stroke so the moving dip reads clearly.
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const bellDb = 20 * Math.log10(mag[i] || 1e-9);
        const y = dbToY(clampDb(staticDbAt(freqs[i]) + bellDb));
        if (i === 0) ctx.moveTo(xs[i], y); else ctx.lineTo(xs[i], y);
      }
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.95;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }, [audioContext]);

  const aLow = active.low, aHigh = active.high, aMids = active.mids;

  // Band selector — one pill per band; the selected band's card renders below
  // the graph (mirrors the Multiband Compressor panel).
  const [selectedBand, setSelectedBand] = useState(0);
  // Graph-node selection — kept in sync with the band pills + knobs so selecting
  // a point on the curve highlights the matching pill and switches the knob row,
  // and clicking a pill rings the corresponding graph node.
  const [graphSelectedId, setGraphSelectedId] = useState(null);
  const bandList = [
    { id: 'low', label: 'Low', color: '#60a5fa', kind: 'low' },
    ...aMids.map((m, i) => ({ id: `mid${i}`, label: `Mid ${i + 1}`, color: MID_COLORS[i % MID_COLORS.length], kind: 'mid', index: i })),
    { id: 'high', label: 'High', color: '#f59e0b', kind: 'high' },
  ];
  const sel = Math.min(selectedBand, bandList.length - 1);
  const selBand = bandList[sel];
  const selSat = selBand.kind === 'low' ? aLow : selBand.kind === 'high' ? aHigh : aMids[selBand.index];

  const pickBand = (i) => { setSelectedBand(i); setGraphSelectedId(bandList[i].id); };
  const onGraphSelect = (id) => {
    if (!id) { setGraphSelectedId(null); return; }
    const idx = bandList.findIndex((b) => b.id === id);
    if (idx >= 0) { setSelectedBand(idx); setGraphSelectedId(id); }
  };

  const renderBandKnobs = () => {
    if (selBand.kind === 'low') {
      return (
        <div className="flex items-center justify-around gap-1 flex-1 min-w-0">
          <Dial value={aLow.freq} onChange={(v) => updBand('low', { freq: v })} defaultValue={200} min={20} max={20000} step={1} scale="log" label="Freq" unit="Hz" />
          <Dial value={aLow.gain} onChange={(v) => updBand('low', { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" />
          <Dial value={aLow.threshold} onChange={(v) => updBand('low', { threshold: v })} defaultValue={-24} min={-60} max={0} step={0.1} label="Thresh" unit="dB" />
          <Dial value={aLow.ratio} onChange={(v) => updBand('low', { ratio: v })} defaultValue={1} min={1} max={12} step={0.1} scale="log" label="Ratio" />
          <Dial value={aLow.attack} onChange={(v) => updBand('low', { attack: v })} defaultValue={0.01} min={0.001} max={0.5} step={0.001} scale="log" label="Atk" unit="s" size="xsmall" />
          <Dial value={aLow.release} onChange={(v) => updBand('low', { release: v })} defaultValue={0.2} min={0.01} max={1} step={0.01} scale="log" label="Rel" unit="s" size="xsmall" />
        </div>
      );
    }
    if (selBand.kind === 'mid') {
      const i = selBand.index;
      const m = aMids[i];
      return (
        <div className="flex items-center justify-around gap-1 flex-1 min-w-0">
          <Dial value={m.freq} onChange={(v) => updBand(`mid${i}`, { freq: v })} defaultValue={1000} min={20} max={20000} step={1} scale="log" label="Freq" unit="Hz" />
          <Dial value={m.gain} onChange={(v) => updBand(`mid${i}`, { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" />
          <Dial value={m.q} onChange={(v) => updBand(`mid${i}`, { q: v })} defaultValue={1} min={0.1} max={6} step={0.1} label="Q" size="small" />
          <Dial value={m.threshold} onChange={(v) => updBand(`mid${i}`, { threshold: v })} defaultValue={-24} min={-60} max={0} step={0.1} label="Thresh" unit="dB" />
          <Dial value={m.ratio} onChange={(v) => updBand(`mid${i}`, { ratio: v })} defaultValue={1} min={1} max={12} step={0.1} scale="log" label="Ratio" />
          <Dial value={m.attack} onChange={(v) => updBand(`mid${i}`, { attack: v })} defaultValue={0.01} min={0.001} max={0.5} step={0.001} scale="log" label="Atk" unit="s" size="xsmall" />
          <Dial value={m.release} onChange={(v) => updBand(`mid${i}`, { release: v })} defaultValue={0.2} min={0.01} max={1} step={0.01} scale="log" label="Rel" unit="s" size="xsmall" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-around gap-1 flex-1 min-w-0">
        <Dial value={aHigh.freq} onChange={(v) => updBand('high', { freq: v })} defaultValue={5000} min={20} max={20000} step={1} scale="log" label="Freq" unit="Hz" />
        <Dial value={aHigh.gain} onChange={(v) => updBand('high', { gain: v })} defaultValue={0} min={-range.max} max={range.max} step={0.1} label="Gain" unit="dB" />
        <Dial value={aHigh.threshold} onChange={(v) => updBand('high', { threshold: v })} defaultValue={-24} min={-60} max={0} step={0.1} label="Thresh" unit="dB" />
        <Dial value={aHigh.ratio} onChange={(v) => updBand('high', { ratio: v })} defaultValue={1} min={1} max={12} step={0.1} scale="log" label="Ratio" />
        <Dial value={aHigh.attack} onChange={(v) => updBand('high', { attack: v })} defaultValue={0.01} min={0.001} max={0.5} step={0.001} scale="log" label="Atk" unit="s" size="xsmall" />
        <Dial value={aHigh.release} onChange={(v) => updBand('high', { release: v })} defaultValue={0.2} min={0.01} max={1} step={0.01} scale="log" label="Rel" unit="s" size="xsmall" />
      </div>
    );
  };

  return (
    <div>
      <div data-fx="dynamiceq" className="p-4 pb-5 rounded-xl h-[470px] flex flex-col bg-gradient-to-br from-teal-950/20 to-black/60 border border-teal-500/30">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: ACCENT + '33' }}>
            <Activity className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span
            className={`text-sm font-medium ${
              safe.enabled ? 'text-teal-300 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]' : 'text-white/80'
            }`}
          >
            Dynamic EQ
          </span>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {BAND_COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => changeCount(c)}
                className={`px-2 py-1 text-[10px] font-mono ${safe.bandCount === c ? 'text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                style={safe.bandCount === c ? { background: ACCENT } : undefined}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-white/10" title="Vertical gain range — rescales the graph axis, gridlines and drag sensitivity">
            {Object.entries(GAIN_RANGES).map(([key, r]) => (
              <button
                key={key}
                onClick={() => changeRange(key)}
                title={`±${r.max} dB — ${r.name} · ${r.grid} dB grid`}
                className={`px-2 py-1 text-[10px] font-mono ${safe.gainRange === key ? 'text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                style={safe.gainRange === key ? { background: r.color, boxShadow: `0 0 8px ${r.color}66` } : undefined}
              >
                {r.name}
              </button>
            ))}
          </div>

        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            onClick={toggleMS}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[10px] font-semibold tracking-wide ${msOn ? '' : 'border-white/12 bg-white/5 text-white/55 hover:text-white/80 hover:border-white/25'}`}
            style={msOn ? { background: '#f59e0b', borderColor: '#b45309', color: '#1a1205', boxShadow: '0 0 10px rgba(245,158,11,0.5)' } : undefined}
            title="Mid/Side mode — dynamic-EQ the Mid and Side channels independently"
          >
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${msOn ? 'bg-black/40' : 'bg-white/30'}`} />
            M/S
          </button>
          {msOn && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-white/45">Edit</span>
              <div className="flex overflow-hidden rounded-full border" style={{ borderColor: channelColor + '66' }}>
                <button onClick={() => pickChannel('mid')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'mid' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'mid' ? { background: MS_MID_COLOR } : undefined}>Mid</button>
                <button onClick={() => pickChannel('side')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'side' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'side' ? { background: MS_SIDE_COLOR } : undefined}>Side</button>
              </div>
            </div>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all text-[10px]"
            title={msOn ? `Reset ${channel === 'side' ? 'Side' : 'Mid'} channel` : 'Reset'}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <InfoButton panelId="dynamiceq" accent={ACCENT} />
          <button
            onClick={() => update({ enabled: !safe.enabled })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${safe.enabled ? 'bg-teal-600 border-teal-500 text-white shadow-[0_0_10px_rgba(13,148,136,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>

      {msOn && (
        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-md font-bold uppercase" style={{ background: channelColor, color: '#000' }}>
            Editing {channel === 'side' ? 'Side' : 'Mid'}
          </span>
          <span className="text-white/45">Mid = (L+R) · Side = (L−R) — duck each channel independently. Dashed curve = the other channel.</span>
        </div>
      )}

      <div className="flex-1 min-h-0 mb-2">
        <EQGraph
          eq={active}
          ghostEq={ghost}
          audioContext={audioContext}
          analyzerNode={analyzerNode}
          onBandDrag={handleBandDrag}
          onDrawOverlay={onDrawOverlay}
          enabledAccent={channelColor}
          selectedId={graphSelectedId}
          onSelect={onGraphSelect}
          minDb={-range.max}
          maxDb={range.max}
          gridDb={range.grid}
          labelDb={range.label}
        />
      </div>

      {/* Lower section — two columns: band controls (left) + saturation (right) */}
      <div className="flex items-stretch gap-2 shrink-0">
        {/* Left: band selector + parameter knobs */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {bandList.map((b, i) => {
              const activeSel = sel === i;
              return (
                <button
                  key={b.id}
                  onClick={() => pickBand(i)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-all"
                  style={activeSel
                    ? { background: b.color + '33', borderColor: b.color, color: '#fff', boxShadow: `0 0 12px ${b.color}88, inset 0 0 8px ${b.color}33` }
                    : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.65)' }}
                  title={`Edit ${b.label}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
                  {b.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/30 flex-1 min-h-0" style={{ borderColor: channelColor + '33', borderWidth: 1 }}>
            {renderBandKnobs()}
          </div>
        </div>
        {/* Right: Saturation column — Sat button + Drive dial */}
        <div className="flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-lg bg-black/30" style={{ borderColor: SAT_COLOR + '44', borderWidth: 1 }}>
          <button
            onClick={() => updBand(selBand.id, { satEnabled: !selSat.satEnabled })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all"
            style={selSat.satEnabled
              ? { background: SAT_COLOR, borderColor: '#fdba74', color: '#ffffff', boxShadow: `0 0 10px ${SAT_COLOR}, 0 0 20px ${SAT_COLOR}88` }
              : { background: '#f0a868', borderColor: '#d98a3a', color: '#9a4515' }}
          >
            <Flame className="w-3 h-3" /> Sat
          </button>
          <Dial value={selSat.satDrive} onChange={(v) => updBand(selBand.id, { satDrive: v })} defaultValue={0.3} min={0} max={1} step={0.01} label="Drive" size="small" accent={SAT_COLOR} />
        </div>
      </div>
      </div>
    </div>
  );
}

const SAT_COLOR = '#fb923c';