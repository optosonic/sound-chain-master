import React, { useMemo, useRef, useState } from 'react';
import { Scissors, Power } from 'lucide-react';
import Dial from './Dial';
import { filterResponsePoints, filterDbAtFreq } from './ClipFilterResponse.jsx';
import InfoButton from './InfoButton';

const LIME = '#98fb98';
const CYAN = '#87ceeb';

const DEFAULT = {
  enabled: false, inputGain: 0, drive: 0, clipFilterType: 'lowpass', clipFilterFreq: 4400,
  symmetry: 0, tone: 170, highShelfFreq: 980, highShelfGain: 0, lpFilterFreq: 6600, mix: 0.2, outputGain: 0
};

// Clip transfer output at input x (−1..1) for drive(dB) + symmetry(%).
// Matches the visualizer curve exactly: tanh with DC offset, clamped to ±1.
function clipOut(driveDb, symPct, x) {
  const D = Math.pow(10, Math.max(0, driveDb) / 20);
  const s = Math.max(-1, Math.min(1, symPct / 100));
  const v = Math.tanh(D * (x + s)) - Math.tanh(D * s);
  return Math.max(-1, Math.min(1, v));
}

// Solve drive(dB) + symmetry(%) so the clip curve passes through two points
// (x1,y1) and (x2,y2) in input/output space. 2-D Newton on (D = linear gain,
// s = symmetry). Lets a dragged dot follow the cursor while the other dot
// stays anchored — the tanh curve reshapes to fit both.
function solveDriveSym(x1, y1, x2, y2, D0, s0) {
  const sech2 = (z) => { const c = 1 / Math.cosh(z); return c * c; };
  let D = Math.max(1, Math.min(316, D0));
  let s = Math.max(-1, Math.min(1, s0));
  for (let it = 0; it < 16; it++) {
    const a1 = D * (x1 + s), a2 = D * (x2 + s), ac = D * s;
    const f1 = Math.tanh(a1) - Math.tanh(ac) - y1;
    const f2 = Math.tanh(a2) - Math.tanh(ac) - y2;
    const df1D = sech2(a1) * (x1 + s) - sech2(ac) * s;
    const df1s = (sech2(a1) - sech2(ac)) * D;
    const df2D = sech2(a2) * (x2 + s) - sech2(ac) * s;
    const df2s = (sech2(a2) - sech2(ac)) * D;
    const det = df1D * df2s - df1s * df2D;
    if (Math.abs(det) < 1e-10) break;
    const dD = (df2s * f1 - df1s * f2) / det;
    const ds = (df1D * f2 - df2D * f1) / det;
    D = Math.max(1, Math.min(316, D - dD));
    s = Math.max(-1, Math.min(1, s - ds));
    if (Math.abs(dD) < 1e-4 && Math.abs(ds) < 1e-4) break;
  }
  const driveDb = Math.max(0, Math.min(50, 20 * Math.log10(D)));
  const symmetry = Math.max(-100, Math.min(100, Math.round(s * 100)));
  return { drive: parseFloat(driveDb.toFixed(1)), symmetry };
}

/**
 * Clip Distortion — asymmetric soft-clipper with pre/post tone shaping.
 * The transfer visualizer uses the exact same formula as SignalChain.createClipCurve
 * (tanh(drive·(x+s)) − tanh(drive·s)), so what you see is what you hear.
 *
 * Props:
 *  - clip: DEFAULT-shaped state
 *  - onChange(next)
 *  - layout: 'wide' → side-by-side (plugin carousel slide); default → original
 *           vertical stack (transfer graph on top, knob grid below) for the
 *           main web-app page.
 */
