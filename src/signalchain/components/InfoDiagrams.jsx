import React, { useContext, createContext } from 'react';
import { satTransfer } from '../satModel.js';

/**
 * Labeled SVG diagrams for the info modals — a learner's manual of the
 * shapes behind every processor. Each diagram is a focused, self-contained
 * component rendered inside the InfoButton modal (dark) OR the printable
 * booklet (dark / light). Colour, grid, axis and label fills all come from a
 * mode-aware palette supplied by <InfoDiagram mode=...>, so the same diagram
 * renders correctly on the app's dark modal and on the booklet's white page.
 */

const W = 300, H = 140, MID = 70;

/* ── mode-aware palette ── */
const DARK = {
  grid: 'rgba(255,255,255,0.09)',
  axis: 'rgba(255,255,255,0.4)',
  faint: 'rgba(255,255,255,0.4)',
  cyan: '#22d3ee', violet: '#a78bfa', amber: '#fbbf24',
  rose: '#fb7185', emerald: '#34d399', blue: '#60a5fa',
  pink: '#f472b6', lime: '#a3e635', orange: '#fb923c', sky: '#7dd3fc',
  boxCls: 'rounded-md border border-white/10 bg-black/30 p-2',
  boxTitle: 'text-white/55',
  lbl: 'rgba(255,255,255,0.75)',
  blockFill: 'rgba(255,255,255,0.06)', blockStroke: 'rgba(255,255,255,0.25)', blockTxt: 'rgba(255,255,255,0.85)',
  arrow: 'rgba(255,255,255,0.5)',
  legendBg: 'rgba(0,0,0,0.5)', legendBorder: 'rgba(255,255,255,0.12)',
  legendText: 'rgba(255,255,255,0.85)',
};
const LIGHT = {
  grid: 'rgba(15,23,42,0.10)',
  axis: 'rgba(15,23,42,0.45)',
  faint: 'rgba(15,23,42,0.5)',
  cyan: '#0891b2', violet: '#7c3aed', amber: '#d97706',
  rose: '#e11d48', emerald: '#059669', blue: '#2563eb',
  pink: '#db2777', lime: '#65a30d', orange: '#ea580c', sky: '#0284c7',
  boxCls: 'rounded-md border border-slate-200 bg-slate-50 p-2',
  boxTitle: 'text-slate-500',
  lbl: 'rgba(15,23,42,0.72)',
  blockFill: 'rgba(15,23,42,0.04)', blockStroke: 'rgba(15,23,42,0.28)', blockTxt: 'rgba(15,23,42,0.85)',
  arrow: 'rgba(15,23,42,0.5)',
  legendBg: 'rgba(255,255,255,0.78)', legendBorder: 'rgba(15,23,42,0.12)',
  legendText: 'rgba(15,23,42,0.85)',
};

const DiagramCtx = createContext({ C: DARK });

function poly(fn, n = 80) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    pts.push(fn(x).map((v) => v.toFixed(1)).join(','));
  }
  return pts.join(' ');
}

function Grid({ cols = 6, rows = 4, h = H }) {
  const { C } = useContext(DiagramCtx);
  const out = [];
  for (let i = 0; i <= cols; i++) { const x = (i / cols) * W; out.push(<line key={'v' + i} x1={x} y1={0} x2={x} y2={h} stroke={C.grid} strokeWidth={0.5} />); }
  for (let i = 0; i <= rows; i++) { const y = (i / rows) * h; out.push(<line key={'h' + i} x1={0} y1={y} x2={W} y2={y} stroke={C.grid} strokeWidth={0.5} />); }
  return <g>{out}</g>;
}

