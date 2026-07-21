import { PATTERNS } from './patterns.js';
import { renderSVGInner } from './render.js';
import { exportSVG, exportPNG } from './export.js';
import { PALETTE } from './palette.js';

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

function fieldMarkup({ label, dataAttr, key, type, min, max, step, value }) {
  if (type === 'swatch') {
    const swatches = PALETTE.map(
      (c) => `
        <button type="button" class="swatch-btn${c.hex.toLowerCase() === String(value).toLowerCase() ? ' selected' : ''}"
          style="background:${c.hex}" ${dataAttr}="${key}" data-hex="${c.hex}" title="${c.name}"></button>`
    ).join('');
    return `
      <div class="field">
        <span>${label}</span>
        <div class="swatch-grid">${swatches}</div>
      </div>`;
  }
  if (type === 'checkbox') {
    return `
      <label class="field field-row">
        <span>${label}</span>
        <input type="checkbox" ${dataAttr}="${key}" ${value ? 'checked' : ''} />
      </label>`;
  }
  return `
    <label class="field">
      <span>${label}</span>
      <input type="range" ${dataAttr}="${key}" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>`;
}

const RIBBON_FIELDS = [
  { label: 'Loop width X', key: 'path.ax', min: 150, max: 420, step: 1 },
  { label: 'Loop width Y', key: 'path.ay', min: 100, max: 280, step: 1 },
  { label: 'Frequency X', key: 'path.fx', min: 1, max: 3, step: 1 },
  { label: 'Frequency Y', key: 'path.fy', min: 1, max: 3, step: 1 },
  { label: 'Ribbon width', key: 'baseWidth', min: 40, max: 180, step: 1 },
];

function readRibbonFieldValue(studio, key) {
  if (key.startsWith('path.')) return studio.path[key.slice(5)];
  return studio[key];
}

