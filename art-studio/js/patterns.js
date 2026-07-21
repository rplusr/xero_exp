// Patterns are plug-ins: fn(project, params) -> array of SVG element specs.
// `project(u, v)` maps surface space to canvas space (through the sheet's
// warp + transform), so every mark bends with the sheet it's drawn on.

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// Plus/cross halftone: a grid of crosses whose size follows a density
// gradient across v (the sheet's "vertical" surface coordinate).
function crossHalftone(project, params, unitScale) {
  const {
    spacing = 0.045,
    minSize = 0.2,
    maxSize = 1.0,
    invert = false,
    strokeWidth = 1.4,
    color = '#e11d3f',
  } = params;

  let d = '';
  for (let v = spacing / 2; v < 1; v += spacing) {
    const t = invert ? 1 - v : v;
    const size = spacing * (minSize + (maxSize - minSize) * clamp01(t));
    const hsPx = (size / 2) * unitScale;
    for (let u = spacing / 2; u < 1; u += spacing) {
      const c = project(u, v);
      d += `M ${(c.x - hsPx).toFixed(2)},${c.y.toFixed(2)} L ${(c.x + hsPx).toFixed(2)},${c.y.toFixed(2)} `;
      d += `M ${c.x.toFixed(2)},${(c.y - hsPx).toFixed(2)} L ${c.x.toFixed(2)},${(c.y + hsPx).toFixed(2)} `;
    }
  }

  return [
    {
      type: 'path',
      d: d.trim(),
      stroke: color,
      strokeWidth,
      fill: 'none',
      strokeLinecap: 'round',
    },
  ];
}

