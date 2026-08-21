import React from 'react';
import { Maximize2, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import IdentityLamps from './IdentityLamps.jsx';
import MetalRocker from './MetalRocker.jsx';
import TubeSchematic from './TubeSchematic.jsx';
import InfoButton from './InfoButton.jsx';
import FpsReadout from './FpsReadout.jsx';

const CASTLE_LOGO = 'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/ba6dff13c_image.png';

/**
 * Full-desktop header only (native AppShell paint + desktopHeaderSlots).
 * Not used inside the 1200×800 plugin frame.
 */
export default function DesktopHeader({
  theme,
  mode = 'full',
  onModeChange,
  appMode = 'pro',
  onAppModeChange,
}) {
  const light = theme.key === 'bk';
  const gem = theme.gem || theme.accent;
  return (
    <header
      className="relative overflow-hidden rounded-[11px]"
      style={{
        minHeight: 128,
        background: light
          ? 'linear-gradient(180deg, #7a877e 0%, #5e6a62 42%, #4a544b 100%)'
          : `linear-gradient(180deg, color-mix(in srgb, #2a303c 93%, ${gem}) 0%, #161a22 42%, #0a0c10 100%)`,
        boxShadow: light
          ? '0 5px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.16)'
          : '0 5px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
        border: `1.15px solid rgba(0,0,0,${light ? 0.32 : 0.62})`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(127deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 3.2px), repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 0.55px, transparent 0.55px 5px)',
        }}
      />
      <TubeSchematic gem={gem} light={light} />

      <div className="relative z-10 flex items-center gap-4 px-4 py-3 sm:gap-5 sm:px-5">
        {/* Castle / SCM badge — existing brand mark, untouched */}
        <div className="relative shrink-0">
          <div
            className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl sm:h-24 sm:w-24"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, #2C4A73 0%, #123a6e 32%, #2bd4c0 68%, #66E3D8 100%)',
              boxShadow: `0 0 24px ${gem}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
          >
            <img
              src={CASTLE_LOGO}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
              style={{
                opacity: 0.45,
                mixBlendMode: 'screen',
                transform: 'scale(1.08)',
                maskImage: 'linear-gradient(to top, transparent 10%, rgba(0,0,0,0.7) 100%)',
                WebkitMaskImage: 'linear-gradient(to top, transparent 10%, rgba(0,0,0,0.7) 100%)',
              }}
            />
            <span
              className="relative text-2xl font-black tracking-tighter text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-3xl"
              style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
            >
              SCM
            </span>
          </div>
        </div>

        {/* Stacked lockup: Spher8 (S only) · Sound Chain Master · tagline */}
        <div className="min-w-0 shrink-0">
          <div
            className="text-[9px] font-bold uppercase"
            style={{ color: gem, letterSpacing: '0.34em', opacity: light ? 0.9 : 0.8 }}
          >
            Spher8
          </div>
          <h1
            className="mt-0.5 text-[28px] font-black leading-none tracking-tight sm:text-[30px]"
            style={{
              backgroundImage: theme.title,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Sound Chain Master
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-[1.4px] w-4 rounded-full" style={{ background: gem, opacity: 0.8 }} />
            <p
              className="text-[11px] tracking-wide"
              style={{ color: light ? '#2a342f' : 'rgba(212,216,222,0.62)', letterSpacing: '0.04em' }}
            >
              Professional audio DSP  ·  component lab
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <IdentityLamps />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex w-[196px] flex-col gap-2">
            <MetalRocker
              gem={gem}
              light={light}
              height={42}
              value={mode === 'plugin' ? 'plugin' : 'full'}
              onChange={onModeChange}
              options={[
                { id: 'plugin', label: 'Plugin', hint: '1200×800', icon: <Maximize2 size={13} /> },
                { id: 'full', label: 'Desktop', hint: 'Full studio', icon: <Monitor size={13} /> },
              ]}
            />
            <MetalRocker
              gem={gem}
              light={light}
              height={22}
              value={appMode}
              onChange={onAppModeChange}
              options={[
                { id: 'basic', label: 'Basic' },
                { id: 'pro', label: 'PRO' },
              ]}
            />
          </div>

          <div className="hidden w-[108px] flex-col justify-center gap-1 sm:flex">
            <div
              className="flex h-[22px] items-center gap-1.5 rounded-md px-2"
              style={{
                background: light ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.42)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <span className="h-[7.2px] w-[7.2px] animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]" />
              <span
                className="text-[8.5px] font-bold uppercase tracking-[0.18em]"
                style={{ color: light ? '#14532d' : '#bbf7d0' }}
              >
                DSP LIVE
              </span>
            </div>
            <span
              className="text-[9px] tracking-wide"
              style={{ color: light ? 'rgba(26,26,26,0.70)' : 'rgba(212,216,222,0.55)' }}
            >
              44.1 kHz  ·  32-bit
            </span>
            <FpsReadout />
            <span
              className="text-[8px] uppercase tracking-[0.18em]"
              style={{ color: light ? 'rgba(47,58,52,0.55)' : 'rgba(255,255,255,0.32)' }}
            >
              v1.0  ·  WEBAUDIO
            </span>
            <Link
              to="/booklet"
              className="text-[8px] font-semibold uppercase tracking-wider opacity-60 hover:opacity-100"
              style={{ color: gem }}
            >
              Booklet
            </Link>
          </div>

          {/* Info i — far right of the header */}
          <InfoButton panelId="visualidentity" accent={gem} compact />
        </div>
      </div>

      <div className="relative z-10 px-4 pb-3 lg:hidden">
        <IdentityLamps />
      </div>
    </header>
  );
}
