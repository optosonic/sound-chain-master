import React from 'react';
import { X, Minus, GripHorizontal } from 'lucide-react';

/**
 * Native VST/AU/AAX-style floating plugin window chrome.
 *
 * Scaling strategy: the plugin interior is designed ONCE at 1200×800
 * (designWidth × designHeight). The interior is uniformly scaled to fit.
 */
export default function PluginWindow({
  width, height,
  title = 'Sound Chain Master', subtitle, theme, children,
  designWidth = 1200, designHeight = 800,
}) {
  const titleH = 28;
  const bodyW = width;
  const bodyH = height - titleH;
  const designBodyH = designHeight - titleH;
  // Real-pixel inset around the scaled design canvas so the interior never
  // touches the window frame on any side (fixes the zero-margin overflow).
  const pad = 8;
  const scale = Math.min((bodyW - pad * 2) / designWidth, (bodyH - pad * 2) / designBodyH);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 pb-6 pt-14"
      style={{ background: 'radial-gradient(125% 125% at 50% 0%, #20242c 0%, #0c0d10 70%, #050608 100%)' }}
    >
      <div
        className="relative overflow-hidden rounded-lg shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
        style={{ width, height, border: '1px solid rgba(255,255,255,0.10)', background: theme?.pageBg || '#0e1014' }}
      >
        {/* Title bar — unscaled, real window width */}
        <div
          className="flex h-7 items-center px-2 select-none"
          style={{ background: 'linear-gradient(180deg,#2c3038,#1a1d23)', borderBottom: '1px solid rgba(0,0,0,0.55)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 text-center text-[11px] font-semibold tracking-wide text-white/70" style={{ fontFamily: 'var(--font-mono)' }}>
            {title}{subtitle && <span className="text-white/30"> · {subtitle}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button className="grid h-4 w-4 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-white/80"><Minus size={10} /></button>
            <button className="grid h-4 w-4 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-white/80"><X size={10} /></button>
          </div>
        </div>

        {/* Body — the design canvas, uniformly scaled to fit the window */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden" style={{ top: titleH, padding: pad }}>
          <div
            style={{
              width: designWidth,
              height: designBodyH,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              flexShrink: 0,
            }}
          >
            {children}
          </div>
        </div>

        {/* Resize handle (bottom-right) */}
        <div className="pointer-events-none absolute bottom-1 right-1 text-white/20">
          <GripHorizontal size={12} />
        </div>
      </div>
    </div>
  );
}