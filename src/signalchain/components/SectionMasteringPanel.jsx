import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Waves, Power, RotateCcw } from 'lucide-react';
import { FACTORY_PRESETS } from '../mastering/factoryPresets.js';
import { applyRecipe } from '../mastering/applyRecipe.js';
import {
  SECTION_LETTERS, SECTION_COLORS,
  defaultCues, defaultGlides, defaultAssignment, computePeaks,
} from '../sectionMasteringModel.js';
import SectionWaveform from './SectionWaveform.jsx';
import SectionWaveformEmpty from './SectionWaveformEmpty.jsx';
import InfoButton from './InfoButton.jsx';

/**
 * Section Mastering — a desktop-only panel above Mastering Studio.
 *
 * Divides the loaded file into 1..5 timed sections, each assigned one of five
 * preset "letters" (A..E). In the header, each letter has a mini dropdown that
 * picks which factory mastering preset it maps to; drag a letter onto a
 * waveform section to assign it. White cue handles slide left/right to move the
 * section boundaries; the ✕ handle on each boundary drags up/down to set the
 * cross-parameterization glide (drawn as a triangle/glide zone between the two
 * adjacent section colours).
 *
 * Click a section to audition its preset on the live chain; enable Live Follow
 * to auto-apply the preset as the playhead crosses each boundary (hard switch).
 * The continuous DSP parameter morph across the glide zone is the next phase.
 */
