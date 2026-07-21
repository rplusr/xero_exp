export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let handle: number | undefined;
  return (...args: Args) => {
    if (handle !== undefined) window.clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), ms);
  };
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