export default function ClipDistortionPanel({ clip, onChange, layout }) {
  const c = { ...DEFAULT, ...(clip || {}) };
  const set = (k, v) => onChange({ ...c, [k]: v });
  const wide = layout === 'wide';

  // Draggable distortion-line dots — drag a green dot and it follows the
  // cursor; the tanh curve solves Drive + Symmetry to pass through BOTH dots
  // (the dragged one at the cursor, the other anchored where it was), so the
  // dot stays on the line and the line follows the drag. Knobs reflect live.
  const graphWrapRef = useRef(null);
  const [leftX, setLeftX] = useState(-0.5);
  const [rightX, setRightX] = useState(0.5);
  const greenDragRef = useRef(null);

  const onGreenDotDown = (e, which) => {
    e.preventDefault(); e.stopPropagation();
    const rect = graphWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    greenDragRef.current = { which, rect, pid: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onGreenDotMove = (e) => {
    const d = greenDragRef.current; if (!d) return;
    const px = ((e.clientX - d.rect.left) / d.rect.width) * 300;
    const py = ((e.clientY - d.rect.top) / d.rect.height) * 140;
    const xC = Math.max(-0.95, Math.min(0.95, (px / 300) * 2 - 1));
    const yC = Math.max(-0.98, Math.min(0.98, (70 - py) / 58));
    const xOther = d.which === 'right' ? leftX : rightX;
    const yOther = clipOut(c.drive, c.symmetry, xOther);
    const D0 = Math.pow(10, Math.max(0, c.drive) / 20);
    const s0 = Math.max(-1, Math.min(1, c.symmetry / 100));
    const { drive, symmetry } = solveDriveSym(xC, yC, xOther, yOther, D0, s0);
    if (d.which === 'right') setRightX(xC); else setLeftX(xC);
    onChange({ ...c, drive, symmetry });
  };
  const onGreenDotUp = (e) => {
    if (!greenDragRef.current) return;
    try { e.currentTarget.releasePointerCapture(greenDragRef.current.pid); } catch {}
    greenDragRef.current = null;
  };

  const curve = useMemo(() => {
    const drive = Math.pow(10, Math.max(0, c.drive) / 20);
    const s = Math.max(-1, Math.min(1, c.symmetry / 100));
    const dc = Math.tanh(drive * s);
    const pts = [];
    for (let i = 0; i <= 300; i++) {
      const x = i / 150 - 1;
      const v = Math.max(-1, Math.min(1, Math.tanh(drive * (x + s)) - dc));
      pts.push(`${i.toFixed(1)},${(70 - v * 58).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [c.drive, c.symmetry]);

  // Screen position (svg 0..300 × 0..140) of a distortion dot at input x.
  const greenDotPos = (xIn) => {
    const v = clipOut(c.drive, c.symmetry, xIn);
    return [((xIn + 1) / 2) * 300, 70 - v * 58];
  };

  // Combined filter-chain response, mapped into the transfer canvas geometry
  // (x = log freq 20Hz–20kHz, y = ±30 dB sharing the transfer vertical range).
  const [view, setView] = useState('transfer');
  const filterCurve = useMemo(
    () => filterResponsePoints(c, { width: 300, midY: 70, pxPerDb: 58 / 30, dbSpan: 30 }),
    [c.clipFilterType, c.clipFilterFreq, c.tone, c.highShelfFreq, c.highShelfGain, c.lpFilterFreq]
  );
  const transferOp = view === 'transfer' ? 1 : 0.6;
  const filterOp = view === 'filter' ? 1 : 0.6;

  // Tone-line control dots — one on each side of the filter (tone) curve.
  // Left dot  → Tone high-pass cutoff (drag horizontally).
  // Right dot → High Shelf gain (drag vertically) + frequency (horizontal).
  const FMIN = 20, FMAX = 20000;
  const freqToX = (f) => ((Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * 300;
  const filterYAt = (f) => 70 - Math.max(-30, Math.min(30, filterDbAtFreq(c, f))) * (58 / 30);

  const toneDragRef = useRef(null);
  const onToneDotDown = (e, which) => {
    e.preventDefault(); e.stopPropagation();
    toneDragRef.current = { x0: e.clientX, y0: e.clientY, tone: c.tone, hsf: c.highShelfFreq, hsg: c.highShelfGain, lpf: c.lpFilterFreq, which, pid: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onToneDotMove = (e) => {
    const d = toneDragRef.current; if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = d.y0 - e.clientY;
    if (d.which === 'left') {
      const nt = Math.max(20, Math.min(20000, d.tone * Math.pow(10, dx * 0.01)));
      onChange({ ...c, tone: Math.round(nt) });
    } else if (d.which === 'right') {
      const ng = Math.max(-24, Math.min(24, d.hsg + dy * (30 / 58)));
      const nf = Math.max(20, Math.min(20000, d.hsf * Math.pow(10, dx * 0.01)));
      onChange({ ...c, highShelfGain: parseFloat(ng.toFixed(1)), highShelfFreq: Math.round(nf) });
    } else if (d.which === 'lp') {
      const nf = Math.max(20, Math.min(20000, d.lpf * Math.pow(10, dx * 0.01)));
      onChange({ ...c, lpFilterFreq: Math.round(nf) });
    }
  };
  const onToneDotUp = (e) => {
    if (!toneDragRef.current) return;
    try { e.currentTarget.releasePointerCapture(toneDragRef.current.pid); } catch {}
    toneDragRef.current = null;
  };

  // Transfer visualizer — aspect-locked SVG so it never stretches, shared by
  // both layouts. Only the surrounding flow changes (row vs column).
  const graph = (
    <div className="relative rounded-lg border p-2 bg-black/30 flex-1 min-h-0" style={{ borderColor: LIME + '33' }}>
      <div className="absolute top-1.5 left-2 z-10 flex gap-1">
        <button
          onClick={() => setView('transfer')}
          className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold border transition-all"
          style={view === 'transfer' ?
          { background: LIME, color: '#06210f', borderColor: LIME, boxShadow: `0 0 6px ${LIME}88` } :
          { background: 'rgba(0,0,0,0.4)', color: LIME, borderColor: LIME + '55' }}>
          TRANSFER</button>
        <button
          onClick={() => setView('filter')}
          className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold border transition-all"
          style={view === 'filter' ?
          { background: CYAN, color: '#062a33', borderColor: CYAN, boxShadow: `0 0 6px ${CYAN}88` } :
          { background: 'rgba(0,0,0,0.4)', color: CYAN, borderColor: CYAN + '55' }}>
          FILTER</button>
      </div>
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono" style={{ color: CYAN }}>Tone: {Math.round(c.tone)} Hz</div>
      <div className="absolute top-1.5 right-2 text-[9px] font-mono" style={{ color: LIME }}>Clip Filter: {Math.round(c.clipFilterFreq)} Hz</div>
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/60">Symmetry: {Math.round(c.symmetry)} %</div>
      <div ref={graphWrapRef} className="absolute inset-2">
      <svg viewBox="0 0 300 140" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
        {[0, 75, 150, 225, 300].map((x) => <line key={`v${x}`} x1={x} y1="6" x2={x} y2="134" stroke="rgba(152,251,152,0.07)" strokeWidth="0.5" />)}
        {[12, 41, 70, 99, 128].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="300" y2={y} stroke="rgba(152,251,152,0.07)" strokeWidth="0.5" />)}
        <line x1="0" y1="70" x2="300" y2="70" stroke="rgba(152,251,152,0.25)" strokeWidth="1" />
        {/* linear reference */}
        <line x1="0" y1="128" x2="300" y2="12" stroke={CYAN} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
        {/* filter-response overlay (x = log freq, y = dB) */}
        <polyline points={filterCurve} fill="none" stroke={CYAN} strokeWidth="1" opacity={filterOp} style={{ filter: `drop-shadow(0 0 4px ${CYAN}aa)` }} />
        {/* clip transfer curve */}
        <polyline points={curve} fill="none" stroke={LIME} strokeWidth="1" opacity={transferOp} style={{ filter: `drop-shadow(0 0 4px ${LIME}88)` }} />
      </svg>
      {/* Distortion-line control dots (green) — drag a dot and it follows the
          cursor; the tanh curve reshapes (Drive + Symmetry) to pass through
          both dots, so the dot stays on the line. Coloured to match the green
          transfer line they drive. */}
      {[
        { which: 'left', xIn: leftX },
        { which: 'right', xIn: rightX },
      ].map((d) => {
        const [cx, cy] = greenDotPos(d.xIn);
        return (
          <div
            key={`d${d.which}`}
            className="absolute rounded-full cursor-grab touch-none active:cursor-grabbing hover:ring-2 hover:ring-white/60"
            title="Drag to reshape the distortion curve (Drive + Symmetry)"
            onPointerDown={(e) => onGreenDotDown(e, d.which)}
            onPointerMove={onGreenDotMove}
            onPointerUp={onGreenDotUp}
            onPointerCancel={onGreenDotUp}
            style={{
              left: `${(cx / 300) * 100}%`,
              top: `${(cy / 140) * 100}%`,
              width: 12,
              height: 12,
              background: LIME,
              border: '1.5px solid #06210f',
              transform: 'translate(-50%, -50%)',
              opacity: transferOp,
              boxShadow: `0 0 5px ${LIME}cc`,
            }}
          />
        );
      })}
      {/* Tone-line control dots (cyan) — three dots on the filter curve,
          coloured to match the cyan tone line. Left: drag horizontally to set
          the Tone (low-cut) frequency. Right: drag vertically for High Shelf
          gain, horizontally for its frequency. LP (knee vertex): drag
          horizontally to set the LP Filter cutoff. */}
      {[
        { which: 'left', f: c.tone },
        { which: 'right', f: c.highShelfFreq },
        { which: 'lp', f: c.lpFilterFreq },
      ].map((d) => {
        const cx = freqToX(d.f);
        const cy = filterYAt(d.f);
        return (
          <div
            key={`t${d.which}`}
            className="absolute rounded-full cursor-grab touch-none active:cursor-grabbing hover:ring-2 hover:ring-white/60"
            title={d.which === 'left' ? 'Drag horizontally: Tone (low cut)' : d.which === 'right' ? 'Drag: vertical = High Shelf gain, horizontal = High Shelf freq' : 'Drag horizontally: LP Filter cutoff'}
            onPointerDown={(e) => onToneDotDown(e, d.which)}
            onPointerMove={onToneDotMove}
            onPointerUp={onToneDotUp}
            onPointerCancel={onToneDotUp}
            style={{
              left: `${(cx / 300) * 100}%`,
              top: `${(cy / 140) * 100}%`,
              width: 11,
              height: 11,
              background: CYAN,
              border: '1.5px solid #06210f',
              transform: 'translate(-50%, -50%)',
              opacity: filterOp,
              boxShadow: `0 0 5px ${CYAN}cc`,
            }}
          />
        );
      })}
      </div>
    </div>
  );

  // Knob set — identical in both layouts; only the grid wrapping changes.
  const knobs = [
    <Dial key="inputGain" value={c.inputGain} onChange={(v) => set('inputGain', v)} defaultValue={DEFAULT.inputGain} min={-30} max={30} step={0.1} label="Input" unit="dB" size="small" accent={LIME} />,
    <Dial key="drive" value={c.drive} onChange={(v) => set('drive', v)} defaultValue={DEFAULT.drive} min={0} max={50} step={0.1} label="Drive" unit="dB" size="small" accent={LIME} />,
    <div key="clipFilter" className="flex items-center justify-center gap-1.5">
      <Dial value={c.clipFilterFreq} onChange={(v) => set('clipFilterFreq', v)} defaultValue={DEFAULT.clipFilterFreq} min={20} max={20000} step={1} scale="log" label="Clip Filter" unit="Hz" size="small" accent={LIME} />
      <div className="flex flex-col self-center overflow-hidden rounded border border-white/10 text-[7px] font-bold leading-none -translate-y-1.5">
        <button onClick={() => set('clipFilterType', 'lowpass')} className="px-1 py-1" style={c.clipFilterType === 'lowpass' ? { background: LIME, color: '#06210f' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>LP</button>
        <button onClick={() => set('clipFilterType', 'highpass')} className="px-1 py-1 border-t border-white/10" style={c.clipFilterType === 'highpass' ? { background: LIME, color: '#06210f' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>HP</button>
      </div>
    </div>,
    <Dial key="symmetry" value={c.symmetry} onChange={(v) => set('symmetry', v)} defaultValue={DEFAULT.symmetry} min={-100} max={100} step={1} label="Symmetry" unit="%" size="small" accent={LIME} />,
    <Dial key="tone" value={c.tone} onChange={(v) => set('tone', v)} defaultValue={DEFAULT.tone} min={20} max={20000} step={1} scale="log" label="Tone" unit="Hz" size="small" accent={LIME} />,
    <Dial key="highShelfFreq" value={c.highShelfFreq} onChange={(v) => set('highShelfFreq', v)} defaultValue={DEFAULT.highShelfFreq} min={20} max={20000} step={1} scale="log" label="High Shelving" unit="Hz" size="small" accent={LIME} />,
    <Dial key="highShelfGain" value={c.highShelfGain} onChange={(v) => set('highShelfGain', v)} defaultValue={DEFAULT.highShelfGain} min={-24} max={24} step={0.1} label="Gain" unit="dB" size="small" accent={LIME} />,
    <Dial key="lpFilterFreq" value={c.lpFilterFreq} onChange={(v) => set('lpFilterFreq', v)} defaultValue={DEFAULT.lpFilterFreq} min={20} max={20000} step={1} scale="log" label="LP Filter" unit="Hz" size="small" accent={LIME} />,
    <Dial key="mix" value={Math.round(c.mix * 100)} onChange={(v) => set('mix', v / 100)} defaultValue={Math.round(DEFAULT.mix * 100)} min={0} max={100} step={1} label="Mix" unit="%" size="small" accent={LIME} />,
    <Dial key="outputGain" value={c.outputGain} onChange={(v) => set('outputGain', v)} defaultValue={DEFAULT.outputGain} min={-30} max={30} step={0.1} label="Output" unit="dB" size="small" accent={LIME} />,
  ];

  return (
    <div>
      <div data-fx="clip" className="p-4 pb-5 rounded-xl bg-gradient-to-br from-emerald-950/30 to-black/60 border h-[470px] flex flex-col" style={{ borderColor: LIME + '55' }}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg sc-fx-icon" style={{ background: LIME + '22' }}><Scissors className="w-4 h-4" style={{ color: LIME }} /></div>
            <span className={`text-sm font-medium transition-all ${c.enabled ? 'drop-shadow-[0_0_8px_rgba(152,251,152,0.8)]' : 'text-white/80'}`} style={c.enabled ? { color: LIME } : undefined}>Clip Distortion</span>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton panelId="clip" accent={LIME} />
            <button onClick={() => set('enabled', !c.enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${c.enabled ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'}`}>
              <Power className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase w-5 text-center">{c.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 mb-2 flex flex-col">{graph}</div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 shrink-0 mt-auto">
          {knobs}
        </div>
      </div>
    </div>);
}