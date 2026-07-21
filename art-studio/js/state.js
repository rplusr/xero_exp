import { PATTERNS } from './patterns.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './render.js';
import { makeRng, pick, range } from './random.js';
import { PALETTE } from './palette.js';

let idCounter = 1;
function nextId() {
  return `zone-${idCounter++}`;
}

// A plain Lissajous curve (one sine per axis). Low integer frequencies —
// 1:1 gives a single loop, 1:2/2:3 give a figure-eight or trefoil-ish
// sweep — read as one ribbon crossing the canvas rather than a tangle.
function randomPathParams(rng) {
  return {
    cx: CANVAS_WIDTH / 2 + range(rng, -40, 40),
    cy: CANVAS_HEIGHT / 2 + range(rng, -25, 25),
    ax: range(rng, 280, 380),
    fx: pick(rng, [1, 1, 2, 2, 3]),
    px: range(rng, 0, Math.PI * 2),
    ay: range(rng, 170, 250),
    fy: pick(rng, [1, 1, 2, 2, 3]),
    py: range(rng, 0, Math.PI * 2),
  };
}

function randomZone(rng) {
  const patternKey = pick(rng, Object.keys(PATTERNS));
  const patternDef = PATTERNS[patternKey];
  const patternParams = { ...patternDef.defaults };
  const color = pick(rng, PALETTE).hex;
  const others = PALETTE.filter((c) => c.hex !== color);
  const accent = pick(rng, others).hex;

  if ('color' in patternParams) patternParams.color = accent;
  if ('colorA' in patternParams) {
    patternParams.colorA = accent;
    patternParams.colorB = pick(rng, others).hex;
  }
  if ('spacing' in patternParams) patternParams.spacing *= range(rng, 0.75, 1.35);
  if ('angleDeg' in patternParams) patternParams.angleDeg = range(rng, -85, 85);

  return { id: nextId(), color, pattern: patternKey, patternParams };
}

export function createDefaultZone(overrides = {}) {
  const patternKey = overrides.pattern || 'crossHalftone';
  const patternDef = PATTERNS[patternKey];
  const base = {
    id: nextId(),
    color: '#3ECCFF',
    pattern: patternKey,
    patternParams: { ...patternDef.defaults },
  };
  return { ...base, ...overrides, id: base.id };
}

export class Studio {
  constructor() {
    this.seed = '1';
    const rng = makeRng(this.seed);
    this.path = randomPathParams(rng);
    this.baseWidth = 100;
    this.zones = [];
    this.selectedId = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
  }

  notify() {
    this._listeners.forEach((fn) => fn());
  }

  ribbon() {
    return {
      path: this.path,
      baseWidth: this.baseWidth,
      zones: this.zones,
    };
  }

  selected() {
    return this.zones.find((z) => z.id === this.selectedId) || null;
  }

  select(id) {
    this.selectedId = id;
    this.notify();
  }

  addZone(overrides) {
    const rng = makeRng(Math.random());
    const zone = overrides ? createDefaultZone(overrides) : randomZone(rng);
    this.zones.push(zone);
    this.selectedId = zone.id;
    this.notify();
    return zone;
  }

  removeZone(id) {
    const i = this.zones.findIndex((z) => z.id === id);
    if (i === -1) return;
    this.zones.splice(i, 1);
    if (this.selectedId === id) {
      const fallback = this.zones[Math.max(0, i - 1)];
      this.selectedId = fallback ? fallback.id : null;
    }
    this.notify();
  }

  duplicateZone(id) {
    const i = this.zones.findIndex((z) => z.id === id);
    if (i === -1) return;
    const copy = JSON.parse(JSON.stringify(this.zones[i]));
    copy.id = nextId();
    this.zones.splice(i + 1, 0, copy);
    this.selectedId = copy.id;
    this.notify();
  }

  moveZone(id, delta) {
    const i = this.zones.findIndex((z) => z.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= this.zones.length) return;
    [this.zones[i], this.zones[j]] = [this.zones[j], this.zones[i]];
    this.notify();
  }

  setPath(patch) {
    Object.assign(this.path, patch);
    this.notify();
  }

  randomise(seed) {
    this.seed = String(seed);
    const rng = makeRng(this.seed);
    this.path = randomPathParams(rng);
    this.baseWidth = range(rng, 80, 120);
    const count = 2 + Math.floor(rng() * 3);
    this.zones = [];
    for (let i = 0; i < count; i++) this.zones.push(randomZone(rng));
    this.selectedId = this.zones[this.zones.length - 1].id;
    this.notify();
  }
}
