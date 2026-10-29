// Seeded random numbers (mulberry32), so a generated task can be rebuilt
// exactly from its seed. Every generator takes an `rng` made here.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh 32-bit seed. Not pure: call it in the UI, never inside js/core.
export function newSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
}

// Integer in [lo, hi], both inclusive.
export function int(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function chance(rng, p) {
  return rng() < p;
}

export function pickOne(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// `weights` parallel to `items`; non-positive weights are never picked.
export function pickWeighted(rng, items, weights) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// n distinct items, in random order.
export function sample(rng, items, n) {
  const pool = items.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(n, pool.length)));
}
