import { renderFullSVGDocument, CANVAS_WIDTH, CANVAS_HEIGHT } from './render.js';

// Plain data: URIs rather than Blob + createObjectURL — one less API that
// needs particular permissions to work, and there's nothing to revoke.
function download(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportSVG(ribbon, filename = 'composition.svg') {
  const svgStr = renderFullSVGDocument(ribbon);
  download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`, filename);
}

export function exportPNG(ribbon, { scale = 3, filename = 'composition.png' } = {}) {
  const svgStr = renderFullSVGDocument(ribbon);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH * scale;
      canvas.height = CANVAS_HEIGHT * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      download(canvas.toDataURL('image/png'), filename);
      resolve();
    };
    img.onerror = () => reject(new Error('Could not rasterise the SVG for PNG export.'));
    img.src = svgDataUrl;
  });
}
