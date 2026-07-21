import { renderFullSVGDocument, CANVAS_WIDTH, CANVAS_HEIGHT } from './render.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSVG(ribbon, filename = 'composition.svg') {
  const svgStr = renderFullSVGDocument(ribbon);
  download(new Blob([svgStr], { type: 'image/svg+xml' }), filename);
}

export function exportPNG(ribbon, { scale = 3, filename = 'composition.png' } = {}) {
  const svgStr = renderFullSVGDocument(ribbon);
  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
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
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        download(blob, filename);
        resolve();
      }, 'image/png');
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
