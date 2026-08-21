import React, { useState } from 'react';
import { Wand2, Download, Loader2, Disc3, Power, Waves } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { MEDIUMS, STYLES, LUFS_OPTIONS } from '../mastering/masterPresets.js';
import { applyRecipe } from '../mastering/applyRecipe.js';
import { FACTORY_PRESETS } from '../mastering/factoryPresets.js';
import { renderDry, renderToTargetLufs, renderSectionMastered, finalizeMaster, bufferPeakDb } from '../mastering/renderMaster.js';
import { encodeWav } from '../mastering/wavEncoder.js';
import { encodeMp3 } from '../mastering/mp3Encoder.js';
import InfoButton from './InfoButton';
import RecipeInfo from './RecipeInfo';
import PresetDropdown from './PresetDropdown';
import PresetNavBar from './PresetNavBar';
import MasterEffectGauge from './MasterEffectGauge';
import RenderProgress from './RenderProgress';
import { useTheme } from '@/signalchain/themes.jsx';

/**
 * Mastering Studio — pick a target medium, style and target LUFS, generate an
 * AI mastering recipe (Bob Katz K-system / pink-noise balance), then render the
 * chain offline through the loaded file, normalize to the target and download a
 * 24-bit WAV that is guaranteed not to clip.
 */
