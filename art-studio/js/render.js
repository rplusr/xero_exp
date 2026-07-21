import { Sheet } from './sheet.js';
import { PATTERNS } from './patterns.js';
import { makeWarpFn, FOLD_COUNT } from './warps.js';

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function elAttrs(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
}

function markupForMark(mark) {
  if (mark.type === 'path') {
    return `<path ${elAttrs({
      d: mark.d,
      transform: mark.transform,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
      fill: mark.fill || 'none',
      'stroke-linecap': mark.strokeLinecap,
      'stroke-linejoin': mark.strokeLinejoin,
      'fill-rule': mark.fillRule,
      opacity: mark.opacity,
    })} />`;
  }
  if (mark.type === 'polygon') {
    return `<polygon ${elAttrs({
      points: mark.points,
      fill: mark.fill,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
      opacity: mark.opacity,
    })} />`;
  }
  return '';
}

// --- Ribbon chaining ---------------------------------------------------
// Every sheet after the first inherits its position from where the previous
// sheet's far edge (u=1, v=0.5) ended up, and its rotation from that edge's
// tangent direction (plus a per-sheet turnDelta), so the composition reads
// as one continuous ribbon instead of scattered independent shapes.

function entryTangentAngle(warpFn) {
  const eps = 0.01;
  const a = warpFn(0, 0.5);
  const b = warpFn(eps, 0.5);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function exitTangentAngle(warpFn) {
  const eps = 0.01;
  const a = warpFn(1 - eps, 0.5);
  const b = warpFn(1, 0.5);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function resolveChain(sheets) {
  return resolveChainWithExit(sheets).resolved;
}

// Same as resolveChain, but also returns where the chain's far end landed
// (point + heading), so a newly added sheet can pick up from there.
export function resolveChainWithExit(sheets) {
  const resolved = [];
  let prevExit = null;

  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const warpFn = makeWarpFn(s.warpType, s.warpAmount);
    let rotation;
    let position;

    if (i === 0 || !prevExit) {
      rotation = s.rotation || 0;
      position = s.position || { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    } else {
      const entryLocalAngle = entryTangentAngle(warpFn);
      const turn = ((s.turnDelta || 0) * Math.PI) / 180;
      const desiredHeading = prevExit.angle + turn;
      rotation = ((desiredHeading - entryLocalAngle) * 180) / Math.PI;

      const rot = (rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const localEntry = warpFn(0, 0.5);
      const sx = localEntry.x * s.scale;
      const sy = localEntry.y * s.scale;
      const worldOffset = { x: sx * cos - sy * sin, y: sx * sin + sy * cos };
      position = { x: prevExit.point.x - worldOffset.x, y: prevExit.point.y - worldOffset.y };
    }

    resolved.push({ ...s, position, rotation });

    const rot = (rotation * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const localExit = warpFn(1, 0.5);
    const esx = localExit.x * s.scale;
    const esy = localExit.y * s.scale;
    const exitPoint = { x: esx * cos - esy * sin + position.x, y: esx * sin + esy * cos + position.y };
    prevExit = { point: exitPoint, angle: exitTangentAngle(warpFn) + rot };
  }

  return { resolved, exit: prevExit };
}

// --- Faceted flat-colour fill --------------------------------------------
// Instead of a gradient, each sheet is sliced into a few flat-coloured
// bands that follow the warp's own geometry, so the "shadow" the curl or
// fold casts reads as a deliberate flat colour, not a smooth blend.

const BAND_SAMPLES = 24;

function buildBandPath(project, axis, lo, hi) {
  const n = BAND_SAMPLES;
  const pts = [];
  if (axis === 'u') {
    for (let i = 0; i <= n; i++) pts.push(project(lo, i / n));
    for (let i = 0; i <= n; i++) pts.push(project(lo + (hi - lo) * (i / n), 1));
    for (let i = 0; i <= n; i++) pts.push(project(hi, 1 - i / n));
    for (let i = 0; i <= n; i++) pts.push(project(hi - (hi - lo) * (i / n), 0));
  } else {
    for (let i = 0; i <= n; i++) pts.push(project(i / n, lo));
    for (let i = 0; i <= n; i++) pts.push(project(1, lo + (hi - lo) * (i / n)));
    for (let i = 0; i <= n; i++) pts.push(project(1 - i / n, hi));
    for (let i = 0; i <= n; i++) pts.push(project(0, hi - (hi - lo) * (i / n)));
  }
  return 'M ' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z';
}

function buildFillRegions(sheetDef, project) {
  const colors = sheetDef.fill && sheetDef.fill.colors && sheetDef.fill.colors.length ? sheetDef.fill.colors : ['#F2F1EE'];
  const c1 = colors[0];
  const c2 = colors.length > 1 ? colors[1] : colors[0];

  if (sheetDef.warpType === 'fold') {
    const regions = [];
    for (let i = 0; i < FOLD_COUNT; i++) {
      regions.push({
        path: buildBandPath(project, 'u', i / FOLD_COUNT, (i + 1) / FOLD_COUNT),
        fill: i % 2 === 0 ? c1 : c2,
      });
    }
    return regions;
  }

  const axis = sheetDef.warpType === 'perspective' ? 'v' : 'u';
  const edge = 0.24;
  return [
    { path: buildBandPath(project, axis, 0, edge), fill: c2 },
    { path: buildBandPath(project, axis, edge, 1 - edge), fill: c1 },
    { path: buildBandPath(project, axis, 1 - edge, 1), fill: c2 },
  ];
}

function buildSheetMarkup(sheetDef) {
  const sheet = new Sheet(sheetDef);
  const project = sheet.buildProjector();
  const boundaryD = sheet.boundaryPath(project);
  const clipId = `clip-${sheetDef.id}`;

  const fillMarkup = buildFillRegions(sheetDef, project)
    .map((r) => `<path d="${r.path}" fill="${r.fill}" />`)
    .join('\n');

  const defs = `
    <clipPath id="${clipId}">
      <path d="${boundaryD}" />
    </clipPath>
  `;

  const patternDef = PATTERNS[sheetDef.pattern];
  const marks = patternDef ? patternDef.render(project, sheetDef.patternParams, sheetDef.scale) : [];
  const marksMarkup = marks.map(markupForMark).join('\n');

  const body = `
    <g clip-path="url(#${clipId})">
      ${fillMarkup}
      ${marksMarkup}
    </g>
  `;

  return { defs, body, id: sheetDef.id };
}

export function renderSVGInner(sheets) {
  const resolved = resolveChain(sheets);
  const built = resolved.map(buildSheetMarkup);
  const defs = built.map((b) => b.defs).join('\n');
  const bodies = built.map((b) => `<g data-sheet-id="${esc(b.id)}">${b.body}</g>`).join('\n');
  return `
    <defs>${defs}</defs>
    <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff" />
    ${bodies}
  `;
}

export function renderFullSVGDocument(sheets) {
  const inner = renderSVGInner(sheets);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">${inner}</svg>`;
}
