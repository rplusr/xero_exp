// Curated colour palettes. Each is a small set of saturated stops designed
// to read clearly on both the light and dark canvas backgrounds.
export const PALETTES = [
    {
        id: 'cymru',
        name: 'Cymru Rail',
        colors: ['#D1112E', '#F2C14E', '#0E7C61', '#1A1A1A', '#7A1327'],
    },
    {
        id: 'underground',
        name: 'Underground',
        colors: ['#E32017', '#0098D4', '#00782A', '#FFD300', '#9B0056', '#F4A81D'],
    },
    {
        id: 'nordic',
        name: 'Nordic Transit',
        colors: ['#3E6D9C', '#7FB2C7', '#A6D1D9', '#2A4B5C', '#C4DDE0'],
    },
    {
        id: 'sakura',
        name: 'Sakura Line',
        colors: ['#E191A4', '#B26AA5', '#6C4E8E', '#2C2255', '#F2B6C2'],
    },
    {
        id: 'amber',
        name: 'Mono Amber',
        colors: ['#F4A93A', '#D97D30', '#8C4A2F', '#2E2A26', '#F7D08A'],
    },
];
export const DEFAULT_PALETTE_ID = PALETTES[0].id;
export const CUSTOM_PALETTE_ID = 'custom';
export function findPalette(id) {
    return PALETTES.find((p) => p.id === id);
}
function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const n = parseInt(clean.length === 3
        ? clean.split('').map((c) => c + c).join('')
        : clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
    const c = (v) => clamp255(v).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}
function clamp255(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}
function lerpColor(a, b, t) {
    const [ar, ag, ab] = hexToRgb(a);
    const [br, bg, bb] = hexToRgb(b);
    return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
/**
 * Build a cyclic multi-stop colour ramp starting at `rotate` within the
 * palette. Cyclic so a drifting phase never produces a visible seam.
 */
export function buildRamp(colors, rotate) {
    const n = colors.length;
    const rotated = [];
    for (let i = 0; i < n; i++) {
        rotated.push(colors[(i + rotate) % n]);
    }
    rotated.push(rotated[0]);
    return rotated;
}
/** Sample a cyclic ramp at t in [0, 1). */
export function sampleRamp(ramp, t) {
    const n = ramp.length - 1;
    const tt = ((t % 1) + 1) % 1;
    const scaled = tt * n;
    const i = Math.min(n - 1, Math.floor(scaled));
    const frac = scaled - i;
    return lerpColor(ramp[i], ramp[i + 1], frac);
}