// Diagonal hatching: parallel lines swept across the surface at an angle.
// Each line is sampled as a polyline in uv-space so it bends with the warp
// instead of staying a straight chord. Lines are generated with a generous
// margin beyond [0,1]; the sheet's clip-path crops the excess, which avoids
// fiddly line/square clipping math entirely.
function diagonalHatch(project, params) {
  const { spacing = 0.05, angleDeg = 45, strokeWidth = 1.2, color = '#1c2340', samples = 10 } = params;
  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const nx = -dirY;
  const ny = dirX;
  const MARGIN = 0.9;

  let d = '';
  for (let k = -MARGIN; k <= MARGIN; k += spacing) {
    const ox = 0.5 + nx * k;
    const oy = 0.5 + ny * k;
    for (let i = 0; i <= samples; i++) {
      const t = -MARGIN + (2 * MARGIN * i) / samples;
      const u = ox + dirX * t;
      const v = oy + dirY * t;
      const p = project(u, v);
      d += (i === 0 ? 'M ' : 'L ') + `${p.x.toFixed(2)},${p.y.toFixed(2)} `;
    }
  }

  return [
    { type: 'path', d: d.trim(), stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' },
  ];
}

// Checker diamonds: a grid of rotated squares (diamonds), alternating fill
// like a checkerboard. Each corner is projected individually so the diamond
// itself bends slightly with the surface curvature.
function checkerDiamonds(project, params) {
  const { spacing = 0.09, colorA = '#0b1130', colorB = '#ff2d55', gap = 0.12 } = params;

  let dA = '';
  let dB = '';
  let row = 0;
  for (let v = spacing / 2; v < 1; v += spacing, row++) {
    let col = 0;
    for (let u = spacing / 2; u < 1; u += spacing, col++) {
      const h = (spacing / 2) * (1 - gap);
      const top = project(u, v - h);
      const right = project(u + h, v);
      const bottom = project(u, v + h);
      const left = project(u - h, v);
      const seg =
        `M ${top.x.toFixed(2)},${top.y.toFixed(2)} ` +
        `L ${right.x.toFixed(2)},${right.y.toFixed(2)} ` +
        `L ${bottom.x.toFixed(2)},${bottom.y.toFixed(2)} ` +
        `L ${left.x.toFixed(2)},${left.y.toFixed(2)} Z `;
      if ((row + col) % 2 === 0) dA += seg;
      else dB += seg;
    }
  }

  return [
    { type: 'path', d: dA.trim(), fill: colorA, stroke: 'none' },
    { type: 'path', d: dB.trim(), fill: colorB, stroke: 'none' },
  ];
}

// Offset chevron weave: rows of zigzag polylines, each row phase-shifted by
// half a period against its neighbour, producing a herringbone weave.
function chevronWeave(project, params) {
  const {
    rowHeight = 0.09,
    period = 0.14,
    amplitude = 0.035,
    strokeWidth = 1.6,
    color = '#3b1fb0',
    segSamples = 3,
  } = params;
  const MARGIN = period * 2;

  let d = '';
  let row = 0;
  for (let v0 = rowHeight / 2; v0 < 1; v0 += rowHeight, row++) {
    const phase = (row % 2) * (period / 2);
    const start = -MARGIN + phase;
    const end = 1 + MARGIN;

    const vertices = [];
    let idx = 0;
    for (let u = start; u <= end; u += period / 2, idx++) {
      const vOff = idx % 2 === 0 ? -amplitude : amplitude;
      vertices.push([u, v0 + vOff]);
    }

    for (let i = 0; i < vertices.length - 1; i++) {
      const [u0, vv0] = vertices[i];
      const [u1, vv1] = vertices[i + 1];
      for (let s = 0; s <= segSamples; s++) {
        const t = s / segSamples;
        const u = u0 + (u1 - u0) * t;
        const v = vv0 + (vv1 - vv0) * t;
        const p = project(u, v);
        d += (i === 0 && s === 0 ? 'M ' : 'L ') + `${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      }
    }
  }

  return [
    {
      type: 'path',
      d: d.trim(),
      stroke: color,
      strokeWidth,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
  ];
}

export const PATTERNS = {
  crossHalftone: {
    label: 'Cross Halftone',
    defaults: { spacing: 0.045, minSize: 0.2, maxSize: 1.0, invert: false, strokeWidth: 1.4, color: '#e11d3f' },
    paramsSchema: [
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0.015, max: 0.09, step: 0.001 },
      { key: 'minSize', label: 'Min size', type: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'maxSize', label: 'Max size', type: 'range', min: 0, max: 1.4, step: 0.01 },
      { key: 'strokeWidth', label: 'Stroke width', type: 'range', min: 0.4, max: 4, step: 0.1 },
      { key: 'color', label: 'Colour', type: 'color' },
      { key: 'invert', label: 'Invert gradient', type: 'checkbox' },
    ],
    render: crossHalftone,
  },
  diagonalHatch: {
    label: 'Diagonal Hatch',
    defaults: { spacing: 0.05, angleDeg: 45, strokeWidth: 1.2, color: '#1c2340', samples: 10 },
    paramsSchema: [
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0.02, max: 0.12, step: 0.001 },
      { key: 'angleDeg', label: 'Angle', type: 'range', min: -90, max: 90, step: 1 },
      { key: 'strokeWidth', label: 'Stroke width', type: 'range', min: 0.4, max: 5, step: 0.1 },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
    render: diagonalHatch,
  },
  checkerDiamonds: {
    label: 'Checker Diamonds',
    defaults: { spacing: 0.09, colorA: '#0b1130', colorB: '#ff2d55', gap: 0.12 },
    paramsSchema: [
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0.03, max: 0.18, step: 0.001 },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 0.4, step: 0.01 },
      { key: 'colorA', label: 'Colour A', type: 'color' },
      { key: 'colorB', label: 'Colour B', type: 'color' },
    ],
    render: checkerDiamonds,
  },
  chevronWeave: {
    label: 'Chevron Weave',
    defaults: { rowHeight: 0.09, period: 0.14, amplitude: 0.035, strokeWidth: 1.6, color: '#3b1fb0', segSamples: 3 },
    paramsSchema: [
      { key: 'rowHeight', label: 'Row height', type: 'range', min: 0.03, max: 0.2, step: 0.001 },
      { key: 'period', label: 'Period', type: 'range', min: 0.04, max: 0.3, step: 0.001 },
      { key: 'amplitude', label: 'Amplitude', type: 'range', min: 0.005, max: 0.08, step: 0.001 },
      { key: 'strokeWidth', label: 'Stroke width', type: 'range', min: 0.4, max: 5, step: 0.1 },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
    render: chevronWeave,
  },
};
