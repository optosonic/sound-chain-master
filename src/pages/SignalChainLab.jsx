import React, { useState } from 'react';
import { ThemeProvider, useTheme } from '@/signalchain/themes.jsx';
import { useSignalChainEngine } from '@/signalchain/useSignalChainEngine.js';
import ViewModeSwitcher from '@/components/ViewModeSwitcher';
import ViewErrorBoundary from '@/components/ViewErrorBoundary';
import FullDesktopLayout from '@/signalchain/layouts/FullDesktopLayout.jsx';
import PluginLayout from '@/signalchain/layouts/PluginLayout.jsx';

/**
 * Sound Chain Master — two view modes sharing ONE audio engine:
 *   • Plug in — native plugin window, 1200×800
 *   • Full / Desktop — standalone studio harness
 */
function SignalChainLabInner() {
  const { theme } = useTheme();
  const engine = useSignalChainEngine();
  const [mode, setMode] = useState('full');
  const [appMode, setAppMode] = useState('pro');

  return (
    <div data-theme={theme.key}>
      {/* Standalone plugin preview: Plug in / Desktop sits outside the 1200×800 frame. */}
      {mode === 'plugin' && <ViewModeSwitcher mode={mode} onChange={setMode} />}
      {mode === 'plugin' && (
        <ViewErrorBoundary label="Plug in">
          <PluginLayout engine={engine} theme={theme} width={1200} height={800} />
        </ViewErrorBoundary>
      )}
      {mode === 'full' && (
        <ViewErrorBoundary label="Desktop">
          <FullDesktopLayout engine={engine} theme={theme} mode={mode} onModeChange={setMode} appMode={appMode} onAppModeChange={setAppMode} />
        </ViewErrorBoundary>
      )}
    </div>
  );
}

export default function SignalChainLab() {
  return (
    <ThemeProvider>
      <SignalChainLabInner />
    </ThemeProvider>
  );
}
