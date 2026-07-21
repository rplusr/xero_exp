// Grid + path geometry: 8-way direction table, vector helpers, and the
// rounded-corner construction that turns a polyline of grid vertices into a
// sequence of straight and arc pieces with a consistent corner radius.

export interface Point {
  x: number;
  y: number;
}

// 8 directions at 45deg increments. Screen/SVG space, y grows downward.
export const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 }, // 0 E
  { dx: 1, dy: -1 }, // 1 NE
  { dx: 0, dy: -1 }, // 2 N
  { dx: -1, dy: -1 }, // 3 NW
  { dx: -1, dy: 0 }, // 4 W
  { dx: -1, dy: 1 }, // 5 SW
  { dx: 0, dy: 1 }, // 6 S
  { dx: 1, dy: 1 }, // 7 SE
];

export const DIR_COUNT = DIRS.length;

/** Signed turn from direction `a` to direction `b`, in steps of 45deg, range -4..3. */
export function turnDelta(a: number, b: number): number {
  return (((b - a + 4 + DIR_COUNT) % DIR_COUNT) - 4);
}

/** Unit pixel-space vector for a direction index (diagonals normalized). */
export function dirUnit(d: number): Point {
  const raw = DIRS[((d % DIR_COUNT) + DIR_COUNT) % DIR_COUNT];
  const len = Math.hypot(raw.dx, raw.dy);
  return { x: raw.dx / len, y: raw.dy / len };
}

/** Perpendicular (rotated +90deg) unit vector for a direction index. */
export function perpUnit(d: number): Point {
  const u = dirUnit(d);
  return { x: -u.y, y: u.x };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}

export function hypot(a: Point): number {
  return Math.hypot(a.x, a.y);
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type PathPiece =
  | { kind: 'line'; p0: Point; p1: Point; len: number }
  | { kind: 'arc'; p0: Point; p1: Point; radius: number; sweep: 0 | 1; len: number };

export interface RoundedPath {
  pieces: PathPiece[];
  totalLength: number;
}

/**
 * Convert a polyline of grid-aligned vertices into rounded-corner pieces.
 * Every interior vertex is replaced by a circular arc of `radius`, trimmed
 * back automatically on short segments so arcs never overlap.
 */
export function buildRoundedPath(vertices: Point[], radius: number): RoundedPath {
  if (vertices.length < 2) {
    return { pieces: [], totalLength: 0 };
  }
  const pieces: PathPiece[] = [];
  let totalLength = 0;
  let cur = vertices[0];

  for (let i = 1; i < vertices.length - 1; i++) {
    const B = vertices[i];
    const C = vertices[i + 1];

    const inVec = sub(B, cur);
    const inLen = hypot(inVec);
    const outVec = sub(C, B);
    const outLen = hypot(outVec);

    if (inLen < 1e-6 || outLen < 1e-6) {
      continue;
    }

    const u = scale(inVec, 1 / inLen);
    const v = scale(outVec, 1 / outLen);
    const d = clamp(dot(u, v), -1, 1);
    const theta = Math.acos(d);

    let r = radius;
    let t = theta > 1e-6 ? r * Math.tan(theta / 2) : 0;
    const maxTrim = Math.max(0, Math.min(inLen, outLen) / 2 - 0.5);
    if (t > maxTrim) {
      t = maxTrim;
      r = theta > 1e-6 ? t / Math.tan(theta / 2) : 0;
    }

    const P1 = sub(B, scale(u, t));
    const P2 = add(B, scale(v, t));

    const lineLen = hypot(sub(P1, cur));
    if (lineLen > 1e-6) {
      pieces.push({ kind: 'line', p0: cur, p1: P1, len: lineLen });
      totalLength += lineLen;
    }

    if (t > 1e-6 && theta > 1e-6) {
      const arcLen = r * theta;
      const sweep: 0 | 1 = cross(u, v) > 0 ? 1 : 0;
      pieces.push({ kind: 'arc', p0: P1, p1: P2, radius: r, sweep, len: arcLen });
      totalLength += arcLen;
    }

    cur = P2;
  }

  const last = vertices[vertices.length - 1];
  const finalLen = hypot(sub(last, cur));
  if (finalLen > 1e-6) {
    pieces.push({ kind: 'line', p0: cur, p1: last, len: finalLen });
    totalLength += finalLen;
  }

  return { pieces, totalLength };
}

export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1 = sub(p2, p1);
  const d2 = sub(p4, p3);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < 1e-9) return null;
  const diff = sub(p3, p1);
  const t = cross(diff, d2) / denom;
  const s = cross(diff, d1) / denom;
  if (t <= 0.02 || t >= 0.98 || s <= 0.02 || s >= 0.98) return null;
  return add(p1, scale(d1, t));
}
