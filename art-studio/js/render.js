import { Sheet } from './sheet.js';
import { PATTERNS } from './patterns.js';

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

function buildSheetMarkup(sheetDef, index) {
  const sheet = new Sheet(sheetDef);
  const project = sheet.buildProjector();
  const boundaryD = sheet.boundaryPath(project);
  const gradId = `grad-${sheetDef.id}`;
  const clipId = `clip-${sheetDef.id}`;

  const [stop1, stop2] = sheetDef.gradient.stops;
  const angle = sheetDef.gradient.angle;

  const defs = `
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${esc(stop1)}" />
      <stop offset="100%" stop-color="${esc(stop2)}" />
    </linearGradient>
    <clipPath id="${clipId}">
      <path d="${boundaryD}" />
    </clipPath>
  `;

  const patternDef = PATTERNS[sheetDef.pattern];
  const marks = patternDef ? patternDef.render(project, sheetDef.patternParams, sheetDef.scale) : [];
  const marksMarkup = marks.map(markupForMark).join('\n');

  const body = `
    <path d="${boundaryD}" fill="url(#${gradId})" />
    <g clip-path="url(#${clipId})">
      ${marksMarkup}
    </g>
  `;

  return { defs, body, id: sheetDef.id };
}

export function renderSVGInner(sheets) {
  const built = sheets.map(buildSheetMarkup);
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