export function initUI(studio) {
  const canvas = document.getElementById('canvas');
  const zoneList = document.getElementById('zoneList');
  const zoneControls = document.getElementById('zoneControls');
  const ribbonControls = document.getElementById('ribbonControls');
  const addZoneBtn = document.getElementById('addZoneBtn');
  const seedInput = document.getElementById('seedInput');
  const randomiseBtn = document.getElementById('randomiseBtn');
  const exportSvgBtn = document.getElementById('exportSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');

  let lastControlsSig = null;

  function renderCanvas() {
    canvas.innerHTML = renderSVGInner(studio.ribbon());
  }

  function renderRibbonControls() {
    ribbonControls.innerHTML = RIBBON_FIELDS.map((f) =>
      fieldMarkup({
        label: f.label,
        dataAttr: 'data-ribbon',
        key: f.key,
        type: 'range',
        min: f.min,
        max: f.max,
        step: f.step,
        value: readRibbonFieldValue(studio, f.key),
      })
    ).join('');
  }

  function renderZoneList() {
    const rows = studio.zones
      .map((z, i) => {
        const selected = z.id === studio.selectedId ? ' selected' : '';
        return `
        <li class="layer-row${selected}" data-id="${z.id}">
          <span class="layer-swatch" style="background:${z.color}"></span>
          <span class="layer-text">
            <span class="layer-label">${PATTERNS[z.pattern].label}</span>
            <span class="layer-sub">Zone ${i + 1}</span>
          </span>
          <span class="layer-actions">
            <button data-action="up" title="Move earlier (])">&uarr;</button>
            <button data-action="down" title="Move later ([)">&darr;</button>
            <button data-action="dup" title="Duplicate (⌘D)">&#10064;</button>
            <button data-action="del" title="Delete (Backspace)">&times;</button>
          </span>
        </li>`;
      })
      .join('');
    zoneList.innerHTML = rows || '<li class="layer-empty">No zones — press A to add one</li>';
  }

  function renderZoneControls() {
    const sel = studio.selected();
    if (!sel) {
      zoneControls.innerHTML = '';
      return;
    }
    const patternDef = PATTERNS[sel.pattern];
    const patternFields = patternDef.paramsSchema
      .map((f) =>
        fieldMarkup({
          label: f.label,
          dataAttr: 'data-param',
          key: f.key,
          type: f.type,
          min: f.min,
          max: f.max,
          step: f.step,
          value: sel.patternParams[f.key],
        })
      )
      .join('');

    zoneControls.innerHTML = `
      <div class="panel-section">
        <h2>Colour</h2>
        ${fieldMarkup({ label: 'Zone colour', dataAttr: 'data-field', key: 'color', type: 'swatch', value: sel.color })}
      </div>
      <div class="panel-section">
        <div class="section-head">
          <h2>Pattern</h2>
        </div>
        <label class="field">
          <span>Type</span>
          <select data-field="pattern">
            ${Object.entries(PATTERNS).map(([k, p]) => `<option value="${k}" ${k === sel.pattern ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </label>
        ${patternFields}
      </div>
    `;
  }

  function controlsSignature() {
    const sel = studio.selected();
    return sel ? `${sel.id}:${sel.pattern}` : 'none';
  }

  function onStudioChange() {
    renderCanvas();
    renderZoneList();
    const sig = controlsSignature();
    if (sig !== lastControlsSig) {
      renderZoneControls();
      lastControlsSig = sig;
    }
  }

  studio.onChange(onStudioChange);
  renderRibbonControls();

  // --- Ribbon shape controls -------------------------------------------
  ribbonControls.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset.ribbon) return;
    const value = parseFloat(t.value);
    const key = t.dataset.ribbon;
    if (key.startsWith('path.')) {
      studio.path[key.slice(5)] = value;
      studio.notify();
    } else {
      studio[key] = value;
      studio.notify();
    }
  });

  // --- Zone list interactions ------------------------------------------
  zoneList.addEventListener('click', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row) return;
    const id = row.dataset.id;
    const btn = e.target.closest('button');
    if (btn) {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'up') studio.moveZone(id, -1);
      else if (action === 'down') studio.moveZone(id, 1);
      else if (action === 'dup') studio.duplicateZone(id);
      else if (action === 'del') studio.removeZone(id);
      return;
    }
    studio.select(id);
  });

  addZoneBtn.addEventListener('click', () => studio.addZone());

  // --- Zone controls interactions ---------------------------------------
  zoneControls.addEventListener('input', (e) => {
    const t = e.target;
    const sel = studio.selected();
    if (!sel) return;

    if (t.dataset.field) {
      const value = t.type === 'range' ? parseFloat(t.value) : t.value;
      setByPath(sel, t.dataset.field, value);
      if (t.dataset.field === 'pattern') {
        sel.patternParams = { ...PATTERNS[value].defaults };
      }
      studio.notify();
    } else if (t.dataset.param) {
      const value = t.type === 'range' ? parseFloat(t.value) : t.type === 'checkbox' ? t.checked : t.value;
      sel.patternParams[t.dataset.param] = value;
      studio.notify();
    }
  });

  zoneControls.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch-btn');
    if (!btn) return;
    const sel = studio.selected();
    if (!sel) return;
    const hex = btn.dataset.hex;
    if (btn.dataset.field) setByPath(sel, btn.dataset.field, hex);
    else if (btn.dataset.param) sel.patternParams[btn.dataset.param] = hex;
    studio.notify();
    renderZoneControls();
    lastControlsSig = controlsSignature();
  });

  // --- Seed + randomise ---------------------------------------------------
  function randomiseWithNewSeed() {
    const newSeed = Math.floor(Math.random() * 1e6).toString();
    seedInput.value = newSeed;
    studio.randomise(newSeed);
    renderRibbonControls();
  }

  randomiseBtn.addEventListener('click', randomiseWithNewSeed);

  exportSvgBtn.addEventListener('click', () => {
    try {
      exportSVG(studio.ribbon(), `ribbon-${studio.seed}.svg`);
    } catch (err) {
      console.error('SVG export failed', err);
      window.alert('SVG export failed: ' + err.message);
    }
  });
  exportPngBtn.addEventListener('click', async () => {
    exportPngBtn.disabled = true;
    exportPngBtn.textContent = 'Exporting…';
    try {
      await exportPNG(studio.ribbon(), { scale: 3, filename: `ribbon-${studio.seed}.png` });
    } catch (err) {
      console.error('PNG export failed', err);
      window.alert('PNG export failed: ' + err.message);
    } finally {
      exportPngBtn.disabled = false;
      exportPngBtn.textContent = 'Export PNG';
    }
  });
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      studio.randomise(seedInput.value.trim() || '1');
      renderRibbonControls();
      seedInput.blur();
    }
  });
  seedInput.addEventListener('blur', () => {
    studio.randomise(seedInput.value.trim() || '1');
    renderRibbonControls();
  });

  // --- Keyboard shortcuts ------------------------------------------------
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      if (studio.selectedId) {
        e.preventDefault();
        studio.duplicateZone(studio.selectedId);
      }
      return;
    }

    if (typing) return;

    if (e.key.toLowerCase() === 'r') {
      randomiseWithNewSeed();
    } else if (e.key === 'a') {
      studio.addZone();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (studio.selectedId) studio.removeZone(studio.selectedId);
    } else if (e.key === ']') {
      if (studio.selectedId) studio.moveZone(studio.selectedId, 1);
    } else if (e.key === '[') {
      if (studio.selectedId) studio.moveZone(studio.selectedId, -1);
    }
  });

  return { seedInput };
}
