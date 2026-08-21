import React, { useEffect, useRef } from 'react';
import { Image } from '@/components/ui/image';

// Photorealistic vacuum tube for the Analogue Density module.
// The bottle itself is an AI-rendered photo (screen-blended so its black
// background melts into the dark panel). A multi-layer warm glow — an outer
// halo behind the bottle and an amber bloom over it — swells with live signal
// amplitude, so the tube reads as alive rather than a static picture.

const TUBE_IMAGES = {
  '12AX7': 'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/9379dc9da_generated_image.png',
  '6U8A': 'https://media.base44.com/images/public/6a7e8481e986f3768f1465c4/9fd62705e_generated_image.png',
};

export default function VacuumTube({ type = '6U8A', drive = 0, alt = false, on = false, analyzer, label }) {
  const haloRef = useRef(null);
  const bloomRef = useRef(null);
  const filRef = useRef(null);
  const rafRef = useRef(0);
  const smoothRef = useRef(0);
  const bufRef = useRef(null);

  // Warm orange-amber when lit; alt tube runs hotter → deep orange-red. Cold =
  // faint grey-blue when the module is off (tubes unlit).
  const glow = alt ? '255,90,25' : '255,120,20';
  const cold = '80,96,120';
  const c = on ? glow : cold;

  useEffect(() => {
    const apply = (intensity) => {
      const halo = haloRef.current, bloom = bloomRef.current, fil = filRef.current;
      if (halo) halo.style.opacity = String(intensity * 0.72);
      if (bloom) bloom.style.opacity = String(intensity * 0.5);
      if (fil) {
        fil.style.opacity = String(intensity * 0.9);
      }
    };

    if (!on) { smoothRef.current = 0; apply(0); return; }

    // Idle warm glow from the knob — kept FAINT so the tube reads as barely
    // lit while the signal sits below the reactive window.
    const idle = Math.min(1, 0.04 + drive * 0.1);
    apply(idle);
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      let db = -60;
      const a = analyzer;
      if (a) {
        if (!bufRef.current || bufRef.current.length !== a.fftSize) bufRef.current = new Float32Array(a.fftSize);
        a.getFloatTimeDomainData(bufRef.current);
        const b = bufRef.current;
        let p = 0;
        for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > p) p = v; }
        db = p > 1e-5 ? 20 * Math.log10(p) : -60;
      }
      // Only the TOP 36 dB (-36..0 dB) drives the reactive glow; below that the
      // tube stays at its faint idle. Ease-in (squared) concentrates the bloom
      // near the loudest peaks so the glow pulses with transients instead of
      // washing on across the whole dynamic range.
      const raw = Math.max(0, Math.min(1, (db + 36) / 36));
      const target = raw * raw;
      const rising = target > smoothRef.current;
      const k = 1 - Math.exp(-dt / (rising ? 0.005 : 0.19));
      smoothRef.current += (target - smoothRef.current) * k;
      const total = Math.min(1, idle + smoothRef.current * 1.2);
      apply(total);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [on, drive, analyzer, c]);

  return (
    <div
      className="relative flex-1 overflow-hidden rounded-lg border border-white/15"
      style={{
        background: 'linear-gradient(180deg, #0c0f14, #05070b)',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8), inset 0 0 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* diamond mesh grille */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 7px)',
        }}
      />
      {/* tube assembly */}
      <div className="absolute inset-0 flex items-end justify-center pb-1">
        <div className="relative h-[96%] w-full">
          {/* outer warm halo — behind the bottle, opacity driven by amplitude */}
          <div
            ref={haloRef}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[82%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 42%, rgba(${c},0.6) 0%, rgba(${c},0.18) 45%, transparent 72%)`,
              filter: 'blur(9px)',
              opacity: 0,
            }}
          />
          {/* photoreal tube — screen-blended so its black bg melts into the panel */}
          <div className="absolute inset-0">
            <Image
              src={TUBE_IMAGES[type] || TUBE_IMAGES['6U8A']}
              fittingType="fit"
              className={`h-full w-full ${on ? 'sc-tube-flicker' : ''}`}
              style={{ mixBlendMode: 'screen', animationDuration: alt ? '2.7s' : '3.4s', animationDelay: alt ? '-1.1s' : undefined }}
              alt=""
            />
          </div>
          {/* amber bloom over the bottle — swells with signal */}
          <div
            ref={bloomRef}
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 40%, rgba(${c},0.5) 0%, rgba(${c},0.12) 46%, transparent 70%)`,
              mixBlendMode: 'screen',
              opacity: 0,
            }}
          />
          {/* internal incandescence — deep amber hot zone inside the metal cage
              with two vertically-aligned white-hot emission points; brightens
              with signal so the tube glows from the inside out */}
          <div
            ref={filRef}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[32%] -translate-x-1/2 -translate-y-1/2"
            style={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, rgba(217,119,0,0.98) 0%, rgba(180,83,9,0.82) 36%, rgba(69,26,3,0.4) 62%, transparent 84%)',
                filter: 'blur(4px)',
              }}
            />
            <div
              className="absolute left-1/2 top-[30%] h-[5%] w-[30%] -translate-x-1/2 rounded-full"
              style={{ background: '#FFF700', filter: 'blur(2px)', boxShadow: '0 0 10px rgba(255,247,0,0.95)' }}
            />
            <div
              className="absolute left-1/2 top-[65%] h-[5%] w-[30%] -translate-x-1/2 rounded-full"
              style={{ background: '#FFCC00', filter: 'blur(2px)', boxShadow: '0 0 10px rgba(255,204,0,0.95)' }}
            />
          </div>

        </div>
      </div>
      {/* base label */}
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] font-semibold tracking-wider text-white/70">
        {label}
      </span>
    </div>
  );
}