import React, { useEffect, useRef, useState } from 'react';
import { Activity, Power } from 'lucide-react';
import Dial from './Dial';
import InfoButton from './InfoButton';
import { MS_MID_COLOR, MS_SIDE_COLOR } from '../eqModel.js';
import { DEFAULT_DYNAMICS } from '../useSignalChainEngine';
import { CHAR_ENUM, gainReductionDbModeled } from '../compressorModel.js';

/**
 * Compressor character presets — selecting a type applies that type's
 * signature attack / release / ratio / knee to the current (Mid or Side)
 * channel, mirroring how Saturation's mode buttons swap the transfer curve.
 * Threshold & makeup stay user-controlled. Labels match the reference row.
 */
/** Post-threshold cyan handle sits ~12 dB above thresh, clamped to −6…0 dB. */
function ratioHandleInDb(thr) {
  return Math.min(0, Math.max(-6, thr + 12));
}

const TYPES = [
  { id: 'platinum', label: 'Digital', ratio: 4, knee: 0, attack: 0.003, release: 0.12 },
  { id: 'vca', label: 'Studio VCA', ratio: 4, knee: 10, attack: 0.01, release: 0.18 },
  { id: 'fet', label: 'Studio FET', ratio: 8, knee: 0, attack: 0.002, release: 0.08 },
  { id: 'opto', label: 'Vintage Opto', ratio: 3, knee: 20, attack: 0.03, release: 0.35 },
  { id: 'vfet', label: 'Vintage FET', ratio: 6, knee: 6, attack: 0.005, release: 0.22 },
];

/**
 * Compressor — standalone panel (split out of the old combined Dynamics panel
 * so each signal-chain slot maps to exactly one reorderable panel below).
 *
 * Props:
 *  - compressor: { enabled, threshold, ratio, attack, release, knee, makeupGain, softClip }
 *  - onChange(next)
 *  - analyzers (optional): full engine analyzers object — reads .compressorInput / .compressorOutput
 *  - node (optional): the compressor DynamicsCompressorNode (for live GR via .reduction)
 */