export default function MasteringPanel({ engine }) {
  const { theme } = useTheme();
  const ACCENT = theme.gem || theme.accent;
  const [medium, setMedium] = useState('album');
  const [style, setStyle] = useState('medium');
  const [targetLufs, setTargetLufs] = useState(-14);
  const [recipe, setRecipe] = useState(null);
  const [busy, setBusy] = useState(null); // 'recipe' | 'render' | null
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [format, setFormat] = useState('wav'); // 'wav' | 'mp3'
  // Render progress popup — staged { stage, label, pct } or null (hidden).
  const [progress, setProgress] = useState(null);
  // Section Mastering participates in Render when enabled — the export bakes
  // each section's assigned preset (with glide crossfades) into the file.
  const sectionActive = !!(engine.sectionMastering?.enabled && engine.sectionMastering?.sectionCount >= 1 && engine.sectionMastering?.assignment?.length >= 1);

  const onMedium = (key) => { setMedium(key); setTargetLufs(MEDIUMS[key].lufs); };
  // Two-way link: picking a Target LUFS that matches a medium's LUFS also
  // selects that medium (e.g. -23 LUFS activates Cinematic). The current
  // medium is kept when it already matches (album & streaming share -14).
  const onLufs = (l) => {
    setTargetLufs(l);
    if (MEDIUMS[medium]?.lufs !== l) {
      const match = Object.entries(MEDIUMS).find(([, m]) => m.lufs === l);
      if (match) setMedium(match[0]);
    }
  };

  const generate = async () => {
    if (!engine.ready) { setStatus('Load and play an audio file first.'); return; }
    setBusy('recipe'); setStatus('Generating mastering recipe with AI…');
    try {
      const res = await base44.functions.invoke('MasteringAssistant', { medium, style, targetLufs });
      const rec = res.data?.recipe;
      if (!rec) { setStatus('No recipe returned.'); return; }
      setRecipe(rec);
      applyRecipe(engine, rec);
      setStatus('Recipe applied to the signal chain — preview it in real time below.');
    } catch (e) {
      setStatus('Recipe failed: ' + (e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const render = async () => {
    if (!engine.ready) { setStatus('Load an audio file first.'); return; }
    setBusy('render'); setStatus('Decoding & rendering offline master…');
    try {
      setProgress({ stage: 'decode', label: 'Decoding source…', pct: 4 });
      const buf = await engine.getDecodedAudioBuffer();
      if (!buf || !buf.length) { setStatus('Could not decode the audio file.'); return; }
      const srcPeak = bufferPeakDb(buf);
      if (srcPeak < -60) { setStatus(`Decoded file is silent (peak ${srcPeak.toFixed(1)} dB) — nothing to master.`); return; }
      const state = engine.getRenderState();
      const sm = engine.sectionMastering;
      const useSections = !!(sm?.enabled && sm.sectionCount >= 1 && sm.assignment?.length >= 1);
      setStatus(useSections
        ? `Rendering ${sm.assignment.length} section${sm.assignment.length > 1 ? 's' : ''} — baking per-section presets…`
        : `Gain-staging into the limiter to hit ${targetLufs} LUFS…`);
      let { buffer: rendered, measuredLufs, appliedInputGainDb } = useSections
        ? await renderSectionMastered({
            audioBuffer: buf, baseState: state,
            recipes: sm.assignment.map((L) => FACTORY_PRESETS[sm.letterPresets?.[L]]?.recipe ?? null),
            cues: sm.cues ?? [], glides: sm.glides ?? [], targetLufs,
            onProgress: ({ index, total }) => {
              const frac = total > 1 ? index / total : 1;
              setProgress({ stage: 'render', label: `Rendering section ${index} of ${total}…`, pct: 8 + Math.round(frac * 76) });
            },
          })
        : await renderToTargetLufs({
            audioBuffer: buf, state, targetLufs,
            onProgress: ({ index, total }) => {
              // Map each render pass across the 8–84% band of the bar.
              const frac = total > 1 ? index / total : 1;
              setProgress({
                stage: 'render',
                label: `Rendering through the chain · pass ${index} of ${total}…`,
                pct: 8 + Math.round(frac * 76),
              });
            },
          });
      let note = useSections ? ' · section mastering baked in' : '';
      // Guard 1: a chain that renders to total silence → fall back to the dry
      // source so the user always gets audible audio.
      if (bufferPeakDb(rendered) < -60) {
        setProgress({ stage: 'fallback', label: 'Chain was silent — exporting dry source…', pct: 85 });
        setStatus('Chain rendered silence — exporting the dry source…');
        rendered = await renderDry({ audioBuffer: buf });
        measuredLufs = undefined;
        appliedInputGainDb = 0;
        note = ' · dry source exported (chain was silent)';
        // Guard 2: if the dry offline render is ALSO silent (offline rendering
        // itself failed), use the decoded source verbatim — guarantee audio.
        if (bufferPeakDb(rendered) < -60) {
          setStatus('Offline render unavailable — exporting the decoded source…');
          rendered = buf;
          note = ' · decoded source exported (offline render failed)';
        }
      }
      setProgress({ stage: 'finalize', label: 'Applying true-peak ceiling…', pct: 90 });
      setStatus('Applying true-peak ceiling…');
      const out = finalizeMaster(rendered, { measuredLufs, appliedGainDb: appliedInputGainDb });
      const ditherOn = engine.dynamics?.limiter?.dither === 'tpdf';
      setProgress({ stage: 'encode', label: `Encoding ${format.toUpperCase()}…`, pct: 93 });
      const blob = format === 'mp3'
        ? await encodeMp3(out.channels, out.sampleRate, out.length, 320, ditherOn, (f) => setProgress({ stage: 'encode', label: 'Encoding MP3…', pct: 93 + Math.round(f * 7) }))
        : encodeWav(out.channels, out.sampleRate, out.length, 24, ditherOn);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (engine.fileName || 'master').replace(/\.[^.]+$/, '') + `_SCM_Master.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setProgress({ stage: 'done', label: 'Master exported', pct: 100 });
      setResult({ lufs: out.measuredLufs.toFixed(1), peak: out.peakDb.toFixed(1), gain: out.appliedGainDb.toFixed(1) });
      setStatus(`Done — ${out.measuredLufs.toFixed(1)} LUFS · ${out.peakDb.toFixed(1)} dBFS peak · ${out.appliedGainDb > 0 ? '+' : ''}${out.appliedGainDb.toFixed(1)} dB limiter drive${note}`);
    } catch (e) {
      setStatus('Render failed: ' + (e?.message || e));
    } finally {
      setBusy(null);
      // Keep the 100% state briefly so the user sees completion, then close.
      setTimeout(() => setProgress(null), 500);
    }
  };

  const btn = (active, onClick, label, sub, key) => (
    <button
      key={key}
      onClick={onClick}
      className="rounded-md text-center transition-all duration-150"
      style={{
        padding: '3px 6px',
        fontWeight: 600,
        lineHeight: 1.05,
        border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.18)'}`,
        background: active
          ? `linear-gradient(180deg, color-mix(in srgb, ${ACCENT} 62%, white) 0%, ${ACCENT} 100%)`
          : 'linear-gradient(180deg, rgba(62,66,74,0.92) 0%, rgba(24,26,31,0.96) 100%)',
        color: active ? '#000' : 'rgba(255,255,255,0.82)',
        boxShadow: active
          ? `0 0 0 1px ${ACCENT}, 0 0 10px ${ACCENT}cc, inset 0 1px 0 rgba(255,255,255,0.45)`
          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.45)',
      }}
    >
      <span className="block" style={{ fontSize: '9px' }}>{label}</span>
      {sub && <span className="block font-mono" style={{ fontSize: '7px', opacity: 0.72, marginTop: '1px' }}>{sub}</span>}
    </button>
  );

  return (
    <section className="sc-panel sc-mastering-studio" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 0.5px, transparent 0.5px, transparent 2px), linear-gradient(160deg, #24272d 0%, #191c21 50%, #101216 100%)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: ACCENT + '22' }}><Disc3 className="w-4 h-4" style={{ color: ACCENT }} /></div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Mastering Studio</h2>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton panelId="mastering" accent={ACCENT} />
          <span className="text-[10px] font-mono text-white/70">AI recipe · offline render · LUFS normalize · WAV</span>
        </div>
      </div>

      <div className="space-y-3">
        <PresetNavBar engine={engine} />
        <PresetDropdown engine={engine} />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/75 mb-1.5">Style</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STYLES).map(([k, s]) => btn(style === k, () => setStyle(k), s.label, undefined, k))}
          </div>
        </div>

        {/* Mastering Effect knob flanked by Target Medium (left) and Target
            LUFS (right). Selecting a LUFS overrides the medium's default LUFS. */}
        <div className="grid items-center gap-3 md:grid-cols-[1fr_1.7fr_1fr]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/75 mb-1.5">Target Medium</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MEDIUMS).map(([k, m]) => btn(medium === k, () => onMedium(k), m.label, `${m.lufs} LUFS`, k))}
            </div>
            <p className="text-[9px] text-white/60 mt-1.5">{MEDIUMS[medium].note}</p>
          </div>
          <div className="flex items-center justify-center">
            <MasterEffectGauge value={engine.masterEffect ?? 0} onChange={(v) => engine.setMasterEffect?.(v)} min={-50} max={50} step={0.5} defaultValue={0} accent={ACCENT} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/75 mb-1.5">Target LUFS</div>
            <div className="grid grid-cols-2 gap-2">
              {LUFS_OPTIONS.map((l) => btn(targetLufs === l, () => onLufs(l), `${l}`, 'LUFS', l))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={generate}
            disabled={!!busy}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-black transition-all disabled:opacity-50"
            style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}55` }}
          >
            {busy === 'recipe' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate AI Recipe
          </button>
          <button
            onClick={render}
            disabled={!!busy}
            className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/40 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black/60 disabled:opacity-50"
          >
            {busy === 'render' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Render &amp; Download
          </button>
          {sectionActive && (
            <span className="flex items-center gap-1 rounded-full border border-white/30 bg-[#58b184] px-2.5 py-1 text-[10px] font-semibold text-black shadow-[0_0_10px_rgba(88,177,132,0.45)]" title="Section Mastering is on — Render bakes each section's assigned preset into the export">
              <Waves className="w-3 h-3 text-black" /> Section Mastering
            </span>
          )}
          <button
            onClick={engine.handleBypassToggle}
            className={`flex min-w-[8rem] items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${engine.bypass ? 'text-black' : 'border-white/20 bg-black/40 text-white/80 hover:bg-black/60'}`}
            style={engine.bypass ? { background: ACCENT, borderColor: ACCENT, boxShadow: `0 0 12px ${ACCENT}80` } : undefined}
            title="A/B the mastered chain against the dry source"
          >
            <Power className="w-4 h-4 shrink-0" /><span>{engine.bypass ? 'Bypass On' : 'Bypass'}</span>
          </button>
          <div className="flex overflow-hidden rounded-lg border border-white/15 font-mono text-[11px]">
            <button onClick={() => setFormat('wav')} className={`px-3 py-2.5 transition-all ${format === 'wav' ? 'text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`} style={format === 'wav' ? { background: ACCENT } : undefined}>WAV</button>
            <button onClick={() => setFormat('mp3')} className={`px-3 py-2.5 transition-all ${format === 'mp3' ? 'text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`} style={format === 'mp3' ? { background: ACCENT } : undefined}>MP3</button>
          </div>
          {status && <span className="text-[11px] font-mono text-white/85">{status}</span>}
        </div>

        {result && (
          <div className="flex flex-wrap gap-3 text-[11px] font-mono">
            <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1">Output: <span style={{ color: ACCENT }}>{result.lufs} LUFS</span></span>
            <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1">Peak: <span className="text-emerald-300">{result.peak} dBFS</span></span>
            <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1">Drive: <span className="text-cyan-300">{result.gain} dB</span></span>
          </div>
        )}

        {recipe?.notes && (
          <div className="rounded-lg p-3" style={{ border: `1px solid ${ACCENT}40`, background: `${ACCENT}0d` }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: ACCENT }}>AI Mastering Notes</div>
            <p className="text-[11px] text-white/70 leading-relaxed">{recipe.notes}</p>
          </div>
        )}

        <RecipeInfo />
      </div>

      <RenderProgress progress={progress} />
    </section>
  );
}