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

export const PATTERNS = {
  crossHalftone: {
    label: 'Cross Halftone',
    defaults: { spacing: 0.045, minSize: 0.2, maxSize: 1.0, invert: false, strokeWidth: 1.4, color: '#e11d3f' },
    render: crossHalftone,
  },
};
