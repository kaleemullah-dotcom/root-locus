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

// ------------------------------------------------------------------ PDF

let embedCssCache: Promise<string> | null = null;

/** Read a same-origin font file as a data: URL. */
async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('font read failed'));
    r.readAsDataURL(blob);
  });
}

const WOFF2_URL = /url\(["']?([^"')]+\.woff2)["']?\)/;

/**
 * All of the page's CSS as one string, with woff2 fonts inlined as data: URLs (computed once).
 * Font subsets the app never uses (cyrillic, vietnamese) are dropped to keep it small.
 */
function pageCss(): Promise<string> {
  if (embedCssCache) return embedCssCache;
  embedCssCache = (async () => {
    const parts: string[] = [];
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin (none expected)
      }
      for (const rule of [...rules]) {
        if (rule instanceof CSSFontFaceRule) {
          const st = rule.style;
          const src = st.getPropertyValue('src');
          if (/cyrillic|vietnamese/.test(src)) continue;
          const m = WOFF2_URL.exec(src);
          if (!m) continue;
          const abs = new URL(m[1], sheet.href ?? document.baseURI).href;
          const data = await toDataUrl(abs);
          const range = st.getPropertyValue('unicode-range');
          parts.push(
            `@font-face{font-family:${st.getPropertyValue('font-family')};` +
              `font-style:${st.getPropertyValue('font-style') || 'normal'};` +
              `font-weight:${st.getPropertyValue('font-weight') || 'normal'};` +
              (range ? `unicode-range:${range};` : '') +
              `src:url(${data}) format("woff2");}`,
          );
        } else parts.push(rule.cssText);
      }
    }
    return parts.join('\n');
  })();
  embedCssCache.catch(() => (embedCssCache = null));
  return embedCssCache;
}

const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Fast, exact rasterisation: the sheet's markup plus the page CSS inside an SVG foreignObject,
 * laid out by the browser's own engine (no per-node style copying).
 */
async function rasterSheet(el: HTMLElement, css: string, scale: number): Promise<HTMLCanvasElement> {
  const w = el.offsetWidth,
    h = el.offsetHeight;
  const html = new XMLSerializer().serializeToString(el);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:#fff">` +
    `<style>${xmlEscape(css)}</style>${html}</div></foreignObject></svg>`;
  // data: URL (not blob:) so the canvas is not tainted by the foreignObject
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const draw = (): void => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };
    // Fonts inside an SVG image may finish loading after decode(); text drawn too early is
    // blank. Redraw until two consecutive renders are identical (fonts settled).
    const probe = document.createElement('canvas');
    probe.width = 400;
    probe.height = Math.round((400 * h) / w);
    const pctx = probe.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const signature = (): number => {
      pctx.drawImage(c, 0, 0, probe.width, probe.height);
      const d = pctx.getImageData(0, 0, probe.width, probe.height).data; // throws if tainted → fallback
      let hsh = 2166136261;
      for (let k = 0; k < d.length; k += 4) hsh = Math.imul(hsh ^ (d[k] + 3 * d[k + 1] + 7 * d[k + 2]), 16777619);
      return hsh >>> 0;
    };
    await new Promise((r) => setTimeout(r, 150));
    draw();
    let prev = signature();
    for (let k = 0; k < 20; k++) {
      await new Promise((r) => setTimeout(r, 120));
      draw();
      const cur = signature();
      if (cur === prev) break;
      prev = cur;
    }
    return c;
  }
}

/**
 * PDF: every element with [data-pdf-a4] inside `root` is an exact A4-landscape sheet
 * (1123 × 794 CSS px), rasterised by the browser itself (so KaTeX and every glyph look exactly
 * as on screen) and placed full-page at 297 × 210 mm.
 */
export async function exportPdf(
  root: HTMLElement,
  name: string,
  meta: { title: string; author: string },
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  await document.fonts?.ready;
  const sheets = [...root.querySelectorAll<HTMLElement>('[data-pdf-a4]')];
  if (!sheets.length) throw new Error('nothing to export');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: meta.title, author: meta.author, creator: 'Root Locus Studio', subject: 'Root-locus solution (R1–R7)' });
  const SCALE = 2.5;
  let css: string | null = null;
  try {
    css = await pageCss();
  } catch {
    css = null;
  }
  for (let i = 0; i < sheets.length; i++) {
    onProgress?.(i, sheets.length);
    const el = sheets[i];
    let canvas: HTMLCanvasElement;
    try {
      if (css === null) throw new Error('no css');
      canvas = await rasterSheet(el, css, SCALE);
    } catch {
      // fallback: per-node style inlining (slower, same result)
      const ms = await import('modern-screenshot');
      canvas = await ms.domToCanvas(el, {
        width: el.offsetWidth,
        height: el.offsetHeight,
        scale: SCALE,
        backgroundColor: '#ffffff',
        font: { preferredFormat: 'woff2' },
      });
    }
    if (i > 0) doc.addPage('a4', 'landscape');
    doc.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
  }
  onProgress?.(sheets.length, sheets.length);
  doc.save(name);
}
