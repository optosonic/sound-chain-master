import React, { useState } from 'react';
import { Play, Pause, Square, Mic, MicOff, Upload, Volume2, Power, RotateCcw, Maximize2, Minimize2, Link2, Unlink, Loader2 } from 'lucide-react';
import ChainStudio from '@/signalchain/components/ChainStudio.jsx';
import MasteringPanel from '@/signalchain/components/MasteringPanel.jsx';
import SectionMasteringPanel from '@/signalchain/components/SectionMasteringPanel.jsx';
import OutputVisualizer from '@/signalchain/components/OutputVisualizer.jsx';
import SignalUtilityPanel from '@/signalchain/components/SignalUtilityPanel.jsx';
import VerticalLedMeter from '@/signalchain/components/VerticalLedMeter.jsx';
import LevelMeter from '@/signalchain/components/LevelMeter.jsx';
import IOGainFader from '@/signalchain/components/IOGainFader.jsx';
import VUMeter from '@/signalchain/components/VUMeter.jsx';
import DesktopHeader from '@/signalchain/components/DesktopHeader.jsx';
import InfoButton from '@/signalchain/components/InfoButton.jsx';
import PlayheadScrubber from '@/signalchain/components/PlayheadScrubber.jsx';

/**
 * Full Desktop harness — native DesktopTopGrid 2×2 Wide + stacked studio pages.
 */
