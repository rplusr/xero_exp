// Parametric sheet warps. Each warp maps (u, v) in [0,1]x[0,1] to a local
// point in an approximately unit-scaled 2D space, via a fake-3D projection.
// The local space is later scaled / rotated / translated by the sheet transform.

const FOCAL = 1.5;

function persp(X3, Y3, Z3) {
  const s = FOCAL / (FOCAL + Z3);
  return { x: X3 * s, y: Y3 * s };
}

// --- Cylinder / curl -------------------------------------------------------
// Rolls the sheet around a vertical axis, like a curling ribbon of paper.
// amount 0 = flat plane, amount 1 = curled through ~0.8 full turns.

const CYLINDER_TURNS = 0.8;
const CYLINDER_LENGTH = 2.6; // elongates v so the sheet reads as a ribbon, not a square tube

function cylinderPoint(u, v, amount) {
  const angleSpan = amount * CYLINDER_TURNS * Math.PI * 2;
  const cu = u - 0.5;
  const cv = (v - 0.5) * CYLINDER_LENGTH;
  let X3, Z3;
  if (Math.abs(angleSpan) < 1e-4) {
    X3 = cu;
    Z3 = 0;
  } else {
    const radius = 1 / angleSpan;
    const angle = cu * angleSpan;
    X3 = Math.sin(angle) * radius;
    Z3 = (1 - Math.cos(angle)) * radius;
  }
  return persp(X3, cv, Z3);
}

// --- Fold / pleat ------------------------------------------------------
// Simulates an accordion fold: N flat panels of equal width, hinged and
// tilted alternately toward/away from the viewer.

export const FOLD_COUNT = 6;
const FOLD_TILT_MAX = 1.309; // ~75deg

function buildFoldTable(amount) {
  const n = FOLD_COUNT;
  const tilt = amount * FOLD_TILT_MAX;
  const w = 1 / n;
  const hx = [-0.5];
  const hz = [0];
  const dirs = [];
  for (let i = 0; i < n; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const dX = Math.cos(sign * tilt);
    const dZ = Math.sin(sign * tilt);
    dirs.push([dX, dZ]);
    hx.push(hx[i] + w * dX);
    hz.push(hz[i] + w * dZ);
  }
  const minX = Math.min(...hx);
  const maxX = Math.max(...hx);
  const offset = (minX + maxX) / 2;
  return { n, w, hx, hz, dirs, offset };
}

const FOLD_LENGTH = 2.2;

function foldPoint(table, u, v) {
  const seg = Math.min(Math.max(Math.floor(u * table.n), 0), table.n - 1);
  const t = u * table.n - seg;
  const [dX, dZ] = table.dirs[seg];
  const X3 = table.hx[seg] + t * table.w * dX - table.offset;
  const Z3 = table.hz[seg] + t * table.w * dZ;
  return persp(X3, (v - 0.5) * FOLD_LENGTH, Z3);
}

// --- Perspective plane ---------------------------------------------------
// Tilts a flat plane away from the viewer around a horizontal axis, like a
// wall or floor receding into the distance.

const PLANE_TILT_MAX = 1.361; // ~78deg
const PLANE_LENGTH = 2.0;

function perspectivePlanePoint(u, v, amount) {
  const tilt = amount * PLANE_TILT_MAX;
  const X3 = u - 0.5;
  const cv = (v - 0.5) * PLANE_LENGTH;
  const Y3 = cv * Math.cos(tilt);
  const Z3 = cv * Math.sin(tilt);
  return persp(X3, Y3, Z3);
}

// --- Public factory --------------------------------------------------------

export const WARP_TYPES = ['cylinder', 'fold', 'perspective'];

export function makeWarpFn(type, amount) {
  switch (type) {
    case 'cylinder':
      return (u, v) => cylinderPoint(u, v, amount);
    case 'fold': {
      const table = buildFoldTable(amount);
      return (u, v) => foldPoint(table, u, v);
    }
    case 'perspective':
      return (u, v) => perspectivePlanePoint(u, v, amount);
    default:
      return (u, v) => ({ x: u - 0.5, y: v - 0.5 });
  }
}
