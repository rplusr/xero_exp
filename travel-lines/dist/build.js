// Turns abstract generated lines (grid segments + lanes) into pixel-space
// render geometry: rounded pieces, per-piece gradient colour stops, and
// station node points (ends, bundle joins, crossings).
import { buildRoundedPath, perpUnit, segmentsIntersect, } from './geometry.js';
import { verticesOf } from './pathgen.js';
import { buildRamp, sampleRamp } from './palettes.js';
function pixelVerticesOf(line, cellSize, spacing) {
    const gridVerts = verticesOf(line.start, line.segments);
    const pixels = [];
    for (let idx = 0; idx < gridVerts.length; idx++) {
        const outgoing = line.segments[idx];
        const incoming = line.segments[idx - 1];
        const seg = outgoing ?? incoming;
        const base = { x: gridVerts[idx].x * cellSize, y: gridVerts[idx].y * cellSize };
        if (!seg || seg.lane === 0) {
            pixels.push(base);
            continue;
        }
        const p = perpUnit(seg.dir);
        const offset = seg.lane * spacing;
        pixels.push({ x: base.x + p.x * offset, y: base.y + p.y * offset });
    }
    return pixels;
}
export function buildComposition(lines, opts) {
    const renderLines = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const allLinePieceEndpoints = [];
    for (const line of lines) {
        const pixelVerts = pixelVerticesOf(line, opts.cellSize, opts.spacing);
        const { pieces, totalLength } = buildRoundedPath(pixelVerts, opts.cornerRadius);
        const ramp = buildRamp(opts.colors, line.id);
        const renderPieces = [];
        let running = 0;
        for (const piece of pieces) {
            const t0 = totalLength > 0 ? running / totalLength : 0;
            running += piece.len;
            const t1 = totalLength > 0 ? running / totalLength : 1;
            const color0 = sampleRamp(ramp, t0);
            const color1 = sampleRamp(ramp, t1);
            if (piece.kind === 'line') {
                renderPieces.push({ kind: 'line', p0: piece.p0, p1: piece.p1, len: piece.len, t0, t1, color0, color1 });
                allLinePieceEndpoints.push({ lineId: line.id, p0: piece.p0, p1: piece.p1 });
            }
            else {
                renderPieces.push({
                    kind: 'arc',
                    p0: piece.p0,
                    p1: piece.p1,
                    radius: piece.radius,
                    sweep: piece.sweep,
                    len: piece.len,
                    t0,
                    t1,
                    color0,
                    color1,
                });
            }
        }
        for (const p of pixelVerts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        const stations = [];
        if (opts.stations) {
            const lastIdx = pixelVerts.length - 1;
            stations.push({ p: pixelVerts[0], t: 0 });
            stations.push({ p: pixelVerts[lastIdx], t: 1 });
            for (const idx of line.joins) {
                if (idx > 0 && idx < lastIdx)
                    stations.push({ p: pixelVerts[idx], t: idx / lastIdx });
            }
        }
        renderLines.push({ id: line.id, pieces: renderPieces, totalLength, ramp, stations });
    }
    if (opts.stations) {
        const crossings = [];
        for (let i = 0; i < allLinePieceEndpoints.length; i++) {
            for (let j = i + 1; j < allLinePieceEndpoints.length; j++) {
                const a = allLinePieceEndpoints[i];
                const b = allLinePieceEndpoints[j];
                if (a.lineId === b.lineId)
                    continue;
                const hit = segmentsIntersect(a.p0, a.p1, b.p0, b.p1);
                if (hit)
                    crossings.push(hit);
            }
        }
        const deduped = [];
        for (const c of crossings) {
            if (!deduped.some((d) => Math.hypot(d.x - c.x, d.y - c.y) < 10))
                deduped.push(c);
        }
        if (deduped.length && renderLines.length) {
            renderLines[0].stations.push(...deduped.map((p) => ({ p, t: 0.5 })));
        }
    }
    if (!isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = 1;
        maxY = 1;
    }
    return { lines: renderLines, bbox: { minX, minY, maxX, maxY } };
}
