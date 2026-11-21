/** Plot export (SVG / PNG) and multi-page A4-landscape PDF export. Heavy libraries load lazily. */

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width', String(vb.width));
  clone.setAttribute('height', String(vb.height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  clone.querySelectorAll('.pulse').forEach((n) => n.remove());
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name = 'root-locus.svg'): void {
  download(new Blob([serializeSvg(svg)], { type: 'image/svg+xml' }), name);
}

export async function svgToCanvas(svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> {
  const src = serializeSvg(svg);
  const vb = svg.viewBox.baseVal;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG rasterisation failed'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = vb.width * scale;
    c.height = vb.height * scale;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(svg: SVGSVGElement, name = 'root-locus.png'): Promise<void> {
  const c = await svgToCanvas(svg, 3);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (blob) download(blob, name);
}

/**
 * PDF: every element with [data-pdf-page] inside `root` becomes one (or more, when tall) A4
 * landscape page. SVGs marked [data-pdf-vector] are embedded as vectors.
 */
export async function exportPdf(root: HTMLElement, name: string, title: string): Promise<void> {
  const [{ jsPDF }, { svg2pdf }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasMod.default;
  await document.fonts?.ready;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297,
    PH = 210,
    M = 9;
  const pages = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')];
  let first = true;
  const header = (sub: string): number => {
    doc.setFillColor(31, 59, 110);
    doc.rect(0, 0, PW, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(`Root Locus Studio — ${title}`, M, 8);
    doc.setFontSize(9);
    doc.text(sub, PW - M, 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    return 16;
  };
  for (const page of pages) {
    const label = page.dataset.pdfPage ?? '';
    const vector = page.querySelector<SVGSVGElement>('svg[data-pdf-vector]');
    if (!first) doc.addPage();
    first = false;
    let y0 = header(label);
    if (vector) {
      // vector plot on the left, the rest (legend) rasterised on the right
      const vb = vector.viewBox.baseVal;
      const maxW = 175,
        maxH = PH - y0 - M;
      const s = Math.min(maxW / vb.width, maxH / vb.height);
      const clone = vector.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll('.pulse').forEach((n) => n.remove());
      clone.setAttribute('width', String(vb.width));
      clone.setAttribute('height', String(vb.height));
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-10000px;top:0';
      holder.appendChild(clone);
      document.body.appendChild(holder);
      try {
        await svg2pdf(clone, doc, { x: M, y: y0, width: vb.width * s, height: vb.height * s });
      } finally {
        holder.remove();
      }
      const side = page.querySelector<HTMLElement>('[data-pdf-side]');
      if (side) {
        const c = await html2canvas(side, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const x = M + vb.width * s + 5;
        const w = PW - x - M;
        const h = Math.min((c.height / c.width) * w, PH - y0 - M);
        const wFit = (c.width / c.height) * h;
        doc.addImage(c.toDataURL('image/png'), 'PNG', x, y0, Math.min(w, wFit), h);
      }
      continue;
    }
    const c = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, windowWidth: page.scrollWidth });
    const w = PW - 2 * M;
    const pxPerMm = c.width / w;
    let sy = 0;
    while (sy < c.height) {
      const avail = (PH - y0 - M) * pxPerMm;
      const sh = Math.min(avail, c.height - sy);
      const slice = document.createElement('canvas');
      slice.width = c.width;
      slice.height = sh;
      (slice.getContext('2d') as CanvasRenderingContext2D).drawImage(c, 0, sy, c.width, sh, 0, 0, c.width, sh);
      doc.addImage(slice.toDataURL('image/png'), 'PNG', M, y0, w, sh / pxPerMm);
      sy += sh;
      if (sy < c.height) {
        doc.addPage();
        y0 = header(`${label} (cont.)`);
      }
    }
  }
  doc.save(name);
}
