import { renderSVGInner } from './render.js';

const canvas = document.getElementById('canvas');

const sheet = {
  id: 'sheet-1',
  warpType: 'cylinder',
  warpAmount: 0.55,
  rotation: 0,
  scale: 480,
  position: { x: 480, y: 320 },
  pattern: 'crossHalftone',
  patternParams: {
    spacing: 0.045,
    minSize: 0.2,
    maxSize: 1.0,
    invert: false,
    strokeWidth: 1.4,
    color: '#e11d3f',
  },
  gradient: {
    stops: ['#eafff6', '#6fe3c4'],
    angle: 20,
  },
};

function render() {
  canvas.innerHTML = renderSVGInner([sheet]);
}

function bindRange(id, onChange) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => onChange(parseFloat(el.value)));
}

function bindColor(id, onChange) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => onChange(el.value));
}

document.getElementById('warpType').addEventListener('change', (e) => {
  sheet.warpType = e.target.value;
  render();
});

bindRange('warpAmount', (v) => { sheet.warpAmount = v; render(); });
bindRange('rotation', (v) => { sheet.rotation = v; render(); });
bindRange('scale', (v) => { sheet.scale = v; render(); });
bindRange('posX', (v) => { sheet.position.x = v; render(); });
bindRange('posY', (v) => { sheet.position.y = v; render(); });

bindColor('gradStop1', (v) => { sheet.gradient.stops[0] = v; render(); });
bindColor('gradStop2', (v) => { sheet.gradient.stops[1] = v; render(); });
bindRange('gradAngle', (v) => { sheet.gradient.angle = v; render(); });

bindRange('pSpacing', (v) => { sheet.patternParams.spacing = v; render(); });
bindRange('pMinSize', (v) => { sheet.patternParams.minSize = v; render(); });
bindRange('pMaxSize', (v) => { sheet.patternParams.maxSize = v; render(); });
bindColor('pColor', (v) => { sheet.patternParams.color = v; render(); });

render();
