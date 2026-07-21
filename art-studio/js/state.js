import { WARP_TYPES } from './warps.js';
import { PATTERNS } from './patterns.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, resolveChainWithExit } from './render.js';
import { makeRng, pick, range } from './random.js';
import { PALETTE } from './palette.js';

let idCounter = 1;
function nextId() {
  return `sheet-${idCounter++}`;
}

function pickPair(rng) {
  const a = pick(rng, PALETTE);
  let b = pick(rng, PALETTE);
  let guard = 0;
  while (b.hex === a.hex && guard++ < 8) b = pick(rng, PALETTE);
  return [a.hex, b.hex];
}

export function createDefaultSheet(overrides = {}) {
  const patternKey = overrides.pattern || 'crossHalftone';
  const patternDef = PATTERNS[patternKey];
  const base = {
    id: nextId(),
    warpType: 'cylinder',
    warpAmount: 0.6,
    rotation: -20,
    turnDelta: 0,
    scale: 340,
    position: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    pattern: patternKey,
    patternParams: { ...patternDef.defaults },
    fill: { colors: ['#F2F1EE', '#9FE5FF'] },
  };
  return { ...base, ...overrides, id: base.id };
}

function buildRandomSheet(rng, index, chain) {
  const warpType = pick(rng, WARP_TYPES);
  const sign = rng() < 0.5 ? -1 : 1;
  const warpAmount = sign * range(rng, 0.35, 0.9);
  const scale = range(rng, 200, 340);

  let rotation = 0;
  let turnDelta = 0;
  let position = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

  if (index === 0) {
    // Anchor the ribbon's start near a canvas edge, aimed inward, so the
    // chain has room to travel across the whole composition.
    const edge = Math.floor(rng() * 4);
    const inset = 70;
    if (edge === 0) position = { x: range(rng, inset, CANVAS_WIDTH - inset), y: inset };
    else if (edge === 1) position = { x: CANVAS_WIDTH - inset, y: range(rng, inset, CANVAS_HEIGHT - inset) };
    else if (edge === 2) position = { x: range(rng, inset, CANVAS_WIDTH - inset), y: CANVAS_HEIGHT - inset };
    else position = { x: inset, y: range(rng, inset, CANVAS_HEIGHT - inset) };
    const toCenter = Math.atan2(CANVAS_HEIGHT / 2 - position.y, CANVAS_WIDTH / 2 - position.x);
    rotation = (toCenter * 180) / Math.PI + range(rng, -15, 15);
    if (chain) {
      chain.x = position.x;
      chain.y = position.y;
      chain.heading = (rotation * Math.PI) / 180;
    }
  } else if (chain) {
    // Steer gently back toward the canvas centre so the chain doesn't
    // wander off-canvas after a few turns, while still wandering.
    const toCenterAngle = Math.atan2(CANVAS_HEIGHT / 2 - chain.y, CANVAS_WIDTH / 2 - chain.x);
    let diff = toCenterAngle - chain.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const steerRad = diff * 0.4;
    const jitterRad = range(rng, -38, 38) * (Math.PI / 180);
    let turnRad = steerRad + jitterRad;
    turnRad = Math.max((-140 * Math.PI) / 180, Math.min((140 * Math.PI) / 180, turnRad));
    turnDelta = (turnRad * 180) / Math.PI;

    chain.heading += turnRad;
    chain.x += Math.cos(chain.heading) * scale * 0.85;
    chain.y += Math.sin(chain.heading) * scale * 0.85;
  } else {
    turnDelta = range(rng, -45, 45);
  }

  const patternKey = pick(rng, Object.keys(PATTERNS));
  const patternDef = PATTERNS[patternKey];
  const [fillA, fillB] = pickPair(rng);
  const accent = pick(rng, PALETTE).hex;

  const patternParams = { ...patternDef.defaults };
  if ('color' in patternParams) patternParams.color = accent;
  if ('colorA' in patternParams) {
    const [a, b] = pickPair(rng);
    patternParams.colorA = a;
    patternParams.colorB = b;
  }
  if ('spacing' in patternParams) patternParams.spacing *= range(rng, 0.7, 1.4);
  if ('angleDeg' in patternParams) patternParams.angleDeg = range(rng, -85, 85);

  return createDefaultSheet({
    warpType,
    warpAmount,
    rotation,
    turnDelta,
    scale,
    position,
    pattern: patternKey,
    patternParams,
    fill: { colors: [fillA, fillB] },
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
    let sheet;
    if (overrides) {
      sheet = createDefaultSheet(overrides);
    } else if (this.sheets.length === 0) {
      sheet = buildRandomSheet(rng, 0, { x: 0, y: 0, heading: 0 });
    } else {
      const { exit } = resolveChainWithExit(this.sheets);
      const chain = exit
        ? { x: exit.point.x, y: exit.point.y, heading: exit.angle }
        : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, heading: 0 };
      sheet = buildRandomSheet(rng, this.sheets.length, chain);
    }
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
    const count = 4 + Math.floor(rng() * 3);
    this.sheets = [];
    const chain = { x: 0, y: 0, heading: 0 };
    for (let i = 0; i < count; i++) {
      this.sheets.push(buildRandomSheet(rng, i, chain));
    }
    this.selectedId = this.sheets[this.sheets.length - 1].id;
    this.notify();
  }
}
