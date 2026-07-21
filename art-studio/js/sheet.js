import { makeWarpFn } from './warps.js';

const BOUNDARY_SAMPLES_PER_EDGE = 48;

// A Sheet bundles a warp, a transform (rotation/scale/position), a pattern
// with its params, and a gradient fill. `project(u,v)` is the single
// function patterns use to go from surface space to canvas space.
export class Sheet {
  constructor(def) {
    Object.assign(this, def);
  }

  buildProjector() {
    const warpFn = makeWarpFn(this.warpType, this.warpAmount);
    const rad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const { scale, position } = this;
    return (u, v) => {
      const { x, y } = warpFn(u, v);
      const sx = x * scale;
      const sy = y * scale;
      return {
        x: sx * cos - sy * sin + position.x,
        y: sx * sin + sy * cos + position.y,
      };
    };
  }

  // Traces the warped boundary of the unit square as an SVG path string.
  boundaryPath(project) {
    const pts = [];
    const n = BOUNDARY_SAMPLES_PER_EDGE;
    for (let i = 0; i <= n; i++) pts.push(project(i / n, 0));
    for (let i = 0; i <= n; i++) pts.push(project(1, i / n));
    for (let i = 0; i <= n; i++) pts.push(project(1 - i / n, 1));
    for (let i = 0; i <= n; i++) pts.push(project(0, 1 - i / n));
    return (
      'M ' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') + ' Z'
    );
  }
}
