import { initControls } from './controls.js';
import { TravelLinesApp } from './state.js';
import { debounce } from './util.js';
function bootstrap() {
    const svg = document.getElementById('canvas');
    const wrapper = document.getElementById('stage');
    if (!svg || !wrapper)
        return;
    const app = new TravelLinesApp(svg, wrapper);
    app.regenerate(app.config.seed);
    initControls(app);
    const onResize = debounce(() => app.rebuild(), 120);
    window.addEventListener('resize', onResize);
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(onResize);
        ro.observe(wrapper);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
}
else {
    bootstrap();
}
