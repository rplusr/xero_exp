// A ribbon is a single smooth path — a Lissajous curve (one sine wave per
// axis) — with a width that eases down gently at each zone boundary, so a
// colour/texture change reads as the ribbon turning rather than a seam.
// Low integer frequencies keep the curve reading as one ribbon sweeping the
// canvas, not a tangle of small loops.

export function makePathFn(p) {
  return function pathPoint(s) {
    const t = s * Math.PI * 2;
    const x = p.cx + p.ax * Math.sin(p.fx * t + p.px);
    const y = p.cy + p.ay * Math.sin(p.fy * t + p.py);
    return { x, y };
  };
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function arcLength(pathFn, s0, s1, samples = 60) {
  let len = 0;
  let prev = pathFn(s0);
  for (let i = 1; i <= samples; i++) {
    const p = pathFn(s0 + (s1 - s0) * (i / samples));
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

// Radius of curvature at s, via the angle turned between two short chords
// either side of s. Where the path bends sharply this gets small — if the
// ribbon's half-width exceeds it, the two edges of the strip cross over
// each other and the ribbon folds on itself. A plain Lissajous curve turns
// gradually everywhere except right at the tips of its loops, so a simple
// instantaneous check (no pre-scan/smoothing pass) is enough here.
function curvatureRadius(pathFn, s) {
  const eps = 0.003;
  const sm = Math.max(0, s - eps);
  const sp = Math.min(1, s + eps);
  const a = pathFn(sm);
  const b = pathFn(s);
  const c = pathFn(sp);
  const d1 = Math.hypot(b.x - a.x, b.y - a.y);
  const d2 = Math.hypot(c.x - b.x, c.y - b.y);
  if (d1 < 1e-9 || d2 < 1e-9) return Infinity;
  let dAngle = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
  while (dAngle > Math.PI) dAngle -= Math.PI * 2;
  while (dAngle < -Math.PI) dAngle += Math.PI * 2;
  if (Math.abs(dAngle) < 1e-9) return Infinity;
  return (d1 + d2) / Math.abs(dAngle);
}

// Width-at-s: a constant width, easing down only where the curve turns
// tightly enough that a full-width strip would fold on itself. Zones hand
// off colour and texture at a clean cut with no narrowing, so the ribbon
// reads as one continuous strip rather than a chain of pinched links.
export function makeWidthFn(pathFn, baseWidth) {
  return function widthAt(s) {
    return Math.max(Math.min(baseWidth, curvatureRadius(pathFn, s) * 1.6), 6);
  };
}

// Builds a project(u, v) function for one zone: u runs along the zone's
// slice of the path (0..1 maps to s0..s1), v runs across the ribbon's
// width (0..1 maps to the two edges). This is the same shape of function
// the pattern plug-ins already expect.
//
// u and v span very different physical distances here — u can cover
// hundreds of pixels of arc length while v only spans the ribbon's width —
// so the projector reports that scale as .pxPerU / .pxPerV. Patterns that
// assume a uniform uv scale (nearly all of them, since they were written
// for flat sheets) should go through makeIsotropicProjector below instead
// of using this one directly.
export function makeZoneProjector(pathFn, widthFn, s0, s1) {
  const eps = 0.0015;
  // Patterns sometimes sample u a bit outside [0,1] for clean clip-path
  // coverage. On a flat sheet that was a safe local extrapolation; on a
  // looping path, wandering too far in u can land on a distant, unrelated
  // part of the curve. Clamp how far patterns can reach past the zone's
  // own span so that never happens.
  const MAX_OVERREACH = 0.15;
  const project = (u, v) => {
    const uc = Math.max(-MAX_OVERREACH, Math.min(1 + MAX_OVERREACH, u));
    const s = s0 + uc * (s1 - s0);
    const a = pathFn(Math.max(0, s - eps));
    const b = pathFn(Math.min(1, s + eps));
    const tangent = normalize(b.x - a.x, b.y - a.y);
    const normal = { x: -tangent.y, y: tangent.x };
    const c = pathFn(s);
    const w = widthFn(s);
    const off = (v - 0.5) * w;
    return { x: c.x + normal.x * off, y: c.y + normal.y * off };
  };
  project.pxPerU = Math.max(arcLength(pathFn, s0, s1), 1e-6);
  project.pxPerV = Math.max(widthFn((s0 + s1) / 2), 1e-6);
  return project;
}

// Wraps a zone projector so u and v represent equal physical distances
// (both measured in "v units", i.e. fractions of the ribbon's width).
// Patterns should loop u from 0 to iso.uMax instead of 0 to 1, and can
// otherwise treat u and v as interchangeable — offsets, angles, and grid
// spacing all come out proportionate regardless of how long the zone is.
export function makeIsotropicProjector(project) {
  const uMax = Math.max(project.pxPerU / project.pxPerV, 1e-6);
  const iso = (u, v) => project(u / uMax, v);
  iso.uMax = uMax;
  return iso;
}

export function boundaryPath(project, samplesPerEdge = 96) {
  const n = samplesPerEdge;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(project(i / n, 0));
  for (let i = 0; i <= n; i++) pts.push(project(1, i / n));
  for (let i = 0; i <= n; i++) pts.push(project(1 - i / n, 1));
  for (let i = 0; i <= n; i++) pts.push(project(0, 1 - i / n));
  return 'M ' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z';
}
