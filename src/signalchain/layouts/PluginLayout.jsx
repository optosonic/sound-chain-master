import React, { useState } from 'react';
import PluginWindow from '@/components/PluginWindow.jsx';
import ChainStudio from '@/signalchain/components/ChainStudio.jsx';
import SectionMasteringPanel from '@/signalchain/components/SectionMasteringPanel.jsx';
import MasteringPanel from '@/signalchain/components/MasteringPanel.jsx';
import OutputVisualizer from '@/signalchain/components/OutputVisualizer.jsx';
import VerticalLedMeter from '@/signalchain/components/VerticalLedMeter.jsx';
import InfoButton from '@/signalchain/components/InfoButton.jsx';

const PAGES = [
  { id: 'chain', label: 'FX Chain' },
  { id: 'section', label: 'Section' },
  { id: 'master', label: 'Master' },
  { id: 'output', label: 'Output' },
];

/**
 * Native AU/VST3 plugin window — 1200×800 lock, bottom tabs, no file transport.
 * Desktop header / 2×2 grid stay out of this frame.
 */
export default function PluginLayout({ engine, theme, width = 1200, height = 800 }) {
  const [page, setPage] = useState('chain');
  const themeKey = theme?.key;

  return (
    <PluginWindow width={width} height={height} subtitle={`${width}×${height}`} theme={theme}>
      <div className="flex h-full flex-col p-2">
        <div className="min-h-0 flex-1 overflow-hidden">
          {page === 'chain' && (
            <ChainStudio engine={engine} themeKey={themeKey} meterW={212} className="h-full" />
          )}
          {page === 'section' && (
            <div className="h-full overflow-auto">
              <SectionMasteringPanel engine={engine} />
            </div>
          )}
          {page === 'master' && (
            <div className="h-full overflow-auto">
              <MasteringPanel engine={engine} />
            </div>
          )}
          {page === 'output' && (
            <section className="sc-panel flex h-full flex-col overflow-hidden">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Final Output</h2>
                <InfoButton panelId="output" accent="#34506b" />
              </div>
              <div className="flex min-h-0 flex-1 items-stretch gap-3">
                <div className="min-w-0 flex-1">
                  <OutputVisualizer
                    analyzerNode={engine.analyzers?.spectrum}
                    ghostAnalyzerNode={engine.analyzers?.spectrumIn}
                    audioContext={engine.audioContext}
                    themeKey={themeKey}
                    leftAnalyzer={engine.analyzers?.levelLeft}
                    rightAnalyzer={engine.analyzers?.levelRight}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <VerticalLedMeter engine={engine.levelEngine} meteringMode={engine.meteringMode} showLufs={false} />
                </div>
              </div>
            </section>
          )}
        </div>
        <nav className="mt-1.5 flex shrink-0 gap-1.5">
          {PAGES.map((p) => {
            const on = page === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPage(p.id)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${
                  on
                    ? 'border-cyan-300/70 bg-white text-black'
                    : 'border-white/10 bg-[#2a2e35] text-white/75 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </nav>
      </div>
    </PluginWindow>
  );
}
