// Seeded PRNG — mulberry32. ~10 lines of core math.
// Returns an object with helpers for uniform, ranged, integer, and gaussian draws.
// All randomness in this engine routes through here so renders are reproducible
// when the caller pins a seed.

export function createRng(seed) {
  // Normalize seed to a uint32. Undefined / non-finite => random seed.
  let s = (seed >>> 0);
  if (!Number.isFinite(seed)) s = ((Math.random() * 0x1_0000_0000) >>> 0);

  function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(lo, hi) {
    return lo + (hi - lo) * next();
  }

  function int(lo, hi) {
    // inclusive lo, exclusive hi — half-open like array indexing
    return lo + Math.floor(next() * (hi - lo));
  }

  function gauss(mean = 0, sd = 1) {
    // Box-Muller. Burn two draws for one gaussian; good enough for jitter.
    const u1 = Math.max(next(), 1e-12);
    const u2 = next();
    const mag = Math.sqrt(-2 * Math.log(u1));
    return mean + sd * mag * Math.cos(2 * Math.PI * u2);
  }

  return { next, range, int, gauss, seed: s };
}
