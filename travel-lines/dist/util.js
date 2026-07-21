export function debounce(fn, ms) {
    let handle;
    return (...args) => {
        if (handle !== undefined)
            window.clearTimeout(handle);
        handle = window.setTimeout(() => fn(...args), ms);
    };
}
export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