function Box({ title, children }) {
  const { C } = useContext(DiagramCtx);
  return (
    <div className={C.boxCls}>
      {title && <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${C.boxTitle}`}>{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 210 }}>{children}</svg>
    </div>
  );
}

function Lbl({ x, y, children, fill, anchor = 'start', size = 8 }) {
  const { C } = useContext(DiagramCtx);
  return <text x={x} y={y} fill={fill || C.lbl} fontSize={size} fontFamily="ui-monospace,monospace" textAnchor={anchor}>{children}</text>;
}

function Block({ x, y, w, h, label, fill, stroke, txt }) {
  const { C } = useContext(DiagramCtx);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill || C.blockFill} stroke={stroke || C.blockStroke} strokeWidth={0.8} />
      <text x={x + w / 2} y={y + h / 2 + 3} fill={txt || C.blockTxt} fontSize={8} fontFamily="ui-monospace,monospace" textAnchor="middle">{label}</text>
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color }) {
  const { C } = useContext(DiagramCtx);
  const col = color || C.arrow;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ah = 4;
  return (
    <g stroke={col} strokeWidth={1} fill={col}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={`${x2},${y2} ${x2 - ah * Math.cos(ang - 0.4)},${y2 - ah * Math.sin(ang - 0.4)} ${x2 - ah * Math.cos(ang + 0.4)},${y2 - ah * Math.sin(ang + 0.4)}`} />
    </g>
  );
}

/* ── 1. EQ response shapes ── */
function EQShapes() {
  const { C } = useContext(DiagramCtx);
  const Fs = 96000, fMin = 20, fMax = 20000;
  const lmin = Math.log10(fMin), lmax = Math.log10(fMax);
  const xOf = (f) => ((Math.log10(f) - lmin) / (lmax - lmin)) * W;
  const fOf = (x) => Math.pow(10, lmin + (x / W) * (lmax - lmin));
  const span = 36;
  const toY = (db) => MID - db * (H / span);

  const magDb = (c, f) => {
    const w = (2 * Math.PI * f) / Fs;
    const cw = Math.cos(w), sw = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nR = c.b0 + c.b1 * cw + c.b2 * c2;
    const nI = -(c.b1 * sw + c.b2 * s2);
    const dR = c.a0 + c.a1 * cw + c.a2 * c2;
    const dI = -(c.a1 * sw + c.a2 * s2);
    return 20 * Math.log10(Math.sqrt(nR * nR + nI * nI) / Math.sqrt(dR * dR + dI * dI));
  };

  const coef = (f0, G, type, Q = 0.707) => {
    const A = Math.pow(10, G / 20);
    const w0 = (2 * Math.PI * f0) / Fs, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q), sqA = Math.sqrt(A);
    if (type === 'peak') {
      const a0 = 1 + al;
      return { b0: (1 + al * A) / a0, b1: (-2 * cw) / a0, b2: (1 - al * A) / a0, a0: 1, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
    }
    if (type === 'lowshelf') {
      const a0 = (A + 1) + (A - 1) * cw + 2 * sqA * al;
      return {
        b0: (A * ((A + 1) - (A - 1) * cw + 2 * sqA * al)) / a0,
        b1: (2 * A * ((A - 1) - (A + 1) * cw)) / a0,
        b2: (A * ((A + 1) - (A - 1) * cw - 2 * sqA * al)) / a0,
        a0: 1, a1: (-2 * ((A - 1) + (A + 1) * cw)) / a0, a2: ((A + 1) + (A - 1) * cw - 2 * sqA * al) / a0,
      };
    }
    if (type === 'highshelf') {
      const a0 = (A + 1) - (A - 1) * cw + 2 * sqA * al;
      return {
        b0: (A * ((A + 1) + (A - 1) * cw + 2 * sqA * al)) / a0,
        b1: (-2 * A * ((A - 1) + (A + 1) * cw)) / a0,
        b2: (A * ((A + 1) + (A - 1) * cw - 2 * sqA * al)) / a0,
        a0: 1, a1: (2 * ((A - 1) - (A + 1) * cw)) / a0, a2: ((A + 1) - (A - 1) * cw - 2 * sqA * al) / a0,
      };
    }
    if (type === 'lpf') {
      const a0 = 1 + al;
      return { b0: ((1 - cw) / 2) / a0, b1: (1 - cw) / a0, b2: ((1 - cw) / 2) / a0, a0: 1, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
    }
    const a0 = 1 + al;
    return { b0: ((1 + cw) / 2) / a0, b1: -(1 + cw) / a0, b2: ((1 + cw) / 2) / a0, a0: 1, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
  };

  const ls = coef(200, 9, 'lowshelf');
  const bell = coef(1200, 10, 'peak', 1.0);
  const hs = coef(4000, 9, 'highshelf');
  const hp = coef(100, 0, 'hpf');
  const lp = coef(8000, 0, 'lpf');

  const curve = (c, n = 140) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W;
      const db = magDb(c, fOf(x));
      pts.push(`${x.toFixed(1)},${Math.max(2, Math.min(H - 2, toY(db))).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <Box title="Response shapes — shelf · bell · cut (log-freq, 2nd-order)">
      <Grid />
      <line x1={0} y1={MID} x2={W} y2={MID} stroke={C.axis} strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={curve(lp)} fill="none" stroke={C.emerald} strokeWidth={1.4} strokeDasharray="4 3" />
      <polyline points={curve(hp)} fill="none" stroke={C.amber} strokeWidth={1.4} strokeDasharray="4 3" />
      <polyline points={curve(ls)} fill="none" stroke={C.blue} strokeWidth={1.8} />
      <polyline points={curve(bell)} fill="none" stroke={C.violet} strokeWidth={1.8} />
      <polyline points={curve(hs)} fill="none" stroke={C.pink} strokeWidth={1.8} />
      {[100, 1000, 10000].map((f) => (
        <g key={f}>
          <line x1={xOf(f)} y1={MID - 2} x2={xOf(f)} y2={MID + 2} stroke={C.axis} strokeWidth={0.7} />
          <Lbl x={xOf(f)} y={H - 1} anchor="middle" size={6} fill={C.faint}>{f >= 1000 ? f / 1000 + 'k' : f}</Lbl>
        </g>
      ))}
      <Lbl x={W - 2} y={MID - 2} anchor="end" size={6} fill={C.faint}>0 dB</Lbl>
      <Lbl x={6} y={toY(9) - 3} fill={C.blue}>Low shelf</Lbl>
      <Lbl x={xOf(1200)} y={toY(10) - 4} anchor="middle" fill={C.violet}>Bell</Lbl>
      <Lbl x={W - 6} y={toY(9) - 3} anchor="end" fill={C.pink}>High shelf</Lbl>
      <Lbl x={6} y={H - 11} fill={C.amber}>HP cut</Lbl>
      <Lbl x={W - 6} y={H - 11} anchor="end" fill={C.emerald}>LP cut</Lbl>
    </Box>
  );
}

/* ── 2. Compressor transfer curve ── */
function CompressorTransfer() {
  const { C } = useContext(DiagramCtx);
  const thr = -24, ratio = 4;
  const dbX = (db) => (db + 60) / 60 * W;
  const dbY = (db) => 10 + (-db) / 60 * 120;
  const out = (db) => (db <= thr ? db : thr + (db - thr) / ratio);
  return (
    <Box title="Transfer curve — threshold & ratio">
      <Grid />
      <polyline points={poly((x) => { const db = x / W * 60 - 60; return [dbX(db), dbY(db)]; })} fill="none" stroke={C.axis} strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={poly((x) => { const db = x / W * 60 - 60; return [dbX(db), dbY(out(db))]; })} fill="none" stroke={C.cyan} strokeWidth={2} />
      <line x1={dbX(thr)} y1={0} x2={dbX(thr)} y2={H} stroke={C.amber} strokeWidth={0.8} strokeDasharray="3 2" />
      <circle cx={dbX(thr)} cy={dbY(thr)} r={2.5} fill={C.amber} />
      <Lbl x={dbX(thr) + 3} y={12} fill={C.amber}>thr {thr}</Lbl>
      <Lbl x={286} y={dbY(out(0)) - 4} anchor="end" fill={C.cyan}>{ratio}:1</Lbl>
      <Lbl x={4} y={14} fill={C.faint}>out dB</Lbl>
      <Lbl x={W - 4} y={H - 4} anchor="end" fill={C.faint}>in dB</Lbl>
    </Box>
  );
}

/* ── 3. Compressor gain reduction over time ── */
function CompressorGR() {
  const { C } = useContext(DiagramCtx);
  const env = (t) => {
    if (t < 70) return 0.25;
    if (t < 110) return 0.25 + (t - 70) / 40 * 0.7;
    if (t < 200) return 0.95;
    if (t < 240) return 0.95 - (t - 200) / 40 * 0.7;
    return 0.25;
  };
  const thr = 0.5, ratio = 4;
  const envY = (e) => 120 - e * 36;
  const gr = (t) => Math.max(0, (env(t) - thr) * (1 - 1 / ratio));
  const grTop = 42;
  const grY = (g) => grTop + g * 34;
  return (
    <Box title="Gain reduction — ducks the loud part only">
      <Grid />
      <line x1={0} y1={grTop} x2={W} y2={grTop} stroke={C.axis} strokeWidth={0.8} />
      <Lbl x={4} y={grTop - 3} fill={C.faint}>0 GR</Lbl>
      <polyline points={poly((x) => [x, envY(env(x))])} fill="none" stroke={C.sky} strokeWidth={1.6} />
      <polyline points={poly((x) => [x, grY(gr(x))])} fill="none" stroke={C.rose} strokeWidth={2} />
      <Lbl x={150} y={envY(0.95) - 4} anchor="middle" fill={C.sky}>signal</Lbl>
      <Lbl x={150} y={grY(0.34) + 12} anchor="middle" fill={C.rose}>GR</Lbl>
    </Box>
  );
}

/* ── 4. Limiter ceiling & inter-sample peak ── */
function LimiterCeiling() {
  const { C } = useContext(DiagramCtx);
  const ceil = 46;
  const wf = (x) => 52 + Math.sin(x / 9) * 18 + Math.sin(x / 4) * 10 + Math.sin(x / 22) * 6;
  const pts = [];
  for (let i = 0; i <= 90; i++) { const x = (i / 90) * W; const y = Math.min(ceil, wf(x)); pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
  return (
    <Box title="Brickwall ceiling — peaks shaved, ISP caught">
      <Grid />
      <line x1={0} y1={ceil} x2={W} y2={ceil} stroke={C.rose} strokeWidth={1.4} strokeDasharray="4 2" />
      <Lbl x={W - 4} y={ceil - 4} anchor="end" fill={C.rose}>ceiling</Lbl>
      <polyline points={pts.join(' ')} fill="none" stroke={C.cyan} strokeWidth={1.6} />
      <line x1={150} y1={24} x2={150} y2={38} stroke={C.amber} strokeWidth={2} />
      <circle cx={150} cy={22} r={2.5} fill={C.amber} />
      <Lbl x={156} y={20} fill={C.amber}>inter-sample peak</Lbl>
    </Box>
  );
}

/* ── 5. Multi-band crossover split ── */
function MBCCrossover() {
  const { C } = useContext(DiagramCtx);
  const spec = (x) => 70 - 22 * Math.exp(-Math.pow((Math.log10((x / W * 19980) + 20) - Math.log10(400)) / 1.1, 2)) - 0.012 * x;
  const xovers = [60, 140, 230];
  return (
    <Box title="Linkwitz-Riley crossovers split the spectrum">
      <Grid />
      <polyline points={poly((x) => [x, spec(x)], 90)} fill="none" stroke={C.faint} strokeWidth={1} />
      {xovers.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={0} x2={x} y2={H} stroke={C.amber} strokeWidth={0.8} strokeDasharray="3 2" />
          <rect x={(xovers[i - 1] || 0)} y={20} width={x - (xovers[i - 1] || 0)} height={100} fill={[C.blue, C.violet, C.pink, C.emerald][i]} fillOpacity={0.18} />
        </g>
      ))}
      <rect x={xovers[2]} y={20} width={W - xovers[2]} height={100} fill={C.emerald} fillOpacity={0.18} />
      <Lbl x={30} y={16} anchor="middle" fill={C.blue}>Low</Lbl>
      <Lbl x={100} y={16} anchor="middle" fill={C.violet}>L-Mid</Lbl>
      <Lbl x={185} y={16} anchor="middle" fill={C.pink}>H-Mid</Lbl>
      <Lbl x={265} y={16} anchor="middle" fill={C.emerald}>High</Lbl>
      {xovers.map((x, i) => <Lbl key={i} x={x} y={H - 4} anchor="middle" fill={C.amber}>×{i + 1}</Lbl>)}
    </Box>
  );
}

/* ── 6. Saturation waveshapes (all modes) ── */
function SaturationCurves() {
  const { C } = useContext(DiagramCtx);
  const d = 0.6;
  const toY = (v) => MID - v * 56;
  const modes = [
    ['tube', C.amber], ['tape', C.violet], ['transistor', C.rose], ['opto', C.emerald], ['clean', C.sky],
  ];
  return (
    <Box title="Waveshapes — tube · tape · transistor · opto · clean">
      <Grid />
      <line x1={0} y1={MID} x2={W} y2={MID} stroke={C.axis} strokeWidth={0.8} />
      <line x1={MID} y1={0} x2={MID} y2={H} stroke={C.axis} strokeWidth={0.8} />
      <line x1={0} y1={H} x2={W} y2={0} stroke={C.axis} strokeWidth={0.8} strokeDasharray="3 3" />
      {modes.map(([m, c]) => (
        <polyline key={m} points={poly((x) => { const v = (x / W) * 2 - 1; return [x, toY(satTransfer(m, d, v))]; })} fill="none" stroke={c} strokeWidth={1.5} />
      ))}
      <Lbl x={4} y={H - 4} fill={C.amber}>tube</Lbl>
      <Lbl x={30} y={H - 4} fill={C.violet}>tape</Lbl>
      <Lbl x={56} y={H - 4} fill={C.rose}>trans</Lbl>
      <Lbl x={88} y={H - 4} fill={C.emerald}>opto</Lbl>
      <Lbl x={116} y={H - 4} fill={C.sky}>clean</Lbl>
    </Box>
  );
}

/* ── 7. Clip transfer (symmetry) ── */
function ClipTransfer() {
  const { C } = useContext(DiagramCtx);
  const drive = Math.pow(10, 10 / 20);
  const toY = (v) => MID - v * 56;
  const curve = (s) => poly((x) => { const v = (x / W) * 2 - 1; const ss = s / 100; const dc = Math.tanh(drive * ss); return [x, toY(Math.tanh(drive * (v + ss)) - dc)]; });
  return (
    <Box title="Clip transfer — symmetry adds even harmonics">
      <Grid />
      <line x1={0} y1={MID} x2={W} y2={MID} stroke={C.axis} strokeWidth={0.8} />
      <line x1={MID} y1={0} x2={MID} y2={H} stroke={C.axis} strokeWidth={0.8} />
      <line x1={0} y1={H} x2={W} y2={0} stroke={C.axis} strokeWidth={0.8} strokeDasharray="3 3" />
      <polyline points={curve(0)} fill="none" stroke={C.lime} strokeWidth={1.8} />
      <polyline points={curve(45)} fill="none" stroke={C.orange} strokeWidth={1.5} strokeDasharray="4 2" />
      <Lbl x={4} y={H - 4} fill={C.lime}>sym 0 (odd)</Lbl>
      <Lbl x={W - 4} y={H - 4} anchor="end" fill={C.orange}>sym 45 (even)</Lbl>
    </Box>
  );
}

/* ── 8. Tape frequency response (head bump + HF loss) ── */
function TapeResponse() {
  const { C } = useContext(DiagramCtx);
  const toY = (db) => MID - db * 2.4;
  const f = (x) => Math.pow(10, Math.log10(20) + (x / W) * (Math.log10(20000) - Math.log10(20)));
  const bump = (x) => 6 / (1 + Math.pow(f(x) / 90, 2));
  const loss = (x) => -8 * (1 - 1 / (1 + Math.pow(f(x) / 11000, 2)));
  return (
    <Box title="Tape colour — head bump (low) + HF loss (high)">
      <Grid />
      <line x1={0} y1={MID} x2={W} y2={MID} stroke={C.axis} strokeWidth={0.8} strokeDasharray="3 3" />
      <polyline points={poly((x) => [x, toY(bump(x))])} fill="none" stroke={C.blue} strokeWidth={1.5} strokeDasharray="4 2" />
      <polyline points={poly((x) => [x, toY(loss(x))])} fill="none" stroke={C.pink} strokeWidth={1.5} strokeDasharray="4 2" />
      <polyline points={poly((x) => [x, toY(bump(x) + loss(x))])} fill="none" stroke={C.amber} strokeWidth={2} />
      <Lbl x={6} y={toY(6) - 3} fill={C.blue}>head bump</Lbl>
      <Lbl x={W - 6} y={toY(-8) - 3} anchor="end" fill={C.pink}>HF loss</Lbl>
      <Lbl x={W - 6} y={H - 4} anchor="end" fill={C.amber}>combined</Lbl>
    </Box>
  );
}

/* ── 9. Delay echo taps ── */
function DelayTaps() {
  const { C } = useContext(DiagramCtx);
  const fb = 0.6;
  const taps = [20, 78, 136, 194, 252];
  return (
    <Box title="Feedback delay — geometrically decaying echoes">
      <Grid />
      <line x1={0} y1={120} x2={W} y2={120} stroke={C.axis} strokeWidth={0.8} />
      {taps.map((x, i) => {
        const h = 92 * Math.pow(fb, i);
        return <line key={i} x1={x} y1={120} x2={x} y2={120 - h} stroke={i === 0 ? C.cyan : C.violet} strokeWidth={i === 0 ? 3 : 2.5} />;
      })}
      {taps.map((x, i) => <Lbl key={i} x={x} y={132} anchor="middle" fill={C.faint}>{i === 0 ? 'dry' : `×${Math.pow(fb, i).toFixed(2)}`}</Lbl>)}
    </Box>
  );
}

/* ── 10. Reverb decay envelope ── */
function ReverbDecay() {
  const { C } = useContext(DiagramCtx);
  const decay = poly((x) => { const t = x / W; return [x, 116 - Math.pow(1 - t, 2) * 96]; });
  const spikes = [18, 34, 52, 70, 92, 118, 150, 188, 230];
  return (
    <Box title="Reverb tail — exponentially decaying reflections">
      <Grid />
      <line x1={0} y1={116} x2={W} y2={116} stroke={C.axis} strokeWidth={0.8} />
      {spikes.map((x, i) => { const h = 90 * Math.pow(0.82, i); return <line key={i} x1={x} y1={116} x2={x} y2={116 - h} stroke={C.sky} strokeWidth={1.6} />; })}
      <polyline points={decay} fill="none" stroke={C.violet} strokeWidth={1.5} strokeDasharray="4 2" />
      <Lbl x={4} y={14} fill={C.sky}>early reflections</Lbl>
      <Lbl x={W - 4} y={40} anchor="end" fill={C.violet}>RT60 tail</Lbl>
    </Box>
  );
}

/* ── 11. Dynamic EQ de-esser architecture ── */
function DynEQArchitecture() {
  const { C } = useContext(DiagramCtx);
  return (
    <Box title="De-esser — a compressor inside an EQ band">
      <Block x={6} y={58} w={34} h={24} label="Input" fill={C.cyan + '1f'} stroke={C.cyan + '88'} txt={C.blockTxt} />
      <Block x={58} y={18} w={44} h={18} label="Bandpass" fill={C.violet + '1f'} stroke={C.violet + '88'} txt={C.blockTxt} />
      <Block x={116} y={18} w={40} h={18} label="Comp" fill={C.amber + '1f'} stroke={C.amber + '88'} txt={C.blockTxt} />
      <Block x={174} y={18} w={30} h={18} label="×g" fill={C.emerald + '1f'} stroke={C.emerald + '88'} txt={C.blockTxt} />
      <Block x={58} y={96} w={44} h={18} label="Bandpass" fill={C.violet + '1a'} stroke={C.violet + '88'} txt={C.blockTxt} />
      <Block x={116} y={96} w={40} h={18} label="compIdle" fill={C.rose + '1f'} stroke={C.rose + '88'} txt={C.blockTxt} />
      <Block x={174} y={96} w={30} h={18} label="×−1" fill={C.rose + '1f'} stroke={C.rose + '88'} txt={C.blockTxt} />
      <circle cx={230} cy={70} r={9} fill="none" stroke={C.cyan} strokeWidth={1.2} />
      <text x={230} y={73} fill={C.cyan} fontSize={9} fontFamily="ui-monospace,monospace" textAnchor="middle">Σ</text>
      <Block x={252} y={58} w={34} h={24} label="Out" fill={C.cyan + '1f'} stroke={C.cyan + '88'} txt={C.blockTxt} />
      <Arrow x1={40} y1={64} x2={56} y2={27} />
      <Arrow x1={102} y1={27} x2={114} y2={27} />
      <Arrow x1={156} y1={27} x2={172} y2={27} />
      <Arrow x1={204} y1={27} x2={224} y2={62} />
      <Arrow x1={40} y1={76} x2={56} y2={105} />
      <Arrow x1={102} y1={105} x2={114} y2={105} />
      <Arrow x1={156} y1={105} x2={172} y2={105} />
      <Arrow x1={204} y1={105} x2={224} y2={78} />
      <Arrow x1={40} y1={70} x2={224} y2={70} color={C.sky + '66'} />
      <Arrow x1={239} y1={70} x2={250} y2={70} />
    </Box>
  );
}

/* ── 12. Mastering chain order ── */
function MasteringChain() {
  const { C } = useContext(DiagramCtx);
  const steps = ['EQ', 'Comp', 'Sat/Tape', 'M-Band', 'Limiter', 'Norm', 'Encode'];
  const n = steps.length;
  const bw = (W - (n - 1) * 6) / n;
  return (
    <Box title="Mastering chain — the order the recipe assumes">
      <Grid rows={2} />
      {steps.map((s, i) => {
        const x = i * (bw + 6);
        const col = [C.violet, C.cyan, C.amber, C.emerald, C.rose, C.sky, C.pink][i];
        return (
          <g key={s}>
            <rect x={x} y={56} width={bw} height={28} rx={4} fill={col + '1f'} stroke={col + '88'} strokeWidth={0.9} />
            <text x={x + bw / 2} y={73} fill={C.blockTxt} fontSize={bw > 34 ? 8 : 7} fontFamily="ui-monospace,monospace" textAnchor="middle">{s}</text>
          </g>
        );
      })}
      {Array.from({ length: n - 1 }, (_, i) => { const x = (i + 1) * (bw + 6) - 6; return <Arrow key={i} x1={x + 1} y1={70} x2={x + 5} y2={70} />; })}
    </Box>
  );
}

/* ── 13. VU scale ── */
function VUScale() {
  const { C } = useContext(DiagramCtx);
  const arc = (r, a0, a1, color, sw = 2) => {
    const p = (a) => [150 + r * Math.cos(a), 120 + r * Math.sin(a)];
    const [x1, y1] = p(a0), [x2, y2] = p(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={sw} />;
  };
  return (
    <Box title="VU scale — 0 VU = −18 dBFS, +3 red zone">
      <Grid />
      {arc(96, Math.PI * 1.15, Math.PI * 1.85, C.faint, 1)}
      {arc(96, Math.PI * 1.35, Math.PI * 1.5, C.rose, 3)}
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * 1.15 + (i / 10) * Math.PI * 0.7;
        const r1 = 90, r2 = i % 5 === 0 ? 78 : 84;
        return <line key={i} x1={150 + r1 * Math.cos(a)} y1={120 + r1 * Math.sin(a)} x2={150 + r2 * Math.cos(a)} y2={120 + r2 * Math.sin(a)} stroke={C.lbl} strokeWidth={0.9} />;
      })}
      <line x1={150} y1={120} x2={150 + 90 * Math.cos(Math.PI * 1.5)} y2={120 + 90 * Math.sin(Math.PI * 1.5)} stroke={C.amber} strokeWidth={1.6} />
      <circle cx={150} cy={120} r={3} fill={C.amber} />
      <Lbl x={150 + 78 * Math.cos(Math.PI * 1.5)} y={120 + 78 * Math.sin(Math.PI * 1.5) - 4} anchor="middle" fill={C.amber}>0 VU</Lbl>
      <Lbl x={150 + 70 * Math.cos(Math.PI * 1.42)} y={120 + 70 * Math.sin(Math.PI * 1.42) + 8} anchor="middle" fill={C.rose}>+3</Lbl>
    </Box>
  );
}

