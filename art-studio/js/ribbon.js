// A ribbon is a single smooth path (a harmonograph-style curve — two
// summed sine waves per axis) with a width that pinches down to near-zero
// at each "twist" — the point where one colour/texture zone hands off to
// the next. The pinch reads as the ribbon turning edge-on, like a real
// strip of paper twisting to show its other face, so the colour change
// never looks like a hard seam.

export function makePathFn(p) {
  return function pathPoint(s) {
    const t = s * Math.PI * 2;
    const x = p.cx + p.ax1 * Math.sin(p.fx1 * t + p.px1) + p.ax2 * Math.sin(p.fx2 * t + p.px2);
    const y = p.cy + p.ay1 * Math.sin(p.fy1 * t + p.py1) + p.ay2 * Math.sin(p.fy2 * t + p.py2);
    return { x, y };
  };
}

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
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
// each other and the ribbon folds on itself.
function curvatureRadius(pathFn, s) {
  const eps = 0.002;
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

// Builds the ribbon's width-at-s function, combining two effects:
//  - twist pinches, narrowing smoothly toward each zone boundary
//  - a curvature safety limit, so the ribbon narrows wherever the path
//    turns tightly enough that a full-width strip would fold on itself
// The curvature limit is pre-scanned across the whole path once, then
// smoothed with a sliding-window minimum sized to the ribbon's own width —
// otherwise a single sharp wiggle in the curve narrows just that one point
// and springs back over a couple of pixels, which reads as a torn flap
// rather than a graceful taper into the tight turn.
export function makeWidthFn(pathFn, twistPositions, baseWidth, pinchWidth, pinchRadius) {
  const SAMPLES = 500;
  const raw = new Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const R = curvatureRadius(pathFn, i / SAMPLES);
    raw[i] = Math.max(Math.min(baseWidth, R * 1.5), 6);
  }
  const totalLen = arcLength(pathFn, 0, 1, SAMPLES);
  const lenPerSample = totalLen / SAMPLES || 1;
  const windowSamples = Math.max(1, Math.round((baseWidth * 1.3) / lenPerSample));
  const smoothed = new Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    let m = raw[i];
    for (let k = 1; k <= windowSamples; k++) {
      if (i - k >= 0) m = Math.min(m, raw[i - k]);
      if (i + k <= SAMPLES) m = Math.min(m, raw[i + k]);
    }
    smoothed[i] = m;
  }

  function curvatureSafeWidth(s) {
    const f = Math.max(0, Math.min(1, s)) * SAMPLES;
    const i0 = Math.floor(f);
    const i1 = Math.min(SAMPLES, i0 + 1);
    const t = f - i0;
    return smoothed[i0] * (1 - t) + smoothed[i1] * t;
  }

  return function widthAt(s) {
    let minDist = Infinity;
    for (const tp of twistPositions) {
      const d = Math.abs(s - tp);
      if (d < minDist) minDist = d;
    }
    const ease = smoothstep(minDist / pinchRadius);
    const twistWidth = pinchWidth + (baseWidth - pinchWidth) * ease;
    return Math.min(twistWidth, curvatureSafeWidth(s));
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

export function boundaryPath(project, samplesPerEdge = 160) {
  const n = samplesPerEdge;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(project(i / n, 0));
  for (let i = 0; i <= n; i++) pts.push(project(1, i / n));
  for (let i = 0; i <= n; i++) pts.push(project(1 - i / n, 1));
  for (let i = 0; i <= n; i++) pts.push(project(0, 1 - i / n));
  return 'M ' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z';
}
