// Draw-in animation (stroke-dash reveal, staggered per line) and a slow
// continuous gradient drift loop. Both respect prefers-reduced-motion.
import { clamp } from './geometry.js';
import { sampleRamp } from './palettes.js';
export function runDrawIn(handles, enabled, reducedMotion) {
    const animate = enabled && !reducedMotion;
    handles.lines.forEach((line, lineIndex) => {
        const lineDuration = clamp(700 + line.totalLength * 0.55, 900, 2200);
        const stagger = Math.min(lineIndex * 70, 420);
        line.pieces.forEach((piece) => {
            const path = piece.path;
            path.style.transition = 'none';
            if (!animate) {
                path.style.strokeDasharray = '';
                path.style.strokeDashoffset = '';
                return;
            }
            const dur = Math.max(60, (piece.len / Math.max(1, line.totalLength)) * lineDuration);
            const delay = piece.t0 * lineDuration + stagger;
            path.style.strokeDasharray = `${piece.len}`;
            path.style.strokeDashoffset = `${piece.len}`;
            void path.getBoundingClientRect();
            requestAnimationFrame(() => {
                path.style.transition = `stroke-dashoffset ${dur}ms linear ${delay}ms`;
                path.style.strokeDashoffset = '0';
            });
        });
        line.stations.forEach((station) => {
            const circle = station.circle;
            circle.style.transition = 'none';
            if (!animate) {
                circle.style.opacity = '1';
                circle.style.transform = 'none';
                return;
            }
            const delay = station.t * lineDuration + stagger;
            circle.style.opacity = '0';
            circle.style.transform = 'scale(0.3)';
            circle.style.transformBox = 'fill-box';
            circle.style.transformOrigin = 'center';
            void circle.getBoundingClientRect();
            requestAnimationFrame(() => {
                circle.style.transition = `opacity 260ms ease ${delay}ms, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`;
                circle.style.opacity = '1';
                circle.style.transform = 'scale(1)';
            });
        });
    });
}
const DRIFT_PERIOD_MS = 16000;
export function createDrift(ref) {
    let rafId = 0;
    let running = false;
    function frame(t) {
        if (!running)
            return;
        const phase = (t % DRIFT_PERIOD_MS) / DRIFT_PERIOD_MS;
        const handles = ref.current;
        if (handles) {
            for (const line of handles.lines) {
                for (const piece of line.pieces) {
                    piece.stop0.setAttribute('stop-color', sampleRamp(line.ramp, piece.t0 + phase));
                    piece.stop1.setAttribute('stop-color', sampleRamp(line.ramp, piece.t1 + phase));
                }
            }
        }
        rafId = requestAnimationFrame(frame);
    }
    return {
        start() {
            if (running)
                return;
            running = true;
            rafId = requestAnimationFrame(frame);
        },
        stop() {
            running = false;
            cancelAnimationFrame(rafId);
        },
    };
}