export default function SectionMasteringPanel({ engine }) {
  const [sectionCount, setSectionCount] = useState(3);
  const [cues, setCues] = useState(defaultCues(3));
  const [glides, setGlides] = useState(defaultGlides(3));
  const [assignment, setAssignment] = useState(defaultAssignment(3));
  const [letterPresets, setLetterPresets] = useState({ A: 0, B: 1, C: 2, D: 3, E: 4 });
  const [enabled, setEnabled] = useState(false);
  const [liveFollow, setLiveFollow] = useState(false);
  const [peaks, setPeaks] = useState(null);
  const [loading, setLoading] = useState(false);

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const getDecoded = engine.getDecodedAudioBuffer;

  // Decode + down-sample the loaded file into waveform peaks whenever the file changes.
  useEffect(() => {
    let cancelled = false;
    if (!engine.fileName) { setPeaks(null); return; }
    setLoading(true);
    getDecoded().then((buf) => {
      if (cancelled) return;
      setPeaks(computePeaks(buf));
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.fileName, getDecoded]);

  // Sync the section-mastering config into the engine so Render & Download
  // bakes the per-section presets (with glides) into the exported file.
  useEffect(() => {
    engine.setSectionMastering?.({ enabled, sectionCount, cues, glides, assignment, letterPresets });
  }, [engine, enabled, sectionCount, cues, glides, assignment, letterPresets]);

  const setCount = (n) => {
    setSectionCount(n);
    setCues(defaultCues(n));
    setGlides(defaultGlides(n));
    setAssignment(defaultAssignment(n));
  };

  const onCueChange = (i, frac) => setCues((c) => c.map((v, idx) => (idx === i ? frac : v)));
  const onGlideChange = (i, amt) => setGlides((g) => g.map((v, idx) => (idx === i ? amt : v)));

  // Audition a section's assigned preset on the live chain. Also snaps the MBC
  // crossfade to match (applyRecipe skips mbc when a preset has none, so we
  // explicitly fade it out — click-free via the 12 ms ramp).
  const applySection = useCallback((idx) => {
    if (!enabled) return;
    const letter = assignment[idx];
    const preset = FACTORY_PRESETS[letterPresets[letter]];
    if (!preset) return;
    applyRecipe(engineRef.current, preset.recipe);
    const mbcOn = !!preset.recipe?.mbc?.enabled;
    const gm = Math.pow(10, (preset.recipe?.mbc?.globalMakeup ?? 0) / 20);
    engineRef.current?.setMbcCrossfade?.(mbcOn ? 1 : 0, gm, !!preset.recipe?.mbc?.msMode, false);
  }, [enabled, assignment, letterPresets]);

  // Live Follow — glide between presets across each glide zone, hard-apply the
  // preset in the stable region between zones. The glide drives the chain
  // directly (no React state churn) so the 60 fps loop never re-renders the UI.
  const cuesRef = useRef(cues); cuesRef.current = cues;
  const glidesRef = useRef(glides); glidesRef.current = glides;
  const assignmentRef = useRef(assignment); assignmentRef.current = assignment;
  const letterPresetsRef = useRef(letterPresets); letterPresetsRef.current = letterPresets;
  const applyRef = useRef(applySection); applyRef.current = applySection;
  // The incoming preset currently loaded onto the morph chain (so the morph
  // can be finalised cleanly if Live Follow is toggled off mid-transition).
  const lastIncomingRef = useRef(null);
  const presetRecipe = (idx) => {
    const letter = assignmentRef.current[idx];
    if (!letter) return null;
    const p = FACTORY_PRESETS[letterPresetsRef.current[letter]];
    return p ? p.recipe : null;
  };
  // Live Follow — dual-chain crossfade between presets across each glide zone.
  // Inside a zone the incoming preset (next section) runs on a parallel morph
  // chain; the equal-power crossfade position is driven by the playhead within
  // the zone (the triangle-handle glide amount defines the zone width). On
  // leaving the zone the incoming preset is promoted onto the primary chain
  // and the crossfade ramps back — zero discontinuity. Both chains share
  // identical latency / topology, so the sum is comb- and phase-artifact-free.
  useEffect(() => {
    if (!liveFollow || !enabled) return;
    let raf; let lastStable = -1; let morphZone = -1;
    const loop = () => {
      const pb = engineRef.current?.getPlayback?.() || {};
      if (pb.duration > 0) {
        const frac = pb.current / pb.duration;
        const cues = cuesRef.current;
        // Is the playhead inside a glide zone around cue i?
        let inZone = false; let zi = -1; let zt = 0;
        for (let i = 0; i < cues.length; i++) {
          const c = cues[i];
          const g = glidesRef.current[i] ?? 0;
          const leftSpan = c - (i ? cues[i - 1] : 0);
          const rightSpan = (i + 1 < cues.length ? cues[i + 1] : 1) - c;
          const maxZone = Math.min(leftSpan, rightSpan, 0.18);
          const half = g * maxZone;
          if (half > 0.001 && frac >= c - half && frac <= c + half) {
            inZone = true; zi = i; zt = (frac - (c - half)) / (2 * half); break;
          }
        }
        if (inZone) {
          // Entering a glide zone: load the incoming preset (next section) onto
          // the silent morph chain once, then drive the crossfade position from
          // the playhead within the zone (triangle-derived zt, 0..1).
          if (morphZone !== zi) {
            morphZone = zi;
            const inc = presetRecipe(zi + 1);
            lastIncomingRef.current = inc;
            engineRef.current?.prepareMorphChain?.(inc);
          }
          engineRef.current?.setMorphT?.(zt);
          lastStable = -1;
        } else {
          // Leaving a glide zone: promote the incoming preset onto the primary
          // chain (its gain is ~0 at the end of the glide, so the parameter
          // switch is inaudible), then ramp the crossfade back to the primary
          // chain over ~30 ms — both chains hold the incoming preset during
          // the ramp, so the hand-off is sample-accurate and click-free.
          if (morphZone >= 0) {
            const sec = morphZone + 1;
            const inc = lastIncomingRef.current || presetRecipe(sec);
            if (inc) applyRecipe(engineRef.current, inc);
            engineRef.current?.rampMorphToChain?.();
            lastStable = sec;
            morphZone = -1;
            lastIncomingRef.current = null;
          }
          const bounds = [0, ...cues, 1];
          let sec = 0;
          for (let i = 0; i < bounds.length - 1; i++) if (frac >= bounds[i] && frac <= bounds[i + 1]) sec = i;
          if (sec !== lastStable) { lastStable = sec; applyRef.current(sec); engineRef.current?.rampMorphToChain?.(); }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      // Finalise any in-flight morph so the primary chain holds the last
      // preset the user heard, with no discontinuity.
      if (morphZone >= 0 && lastIncomingRef.current) {
        applyRecipe(engineRef.current, lastIncomingRef.current);
        engineRef.current?.rampMorphToChain?.();
      }
    };
  }, [liveFollow, enabled]);

  const reset = () => {
    setCount(3);
    setLetterPresets({ A: 0, B: 1, C: 2, D: 3, E: 4 });
    setEnabled(false);
    setLiveFollow(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const letter = e.dataTransfer.getData('text/letter');
    if (!letter) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const bounds = [0, ...cues, 1];
    for (let i = 0; i < bounds.length - 1; i++) {
      if (frac >= bounds[i] && frac <= bounds[i + 1]) {
        setAssignment((a) => a.map((l, idx) => (idx === i ? letter : l)));
        break;
      }
    }
  };

  return (
    <section className="sc-panel" style={{ background: 'linear-gradient(180deg, rgba(12,14,20,0.97), rgba(6,8,12,0.99))' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: SECTION_COLORS.A + '22' }}><Waves className="w-4 h-4" style={{ color: SECTION_COLORS.A }} /></div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Section Mastering</h2>
          <div className="flex overflow-hidden rounded-lg border border-white/15 font-mono text-[11px] ml-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`px-2.5 py-1 transition-all ${sectionCount === n ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`} title={`${n} section${n > 1 ? 's' : ''}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton panelId="sectionmastering" accent="#7c3aed" />
          <button onClick={() => setLiveFollow((v) => !v)} title="Auto-apply each section's preset as the playhead crosses its boundary (hard switch)" className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${liveFollow ? 'border-cyan-400 bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.45)]' : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'}`}>
            <Power className="w-3.5 h-3.5" />Live Follow
          </button>
          <button onClick={() => setEnabled((v) => !v)} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${enabled ? 'border-emerald-400 bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.45)]' : 'border-white/15 bg-white/5 text-white/50'}`}>
            <Power className="w-3.5 h-3.5" />{enabled ? 'On' : 'Off'}
          </button>
          <button onClick={reset} title="Reset sections" className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* per-letter preset controls — drag a letter onto a section to assign */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-wider text-white/50 mr-1">Presets</span>
        {SECTION_LETTERS.map((L) => {
          const col = SECTION_COLORS[L];
          return (
            <div
              key={L}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/letter', L); e.dataTransfer.effectAllowed = 'copy'; }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 pl-1.5 pr-1 cursor-grab"
              title={`Drag ${L} onto a section to assign its preset`}
            >
              <span className="grid place-items-center w-5 h-5 rounded font-bold text-[11px] text-black" style={{ background: col }}>{L}</span>
              <select
                value={letterPresets[L]}
                onChange={(e) => setLetterPresets((p) => ({ ...p, [L]: parseInt(e.target.value, 10) }))}
                className="bg-transparent text-[10px] text-white/85 outline-none max-w-[130px] cursor-pointer"
              >
                {FACTORY_PRESETS.map((p, i) => (
                  <option key={p.name} value={i} style={{ background: '#16191f', color: '#e5e7eb' }}>{p.name}</option>
                ))}
              </select>
            </div>
          );
        })}
        <span className="text-[9px] font-mono text-white/40 ml-1">drag a letter onto a section · click to audition · drag white handles to move · drag ✕ for glide{enabled ? ' · render bakes per-section presets' : ''}</span>
      </div>

      <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="rounded-lg overflow-hidden">
        {peaks ? (
          <SectionWaveform
            peaks={peaks}
            cues={cues}
            glides={glides}
            assignment={assignment}
            onCueChange={onCueChange}
            onGlideChange={onGlideChange}
            onSectionClick={applySection}
            getPlayback={engine.getPlayback}
            height={220}
          />
        ) : (
          <SectionWaveformEmpty loading={loading} />
        )}
      </div>
    </section>
  );
}