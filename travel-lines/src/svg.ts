// DOM/SVG builder: turns a RenderComposition into live SVG elements
// (gradients, paths, station nodes) and returns lightweight handles the
// animation module uses for draw-in and gradient drift.

import { RenderComposition, RenderPiece } from './build.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PieceHandle {
  path: SVGPathElement;
  len: number;
  t0: number;
  t1: number;
  stop0: SVGStopElement;
  stop1: SVGStopElement;
}

export interface StationHandle {
  circle: SVGCircleElement;
  t: number;
}

export interface LineHandle {
  id: number;
  pieces: PieceHandle[];
  totalLength: number;
  ramp: string[];
  stations: StationHandle[];
}

export interface RenderHandles {
  lines: LineHandle[];
  scale: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  padding: number;
  thickness: number;
  stationsEnabled: boolean;
  stationRadius: number;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function piecePathData(p: RenderPiece): string {
  if (p.kind === 'line') {
    return `M ${p.p0.x.toFixed(2)} ${p.p0.y.toFixed(2)} L ${p.p1.x.toFixed(2)} ${p.p1.y.toFixed(2)}`;
  }
  return `M ${p.p0.x.toFixed(2)} ${p.p0.y.toFixed(2)} A ${p.radius!.toFixed(2)} ${p.radius!.toFixed(2)} 0 0 ${p.sweep} ${p.p1.x.toFixed(2)} ${p.p1.y.toFixed(2)}`;
}

function computeFitTransform(bbox: RenderComposition['bbox'], width: number, height: number, padding: number) {
  const w = Math.max(1, bbox.maxX - bbox.minX);
  const h = Math.max(1, bbox.maxY - bbox.minY);
  const availW = Math.max(1, width - padding * 2);
  const availH = Math.max(1, height - padding * 2);
  const scale = Math.min(availW / w, availH / h, 3.4);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const tx = width / 2 - cx * scale;
  const ty = height / 2 - cy * scale;
  return { scale, tx, ty };
}

export function renderComposition(
  svg: SVGSVGElement,
  comp: RenderComposition,
  opts: RenderOptions,
): RenderHandles {
  svg.setAttribute('viewBox', `0 0 ${opts.width} ${opts.height}`);
  svg.setAttribute('width', String(opts.width));
  svg.setAttribute('height', String(opts.height));
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = el('defs');
  svg.appendChild(defs);

  const { scale, tx, ty } = computeFitTransform(comp.bbox, opts.width, opts.height, opts.padding);
  const root = el('g');
  root.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`);
  svg.appendChild(root);

  const lineHandles: LineHandle[] = [];

  for (const line of comp.lines) {
    const group = el('g');
    group.setAttribute('class', 'tl-line');
    group.setAttribute('data-line-id', String(line.id));

    const pieceHandles: PieceHandle[] = [];

    line.pieces.forEach((piece, pieceIndex) => {
      const gradId = `tl-grad-${line.id}-${pieceIndex}`;
      const grad = el('linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.setAttribute('x1', piece.p0.x.toFixed(2));
      grad.setAttribute('y1', piece.p0.y.toFixed(2));
      grad.setAttribute('x2', piece.p1.x.toFixed(2));
      grad.setAttribute('y2', piece.p1.y.toFixed(2));

      const stop0 = el('stop');
      stop0.setAttribute('offset', '0%');
      stop0.setAttribute('stop-color', piece.color0);
      const stop1 = el('stop');
      stop1.setAttribute('offset', '100%');
      stop1.setAttribute('stop-color', piece.color1);
      grad.appendChild(stop0);
      grad.appendChild(stop1);
      defs.appendChild(grad);

      const path = el('path');
      path.setAttribute('d', piecePathData(piece));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', `url(#${gradId})`);
      path.setAttribute('stroke-width', String(opts.thickness));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      group.appendChild(path);

      pieceHandles.push({ path, len: piece.len, t0: piece.t0, t1: piece.t1, stop0, stop1 });
    });

    root.appendChild(group);
    const stationHandles: StationHandle[] = [];
    lineHandles.push({
      id: line.id,
      pieces: pieceHandles,
      totalLength: line.totalLength,
      ramp: line.ramp,
      stations: stationHandles,
    });

    if (opts.stationsEnabled && line.stations.length) {
      const stationGroup = el('g');
      stationGroup.setAttribute('class', 'tl-stations');
      for (const s of line.stations) {
        const circle = el('circle');
        circle.setAttribute('cx', s.p.x.toFixed(2));
        circle.setAttribute('cy', s.p.y.toFixed(2));
        circle.setAttribute('r', (opts.stationRadius / scale).toFixed(2));
        circle.setAttribute('class', 'tl-station');
        circle.setAttribute('stroke-width', String(Math.max(1.5, opts.thickness * 0.32)));
        circle.setAttribute('vector-effect', 'non-scaling-stroke');
        stationGroup.appendChild(circle);
        stationHandles.push({ circle, t: s.t });
      }
      root.appendChild(stationGroup);
    }
  }

  return { lines: lineHandles, scale };
}