/* ── 14. Level / dBFS scale ── */
function LevelScale() {
  const { C } = useContext(DiagramCtx);
  const marks = [0, -3, -6, -9, -12, -18, -24, -36, -48];
  const y = (db) => 12 + (-db) / 48 * 116;
  return (
    <Box title="dBFS scale — peak, headroom & clip zone">
      <Grid cols={3} rows={6} />
      <rect x={120} y={y(0)} width={40} height={12} fill={C.rose} fillOpacity={0.25} />
      <Lbl x={166} y={y(0) + 9} fill={C.rose}>CLIP</Lbl>
      <line x1={120} y1={y(0)} x2={160} y2={y(0)} stroke={C.rose} strokeWidth={1.4} />
      {marks.map((db) => (
        <g key={db}>
          <line x1={120} y1={y(db)} x2={132} y2={y(db)} stroke={C.lbl} strokeWidth={0.9} />
          <Lbl x={110} y={y(db) + 3} anchor="end" fill={C.faint}>{db === 0 ? '0' : db}</Lbl>
        </g>
      ))}
      <line x1={132} y1={y(-6)} x2={160} y2={y(-6)} stroke={C.amber} strokeWidth={1} strokeDasharray="3 2" />
      <Lbl x={166} y={y(-6) + 3} fill={C.amber}>headroom</Lbl>
      <rect x={132} y={y(-6)} width={28} height={y(0) - y(-6)} fill={C.emerald} fillOpacity={0.14} />
    </Box>
  );
}

