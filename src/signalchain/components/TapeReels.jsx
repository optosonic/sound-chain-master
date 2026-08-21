import React, { useEffect, useRef, useState } from 'react';

/**
 * Animated two-reel tape visualizer — purely decorative (drives no audio).
 * Reels spin at an angular velocity proportional to the tape speed (ips) when
 * the module is enabled, easing toward a stop when bypassed; the tape strip
 * between the reels wobbles subtly with the wow depth.
 *
 * The tape runs sit a few px INBOARD of the reel rims, so the reels (drawn
 * after the tape) overlap the tape by a small amount — like a real reel where
 * the tape disappears behind the flange at the take-up point.
 */
export default function TapeReels({ speed = 15, wow = 0.15, enabled = false, accent = '#e8a06a' }) {
  const [angle, setAngle] = useState(0);
  const [active, setActive] = useState(0);
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const activeRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const target = enabled ? speed * 0.35 : 0; // rad/s
      velRef.current += (target - velRef.current) * Math.min(1, dt * 2.5);
      angleRef.current = (angleRef.current + velRef.current * dt) % (Math.PI * 2);
      // Eased activity: 0 when off (tape straight), 1 when on (tape slants).
      const aTarget = enabled ? 1 : 0;
      activeRef.current += (aTarget - activeRef.current) * Math.min(1, dt * 3);
      setAngle(angleRef.current);
      setActive(activeRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, speed]);

  // Canvas sized slightly taller than the Clip Distortion transfer visualizer
  // (148 vs 140) so the tape-machine background photo picks up the extra
  // vertical real estate and the Tape Machine panel lines up with Clip
  // Distortion (compensating for the panel's tighter spacing above the knobs).
  const r = 34;
  const cy = 74;
  const c1 = 52;
  const c2 = 248;
  // Small inward offset so the reels overlap the tape at the take-up points.
  const overlap = 5;
  // Independent natural vibrations for the top and bottom tape runs —
  // different frequencies and phases so they don't track in parallel. Both
  // ease to 0 (tape sits straight) when the machine is off, and their depth
  // scales with the wow modulation parameter when on.
  const topSlant = (Math.sin(angle * 1.7) + Math.sin(angle * 3.1 + 1.2) * 0.4) * wow * 10 * active;
  const bottomSlant = (Math.sin(angle * 2.3 + 0.6) + Math.sin(angle * 1.4 + 2.1) * 0.35) * wow * 10 * active;

  const Reel = ({ cx, dir = 1 }) => {
    const a0 = angle * dir;
    const spokes = [0, 60, 120].map((d) => {
      const a = a0 + (d * Math.PI) / 180;
      return (
        <line
          key={d}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(a) * (r - 6)}
          y2={cy + Math.sin(a) * (r - 6)}
          stroke={accent}
          strokeOpacity="0.55"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      );
    });
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="#15171c" stroke={accent} strokeOpacity="0.45" strokeWidth="2.4" />
        <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke={accent} strokeOpacity="0.18" strokeWidth="1" />
        {spokes}
        <circle cx={cx} cy={cy} r={9} fill={accent} fillOpacity="0.85" />
        <circle cx={cx} cy={cy} r={3} fill="#0b0d10" />
      </g>
    );
  };

  return (
    <svg width="100%" height="100%" viewBox="0 0 300 148" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {/* tape strip between the reels — top + bottom runs vibrate independently.
          Drawn before the reels and nudged inboard so the reels overlap the tape. */}
      <path
        d={`M ${c1} ${cy - r + overlap} Q 150 ${cy - r + overlap + topSlant}, ${c2} ${cy - r + overlap}`}
        stroke={accent} strokeOpacity="0.75" strokeWidth="2" fill="none"
      />
      <path
        d={`M ${c1} ${cy + r - overlap} Q 150 ${cy + r - overlap + bottomSlant}, ${c2} ${cy + r - overlap}`}
        stroke={accent} strokeOpacity="0.75" strokeWidth="2" fill="none"
      />
      <Reel cx={c1} dir={1} />
      <Reel cx={c2} dir={1} />
    </svg>
  );
}