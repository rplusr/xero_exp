// Wires the static control markup in index.html to a TravelLinesApp
// instance. Range inputs are debounced so dragging feels live without
// rebuilding on every pixel of drag.

import { exportPng, exportSvg, copyToClipboard } from './export.js';
import { CUSTOM_PALETTE_ID, PALETTES } from './palettes.js';
import { TravelLinesApp } from './state.js';
import { debounce } from './util.js';

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}

const BG_COLORS = { light: '#F5F2EC', dark: '#0B0C0E' };

export function initControls(app: TravelLinesApp): void {
  const randomizeBtn = byId<HTMLButtonElement>('randomizeBtn');
  const seedInput = byId<HTMLInputElement>('seedInput');
  const copySeedBtn = byId<HTMLButtonElement>('copySeedBtn');

  const lineCount = byId<HTMLInputElement>('lineCount');
  const lineCountValue = byId<HTMLElement>('lineCountValue');
  const gridDensity = byId<HTMLInputElement>('gridDensity');
  const gridDensityValue = byId<HTMLElement>('gridDensityValue');
  const thickness = byId<HTMLInputElement>('thickness');
  const thicknessValue = byId<HTMLElement>('thicknessValue');
  const cornerRadius = byId<HTMLInputElement>('cornerRadius');
  const cornerRadiusValue = byId<HTMLElement>('cornerRadiusValue');
  const spacing = byId<HTMLInputElement>('spacing');
  const spacingValue = byId<HTMLElement>('spacingValue');

  const paletteRow = byId<HTMLElement>('paletteRow');
  const customColors = byId<HTMLElement>('customColors');
  const customColor1 = byId<HTMLInputElement>('customColor1');
  const customColor2 = byId<HTMLInputElement>('customColor2');
  const customColor3 = byId<HTMLInputElement>('customColor3');

  const bgSegmented = byId<HTMLElement>('bgSegmented');
  const stationsToggle = byId<HTMLInputElement>('stationsToggle');
  const animationToggle = byId<HTMLInputElement>('animationToggle');

  const exportSvgBtn = byId<HTMLButtonElement>('exportSvgBtn');
  const exportPngBtn = byId<HTMLButtonElement>('exportPngBtn');

  const panelToggle = document.getElementById('panelToggle') as HTMLButtonElement | null;
  const panel = document.getElementById('panel');
  const panelBackdrop = document.getElementById('panelBackdrop');

  function syncReadouts(): void {
    lineCountValue.textContent = String(app.config.lineCount);
    gridDensityValue.textContent = String(app.config.gridDensity);
    thicknessValue.textContent = `${app.config.thickness}`;
    cornerRadiusValue.textContent = `${app.config.cornerRadius}`;
    spacingValue.textContent = `${app.config.spacing}`;
    seedInput.value = app.config.seed;
  }

  function buildPaletteSwatches(): void {
    paletteRow.innerHTML = '';
    const entries = [...PALETTES, { id: CUSTOM_PALETTE_ID, name: 'Custom', colors: [] as string[] }];
    for (const p of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.setAttribute('role', 'radio');
      btn.title = p.name;
      btn.setAttribute('aria-label', p.name);
      btn.dataset.paletteId = p.id;
      const colors = p.id === CUSTOM_PALETTE_ID ? [customColor1.value, customColor2.value, customColor3.value] : p.colors;
      btn.style.background = `linear-gradient(135deg, ${colors.slice(0, 4).join(', ')})`;
      btn.setAttribute('aria-checked', String(p.id === app.config.paletteId));
      btn.addEventListener('click', () => {
        app.config.paletteId = p.id;
        customColors.hidden = p.id !== CUSTOM_PALETTE_ID;
        [...paletteRow.children].forEach((c) => c.setAttribute('aria-checked', String(c === btn)));
        app.rebuild();
      });
      paletteRow.appendChild(btn);
    }
    customColors.hidden = app.config.paletteId !== CUSTOM_PALETTE_ID;
  }

  const rebuildDebounced = debounce(() => app.rebuild(), 70);

  lineCount.addEventListener('input', () => {
    app.config.lineCount = Number(lineCount.value);
    lineCountValue.textContent = lineCount.value;
    debounce(() => app.regenerate(app.config.seed), 90)();
  });

  gridDensity.addEventListener('input', () => {
    app.config.gridDensity = Number(gridDensity.value);
    gridDensityValue.textContent = gridDensity.value;
    rebuildDebounced();
  });

  thickness.addEventListener('input', () => {
    app.config.thickness = Number(thickness.value);
    thicknessValue.textContent = thickness.value;
    rebuildDebounced();
  });

  cornerRadius.addEventListener('input', () => {
    app.config.cornerRadius = Number(cornerRadius.value);
    cornerRadiusValue.textContent = cornerRadius.value;
    rebuildDebounced();
  });

  spacing.addEventListener('input', () => {
    app.config.spacing = Number(spacing.value);
    spacingValue.textContent = spacing.value;
    rebuildDebounced();
  });

  [customColor1, customColor2, customColor3].forEach((input) => {
    input.addEventListener('input', () => {
      app.config.customColors = [customColor1.value, customColor2.value, customColor3.value];
      if (app.config.paletteId === CUSTOM_PALETTE_ID) rebuildDebounced();
      const customSwatch = paletteRow.querySelector(`[data-palette-id="${CUSTOM_PALETTE_ID}"]`) as HTMLElement | null;
      if (customSwatch) {
        customSwatch.style.background = `linear-gradient(135deg, ${app.config.customColors.join(', ')})`;
      }
    });
  });

  bgSegmented.querySelectorAll<HTMLButtonElement>('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.bg as 'light' | 'dark';
      app.config.background = value;
      bgSegmented.querySelectorAll('.segmented-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      app.rebuild();
    });
  });

  stationsToggle.addEventListener('change', () => {
    app.config.stations = stationsToggle.checked;
    app.rebuild();
  });

  animationToggle.addEventListener('change', () => {
    app.config.animation = animationToggle.checked;
    app.rebuild();
  });

  randomizeBtn.addEventListener('click', () => {
    app.regenerate();
    syncReadouts();
  });

  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      app.regenerate(seedInput.value.trim() || undefined);
      syncReadouts();
      seedInput.blur();
    }
  });
  seedInput.addEventListener('blur', () => {
    if (seedInput.value.trim() && seedInput.value.trim() !== app.config.seed) {
      app.regenerate(seedInput.value.trim());
      syncReadouts();
    }
  });

  copySeedBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(app.config.seed);
    copySeedBtn.classList.toggle('is-copied', ok);
    window.setTimeout(() => copySeedBtn.classList.remove('is-copied'), 1200);
  });

  exportSvgBtn.addEventListener('click', () => {
    const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
    exportSvg(svg, BG_COLORS[app.config.background], `travel-lines-${app.config.seed}.svg`);
  });

  exportPngBtn.addEventListener('click', () => {
    const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
    exportPng(svg, BG_COLORS[app.config.background], `travel-lines-${app.config.seed}@2x.png`, 2);
  });

  if (panelToggle && panel) {
    const setOpen = (open: boolean) => {
      panel.classList.toggle('is-open', open);
      panelBackdrop?.classList.toggle('is-visible', open);
      panelToggle.setAttribute('aria-expanded', String(open));
    };
    panelToggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    panelBackdrop?.addEventListener('click', () => setOpen(false));
  }

  buildPaletteSwatches();
  syncReadouts();
}
