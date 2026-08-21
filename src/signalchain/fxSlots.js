/** Master-bus FX slot IDs. */
export const FX_SLOT = {
  compressor: 'compressor',
  saturation: 'saturation',
  clip: 'clip',
  tape: 'tape',
  delay: 'delay',
  reverb: 'reverb',
  eq: 'eq',
  dynamicEq: 'dynamicEq',
  multiBandComp: 'multiBandComp',
  limiter: 'limiter',
  stereoImager: 'stereoImager',
  mon8: 'mon8',
  analogueDensity: 'analogueDensity',
};

export const FX_SLOT_LIST = [
  FX_SLOT.compressor,
  FX_SLOT.saturation,
  FX_SLOT.analogueDensity,
  FX_SLOT.clip,
  FX_SLOT.tape,
  FX_SLOT.delay,
  FX_SLOT.reverb,
  FX_SLOT.eq,
  FX_SLOT.dynamicEq,
  FX_SLOT.multiBandComp,
  FX_SLOT.mon8,
  FX_SLOT.stereoImager,
  FX_SLOT.limiter,
];

export const DEFAULT_FX_ORDER = [...FX_SLOT_LIST];

export const FX_SLOT_META = {
  [FX_SLOT.compressor]: { label: 'CMP', color: '#a9a6a1' },
  [FX_SLOT.saturation]: { label: 'SAT', color: '#ff754e' },
  [FX_SLOT.clip]: { label: 'CLP', color: '#98fb98' },
  [FX_SLOT.tape]: { label: 'TPE', color: '#e8a06a' },
  [FX_SLOT.delay]: { label: 'DEL', color: '#ffc76d' },
  [FX_SLOT.reverb]: { label: 'REV', color: '#68d3ce' },
  [FX_SLOT.eq]: { label: 'EQ', color: '#ffb74d' },
  [FX_SLOT.dynamicEq]: { label: 'D-EQ', color: '#c084fc' },
  [FX_SLOT.multiBandComp]: { label: 'MBC', color: '#4ade80' },
  [FX_SLOT.limiter]: { label: 'LIM', color: '#ff6b6b' },
  [FX_SLOT.stereoImager]: { label: 'IMG', color: '#5eead4' },
  [FX_SLOT.mon8]: { label: 'MON', color: '#818cf8' },
  [FX_SLOT.analogueDensity]: { label: 'DEN', color: '#6fb1e0' },
};

/** Normalize user order: dedupe, fill missing slots. */
export function normalizeFxOrder(order) {
  const seen = new Set();
  const cleaned = [];
  for (const slot of order ?? []) {
    if (!FX_SLOT_META[slot] || seen.has(slot)) continue;
    seen.add(slot);
    cleaned.push(slot);
  }
  for (const slot of FX_SLOT_LIST) {
    if (!seen.has(slot)) cleaned.push(slot);
  }
  return cleaned;
}

export function swapFxOrder(order, from, to) {
  const next = normalizeFxOrder(order);
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── Instance model (multi-instance signal chain) ─────────────────────────
// A chain position is an INSTANCE, not just a type, so the same effect type can
// appear multiple times (e.g. two EQs: a "Pre-EQ" and a "Mastering EQ").
// Instance id format: "<type>#<n>"  e.g. "eq#1", "eq#2".

/** The effect type of an instance id (or bare type). */
export const instanceType = (id) => (typeof id === 'string' ? id.split('#')[0] : id);
/** The numeric suffix of an instance id (1 if absent). */
export const instanceIndex = (id) => (typeof id === 'string' ? Number(id.split('#')[1] || 1) : 1);
/** True when an id is a full instance id ("<type>#<n>"). */
export const isInstanceId = (id) => typeof id === 'string' && id.includes('#') && !!FX_SLOT_META[id.split('#')[0]];

/** Default instance id for a type (the first instance). */
export const defaultInstanceId = (type) => `${type}#1`;

/** Default chain: one instance per type, in DEFAULT_FX_ORDER order. */
export const defaultInstanceOrder = () => FX_SLOT_LIST.map(defaultInstanceId);

/** Next free instance id for a type given the ids already in use. */
export function nextInstanceId(type, existingIds) {
  const used = new Set(existingIds || []);
  let n = 1;
  while (used.has(`${type}#${n}`)) n++;
  return `${type}#${n}`;
}

/**
 * Normalize a chain order that may contain bare types (legacy) or full instance
 * ids: every entry becomes an instance id, duplicates are dropped, and any
 * missing default instances are appended in DEFAULT_FX_ORDER.
 */
export function normalizeInstanceOrder(order) {
  const seen = new Set();
  const out = [];
  const push = (id) => { if (!seen.has(id) && FX_SLOT_META[instanceType(id)]) { seen.add(id); out.push(id); } };
  for (const entry of order || []) {
    if (typeof entry !== 'string') continue;
    push(entry.includes('#') ? entry : `${entry}#1`);
  }
  for (const id of defaultInstanceOrder()) push(id);
  return out;
}