// A small seeded random generator (mulberry32): the same seed always grows the same night,
// so a staged screenshot scene and a replayed run agree move for move. Nothing in the world
// is allowed to roll dice the seed does not know about.

/** Create a generator from a 32-bit seed. Returns a function giving values in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max) from the generator. */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** A whole number in [min, max] from the generator. */
export function whole(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

/** True with probability p. */
export function chance(next, p) {
  return next() < p;
}