/* ── 15. Output visualizer anatomy ── */
function OutputAnatomy() {
  const { C } = useContext(DiagramCtx);
  const bars = Array.from({ length: 22 }, (_, i) => { const h = 30 + 40 * Math.exp(-Math.pow((i - 8) / 5, 2)) + 8 * Math.sin(i); return { x: 6 + i * 13, h }; });
  const scope = poly((x) => { const t = x / W; return [x, 96 + Math.sin(t * 30) * 8 * (1 - t) + Math.sin(t * 7) * 6]; });
  const ghost = poly((x) => { const t = x / W; return [x, 96 + Math.sin(t * 30) * 8 * 0.5]; });
  return (
    <Box title="Output visualizer — spectrum · scope · dry ghost">
      <Grid cols={8} rows={4} />
      {bars.map((b, i) => <rect key={i} x={b.x} y={60 - b.h} width={9} height={b.h} fill={`hsl(${190 + i * 6}, 70%, 45%)`} fillOpacity={0.6} />)}
      <polyline points={ghost} fill="none" stroke={C.amber} strokeWidth={1.2} strokeDasharray="3 2" opacity={0.8} />
      <polyline points={scope} fill="none" stroke={C.cyan} strokeWidth={1.4} />
      <Lbl x={4} y={14} fill={C.cyan}>spectrum</Lbl>
      <Lbl x={W - 4} y={14} anchor="end" fill={C.amber}>dry ghost</Lbl>
      <Lbl x={4} y={H - 4} fill={C.faint}>scope (time)</Lbl>
    </Box>
  );
}

