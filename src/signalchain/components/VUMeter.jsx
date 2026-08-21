import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { getMeterStandby, subscribeMeterStandby } from '../meterStandby.js';
import { Slider } from './ui/slider';

/**
 * Stereo VU meter — a single unit with a Round/Rect toggle (saves space).
 *   - "round": circular amber gauge (100° sweep)
 *   - "rect" : wide rectangular amber gauge (150° sweep) + secondary % scale
 *
 * Reads the same `engine` as the digital LevelMeter (getDetail() → { left, right }).
 * VU ballistics: ~300ms one-pole smoothing; 0 VU aligned to -18 dBFS.
 *
 * Standard VU geometry (ANSI C16.5 / IEC 60268-17): the d'Arsonval movement is
 * linear in VOLTAGE, so the dial is exponential in VU. Full-scale deflection
 * (+3 VU) sits at the right edge; the rest peg (0 V) at the left. This places
 * −3 VU (half power) left of centre, 0 VU at ~71 %, and the 0→+3 red zone in
 * the rightmost ~29 % — NOT at half. 0 VU is calibrated to −18 dBFS RMS.
 */

// Per-variant sweep (degrees; 0 = vertical up, + = clockwise/right).
const ANGLES = {
  round: { min: -50, max: 50 }, // 100° total
  rect: { min: -75, max: 75 },  // 150° total — fills the rectangular window
};

function vuFrac(v) {
  return Math.pow(10, (v - 3) / 20);
}
function vuAngle(v, aMin, aMax) {
  const f = Math.max(0, Math.min(1, vuFrac(v)));
  return aMin + f * (aMax - aMin);
}

const MAJOR = [
  { v: -20, label: '20' }, { v: -10, label: '10' }, { v: -7, label: '7' },
  { v: -5, label: '5' }, { v: -3, label: '3' }, { v: -2, label: '2' },
  { v: -1, label: '1' }, { v: 0, label: '0' }, { v: 1, label: '+1' },
  { v: 2, label: '+2' }, { v: 3, label: '+3' },
];
const MAJOR_SET = new Set(MAJOR.map((m) => m.v));

// Minor graduation ticks. Below −10 every 2 VU; −10..0 every 1 VU; red zone 0.5 VU.
const MINOR = [];
for (let v = -18; v <= -12; v += 2) MINOR.push(v);
for (let v = -9; v <= -1; v += 1) if (!MAJOR_SET.has(v)) MINOR.push(v);
[0.5, 1.5, 2.5].forEach((v) => MINOR.push(v));

// Secondary percentage scale (-20..0 VU ⇆ 0..100 %).
const PCT = [20, 40, 60, 80, 100];
const pctToVU = (p) => (p / 100) * 20 - 20;

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function arcPath(cx, cy, r, a0, a1) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
}

