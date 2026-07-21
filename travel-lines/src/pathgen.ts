// Constrained-path generator: produces a set of lines as sequences of
// 45/90deg grid segments, with a subset of segments cloned from earlier
// lines (and tagged with a lane index) so they bundle together in
// parallel before peeling off — the transit-map "run together, diverge"
// behaviour.

import { DIRS, DIR_COUNT, Point, turnDelta } from './geometry.js';
import { Rng, chance, intRange, pick } from './rng.js';

export interface Segment {
  dir: number;
  cells: number;
  lane: number;
}

export interface GeneratedLine {
  id: number;
  start: Point;
  segments: Segment[];
  /** Vertex indices (0-based, 0 = start) that mark bundle joins — used for station nodes. */
  joins: Set<number>;
}

const SEG_LEN: [number, number] = [2, 6];

function gridStep(d: number, cells: number): Point {
  const raw = DIRS[d];
  return { x: raw.dx * cells, y: raw.dy * cells };
}

export function verticesOf(start: Point, segments: Segment[]): Point[] {
  const verts: Point[] = [start];
  let cur = start;
  for (const seg of segments) {
    const step = gridStep(seg.dir, seg.cells);
    cur = { x: cur.x + step.x, y: cur.y + step.y };
    verts.push(cur);
  }
  return verts;
}

function angleToDirIndex(angle: number): number {
  let best = 0;
  let bestDot = -Infinity;
  for (let d = 0; d < DIR_COUNT; d++) {
    const da = (d * Math.PI) / 4;
    const dot = Math.cos(angle - da);
    if (dot > bestDot) {
      bestDot = dot;
      best = d;
    }
  }
  return best;
}

function randomStart(rng: Rng): { start: Point; dir: number } {
  const angle = rng() * Math.PI * 2;
  const radius = intRange(rng, 6, 16);
  const start = {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
  // walk roughly back toward the centre, with jitter
  const dir = angleToDirIndex(angle + Math.PI + (rng() - 0.5) * 1.2);
  return { start, dir };
}

/**
 * Biased random walk: strong momentum, occasional gentle turns, no
 * reversals. A short memory of recent turn direction discourages the walk
 * from curling back on itself into tight, self-crossing loops.
 */
function walk(rng: Rng, startDir: number, steps: number): Segment[] {
  const segs: Segment[] = [];
  let curDir = startDir;
  const recentDeltas: number[] = [];
  for (let i = 0; i < steps; i++) {
    const recentSum = recentDeltas.reduce((s, v) => s + v, 0);
    const candidates: { dir: number; weight: number }[] = [];
    for (let d = 0; d < DIR_COUNT; d++) {
      const delta = turnDelta(curDir, d);
      if (Math.abs(delta) === 4) continue;
      const abs = Math.abs(delta);
      let weight = abs === 0 ? 8 : abs === 1 ? 3 : abs === 2 ? 0.8 : 0.12;
      if (delta !== 0 && Math.sign(delta) === Math.sign(recentSum) && Math.abs(recentSum) > 4) {
        weight *= 0.1;
      }
      candidates.push({ dir: d, weight });
    }
    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = rng() * total;
    let chosen = candidates[candidates.length - 1].dir;
    for (const c of candidates) {
      if (r < c.weight) {
        chosen = c.dir;
        break;
      }
      r -= c.weight;
    }
    segs.push({ dir: chosen, cells: intRange(rng, SEG_LEN[0], SEG_LEN[1]), lane: 0 });
    recentDeltas.push(turnDelta(curDir, chosen));
    if (recentDeltas.length > 6) recentDeltas.shift();
    curDir = chosen;
  }
  return segs;
}

function trimReversal(segs: Segment[], junctionDir: number, fromStart: boolean): Segment[] {
  let out = segs;
  while (out.length) {
    const edge = fromStart ? out[out.length - 1].dir : out[0].dir;
    const delta = fromStart ? turnDelta(edge, junctionDir) : turnDelta(junctionDir, edge);
    if (Math.abs(delta) !== 4) break;
    out = fromStart ? out.slice(0, -1) : out.slice(1);
  }
  return out;
}

export interface GenOptions {
  lineCount: number;
  bundleChance: number;
}

export function generateComposition(rng: Rng, opts: GenOptions): GeneratedLine[] {
  const lines: GeneratedLine[] = [];
  const laneUsage = new Map<string, number>();

  for (let i = 0; i < opts.lineCount; i++) {
    const trunkPoolSize = Math.min(3, lines.length);
    const canBundle = lines.length > 0 && chance(rng, opts.bundleChance);

    if (canBundle) {
      const source =
        trunkPoolSize > 0 && chance(rng, 0.8)
          ? lines[Math.floor(rng() * trunkPoolSize)]
          : pick(rng, lines);
      const srcVerts = verticesOf(source.start, source.segments);

      if (srcVerts.length >= 3) {
        const maxRun = Math.min(5, source.segments.length);
        const runLen = intRange(rng, 2, Math.max(2, maxRun));
        const startIdx = intRange(rng, 0, source.segments.length - runLen);
        const cloneSegs: Segment[] = source.segments
          .slice(startIdx, startIdx + runLen)
          .map((s) => ({ ...s }));

        let laneForRun = 1;
        for (let k = startIdx; k < startIdx + runLen; k++) {
          const key = `${source.id}:${k}`;
          const used = laneUsage.get(key) ?? 1;
          laneUsage.set(key, used + 1);
          laneForRun = Math.max(laneForRun, used);
        }
        cloneSegs.forEach((s) => (s.lane = laneForRun));

        const cloneStartVertex = srcVerts[startIdx];

        let leadIn = walk(rng, intRange(rng, 0, 7), intRange(rng, 2, 4));
        leadIn = trimReversal(leadIn, cloneSegs[0].dir, true);
        const leadInVerts = verticesOf({ x: 0, y: 0 }, leadIn);
        const lastLeadInVert = leadInVerts[leadInVerts.length - 1];
        const offset = { x: cloneStartVertex.x - lastLeadInVert.x, y: cloneStartVertex.y - lastLeadInVert.y };
        const start = { x: leadInVerts[0].x + offset.x, y: leadInVerts[0].y + offset.y };

        let leadOut = walk(rng, cloneSegs[cloneSegs.length - 1].dir, intRange(rng, 2, 4));
        leadOut = trimReversal(leadOut, cloneSegs[cloneSegs.length - 1].dir, false);

        const segments = [...leadIn, ...cloneSegs, ...leadOut];
        const joins = new Set<number>([leadIn.length, leadIn.length + cloneSegs.length]);

        lines.push({ id: i, start, segments, joins });
        continue;
      }
    }

    const { start, dir } = randomStart(rng);
    const segments = walk(rng, dir, intRange(rng, 6, 10));
    lines.push({ id: i, start, segments, joins: new Set() });
  }

  return lines;
}
