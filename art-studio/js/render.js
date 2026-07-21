import { PATTERNS } from './patterns.js';
import { makePathFn, makeWidthFn, makeZoneProjector, makeIsotropicProjector, boundaryPath } from './ribbon.js';

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

function twistPositions(zoneCount) {
  const twists = [];
  for (let i = 1; i < zoneCount; i++) twists.push(i / zoneCount);
  return twists;
}

function buildZoneMarkup(ribbon, zone, pathFn, widthFn, s0, s1) {
  const project = makeZoneProjector(pathFn, widthFn, s0, s1);
  const boundaryD = boundaryPath(project);
  const clipId = `clip-${zone.id}`;

  const defs = `
    <clipPath id="${clipId}">
      <path d="${boundaryD}" />
    </clipPath>
  `;

  const patternDef = PATTERNS[zone.pattern];
  const isoProject = makeIsotropicProjector(project);
  const marks = patternDef ? patternDef.render(isoProject, zone.patternParams, ribbon.baseWidth) : [];
  const marksMarkup = marks.map(markupForMark).join('\n');

  const body = `
    <g clip-path="url(#${clipId})">
      <path d="${boundaryD}" fill="${zone.color}" />
      ${marksMarkup}
    </g>
  `;

  return { defs, body, id: zone.id };
}

export function renderSVGInner(ribbon) {
  const n = ribbon.zones.length;
  if (n === 0) {
    return `<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff" />`;
  }

  const pathFn = makePathFn(ribbon.path);
  const widthFn = makeWidthFn(pathFn, twistPositions(n), ribbon.baseWidth, ribbon.pinchWidth, ribbon.pinchRadius);

  const built = ribbon.zones.map((zone, i) => buildZoneMarkup(ribbon, zone, pathFn, widthFn, i / n, (i + 1) / n));

  const defs = built.map((b) => b.defs).join('\n');
  const bodies = built.map((b) => `<g data-zone-id="${esc(b.id)}">${b.body}</g>`).join('\n');
  return `
    <defs>${defs}</defs>
    <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#ffffff" />
    ${bodies}
  `;
}

export function renderFullSVGDocument(ribbon) {
  const inner = renderSVGInner(ribbon);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">${inner}</svg>`;
}