/* ── 16. Signal flow ── */
function SignalFlow() {
  const { C } = useContext(DiagramCtx);
  const steps = [
    ['Source', C.cyan], ['FX Chain', C.violet], ['Master', C.amber], ['Meters', C.emerald], ['Output', C.sky],
  ];
  const n = steps.length;
  const bw = (W - (n - 1) * 8) / n;
  return (
    <Box title="Signal flow — source to output">
      <Grid rows={2} />
      {steps.map(([s, col], i) => {
        const x = i * (bw + 8);
        return (
          <g key={s}>
            <rect x={x} y={54} width={bw} height={32} rx={5} fill={col + '1f'} stroke={col + '88'} strokeWidth={1} />
            <text x={x + bw / 2} y={74} fill={C.blockTxt} fontSize={9} fontFamily="ui-monospace,monospace" textAnchor="middle">{s}</text>
          </g>
        );
      })}
      {Array.from({ length: n - 1 }, (_, i) => { const x = (i + 1) * (bw + 8) - 8; return <Arrow key={i} x1={x + 1} y1={70} x2={x + 7} y2={70} />; })}
    </Box>
  );
}

function StereoImagerMS() {
  const { C } = useContext(DiagramCtx);
  return (
    <Box title="Direction Mixer — M/S encode · spread · direction">
      <Grid rows={3} />
      <Block x={4} y={30} w={34} h={18} label="L / R" fill={C.cyan + '1f'} stroke={C.cyan + '88'} txt={C.blockTxt} />
      <Arrow x1={40} y1={39} x2={56} y2={39} />
      <Block x={56} y={24} w={42} h={30} label="M / S" fill={C.violet + '1f'} stroke={C.violet + '88'} txt={C.blockTxt} />
      <Lbl x={77} y={62} fill={C.faint}>encode</Lbl>
      <Arrow x1={98} y1={39} x2={116} y2={39} />
      <Block x={116} y={30} w={36} h={18} label="× width" fill={C.amber + '1f'} stroke={C.amber + '88'} txt={C.blockTxt} />
      <Arrow x1={152} y1={39} x2={170} y2={39} />
      <Block x={170} y={24} w={42} h={30} label="L / R" fill={C.emerald + '1f'} stroke={C.emerald + '88'} txt={C.blockTxt} />
      <Lbl x={191} y={62} fill={C.faint}>decode</Lbl>
      <Arrow x1={212} y1={39} x2={230} y2={39} />
      <Block x={230} y={30} w={42} h={18} label="rotate θ" fill={C.rose + '1f'} stroke={C.rose + '88'} txt={C.blockTxt} />
      <Lbl x={4} y={96} fill={C.violet}>M = (L+R)/2   S = (L−R)/2</Lbl>
      <Lbl x={4} y={108} fill={C.amber}>L = M + w·S   R = M − w·S</Lbl>
      <Lbl x={150} y={96} fill={C.rose}>L′ = cosθ·L − sinθ·R</Lbl>
      <Lbl x={150} y={108} fill={C.rose}>R′ = sinθ·L + cosθ·R</Lbl>
    </Box>
  );
}

