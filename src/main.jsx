import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Surface the real cause of unhandled promise rejections. Some code paths
// reject with a non-Error value (no `.stack`), which makes the dev-injected
// rejection formatter crash with "Cannot read properties of undefined
// (reading 'match')". Normalise the reason into a real Error first so the
// formatter has a stack to read, and log the original so it's debuggable.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event && event.reason;
  if (reason instanceof Error) return;
  try {
    const msg = typeof reason === 'string' ? reason
      : (reason && typeof reason === 'object' && (reason.message || JSON.stringify(reason))) || String(reason);
    // eslint-disable-next-line no-console
    console.warn('[unhandledrejection] non-Error reason:', msg, reason);
  } catch {}
  // Replace the stack-less reason with a real Error so downstream formatters
  // (the platform's) don't crash reading `.match` on undefined.
  const err = reason instanceof Error ? reason : new Error(String(reason ?? 'unhandled rejection'));
  try { Object.defineProperty(event, 'reason', { value: err, configurable: true }); } catch {}
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)