function useNeedle(engine, channel, pivotRef, aMin, aMax, monitor = 'out', ballistics = { rise: 100, fall: 100 }) {
  const needleRef = useRef(null);
  const frac = useRef(0);
  const standbyRef = useRef(getMeterStandby());
  useEffect(() => subscribeMeterStandby((v) => { standbyRef.current = v; }), []);
  const rise = (ballistics?.rise ?? 100) / 1000;
  const fall = (ballistics?.fall ?? 100) / 1000;
  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (t) => {
      if (standbyRef.current && frac.current < 0.001) {
        last = t;
        raf = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      let vu;
      if (standbyRef.current) {
        vu = -100; // silence — needle falls to zero
      } else {
        const det = monitor === 'in' ? engine?.getDetailIn?.() : engine?.getDetail?.();
        const db = det ? det[channel]?.rms : -100;
        vu = db + 18; // 0 VU calibrated to −18 dBFS
      }
      const target = Math.max(0, Math.min(1, vuFrac(vu)));
      // Independent rise/fall time constants (seconds) — settable via the
      // ballistics popover. Lower rise = sharper attack tracking.
      const tc = target >= frac.current ? rise : fall;
      const k = 1 - Math.exp(-dt / Math.max(0.001, tc));
      frac.current += (target - frac.current) * k;
      if (needleRef.current && pivotRef?.current) {
        const { x, y } = pivotRef.current;
        const ang = aMin + frac.current * (aMax - aMin);
        needleRef.current.setAttribute('transform', `rotate(${ang.toFixed(2)} ${x} ${y})`);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, channel, pivotRef, aMin, aMax, monitor, rise, fall]);
  return needleRef;
}

const G = (pfx, ch) => `${pfx}-${ch}`;

// ============ ROUND DIAL ============
function RoundDial({ engine, channel, label, aMin, aMax, monitor, ballistics }) {
  const CX = 130;
  const CY = 200;
  const R = 116;
  const LR = R - 24;
  const PR = R - 52;
  const pivotRef = useRef({ x: CX, y: CY });
  const needleRef = useNeedle(engine, channel, pivotRef, aMin, aMax, monitor, ballistics);
  const angOf = (v) => vuAngle(v, aMin, aMax);
  const redA0 = angOf(0);
  const redA1 = angOf(3);
  const F = G('rface', channel);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full max-w-[220px] rounded-full bg-gradient-to-b from-zinc-300 to-zinc-600 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.65)]">
        <svg viewBox="0 0 260 260" className="h-auto w-full" textRendering="geometricPrecision" shapeRendering="geometricPrecision">
          <defs>
            <radialGradient id={F} cx="50%" cy="40%" r="68%">
              <stop offset="0%" stopColor="#fff4d6" />
              <stop offset="55%" stopColor="#fbd99b" />
              <stop offset="100%" stopColor="#e3b86a" />
            </radialGradient>
            <radialGradient id={G('rvig', channel)} cx="50%" cy="82%" r="80%">
              <stop offset="72%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#2a2a2a" stopOpacity="0.22" />
            </radialGradient>
            <linearGradient id={G('rflare', channel)} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="40%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={G('rbezel', channel)} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f4f4f6" />
              <stop offset="48%" stopColor="#9a9aa2" />
              <stop offset="100%" stopColor="#52525a" />
            </linearGradient>
          </defs>

          <circle cx={CX} cy={CX} r="128" fill={`url(#${G('rbezel', channel)})`} />
          <circle cx={CX} cy={CX} r="120" fill="#1a1a1a" />
          <circle cx={CX} cy={CX} r="118" fill={`url(#${F})`} stroke="#5a5a52" strokeWidth="1.2" />
          <circle cx={CX} cy={CX} r="118" fill={`url(#${G('rvig', channel)})`} />

          <path d={arcPath(CX, CY, R, redA0, redA1)} stroke="#D60000" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.92" />
          <path d={arcPath(CX, CY, R + 7, redA0, redA1)} stroke="#D60000" strokeWidth="1.4" fill="none" opacity="0.4" />

          {MINOR.map((v) => {
            const a = angOf(v);
            const p1 = polar(CX, CY, R + 2, a);
            const p2 = polar(CX, CY, R - 4, a);
            return <line key={`mi${v}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2a1a00" strokeWidth="1" strokeLinecap="round" opacity="0.7" />;
          })}

          {PCT.map((p) => {
            const a = angOf(pctToVU(p));
            const p1 = polar(CX, CY, PR + 6, a);
            const p2 = polar(CX, CY, PR - 2, a);
            return <line key={`pc${p}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3a2a00" strokeWidth="1" strokeLinecap="round" opacity="0.55" />;
          })}

          {MAJOR.map((tk) => {
            const a = angOf(tk.v);
            const p1 = polar(CX, CY, R + 4, a);
            const p2 = polar(CX, CY, R - 9, a);
            const lp = polar(CX, CY, LR, a);
            const red = tk.v >= 1;
            const zero = tk.v === 0;
            const dense = tk.v >= -3 && tk.v <= 0;
            return (
              <g key={tk.v}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={red ? '#A30000' : '#1c1200'} strokeWidth={zero ? 2.8 : 2} strokeLinecap="round" />
                <text x={lp.x} y={lp.y} fill={red ? '#A30000' : '#1c1200'} fontSize={dense ? 7.5 : 9.5} fontWeight={zero ? 800 : 700} textAnchor="middle" dominantBaseline="middle" fontFamily="'Helvetica Neue', Arial, sans-serif">{tk.label}</text>
              </g>
            );
          })}

          {PCT.map((p) => {
            const a = angOf(pctToVU(p));
            const lp = polar(CX, CY, PR, a);
            return <text key={`pl${p}`} x={lp.x} y={lp.y} fill="#4a3000" fontSize="5.5" fontWeight={600} textAnchor="middle" dominantBaseline="middle" fontFamily="'Helvetica Neue', Arial, sans-serif">{p}</text>;
          })}

          <g ref={needleRef} transform={`rotate(${aMin} ${CX} ${CY})`}>
            <line x1={CX} y1={CY + 16} x2={CX} y2={CY + 4} stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
            <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points={`${CX - 2.2},${CY - R + 14} ${CX + 2.2},${CY - R + 14} ${CX},${CY - R + 2}`} fill="#0a0a0a" />
          </g>
          <circle cx={CX} cy={CY} r="7.5" fill="#0c0c0c" stroke="#6a6a6a" strokeWidth="0.8" />
          <circle cx={CX} cy={CY} r="3" fill="#3a3a3a" />

          <text x={CX + 70} y={CY - 6} textAnchor="middle" fontSize="15" fontWeight={800} fill="#1c1200" letterSpacing="1.5" fontFamily="'Helvetica Neue', Arial, sans-serif">VU</text>
          <text x={CX - 70} y={CY - 6} textAnchor="middle" fontSize="6" fontWeight={600} fill="#4a3000" letterSpacing="0.5" fontFamily="'Helvetica Neue', Arial, sans-serif">0VU=-18dB</text>

          <ellipse cx={CX - 34} cy={CX - 54} rx="54" ry="32" fill={`url(#${G('rflare', channel)})`} transform={`rotate(-34 ${CX - 34} ${CX - 54})`} />
        </svg>
      </div>
      <span className="sc-vu-label font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

// ============ RECTANGULAR (stereo, single wide housing) ============
// One wide brushed-metal housing holding two amber movements side by side,
// sized to the same height as the round dial so the panel matches. The two
// faces fill the panel (no top/bottom letterbox); L/R labels sit below.
function RectMovement({ engine, channel, cx, cy, r, face, aMin, aMax, faceGrad = 'sface', vigGrad = 'svig', monitor, ballistics }) {
  const pivotRef = useRef({ x: cx, y: cy });
  const needleRef = useNeedle(engine, channel, pivotRef, aMin, aMax, monitor, ballistics);
  const angOf = (v) => vuAngle(v, aMin, aMax);
  const redA0 = angOf(0);
  const redA1 = angOf(3);
  const LR = r - 20;
  const PR = r - 38;
  const { x, y, w, h } = face;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={`url(#${faceGrad})`} stroke="#5a5a52" strokeWidth="1.4" />
      <rect x={x} y={y} width={w} height={h} rx="6" fill={`url(#${vigGrad})`} />

      <path d={arcPath(cx, cy, r, redA0, redA1)} stroke="#D60000" strokeWidth="4.5" fill="none" strokeLinecap="round" opacity="0.92" />

      {MINOR.map((v) => {
        const a = angOf(v);
        const p1 = polar(cx, cy, r + 1, a);
        const p2 = polar(cx, cy, r - 5, a);
        return <line key={`mi${v}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2a1a00" strokeWidth="1" strokeLinecap="round" opacity="0.7" />;
      })}

      {PCT.map((p) => {
        const a = angOf(pctToVU(p));
        const p1 = polar(cx, cy, PR + 5, a);
        const p2 = polar(cx, cy, PR - 2, a);
        return <line key={`pc${p}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3a2a00" strokeWidth="1" strokeLinecap="round" opacity="0.5" />;
      })}

      {MAJOR.map((tk) => {
        const a = angOf(tk.v);
        const p1 = polar(cx, cy, r + 3, a);
        const p2 = polar(cx, cy, r - 9, a);
        const lp = polar(cx, cy, LR, a);
        const red = tk.v >= 1;
        const zero = tk.v === 0;
        const dense = tk.v >= -3 && tk.v <= 0;
        return (
          <g key={tk.v}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={red ? '#A30000' : '#1c1200'} strokeWidth={zero ? 2.6 : 2} strokeLinecap="round" />
            <text x={lp.x} y={lp.y} fill={red ? '#A30000' : '#1c1200'} fontSize={dense ? 7 : 8.5} fontWeight={zero ? 800 : 700} textAnchor="middle" dominantBaseline="middle" fontFamily="'Helvetica Neue', Arial, sans-serif">{tk.label}</text>
          </g>
        );
      })}

      <g ref={needleRef} transform={`rotate(${aMin} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + 14} x2={cx} y2={cy + 4} stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
        <polygon points={`${cx - 2},${cy - r + 14} ${cx + 2},${cy - r + 14} ${cx},${cy - r + 2}`} fill="#0a0a0a" />
      </g>
      <path d={`M ${cx - 16} ${cy} A 16 16 0 0 1 ${cx + 16} ${cy} Z`} fill="#0e0e0e" stroke="#3a3a3a" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="5.5" fill="#000" stroke="#5a5a5a" strokeWidth="0.5" />
      <line x1={cx - 2.5} y1={cy} x2={cx + 2.5} y2={cy} stroke="#7a7a7a" strokeWidth="0.9" />

      <text x={cx + r * 0.5} y={cy + 30} textAnchor="middle" fontSize="12" fontWeight={800} fill="#1c1200" letterSpacing="1.2" fontFamily="'Helvetica Neue', Arial, sans-serif">VU</text>
      <text x={cx - r * 0.5} y={cy + 28} textAnchor="middle" fontSize="5.5" fontWeight={600} fill="#4a3000" letterSpacing="0.3" fontFamily="'Helvetica Neue', Arial, sans-serif">0VU=-18dB</text>
    </g>
  );
}

function SingleRectMeter({ engine, channel, label, monitor, ballistics }) {
  const aMin = ANGLES.rect.min;
  const aMax = ANGLES.rect.max;
  const face = { x: 6, y: 6, w: 268, h: 160 };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative aspect-[280/172] w-full max-w-[280px] rounded-md bg-gradient-to-b from-zinc-300 to-zinc-600 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.65)]">
        <svg viewBox="0 0 280 172" preserveAspectRatio="xMidYMid meet" className="h-full w-full" textRendering="geometricPrecision" shapeRendering="geometricPrecision">
          <defs>
            <radialGradient id={`sface-${channel}`} cx="50%" cy="40%" r="68%">
              <stop offset="0%" stopColor="#fff4d6" />
              <stop offset="55%" stopColor="#fbd99b" />
              <stop offset="100%" stopColor="#e3b86a" />
            </radialGradient>
            <radialGradient id={`svig-${channel}`} cx="50%" cy="88%" r="82%">
              <stop offset="72%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#2a2a2a" stopOpacity="0.22" />
            </radialGradient>
          </defs>
          <RectMovement engine={engine} channel={channel} cx={140} cy={134} r={122} face={face} aMin={aMin} aMax={aMax} faceGrad={`sface-${channel}`} vigGrad={`svig-${channel}`} monitor={monitor} ballistics={ballistics} />
        </svg>
      </div>
      <span className="sc-vu-label font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

function StereoRectMeter({ engine, monitor, ballistics }) {
  return (
    <div className="flex items-start justify-center gap-8 sm:gap-12">
      <SingleRectMeter engine={engine} channel="left" label="L Meter" monitor={monitor} ballistics={ballistics} />
      <SingleRectMeter engine={engine} channel="right" label="R Meter" monitor={monitor} ballistics={ballistics} />
    </div>
  );
}

export default function VUMeter({ engine, variant: initialVariant = 'round' }) {
  const [variant, setVariant] = useState(initialVariant);
  const [monitor, setMonitor] = useState('out');
  const [showSettings, setShowSettings] = useState(false);
  const [ballistics, setBallistics] = useState({ rise: 100, fall: 100 });
  const isRect = variant === 'rect';
  const { min, max } = ANGLES.round;

  return (
    <div
      className={`relative rounded-xl p-4 pb-5 shadow-[0_10px_24px_rgba(0,0,0,0.55)] sc-vu-panel ${isRect ? 'sc-vu-panel--rect' : ''}`}
    >
      {['left-2 top-2', 'right-2 top-2', 'left-2 bottom-2', 'right-2 bottom-2'].map((pos) => (
        <span key={pos} className={`absolute ${pos} h-2.5 w-2.5 rounded-full bg-gradient-to-b from-zinc-400 to-zinc-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]`} />
      ))}

      <div className={`mb-3 flex items-center justify-between rounded-md px-3 py-1.5 ${isRect ? 'bg-black/60' : 'bg-[#1a1a1a]'}`}>
        <span className={`font-mono text-[9px] font-bold tracking-[0.25em] ${isRect ? 'text-zinc-400' : 'text-zinc-300'}`}>VU METER</span>
        <div className="flex items-center gap-2">
          {/* IN / OUT source — read pre-chain (IN) or post-master (OUT) */}
          <div className={`flex overflow-hidden rounded-md border ${isRect ? 'border-cyan-600' : 'border-cyan-700/60'}`}>
            <button
              onClick={() => setMonitor('in')}
              className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider transition-all ${monitor === 'in' ? 'bg-cyan-400 text-black' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            >IN</button>
            <button
              onClick={() => setMonitor('out')}
              className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider transition-all ${monitor === 'out' ? 'bg-cyan-400 text-black' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            >OUT</button>
          </div>
          {/* Round / Rect toggle */}
          <div className={`flex overflow-hidden rounded-md border ${isRect ? 'border-zinc-600' : 'border-zinc-700'}`}>
            <button
              onClick={() => setVariant('round')}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold tracking-wider transition-all ${!isRect ? 'bg-amber-400 text-black' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            >ROUND</button>
            <button
              onClick={() => setVariant('rect')}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold tracking-wider transition-all ${isRect ? 'bg-amber-400 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
            >RECT</button>
          </div>
          {/* Ballistics settings */}
          <button
            onClick={() => setShowSettings((s) => !s)}
            title="VU ballistics"
            className={`flex items-center justify-center rounded-md border px-1.5 py-1 transition-all ${showSettings ? 'border-amber-400 bg-amber-400/20 text-amber-300' : isRect ? 'border-zinc-600 text-zinc-400 hover:text-zinc-200' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fixed-height meter bed — meters never move. The ballistics settings
          popover overlays the meters (absolute) instead of pushing them down. */}
      <div className="relative flex h-[240px] items-center justify-center">
        {isRect ? (
          <StereoRectMeter engine={engine} monitor={monitor} ballistics={ballistics} />
        ) : (
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <RoundDial engine={engine} channel="left" label="L Meter" aMin={min} aMax={max} monitor={monitor} ballistics={ballistics} />
            <RoundDial engine={engine} channel="right" label="R Meter" aMin={min} aMax={max} monitor={monitor} ballistics={ballistics} />
          </div>
        )}

        {/* Ballistics settings popover — overlays the meters, never shifts them */}
        {showSettings && (
          <div className={`absolute inset-x-2 bottom-1 z-20 rounded-md px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${isRect ? 'bg-black/80' : 'bg-[#161616]/95'} backdrop-blur-sm`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex justify-between text-[9px] font-mono">
                  <span className="text-zinc-400">Rise</span>
                  <span className="text-amber-300">{ballistics.rise} ms</span>
                </div>
                <Slider value={[ballistics.rise]} onValueChange={([v]) => setBallistics((b) => ({ ...b, rise: v }))} min={10} max={600} step={5} className="[&_.bg-primary]:bg-amber-500/40 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-300" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[9px] font-mono">
                  <span className="text-zinc-400">Fall</span>
                  <span className="text-amber-300">{ballistics.fall} ms</span>
                </div>
                <Slider value={[ballistics.fall]} onValueChange={([v]) => setBallistics((b) => ({ ...b, fall: v }))} min={10} max={1000} step={5} className="[&_.bg-primary]:bg-amber-500/40 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-300" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[8px] font-mono text-zinc-500">
              <span>Lower = faster / more transient. Standard VU ≈ 300 ms.</span>
              <button onClick={() => setBallistics({ rise: 300, fall: 300 })} className="rounded border border-zinc-600 px-1.5 py-0.5 text-zinc-300 hover:bg-white/10">Standard VU</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}