function LUFSDiagram() {
  const { C } = useContext(DiagramCtx);
  const LW = 480, LH = 200;
  const padL = 50, padR = 20, padT = 20, padB = 30;
  const gW = LW - padL - padR, gH = LH - padT - padB;

  const points = (fn) => Array.from({ length: 80 }, (_, i) => {
    const t = i / 79;
    const x = padL + t * gW;
    const y = padT + gH - ((fn(t) + 30) / 30) * gH;
    return `${x},${Math.max(padT, Math.min(padT + gH, y))}`;
  }).join(' ');

  const mPts = points(t => -14 + 8 * Math.sin(t * 18) * Math.exp(-t * 0.5) * Math.random() * 1.2 + 2 * Math.sin(t * 6));
  const sPts = points(t => -16 + 3 * Math.sin(t * 5) + 1.5 * Math.sin(t * 2));
  const intY = padT + gH - ((-14 + 30) / 30) * gH;
  const dbLabels = [0, -6, -14, -23, -30];

  return (
    <div className={C.boxCls}>
      <p className={`mb-1 text-[9px] font-mono uppercase tracking-widest ${C.boxTitle}`}>LUFS Time Windows — Momentary / Short-Term / Integrated</p>
      <svg width="100%" viewBox={`0 0 ${LW} ${LH}`} className="overflow-visible">
        {dbLabels.map(db => {
          const y = padT + gH - ((db + 30) / 30) * gH;
          return (
            <g key={db}>
              <line x1={padL} y1={y} x2={padL + gW} y2={y} stroke={C.grid} strokeWidth="1" strokeDasharray="3,4" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="7" fill={C.faint}>{db}</text>
            </g>
          );
        })}
        <line x1={padL} y1={intY} x2={padL + gW} y2={intY} stroke={C.violet} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8" />
        <text x={padL + gW + 2} y={intY + 3} fontSize="7" fill={C.violet}>I −14</text>
        <polyline points={sPts} fill="none" stroke={C.cyan} strokeWidth="1.5" opacity="0.85" />
        <polyline points={mPts} fill="none" stroke={C.lime} strokeWidth="1" opacity="0.7" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + gH} stroke={C.axis} strokeWidth="1" />
        <line x1={padL} y1={padT + gH} x2={padL + gW} y2={padT + gH} stroke={C.axis} strokeWidth="1" />
        <text x={padL - 4} y={padT - 6} textAnchor="middle" fontSize="7" fill={C.faint}>dBFS/LUFS</text>
        <g transform={`translate(${padL + 8},${padT + 4})`}>
          <rect width="52" height="36" rx="3" fill={C.legendBg} stroke={C.legendBorder} strokeWidth="0.5" />
          <line x1="4" y1="8" x2="14" y2="8" stroke={C.lime} strokeWidth="1.5" />
          <text x="16" y="11" fontSize="7" fill={C.lime}>Momentary</text>
          <line x1="4" y1="18" x2="14" y2="18" stroke={C.cyan} strokeWidth="1.5" />
          <text x="16" y="21" fontSize="7" fill={C.cyan}>Short-Term</text>
          <line x1="4" y1="28" x2="14" y2="28" stroke={C.violet} strokeWidth="1.5" strokeDasharray="4,2" />
          <text x="16" y="31" fontSize="7" fill={C.violet}>Integrated</text>
        </g>
        <text x={padL + gW / 2} y={LH - 4} textAnchor="middle" fontSize="7" fill={C.faint}>Time →</text>
      </svg>
    </div>
  );
}

const REGISTRY = {
  'stereoimager-ms': StereoImagerMS,
  'eq-shapes': EQShapes,
  'compressor-transfer': CompressorTransfer,
  'compressor-gr': CompressorGR,
  'limiter-ceiling': LimiterCeiling,
  'mbc-crossover': MBCCrossover,
  'saturation-curves': SaturationCurves,
  'clip-transfer': ClipTransfer,
  'tape-response': TapeResponse,
  'delay-taps': DelayTaps,
  'reverb-decay': ReverbDecay,
  'dynamiceq-architecture': DynEQArchitecture,
  'mastering-chain': MasteringChain,
  'vu-scale': VUScale,
  'level-scale': LevelScale,
  'output-anatomy': OutputAnatomy,
  'signal-flow': SignalFlow,
  'lufs-diagram': LUFSDiagram,
};

export default function InfoDiagram({ diagram, mode = 'dark' }) {
  const Comp = REGISTRY[diagram];
  if (!Comp) return null;
  const C = mode === 'light' ? LIGHT : DARK;
  return (
    <DiagramCtx.Provider value={{ C }}>
      <Comp />
    </DiagramCtx.Provider>
  );
}