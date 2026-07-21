import { WARP_TYPES } from './warps.js';
import { PATTERNS } from './patterns.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './render.js';
import { makeRng, pick, range } from './random.js';

let idCounter = 1;
function nextId() {
  return `sheet-${idCounter++}`;
}

// Curated colour combinations so random compositions stay coherent instead
// of garish. Each entry pairs a gradient (2 stops) with accent colours that
// read well against it.
const PALETTE = [
  { stops: ['#ffffff', '#eafff6'], accents: ['#e11d3f', '#0b1130'] },
  { stops: ['#e6e9ff', '#4b3df5'], accents: ['#ffffff', '#0b1130'] },
  { stops: ['#fff0fb', '#ff3ec8'], accents: ['#0b1130', '#ffffff'] },
  { stops: ['#fff5f2', '#ff3b30'], accents: ['#0b1130', '#ffffff'] },
  { stops: ['#eafcff', '#2fd9c6'], accents: ['#e11d3f', '#0b1130'] },
  { stops: ['#0b1130', '#4b3df5'], accents: ['#ffffff', '#ff3ec8'] },
];

export function createDefaultSheet(overrides = {}) {
  const patternKey = overrides.pattern || 'crossHalftone';
  const patternDef = PATTERNS[patternKey];
  const base = {
    id: nextId(),
    warpType: 'cylinder',
    warpAmount: 0.6,
    rotation: -20,
    scale: 340,
    position: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    pattern: patternKey,
    patternParams: { ...patternDef.defaults },
    gradient: { stops: ['#eafff6', '#6fe3c4'], angle: 20 },
  };
  return { ...base, ...overrides, id: base.id };
}

function buildRandomSheet(rng) {
  const warpType = pick(rng, WARP_TYPES);
  const sign = rng() < 0.5 ? -1 : 1;
  const warpAmount = sign * range(rng, 0.35, 0.9);
  const rotation = range(rng, -60, 60);
  const scale = range(rng, 240, 460);
  const marginX = CANVAS_WIDTH * 0.12;
  const marginY = CANVAS_HEIGHT * 0.12;
  const position = {
    x: range(rng, marginX, CANVAS_WIDTH - marginX),
    y: range(rng, marginY, CANVAS_HEIGHT - marginY),
  };

  const patternKey = pick(rng, Object.keys(PATTERNS));
  const patternDef = PATTERNS[patternKey];
  const palette = pick(rng, PALETTE);
  const accent = pick(rng, palette.accents);
  const accent2 = palette.accents.find((c) => c !== accent) || palette.accents[0];

  const patternParams = { ...patternDef.defaults };
  if ('color' in patternParams) patternParams.color = accent;
  if ('colorA' in patternParams) {
    patternParams.colorA = accent;
    patternParams.colorB = accent2;
  }
  if ('spacing' in patternParams) patternParams.spacing *= range(rng, 0.7, 1.4);
  if ('angleDeg' in patternParams) patternParams.angleDeg = range(rng, -85, 85);

  return createDefaultSheet({
    warpType,
    warpAmount,
    rotation,
    scale,
    position,
    pattern: patternKey,
    patternParams,
    gradient: { stops: [...palette.stops], angle: Math.floor(range(rng, 0, 360)) },
  });
}

export class Studio {
  constructor() {
    this.seed = '1';
    this.sheets = [];
    this.selectedId = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
  }

  notify() {
    this._listeners.forEach((fn) => fn());
  }

  selected() {
    return this.sheets.find((s) => s.id === this.selectedId) || null;
  }

  select(id) {
    this.selectedId = id;
    this.notify();
  }

  addSheet(overrides) {
    const rng = makeRng(Math.random());
    const sheet = overrides ? createDefaultSheet(overrides) : buildRandomSheet(rng);
    this.sheets.push(sheet);
    this.selectedId = sheet.id;
    this.notify();
    return sheet;
  }

  removeSheet(id) {
    const i = this.sheets.findIndex((s) => s.id === id);
    if (i === -1) return;
    this.sheets.splice(i, 1);
    if (this.selectedId === id) {
      const fallback = this.sheets[Math.max(0, i - 1)];
      this.selectedId = fallback ? fallback.id : null;
    }
    this.notify();
  }

  duplicateSheet(id) {
    const i = this.sheets.findIndex((s) => s.id === id);
    if (i === -1) return;
    const copy = JSON.parse(JSON.stringify(this.sheets[i]));
    copy.id = nextId();
    copy.position = { x: this.sheets[i].position.x + 18, y: this.sheets[i].position.y + 18 };
    this.sheets.splice(i + 1, 0, copy);
    this.selectedId = copy.id;
    this.notify();
  }

  moveSheet(id, delta) {
    const i = this.sheets.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= this.sheets.length) return;
    [this.sheets[i], this.sheets[j]] = [this.sheets[j], this.sheets[i]];
    this.notify();
  }

  randomise(seed) {
    this.seed = String(seed);
    const rng = makeRng(this.seed);
    const count = 3 + Math.floor(rng() * 2);
    this.sheets = [];
    for (let i = 0; i < count; i++) {
      this.sheets.push(buildRandomSheet(rng));
    }
    this.selectedId = this.sheets[this.sheets.length - 1].id;
    this.notify();
  }
}
