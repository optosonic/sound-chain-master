import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Visual identity themes for Sound Chain Master.
 * Each theme is a token set consumed by the page chrome (background, ambient
 * glow, logo/title gradients, accent) plus a `fx` key that selects a signature
 * overlay in index.css (glass caustic / metal grain / CRT scanlines / HUD grid).
 *
 * Themes are kept dark-leaning so the existing white-on-dark panel text stays
 * legible in every identity.
 */
export const THEMES = [
  {
    key: 'dark',
    name: 'Precision Studio',
    blurb: 'Clean pro-audio dark',
    pageBg:
      'radial-gradient(1100px 620px at 14% -12%, rgba(56,224,255,0.24), transparent 55%), radial-gradient(1000px 560px at 88% 112%, rgba(99,102,241,0.20), transparent 58%), radial-gradient(900px 520px at 50% 104%, rgba(30,58,95,0.55), transparent 70%), linear-gradient(180deg, #2c3a58 0%, #1d2842 48%, #131c30 100%)',
    glow1: 'rgba(56,224,255,0.22)',
    glow2: 'rgba(99,102,241,0.20)',
    logo: 'linear-gradient(to bottom right, #0a1a3f 0%, #123a6e 32%, #2bd4c0 68%, #38e0ff 100%)',
    title: 'linear-gradient(90deg,#67e8f9,#a5b4fc,#e0e7ff)',
    accent: '#38e0ff',
    gem: '#38e0ff',
    accent2: '#818cf8',
    fx: 'dark',
  },
  {
    key: 'glass',
    name: 'Ethereal Glass',
    blurb: 'Frosted liquid glass',
    pageBg:
      'radial-gradient(820px 520px at 12% 8%, rgba(56,189,248,0.42), transparent 58%), radial-gradient(760px 520px at 88% 18%, rgba(217,70,239,0.40), transparent 60%), radial-gradient(700px 460px at 78% 96%, rgba(129,140,248,0.38), transparent 62%), linear-gradient(155deg,#140a2e,#241043 48%,#0a0524 78%,#04021a)',
    glow1: 'rgba(56,189,248,0.30)',
    glow2: 'rgba(232,121,249,0.30)',
    logo: 'linear-gradient(135deg, rgba(56,189,248,0.85), rgba(232,121,249,0.85))',
    title: 'linear-gradient(90deg,#a5f3fc,#f0abfc,#c4b5fd)',
    accent: '#22d3ee',
    gem: '#22d3ee',
    accent2: '#e879f9',
    fx: 'glass',
  },
  {
    key: 'titanium',
    name: 'Forge Titanium',
    blurb: 'Brushed industrial metal',
    pageBg:
      'repeating-linear-gradient(127deg, rgba(255,255,255,0.035) 0 1px, rgba(0,0,0,0.05) 1px 2px, transparent 2px 5px), radial-gradient(900px 500px at 50% -10%, rgba(212,160,74,0.16), transparent 60%), linear-gradient(160deg,#3a3e45,#22252b 55%,#0f1013)',
    glow1: 'rgba(212,160,74,0.20)',
    glow2: 'rgba(180,188,200,0.14)',
    logo: 'linear-gradient(160deg,#e6e9ee,#9aa0a8 38%,#3a3d42)',
    title: 'linear-gradient(90deg,#f1d9a1,#d4a04a,#8b949e)',
    accent: '#e0a94e',
    gem: '#e0a94e',
    accent2: '#9aa4b2',
    fx: 'titanium',
  },
  {
    key: 'retro',
    name: 'Analog Rack',
    blurb: 'Warm 80s studio rack',
    pageBg:
      'radial-gradient(900px 520px at 30% 0%, rgba(255,158,26,0.16), transparent 60%), radial-gradient(700px 460px at 80% 100%, rgba(74,222,128,0.10), transparent 62%), linear-gradient(165deg,#241a10,#2a1d12 50%,#14100a)',
    glow1: 'rgba(255,158,26,0.24)',
    glow2: 'rgba(74,222,128,0.16)',
    logo: 'linear-gradient(160deg,#3a2a14,#8a5a26 50%,#f0a93c)',
    title: 'linear-gradient(90deg,#ff9e1a,#ffd56b,#7be88f)',
    accent: '#ff9e1a',
    gem: '#ff9e1a',
    accent2: '#4ade80',
    fx: 'retro',
  },
  {
    key: 'hud',
    name: 'Neural Lab',
    blurb: 'Cyberpunk command centre',
    pageBg:
      'radial-gradient(560px 360px at 50% -8%, rgba(0,240,255,0.20), transparent 66%), radial-gradient(420px 300px at 96% 8%, rgba(255,45,209,0.16), transparent 64%), radial-gradient(420px 300px at 4% 96%, rgba(170,255,0,0.12), transparent 64%), linear-gradient(180deg,#000206,#01030a 60%,#000)',
    glow1: 'rgba(0,240,255,0.26)',
    glow2: 'rgba(255,45,209,0.20)',
    logo: 'linear-gradient(160deg,#021018,#07343c 58%,#00f0ff)',
    title: 'linear-gradient(90deg,#00f0ff,#aaff00,#ff2dd1)',
    accent: '#00f0ff',
    gem: '#00f0ff',
    accent2: '#aaff00',
    fx: 'hud',
  },
  {
    key: 'bk',
    name: 'B&K Lab',
    blurb: 'Brüel & Kjær measurement instrument',
    pageBg:
      'radial-gradient(120% 90% at 50% -10%, #6b786d 0%, #586359 55%, #4a544b 100%)',
    glow1: 'rgba(44,95,82,0.10)',
    glow2: 'rgba(26,26,26,0.06)',
    logo: 'linear-gradient(160deg,#2a2a2a,#0d0d0d)',
    title: 'linear-gradient(90deg,#EAF0E6,#9AB5A6)',
    accent: '#2C5F52',
    gem: '#5fe8c4',
    accent2: '#9A7B4A',
    fx: 'bk',
  },
];

const ThemeCtx = createContext({ theme: THEMES[0], setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [key, setKey] = useState(() => {
    try {
      return localStorage.getItem('scm-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('scm-theme', key);
    } catch {}
  }, [key]);
  const theme = THEMES.find((t) => t.key === key) || THEMES[0];
  return (
    <ThemeCtx.Provider value={{ theme, setTheme: setKey }}>{children}</ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);