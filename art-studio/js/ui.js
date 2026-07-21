import { PATTERNS } from './patterns.js';
import { WARP_TYPES } from './warps.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, renderSVGInner } from './render.js';
import { exportSVG, exportPNG } from './export.js';
import { PALETTE } from './palette.js';

const WARP_LABELS = {
  cylinder: 'Cylinder / Curl',
  fold: 'Fold',
  perspective: 'Perspective Plane',
};

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

export function initUI(studio) {
  const canvas = document.getElementById('canvas');
  const layerList = document.getElementById('layerList');
  const sheetControls = document.getElementById('sheetControls');
  const addSheetBtn = document.getElementById('addSheetBtn');
  const seedInput = document.getElementById('seedInput');
  const randomiseBtn = document.getElementById('randomiseBtn');
  const exportSvgBtn = document.getElementById('exportSvgBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');

  let lastControlsSig = null;

  function renderCanvas() {
    canvas.innerHTML = renderSVGInner(studio.sheets);
  }

  function renderLayerList() {
    const rows = [...studio.sheets]
      .map((s, i) => ({ s, i }))
      .reverse()
      .map(({ s, i }) => {
        const selected = s.id === studio.selectedId ? ' selected' : '';
        const [c1, c2] = s.fill.colors;
        const swatch = `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
        const linkTag = i === 0 ? 'Ribbon start' : 'Linked';
        return `
        <li class="layer-row${selected}" data-id="${s.id}">
          <span class="layer-swatch" style="background:${swatch}"></span>
          <span class="layer-text">
            <span class="layer-label">${PATTERNS[s.pattern].label}</span>
            <span class="layer-sub">${WARP_LABELS[s.warpType]} · ${linkTag}</span>
          </span>
          <span class="layer-actions">
            <button data-action="up" title="Bring forward (])">&uarr;</button>
            <button data-action="down" title="Send backward ([)">&darr;</button>
            <button data-action="dup" title="Duplicate (⌘D)">&#10064;</button>
            <button data-action="del" title="Delete (Backspace)">&times;</button>
          </span>
        </li>`;
      })
      .join('');
    layerList.innerHTML = rows || '<li class="layer-empty">No sheets — press A to add one</li>';
  }

  function renderSheetControls() {
    const sel = studio.selected();
    if (!sel) {
      sheetControls.innerHTML = '';
      return;
    }
    const idx = studio.sheets.indexOf(sel);
    const isFirst = idx === 0;

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

    const placementFields = isFirst
      ? `
        ${fieldMarkup({ label: 'Rotation', dataAttr: 'data-field', key: 'rotation', type: 'range', min: -180, max: 180, step: 1, value: sel.rotation })}
        ${fieldMarkup({ label: 'Position X', dataAttr: 'data-field', key: 'position.x', type: 'range', min: -200, max: CANVAS_WIDTH + 200, step: 1, value: sel.position.x })}
        ${fieldMarkup({ label: 'Position Y', dataAttr: 'data-field', key: 'position.y', type: 'range', min: -200, max: CANVAS_HEIGHT + 200, step: 1, value: sel.position.y })}
      `
      : `
        ${fieldMarkup({ label: 'Turn from previous', dataAttr: 'data-field', key: 'turnDelta', type: 'range', min: -150, max: 150, step: 1, value: sel.turnDelta || 0 })}
      `;

    sheetControls.innerHTML = `
      <div class="panel-section">
        <div class="section-head">
          <h2>Sheet</h2>
          <span class="chain-badge">${isFirst ? 'Ribbon start' : `Linked to segment ${idx}`}</span>
        </div>
        <label class="field">
          <span>Warp</span>
          <select data-field="warpType">
            ${WARP_TYPES.map((w) => `<option value="${w}" ${w === sel.warpType ? 'selected' : ''}>${WARP_LABELS[w]}</option>`).join('')}
          </select>
        </label>
        ${fieldMarkup({ label: 'Warp amount', dataAttr: 'data-field', key: 'warpAmount', type: 'range', min: -1, max: 1, step: 0.01, value: sel.warpAmount })}
        ${placementFields}
        ${fieldMarkup({ label: 'Scale', dataAttr: 'data-field', key: 'scale', type: 'range', min: 60, max: 800, step: 1, value: sel.scale })}
      </div>
      <div class="panel-section">
        <h2>Fill</h2>
        ${fieldMarkup({ label: 'Colour 1', dataAttr: 'data-field', key: 'fill.colors.0', type: 'swatch', value: sel.fill.colors[0] })}
        ${fieldMarkup({ label: 'Colour 2 (shadow)', dataAttr: 'data-field', key: 'fill.colors.1', type: 'swatch', value: sel.fill.colors[1] })}
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
    if (!sel) return 'none';
    const idx = studio.sheets.indexOf(sel);
    return `${sel.id}:${sel.pattern}:${sel.warpType}:${idx === 0}`;
  }

  function onStudioChange() {
    renderCanvas();
    renderLayerList();
    const sig = controlsSignature();
    if (sig !== lastControlsSig) {
      renderSheetControls();
      lastControlsSig = sig;
    }
  }

  studio.onChange(onStudioChange);

  // --- Layer list interactions ---------------------------------------------
  layerList.addEventListener('click', (e) => {
    const row = e.target.closest('.layer-row');
    if (!row) return;
    const id = row.dataset.id;
    const btn = e.target.closest('button');
    if (btn) {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'up') studio.moveSheet(id, 1);
      else if (action === 'down') studio.moveSheet(id, -1);
      else if (action === 'dup') studio.duplicateSheet(id);
      else if (action === 'del') studio.removeSheet(id);
      return;
    }
    studio.select(id);
  });

  addSheetBtn.addEventListener('click', () => studio.addSheet());

  // --- Sheet controls interactions -----------------------------------------
  sheetControls.addEventListener('input', (e) => {
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

  sheetControls.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch-btn');
    if (!btn) return;
    const sel = studio.selected();
    if (!sel) return;
    const hex = btn.dataset.hex;
    if (btn.dataset.field) setByPath(sel, btn.dataset.field, hex);
    else if (btn.dataset.param) sel.patternParams[btn.dataset.param] = hex;
    studio.notify();
    renderSheetControls();
    lastControlsSig = controlsSignature();
  });

  // --- Seed + randomise ------------------------------------------------------
  function randomiseWithNewSeed() {
    const newSeed = Math.floor(Math.random() * 1e6).toString();
    seedInput.value = newSeed;
    studio.randomise(newSeed);
  }

  randomiseBtn.addEventListener('click', randomiseWithNewSeed);

  exportSvgBtn.addEventListener('click', () => {
    exportSVG(studio.sheets, `sheets-${studio.seed}.svg`);
  });
  exportPngBtn.addEventListener('click', async () => {
    exportPngBtn.disabled = true;
    exportPngBtn.textContent = 'Exporting…';
    try {
      await exportPNG(studio.sheets, { scale: 3, filename: `sheets-${studio.seed}.png` });
    } catch (err) {
      console.error('PNG export failed', err);
    } finally {
      exportPngBtn.disabled = false;
      exportPngBtn.textContent = 'Export PNG';
    }
  });
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      studio.randomise(seedInput.value.trim() || '1');
      seedInput.blur();
    }
  });
  seedInput.addEventListener('blur', () => {
    studio.randomise(seedInput.value.trim() || '1');
  });

  // --- Keyboard shortcuts ------------------------------------------------
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      if (studio.selectedId) {
        e.preventDefault();
        studio.duplicateSheet(studio.selectedId);
      }
      return;
    }

    if (typing) return;

    if (e.key.toLowerCase() === 'r') {
      randomiseWithNewSeed();
    } else if (e.key === 'a') {
      studio.addSheet();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (studio.selectedId) studio.removeSheet(studio.selectedId);
    } else if (e.key === ']') {
      if (studio.selectedId) studio.moveSheet(studio.selectedId, 1);
    } else if (e.key === '[') {
      if (studio.selectedId) studio.moveSheet(studio.selectedId, -1);
    }
  });

  return { seedInput };
}