export default function FullDesktopLayout({ engine, theme, mode, onModeChange, appMode = 'pro', onAppModeChange }) {
  const [outputFullscreen, setOutputFullscreen] = useState(false);
  const {
    ready, isPlaying, isMicOn, volume, fileName, isLoading, loadProgress, loadFailed, dragOver, error, bypass,
    meterOrient, meterPro, meteringMode,
    inputGainL, inputGainR, outputGainL, outputGainR, linkLR,
    levelEngine, audioContext, analyzers,
    setVolume, setMeterOrient, setMeterPro, setMeteringMode, setDragOver,
    handleInputGainLChange, handleInputGainRChange, handleOutputGainLChange, handleOutputGainRChange, handleLinkLRToggle,
    handlePlay, handlePause, handleStop, toggleMic, handleBypassToggle, handleReset,
    onFileInput, onDrop,
  } = engine;

  return (
    <div className="min-h-screen text-white" style={{ background: theme.pageBg }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full blur-[120px]" style={{ background: theme.glow1 }} />
        <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full blur-[120px]" style={{ background: theme.glow2 }} />
      </div>
      <div className="sc-fx-overlay" aria-hidden />

      <div className="relative mx-auto max-w-[1280px] space-y-4 px-4 py-6">
        <DesktopHeader theme={theme} mode={mode} onModeChange={onModeChange} appMode={appMode} onAppModeChange={onAppModeChange} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="sc-panel flex h-[400px] flex-col overflow-hidden">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Audio Source</h2>
            <div className="flex items-center gap-2">
              <span className="sc-source-info"><InfoButton panelId="source" accent="#34d399" /></span>
              <span className={`sc-source-status rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold ${ready ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : 'border-white/30 bg-black/40 text-white/70'}`}>
                {ready ? '● Engine Ready' : '○ Initialising'}
              </span>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-4">
            <label
                onDragOver={(e) => {e.preventDefault();setDragOver(true);}}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-4 text-center transition-all"
                style={{
                  background: 'linear-gradient(160deg, rgba(8,10,16,0.92), rgba(2,4,9,0.96))',
                  border: `1px solid ${dragOver ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.14)'}`,
                  boxShadow: dragOver ? '0 0 22px rgba(167,139,250,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 40px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)'
                }}>
                
              <span className="pointer-events-none absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.05), transparent 60%)' }} />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
                ) : (
                  <Upload className={`h-5 w-5 transition-colors ${dragOver ? 'text-violet-300' : 'text-white/80'}`} />
                )}
              </div>
              <span className={`relative text-sm font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${loadFailed ? 'text-rose-300' : 'text-white'}`}>
                {isLoading ? (
                  <>Loading: <span className="font-mono text-violet-300">{fileName}</span></>
                ) : loadFailed ? (
                  <>Failed to load: <span className="font-mono text-rose-300">{fileName}</span></>
                ) : fileName ? (
                  <>{isPlaying ? 'Now playing:' : 'Now loaded:'} <span className="font-mono text-violet-300">{fileName}</span></>
                ) : (
                  'Drag & drop an audio file, or click to browse'
                )}
              </span>
              {isLoading && (
                <div className="relative mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300 ${loadProgress > 0 ? 'transition-[width] duration-200' : 'animate-pulse'}`}
                    style={{ width: `${loadProgress > 0 ? loadProgress : 40}%` }}
                  />
                </div>
              )}
              <input type="file" accept="audio/*" className="hidden" onChange={onFileInput} />
            </label>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={isPlaying ? handlePause : handlePlay} className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(139,92,246,0.55)] transition-all hover:from-violet-400 hover:to-violet-600">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={handleStop} className="flex items-center gap-2 rounded-lg border border-white/25 bg-black/50 px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-black/70 hover:border-white/40"><Square className="h-4 w-4" /> Stop</button>
                <button onClick={toggleMic} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${isMicOn ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_12px_rgba(251,113,133,0.5)]' : 'border-white/25 bg-black/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-black/70 hover:border-white/40'}`}>
                  {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{isMicOn ? 'Mic On' : 'Mic'}
                </button>
                <button onClick={handleBypassToggle} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${bypass ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-white/25 bg-black/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-black/70 hover:border-white/40'}`} title="A/B against the dry signal">
                  <Power className="h-4 w-4" />{bypass ? 'Bypass On' : 'Bypass'}
                </button>
                <button onClick={handleReset} className="flex items-center gap-2 rounded-lg border border-white/25 bg-black/50 px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-black/70 hover:border-white/40" title="Restore all panels to defaults"><RotateCcw className="h-4 w-4" /> Reset</button>
              </div>
              <PlayheadScrubber engine={engine} />
              <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2">
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-white/40">Monitor Out</span>
                <Volume2 className="h-4 w-4 shrink-0 text-white/80" />
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full accent-violet-400" />
                <span className="w-16 text-right font-mono text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{volume <= 0 ? '−∞' : `${(20 * Math.log10(volume)).toFixed(1)}`}<span className="ml-0.5 text-white/40">dB</span></span>
              </div>
            </div>
          </div>
          {error && <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-200">{error}</p>}
        </section>

        <section className="sc-panel flex h-[400px] flex-col overflow-hidden">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Signal Utility</h2>
            <InfoButton panelId="source" accent="#22d3ee" />
          </div>
          <SignalUtilityPanel signalUtility={engine.signalUtility} />
        </section>

        <section className="sc-panel h-[400px] overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">VU Meter</h2>
            <InfoButton panelId="vu" accent="#fbbf24" />
          </div>
          <VUMeter engine={levelEngine} variant="round" />
        </section>

        <section className="sc-panel flex h-[400px] flex-col overflow-hidden">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Master Level Meter</h2>
            <div className="flex items-center gap-2">
              <InfoButton panelId="level" accent="#22d3ee" />
              <div className="flex overflow-hidden rounded-lg border border-white/10 font-mono text-[11px]">
                <button onClick={() => setMeterOrient('horizontal')} className={`px-2.5 py-1 transition-all ${meterOrient === 'horizontal' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>H</button>
                <button onClick={() => setMeterOrient('vertical')} className={`px-2.5 py-1 transition-all ${meterOrient === 'vertical' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>V</button>
              </div>
              <button onClick={() => setMeterPro((p) => !p)} className={`rounded-lg border px-3 py-1 text-[11px] transition-all ${meterPro ? 'border-violet-400 bg-violet-500/20 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}>{meterPro ? 'Less Detail' : 'More Detail'}</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 flex gap-3">
            <div className="min-w-0 flex-1">
            <LevelMeter engine={levelEngine} orientation={meterOrient} pro={meterPro} meteringMode={meteringMode} onMeteringModeChange={setMeteringMode} inAnalyzer={analyzers?.spectrumIn} outAnalyzer={analyzers?.spectrum} audioContext={audioContext} />
            </div>
            <div className="flex w-16 shrink-0 flex-col gap-2 rounded-lg border border-cyan-500/20 bg-black px-1.5 py-2">
              <span className="text-center text-[8px] font-mono uppercase tracking-widest text-cyan-200/50">I/O</span>
              <div className="flex min-h-0 flex-1 justify-center gap-1.5">
                <IOGainFader
                  values={linkLR ? [inputGainL] : [inputGainL, inputGainR]}
                  onChange={(i, db) => (i === 0 ? handleInputGainLChange(db) : handleInputGainRChange(db))}
                  label="IN"
                  accent="#22d3ee"
                />
                <IOGainFader
                  values={linkLR ? [outputGainL] : [outputGainL, outputGainR]}
                  onChange={(i, db) => (i === 0 ? handleOutputGainLChange(db) : handleOutputGainRChange(db))}
                  label="OUT"
                  accent="#22d3ee"
                />
              </div>
              <button
                onClick={handleLinkLRToggle}
                title={linkLR ? 'L/R linked — click to unlink (independent L & R faders)' : 'L/R independent — click to link'}
                className={`flex items-center justify-center gap-1 rounded border px-1 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider transition-all ${
                  linkLR
                    ? 'border-cyan-300/60 bg-cyan-500/30 text-cyan-100'
                    : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'
                }`}
              >
                {linkLR ? <Link2 className="h-2.5 w-2.5" /> : <Unlink className="h-2.5 w-2.5" />} {linkLR ? 'Link' : 'L·R'}
              </button>
            </div>
          </div>
        </section>
        </div>

        {/* FX Chain — shared inspector with plugin window. Watermark fills leftover. */}
        {appMode !== 'basic' && (
        <section className="overflow-hidden h-[760px] rounded-xl border border-white/10 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]" style={{ background: theme.pageBg }}>
          <ChainStudio engine={engine} themeKey={theme.key} className="h-full" />
        </section>
        )}

        {appMode !== 'basic' && (
        <SectionMasteringPanel engine={engine} />
        )}

        <MasteringPanel engine={engine} />

        <section className="sc-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Final Output</h2>
            <div className="flex items-center gap-2">
              <InfoButton panelId="output" accent="#34506b" />
              <span className="text-[10px] font-mono text-white/45">spectrum · scope · peak / rms</span>
              <button onClick={() => setOutputFullscreen(true)} title="Expand to full screen" className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition-all hover:bg-white/10 hover:text-white hover:border-white/30">
                <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
              </button>
            </div>
          </div>
          <div className="flex items-stretch gap-3">
            <div className="min-w-0 flex-1">
              <OutputVisualizer analyzerNode={analyzers?.spectrum} ghostAnalyzerNode={analyzers?.spectrumIn} audioContext={audioContext} themeKey={theme.key} leftAnalyzer={analyzers?.levelLeft} rightAnalyzer={analyzers?.levelRight} />
            </div>
            <div className="w-24 shrink-0">
              <VerticalLedMeter engine={levelEngine} meteringMode={meteringMode} showLufs={false} />
            </div>
          </div>
        </section>

        {outputFullscreen &&
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Final Output — Full Screen</h2>
              <button onClick={() => setOutputFullscreen(false)} className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-white/20 hover:border-white/40">
                <Minimize2 className="h-4 w-4" /> Exit
              </button>
            </div>
            <div className="flex flex-1 min-h-0 items-stretch gap-3">
              <div className="min-w-0 flex-1">
                <OutputVisualizer analyzerNode={analyzers?.spectrum} ghostAnalyzerNode={analyzers?.spectrumIn} audioContext={audioContext} height={Math.max(300, window.innerHeight - 120)} themeKey={theme.key} leftAnalyzer={analyzers?.levelLeft} rightAnalyzer={analyzers?.levelRight} />
              </div>
              <div className="w-24 shrink-0">
                <VerticalLedMeter engine={levelEngine} meteringMode={meteringMode} showLufs={false} />
              </div>
            </div>
          </div>
        }

        <footer className="pt-4 pb-10 text-center">
          <div className="mx-auto mb-4 h-px w-20 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="flex items-center justify-center gap-3">
            <a href="https://spher8.com" target="_blank" rel="noreferrer" className="font-bold tracking-tight text-white transition-colors hover:text-white text-base">Spher8</a>
            <span className="text-white/30">·</span>
            <span className="text-sm font-semibold tracking-wide text-white/70">SCM — Sound Chain Master</span>
          </div>
          <p className="mt-2 text-xs font-medium tracking-wide text-white/45">
            Created and designed by Ivan Zavada <span className="text-white/30">·</span> © 2026
          </p>
          <a href="https://spher8.com" target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] tracking-wider text-white/45 transition-colors hover:text-white/80">
            www.spher8.com
          </a>
        </footer>
      </div>
    </div>);

}