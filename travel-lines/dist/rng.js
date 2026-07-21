// Small, fast, seedable PRNG (mulberry32) plus a string seed hash so users
// can type arbitrary text and get a reproducible composition.
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// cyrb53-style string hash folded to a single 32-bit int, used to turn a
// typed seed into a PRNG seed.
export function hashSeed(str) {
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
}
const SEED_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function randomSeedString(rng = Math.random) {
    let out = '';
    for (let i = 0; i < 8; i++) {
        out += SEED_CHARS[Math.floor(rng() * SEED_CHARS.length)];
    }
    return out;
}
export function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length) % arr.length];
}
export function range(rng, min, max) {
    return min + rng() * (max - min);
}
export function intRange(rng, min, max) {
    return Math.floor(range(rng, min, max + 1));
}
export function chance(rng, probability) {
    return rng() < probability;
}
