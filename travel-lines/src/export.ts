// SVG / PNG@2x export and clipboard helpers.

const SVG_NS = 'http://www.w3.org/2000/svg';

function prepareExportSvg(svg: SVGSVGElement, backgroundColor: string): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', clone.getAttribute('width') || '0');
  bg.setAttribute('height', clone.getAttribute('height') || '0');
  bg.setAttribute('fill', backgroundColor);
  clone.insertBefore(bg, clone.firstChild);
  return clone;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(svg: SVGSVGElement, backgroundColor: string, filename: string): void {
  const clone = prepareExportSvg(svg, backgroundColor);
  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function exportPng(svg: SVGSVGElement, backgroundColor: string, filename: string, scaleFactor = 2): void {
  const clone = prepareExportSvg(svg, backgroundColor);
  const w = parseFloat(clone.getAttribute('width') || '0') || 1;
  const h = parseFloat(clone.getAttribute('height') || '0') || 1;
  const data = new XMLSerializer().serializeToString(clone);
  const svg64 = btoa(unescape(encodeURIComponent(data)));
  const image64 = `data:image/svg+xml;base64,${svg64}`;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scaleFactor);
    canvas.height = Math.round(h * scaleFactor);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
    }, 'image/png');
  };
  img.src = image64;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
