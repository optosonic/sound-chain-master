/**
 * Shared "audio engine is producing signal" flag.
 *
 * When the engine is NOT playing and the mic is off, `standby` is true and every
 * always-on meter / visualizer skips its per-frame work (FFT reads, canvas
 * draws, DOM style writes), freezing on its last frame and dropping idle CPU to
 * near zero. The engine toggles this; meters subscribe via a ref so their rAF
 * loops never need to restart — they just early-out while idle.
 *
 * The FPS pill keeps running in standby, so the main-thread frame time visibly
 * falls when the meters go idle.
 */
let standby = true;
const listeners = new Set();

export function getMeterStandby() {
  return standby;
}

export function setMeterStandby(v) {
  const next = !!v;
  if (standby === next) return;
  standby = next;
  listeners.forEach((fn) => fn(next));
}

export function subscribeMeterStandby(fn) {
  listeners.add(fn);
  fn(standby);
  return () => {
    listeners.delete(fn);
  };
}