export default function CompressorPanel({ compressor, onChange, analyzers, node, nodeMid, nodeSide }) {
  const safe = {
    type: 'platinum', enabled: false, threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30, makeupGain: 0, softClip: 0, msMode: false, msChannel: 'mid',
    sideThreshold: -24, sideRatio: 4, sideAttack: 0.003, sideRelease: 0.25, sideKnee: 30, sideMakeupGain: 0, model: 1, sideModel: 1,
    ...(compressor || {}),
  };

  const [inputLevel, setInputLevel] = useState(-60);
  const [outputLevel, setOutputLevel] = useState(-60);
  const [gainReduction, setGainReduction] = useState(0);
  const [grMid, setGRMid] = useState(0);
  const [grSide, setGRSide] = useState(0);
  // VU-style smoothed level for the live signal dot — glides instead of
  // snapping frame-to-frame (which read as a squashed ellipsoid) and keeps
  // the dot's motion light and "ballistic" rather than sample-accurate.
  const [dotDb, setDotDb] = useState(-60);
  const [graphHover, setGraphHover] = useState(null); // 'thresh' | 'ratio' | null
  const [graphDrag, setGraphDrag] = useState(null);
  const dotDbRef = useRef(-60);
  const rafRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const safeRef = useRef(safe);
  const onChangeRef = useRef(onChange);
  safeRef.current = safe;
  onChangeRef.current = onChange;
  const inRef = useRef(null);
  const outRef = useRef(null);
  const nodeRef = useRef(null);
  const nodeMidRef = useRef(null);
  const nodeSideRef = useRef(null);
  inRef.current = analyzers?.compressorInput || null;
  outRef.current = analyzers?.compressorOutput || null;
  nodeRef.current = node || null;
  nodeMidRef.current = nodeMid || null;
  nodeSideRef.current = nodeSide || null;

  useEffect(() => {
    if (!inRef.current || !outRef.current) return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      const releaseRate = 120;
      if (safe.enabled) {
        const inData = new Float32Array(inRef.current.fftSize);
        const outData = new Float32Array(outRef.current.fftSize);
        inRef.current.getFloatTimeDomainData(inData);
        outRef.current.getFloatTimeDomainData(outData);
        let inPeak = 0, outPeak = 0;
        for (let i = 0; i < inData.length; i++) {
          inPeak = Math.max(inPeak, Math.abs(inData[i]));
          outPeak = Math.max(outPeak, Math.abs(outData[i]));
        }
        const inDb = inPeak > 1e-5 ? 20 * Math.log10(inPeak) : -60;
        const outDb = outPeak > 1e-5 ? 20 * Math.log10(outPeak) : -60;
        setInputLevel((p) => (inDb >= p ? inDb : Math.max(-60, p - releaseRate * dt)));
        setOutputLevel((p) => (outDb >= p ? outDb : Math.max(-60, p - releaseRate * dt)));
        // Peak-hold ballistics for the dot — fast attack (~8 ms) so the dot
        // snaps up to each incoming peak (true peak detection), slower
        // release (~150 ms) so it glides down smoothly without the
        // squashed-ellipsoid look. Asymmetric = catches peaks, doesn't lag.
        const rising = inDb > dotDbRef.current;
        const a = 1 - Math.exp(-dt / (rising ? 0.008 : 0.15));
        dotDbRef.current += (inDb - dotDbRef.current) * a;
        setDotDb(dotDbRef.current);
        if (safe.msMode && nodeMidRef.current && nodeSideRef.current) {
          setGRMid(Math.abs(nodeMidRef.current.reduction));
          setGRSide(Math.abs(nodeSideRef.current.reduction));
          setGainReduction(0);
        } else {
          setGainReduction(nodeRef.current ? Math.abs(nodeRef.current.reduction) : 0);
          setGRMid(0); setGRSide(0);
        }
      } else {
        setInputLevel(-60); setOutputLevel(-60); setGainReduction(0); setGRMid(0); setGRSide(0);
        dotDbRef.current = -60; setDotDb(-60);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analyzers, node, nodeMid, nodeSide, safe.enabled, safe.msMode, safe.threshold, safe.ratio, safe.knee]);

  if (!onChange) return null;
  const set = (k, v) => onChange({ ...safe, [k]: v });
  const meterPct = (db) => Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

  const msOn = !!safe.msMode;
  const channel = msOn && safe.msChannel === 'side' ? 'side' : 'mid';
  const channelColor = msOn ? (channel === 'side' ? MS_SIDE_COLOR : MS_MID_COLOR) : '#5b7a99';
  const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  const getCh = (k) => (msOn && channel === 'side') ? safe['side' + cap(k)] : safe[k];
  const setCh = (k, v) => onChange((msOn && channel === 'side') ? { ...safe, ['side' + cap(k)]: v } : { ...safe, [k]: v });
  // Application default for the dial being Option-clicked, channel-aware.
  const defCh = (k) => (msOn && channel === 'side') ? DEFAULT_DYNAMICS.compressor['side' + cap(k)] : DEFAULT_DYNAMICS.compressor[k];
  // Selecting a compressor type stamps its character params onto the current
  // channel (Mid or Side in M/S mode) and stores the type id.
  const selectType = (t) => {
    const base = { ...safe, type: t.id };
    if (msOn && channel === 'side') {
      onChange({ ...base, sideRatio: t.ratio, sideKnee: t.knee, sideAttack: t.attack, sideRelease: t.release });
    } else {
      onChange({ ...base, ratio: t.ratio, knee: t.knee, attack: t.attack, release: t.release });
    }
  };

  // Transfer plot geometry (SVG user units) — mirrors the Saturation panel so
  // the compressor graph has the same contrast, labels and bloom.
  const PLOT = { L: 46, R: 284, T: 16, B: 168 };
  const DB_MIN = -60, DB_MAX = 0;
  const DB_TICKS = [-60, -45, -30, -15, 0];
  const PW = PLOT.R - PLOT.L, PH = PLOT.B - PLOT.T;
  const mx = (db) => PLOT.L + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * PW;
  const my = (db) => PLOT.B - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * PH;
  const activeType = TYPES.find((t) => t.id === (safe.type || 'platinum')) || TYPES[0];

  const transferPath = () => {
    const t = getCh('threshold'), r = Math.max(1, getCh('ratio')), W = Math.max(0, getCh('knee'));
    // Per-character gain computer — mirrors the AudioWorklet DSP so the plotted
    // transfer curve shows the real model (FET rising ratio, Opto smooth
    // compressive curve, VFET soft tube knee) rather than a fixed-ratio knee.
    const chId = CHAR_ENUM[safe.type] ?? 0;
    const pts = [];
    for (let i = 0; i <= 180; i++) {
      const inDb = DB_MIN + (i / 180) * (DB_MAX - DB_MIN);
      const gr = gainReductionDbModeled(inDb, t, r, W, chId, getCh('model'));
      const outDb = inDb - gr;
      pts.push(`${mx(inDb).toFixed(1)},${my(outDb).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  // Live signal dot — rides the transfer curve at the current input peak.
  // Runs the same modelled gain computer as the plotted curve so the dot sits
  // exactly on the line, moving up/down (and across) as the incoming signal
  // rises and falls.
  const chId = CHAR_ENUM[safe.type] ?? 0;
  // The dot rides the curve on the VU-smoothed level (dotDb), not the snappy
  // meter level — smoother motion, same on-curve accuracy.
  const sigInDb = dotDb;
  // Area under the curve — follows the live signal dot: fill runs from the
  // left edge along the curve and terminates at the dot's input level, so
  // everything to the right of the dot is the plain background.
  // Two-shade area under the curve, both bounded by the dot's input level:
  // darker shade below the threshold, lighter shade above it, and the fill
  // stops at the dot — everything to its right is the plain background.
  const { leftAuc, rightAuc } = (() => {
    const t = getCh('threshold'), r = Math.max(1, getCh('ratio')), W = Math.max(0, getCh('knee'));
    const cid = CHAR_ENUM[safe.type] ?? 0;
    const edge = safe.enabled ? Math.max(DB_MIN, Math.min(DB_MAX, sigInDb)) : DB_MIN;
    const pts = [];
    for (let i = 0; i <= 180; i++) {
      const inDb = DB_MIN + (i / 180) * (DB_MAX - DB_MIN);
      const gr = gainReductionDbModeled(inDb, t, r, W, cid, getCh('model'));
      pts.push({ inDb, x: mx(inDb), y: my(inDb - gr) });
    }
    const cut = pts.findIndex((p) => p.inDb >= edge);
    const dotIdx = cut < 0 ? pts.length - 1 : cut;
    const thrIdx = pts.findIndex((p) => p.inDb >= t);
    const lower = pts.slice(0, dotIdx + 1);
    const poly = (seg) => [
      `${seg[0].x.toFixed(1)},${PLOT.B}`,
      ...seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `${seg[seg.length - 1].x.toFixed(1)},${PLOT.B}`,
    ].join(' ');
    let l = '', rl = '';
    if (dotIdx <= (thrIdx < 0 ? pts.length - 1 : thrIdx)) {
      l = poly(lower); // dot before/at threshold → all darker
    } else {
      const ti = thrIdx < 0 ? pts.length - 1 : thrIdx;
      l = poly(pts.slice(0, ti + 1));
      rl = poly(pts.slice(ti, dotIdx + 1));
    }
    return { leftAuc: l, rightAuc: rl };
  })();
  const sigGr = safe.enabled
    ? gainReductionDbModeled(sigInDb, getCh('threshold'), Math.max(1, getCh('ratio')), Math.max(0, getCh('knee')), chId, getCh('model'))
    : 0;
  const sigOutDb = sigInDb - sigGr;
  const showSigDot = safe.enabled && sigInDb > -59;

  const thr = getCh('threshold');
  const handleIn = ratioHandleInDb(thr);
  const handleOut = handleIn - gainReductionDbModeled(
    handleIn, thr, Math.max(1, getCh('ratio')), Math.max(0, getCh('knee')), chId, getCh('model'),
  );
  const hx = mx(handleIn);
  const hy = my(handleOut);
  const thrX = mx(thr);
  const thrHot = graphHover === 'thresh' || graphDrag === 'thresh';
  const ratioHot = graphHover === 'ratio' || graphDrag === 'ratio';

  const svgPt = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  };
  const xToDb = (x) => DB_MIN + ((x - PLOT.L) / PW) * (DB_MAX - DB_MIN);
  const yToDb = (y) => DB_MIN + ((PLOT.B - y) / PH) * (DB_MAX - DB_MIN);

  const hitGraph = (p) => {
    if (p.y >= PLOT.T - 4 && p.y <= PLOT.B + 4 && Math.abs(p.x - thrX) <= 7) return 'thresh';
    if (Math.hypot(p.x - hx, p.y - hy) <= 14) return 'ratio';
    const t = getCh('threshold');
    let best = 1e9;
    for (let i = 0; i <= 180; i++) {
      const inDb = DB_MIN + (i / 180) * (DB_MAX - DB_MIN);
      if (inDb < t + 3) continue;
      const gr = gainReductionDbModeled(inDb, t, Math.max(1, getCh('ratio')), Math.max(0, getCh('knee')), chId, getCh('model'));
      best = Math.min(best, Math.hypot(p.x - mx(inDb), p.y - my(inDb - gr)));
    }
    if (best <= 8) return 'ratio';
    return null;
  };

  const applyGraph = (kind, p) => {
    const s = safeRef.current;
    const ms = !!s.msMode;
    const side = ms && s.msChannel === 'side';
    const patch = (k, v) => {
      const key = side ? `side${k.charAt(0).toUpperCase()}${k.slice(1)}` : k;
      onChangeRef.current?.({ ...s, [key]: v });
    };
    if (kind === 'thresh') {
      const db = Math.max(-60, Math.min(0, Math.round(xToDb(p.x) * 10) / 10));
      patch('threshold', db);
      return;
    }
    if (kind === 'ratio') {
      const T = side ? s.sideThreshold : s.threshold;
      const inDb = Math.max(T + 8, xToDb(p.x));
      const outDb = yToDb(p.y);
      const over = inDb - T;
      const rise = outDb - T;
      const r = rise <= 0.05 ? 20 : over / rise;
      patch('ratio', Math.max(1, Math.min(20, Math.round(r * 10) / 10)));
    }
  };

  useEffect(() => {
    if (!graphDrag) return;
    const move = (e) => applyGraph(dragRef.current, svgPt(e));
    const up = () => { dragRef.current = null; setGraphDrag(null); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [graphDrag]);

  const graphCursor = graphDrag === 'thresh' || graphHover === 'thresh' ? 'ew-resize'
    : graphDrag === 'ratio' || graphHover === 'ratio' ? 'nesw-resize'
      : 'crosshair';

  return (
    <div>
      <div data-fx="compressor" className="h-[470px] flex flex-col p-4 pb-5 rounded-xl bg-gradient-to-br from-sky-950/40 to-black/60 border border-bluegraphite-500/30">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-bluegraphite-500/20"><Activity className="w-4 h-4 text-bluegraphite-400" /></div>
            <span className={`text-sm font-medium transition-all ${safe.enabled ? 'text-bluegraphite-400 drop-shadow-[0_0_8px_rgba(91,122,153,0.8)]' : 'text-white/80'}`}>Compressor</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => set('msMode', !safe.msMode)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border transition-all text-[10px] font-bold uppercase ${safe.msMode ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5 border-white/25 text-white/80 hover:bg-white/10 hover:border-white/40'}`} title="Mid/Side mode — compress Mid and Side independently">
              <span className="text-[9px] leading-none">M/S</span>
              <span className="text-[9px] leading-none opacity-70">{safe.msMode ? 'On' : 'Off'}</span>
            </button>
            <InfoButton panelId="compressor" accent="#5b7a99" />
            <button onClick={() => set('enabled', !safe.enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${safe.enabled ? 'bg-bluegraphite-500 border-bluegraphite-400 text-white shadow-[0_0_10px_rgba(91,122,153,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{safe.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        {/* Compressor type — character presets, styled to match the panel's
            blue-graphite scheme (active = graphite fill + glow, inactive =
            soft grey). Sits in the row the M/S channel selector occupies, so
            the panel height is unchanged. */}
        <div className="grid grid-cols-5 gap-1.5 mb-2 shrink-0">
          {TYPES.map((t) => {
            const active = (safe.type || 'platinum') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectType(t)}
                className={`py-1.5 text-[10px] rounded transition-all ${active ? 'text-white shadow-[0_0_8px_rgba(91,122,153,0.5)]' : 'bg-white/10 text-white/55 hover:bg-white/20'}`}
                style={active ? { background: msOn ? channelColor : '#446079', border: `1px solid ${msOn ? channelColor : '#446079'}` } : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {safe.msMode && (
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4 shrink-0">
            <div className="flex overflow-hidden rounded-full border" style={{ borderColor: channelColor + '66' }}>
              <button onClick={() => set('msChannel', 'mid')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'mid' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'mid' ? { background: MS_MID_COLOR } : undefined}>Mid</button>
              <button onClick={() => set('msChannel', 'side')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${channel === 'side' ? 'text-black' : 'bg-black/40 text-white/60 hover:text-white'}`} style={channel === 'side' ? { background: MS_SIDE_COLOR } : undefined}>Side</button>
            </div>
        </div>
        )}

        {safe.msMode && (
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono shrink-0">
            <span className="px-2 py-0.5 rounded-md font-bold uppercase" style={{ background: channelColor, color: '#000' }}>
              Editing {channel === 'side' ? 'Side' : 'Mid'}
            </span>
            <span className="text-white/45">Mid = (L+R) · Side = (L−R) — compress each channel independently.</span>
          </div>
        )}

        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex flex-col items-center gap-1 w-10 shrink-0">
            <span className="text-[9px] text-bluegraphite-400/60 font-medium">IN</span>
            <div className="flex-1 w-6 bg-black/60 border border-bluegraphite-500/20 relative overflow-hidden rounded-sm">
              {safe.enabled && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bluegraphite-600 via-bluegraphite-400 to-bluegraphite-300" style={{ height: `${meterPct(inputLevel)}%` }} />}
            </div>
            <span className="text-[8px] text-bluegraphite-400/80 font-mono">{safe.enabled ? inputLevel.toFixed(0) : '-60'}</span>
          </div>
          <div className="flex-1 min-h-0 rounded-lg p-1.5 border border-bluegraphite-500/25 bg-black/60 shadow-[inset_0_0_18px_rgba(125,211,252,0.08)] flex flex-col">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[8px] font-mono uppercase tracking-widest text-sky-200">Transfer Characteristic</span>
              <span className="text-[8px] font-mono text-sky-200/80 truncate max-w-[58%] text-right" title="Drag the dotted line = Threshold · cyan handle / post-threshold curve = Ratio">
                {activeType.label} · drag line = thresh · handle = ratio
              </span>
            </div>
            <svg
              ref={svgRef}
              viewBox="0 0 300 194"
              className="w-full flex-1 min-h-0 touch-none"
              preserveAspectRatio="xMidYMid meet"
              style={{ cursor: graphCursor }}
              onPointerDown={(e) => {
                const hit = hitGraph(svgPt(e));
                if (!hit) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                dragRef.current = hit;
                setGraphDrag(hit);
                applyGraph(hit, svgPt(e));
              }}
              onPointerMove={(e) => {
                if (graphDrag) return;
                setGraphHover(hitGraph(svgPt(e)));
              }}
              onPointerLeave={() => { if (!graphDrag) setGraphHover(null); }}
            >
              <defs>
                <filter id="cmpGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="cmpFill" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="rgba(125,211,252,0.14)" />
                  <stop offset="100%" stopColor="rgba(125,211,252,0)" />
                </linearGradient>
                {/* Soft shade behind the live dot — blue-tinted ~15% darker than
                    the transfer curve (#7dd3fc → #6ab3d6), semi-transparent. The
                    focal point is offset to the right (fx 72%) so the shade's
                    right edge reads slightly brighter, as requested. */}
                <radialGradient id="cmpDotShade" cx="50%" cy="50%" r="50%" fx="72%" fy="50%">
                  <stop offset="0%" stopColor="rgba(106,179,214,0.42)" />
                  <stop offset="55%" stopColor="rgba(106,179,214,0.20)" />
                  <stop offset="100%" stopColor="rgba(106,179,214,0)" />
                </radialGradient>
              </defs>

              {/* Grid */}
              {DB_TICKS.map((t, i) => (
                <line key={`vg${i}`} x1={mx(t)} y1={PLOT.T} x2={mx(t)} y2={PLOT.B} stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
              ))}
              {DB_TICKS.map((t, i) => (
                <line key={`hg${i}`} x1={PLOT.L} y1={my(t)} x2={PLOT.R} y2={my(t)} stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
              ))}

              {/* Axes */}
              <line x1={PLOT.L} y1={PLOT.T} x2={PLOT.L} y2={PLOT.B} stroke="rgba(125,211,252,0.85)" strokeWidth="0.8" />
              <line x1={PLOT.L} y1={PLOT.B} x2={PLOT.R} y2={PLOT.B} stroke="rgba(125,211,252,0.85)" strokeWidth="0.8" />

              {/* Unity (no-compression) reference */}
              <line x1={mx(DB_MIN)} y1={my(DB_MIN)} x2={mx(DB_MAX)} y2={my(DB_MAX)} stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeDasharray="3,3" />

              {/* Threshold line — drag horizontally */}
              <line
                x1={thrX} y1={PLOT.T} x2={thrX} y2={PLOT.B}
                stroke={thrHot ? 'rgba(125,211,252,0.95)' : 'rgba(125,211,252,0.7)'}
                strokeWidth={thrHot ? 1.6 : 0.8}
                strokeDasharray="2,2"
              />
              <rect x={thrX - 6} y={PLOT.T} width="12" height={PLOT.B - PLOT.T} fill="transparent" />

              {/* Tick labels */}
              {DB_TICKS.map((t, i) => (
                <text key={`xl${i}`} x={mx(t)} y={PLOT.B + 9} textAnchor="middle" className="fill-slate-300" style={{ fontSize: 6, fontFamily: 'monospace' }}>{t}</text>
              ))}
              {DB_TICKS.map((t, i) => (
                <text key={`yl${i}`} x={PLOT.L - 5} y={my(t) + 2} textAnchor="end" className="fill-slate-300" style={{ fontSize: 6, fontFamily: 'monospace' }}>{t}</text>
              ))}

              {/* Axis titles */}
              <text x={(PLOT.L + PLOT.R) / 2} y={190} textAnchor="middle" className="fill-slate-200" style={{ fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }}>INPUT</text>
              <text x={14} y={(PLOT.T + PLOT.B) / 2} textAnchor="middle" className="fill-slate-200" style={{ fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }} transform={`rotate(-90 14 ${(PLOT.T + PLOT.B) / 2})`}>OUTPUT</text>

              {/* Area under the curve up to the dot — darker below threshold,
                  lighter above it; the rest (right of the dot) is background. */}
              {leftAuc && <polygon points={leftAuc} fill="rgba(56,189,248,0.16)" />}
              {rightAuc && <polygon points={rightAuc} fill="rgba(125,211,252,0.30)" />}

              {/* Curve glow + line */}
              <polyline points={transferPath()} fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#cmpGlow)" />
              <polyline points={transferPath()} fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />

              {/* Live signal dot — orange (complementary to the blue curve), with a
                  soft blue shade following it covering the transfer junction. */}
              {showSigDot && (
                <>
                  <circle cx={mx(sigInDb)} cy={my(sigOutDb)} r="15" fill="url(#cmpDotShade)" />
                  <circle cx={mx(sigInDb)} cy={my(sigOutDb)} r="4.6" fill="#2a2a2a" />
                  <circle cx={mx(sigInDb)} cy={my(sigOutDb)} r="4" fill="#ff8c1a" />
                  <circle cx={mx(sigInDb) - 1.2} cy={my(sigOutDb) - 1.2} r="1.2" fill="#ffffff" />
                </>
              )}

              {/* Ratio handle — drag to tilt the post-threshold slope */}
              {ratioHot && (
                <circle cx={hx} cy={hy} r="9.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" />
              )}
              <circle cx={hx} cy={hy} r={ratioHot ? 6.5 : 5} fill="#7dd3fc" fillOpacity={ratioHot ? 1 : 0.85} stroke="#0b1a24" strokeWidth="1.2" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1 w-10 shrink-0">
            <span className="text-[9px] text-bluegraphite-400/60 font-medium">OUT</span>
            <div className="flex-1 w-6 bg-black/60 border border-bluegraphite-500/20 relative overflow-hidden rounded-sm">
              {safe.enabled && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bluegraphite-600 via-bluegraphite-400 to-bluegraphite-300" style={{ height: `${meterPct(outputLevel)}%` }} />}
            </div>
            <span className="text-[8px] text-bluegraphite-400/80 font-mono">{safe.enabled ? outputLevel.toFixed(0) : '-60'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 w-10 shrink-0">
            <span className="text-[9px] text-amber-400/60 font-medium">GR</span>
            {safe.msMode ? (
              <div className="flex-1 flex gap-0.5 w-6">
                <div className="flex-1 bg-black/60 border border-amber-500/20 relative overflow-hidden rounded-sm">
                  {safe.enabled && grMid > 0 && <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-500 to-amber-300" style={{ height: `${Math.min(100, grMid * 4)}%` }} />}
                </div>
                <div className="flex-1 bg-black/60 border border-amber-500/20 relative overflow-hidden rounded-sm">
                  {safe.enabled && grSide > 0 && <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-500 to-amber-300" style={{ height: `${Math.min(100, grSide * 4)}%` }} />}
                </div>
              </div>
            ) : (
              <div className="flex-1 w-6 bg-black/60 border border-amber-500/20 relative overflow-hidden rounded-sm">
                {safe.enabled && gainReduction > 0 && <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-500 to-amber-300" style={{ height: `${Math.min(100, gainReduction * 4)}%` }} />}
              </div>
            )}
            <span className="text-[8px] text-amber-400/80 font-mono">{safe.enabled ? (safe.msMode ? `${grMid.toFixed(1)}·${grSide.toFixed(1)}` : `-${gainReduction.toFixed(1)}`) : '0'}</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1 shrink-0">
          <Dial value={getCh('threshold')} onChange={(v) => setCh('threshold', v)} defaultValue={defCh('threshold')} min={-60} max={0} step={0.5} label="Thresh" unit="dB" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={getCh('ratio')} onChange={(v) => setCh('ratio', v)} defaultValue={defCh('ratio')} min={1} max={20} step={0.1} label="Ratio" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={getCh('knee')} onChange={(v) => setCh('knee', v)} defaultValue={defCh('knee')} min={0} max={40} step={1} label="Knee" unit="dB" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={getCh('makeupGain')} onChange={(v) => setCh('makeupGain', v)} defaultValue={defCh('makeupGain')} min={0} max={24} step={0.5} label="Makeup" unit="dB" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={getCh('attack') * 1000} onChange={(v) => setCh('attack', v / 1000)} defaultValue={defCh('attack') * 1000} min={1} max={300} step={1} label="Attack" unit="ms" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={getCh('release') * 1000} onChange={(v) => setCh('release', v / 1000)} defaultValue={defCh('release') * 1000} min={10} max={1000} step={10} label="Release" unit="ms" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={Math.round((getCh('model') ?? 1) * 100)} onChange={(v) => setCh('model', v / 100)} defaultValue={Math.round((defCh('model') ?? 1) * 100)} min={0} max={200} step={1} label="Model" unit="%" size="small" accent={msOn ? channelColor : '#5b7a99'} />
          <Dial value={safe.mix ?? 100} onChange={(v) => set('mix', v)} defaultValue={100} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent={msOn ? channelColor : '#5b7a99'} />
        </div>
      </div>
    </div>
  );
}