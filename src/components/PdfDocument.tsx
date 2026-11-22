/**
 * Off-screen A4-landscape document used for the PDF export.
 *
 * The document is one continuous flow of blocks — document header (first page only), the
 * rule-table rows, the Routh section and the final plot — packed onto plain A4 sheets.
 * Phase 1 renders every block at the final width and measures it; phase 2 places blocks
 * page by page (a block that does not fit moves to the next page; table rows are never
 * split and the column header repeats when the table continues).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Solution, ViewBox } from '../engine';
import type { RuleRow } from '../lib/content';
import { LegendPanel } from './LegendPanel';
import { MainPlot, type KMode } from './MainPlot';
import { MiniSketch } from './MiniSketch';
import { RouthPanel } from './RouthPanel';
import { Lines, MathText, Tex } from './Tex';

/** A4 landscape at 96 CSS px per inch. */
export const A4 = { w: 1123, h: 794 } as const;
const PAD = 36;
const CONTENT_W = A4.w - 2 * PAD;
const CONTENT_H = A4.h - 2 * PAD;
const GAP = 14;

interface Props {
  sol: Solution;
  solShown: Solution;
  solNeg: Solution | null;
  kMode: KMode;
  plotView?: ViewBox;
  rows: RuleRow[];
  title: string;
  tfTex: string;
  /** called once every sheet is laid out and fonts are ready */
  onReady: (root: HTMLElement) => void;
}

const FONT = 'Inter, system-ui, Arial, sans-serif';

function DocHeader({ sol, tfTex }: { sol: Solution; tfTex: string }) {
  const f = (z: { re: number; im: number }): string => {
    const r = (x: number): string => (Math.round(x * 1000) / 1000).toString().replace('-', '−');
    return z.im === 0 ? r(z.re) : `${z.re === 0 ? '' : r(z.re) + ' '}${z.im < 0 ? '−' : '+'} j${r(Math.abs(z.im))}`;
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1f3b6e', paddingBottom: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1f3b6e', lineHeight: 1.15 }}>Root Locus Studio — Root-locus solution</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>7-rule method (R1 – R7) · Routh array · final root locus</div>
        </div>
        <div style={{ fontSize: 12, color: '#475569', textAlign: 'right' }}>
          Developed by Kaleem Ullah (CE-45 A)
          <br />
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div style={{ fontSize: 19, marginTop: 10 }}>
        <Tex tex={tfTex} />
      </div>
      <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
        <b style={{ color: '#b02a2a' }}>Poles: </b>
        {sol.ol.poles.map((z, i) => (
          <span key={i} style={{ marginRight: 10 }}>
            P<sub>{i + 1}</sub> = {f(z)}
          </span>
        ))}
        <b style={{ color: '#b02a2a', marginLeft: 6 }}>Zeros: </b>
        {sol.ol.zeros.length
          ? sol.ol.zeros.map((z, i) => (
              <span key={i} style={{ marginRight: 10 }}>
                z<sub>{i + 1}</sub> = {f(z)}
              </span>
            ))
          : 'none'}
        <span style={{ marginLeft: 6 }}>
          n = {sol.ol.n}, m = {sol.ol.m}
        </span>
      </div>
    </div>
  );
}

const COLS = [56, 92, 168, undefined, 150, 150, 150] as const;

function TableHead() {
  return (
    <>
      <colgroup>
        {COLS.map((w, i) => (
          <col key={i} style={w ? { width: w } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {['Rule #', 'Name', 'Formula', 'Calculations', 'Results', 'Plot', 'Remarks'].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
    </>
  );
}

function Row({ r, sol, locus }: { r: RuleRow; sol: Solution; locus: Solution['locus'] }) {
  return (
    <tr>
      <td>
        <b style={{ color: '#1f3b6e' }}>{r.id}</b>
      </td>
      <td className="f-blue" style={{ fontWeight: 500 }}>
        {r.name}
      </td>
      <td className="f-red">
        <Lines lines={r.formula} />
      </td>
      <td>
        <Lines lines={r.calc} />
      </td>
      <td className="f-blue">
        <Lines lines={r.results} />
      </td>
      <td style={{ padding: 3 }}>
        <MiniSketch sol={sol} rule={r.id} locus={r.id === 'R7' ? locus : undefined} />
      </td>
      <td style={{ fontSize: 11, color: '#334155' }}>
        <MathText text={r.remarks} />
      </td>
    </tr>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 15, fontWeight: 700, color: '#1f3b6e', borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 8 }}>{children}</div>
);

type Block = { kind: 'header' } | { kind: 'row'; i: number } | { kind: 'routh' } | { kind: 'plot' };

export function PdfDocument({ sol, solShown, solNeg, kMode, plotView, rows, title, tfTex, onReady }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Block[][] | null>(null);
  const fired = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const blocks: Block[] = [{ kind: 'header' }, ...rows.map((_, i) => ({ kind: 'row' as const, i })), { kind: 'routh' }, { kind: 'plot' }];

  const renderBlock = (b: Block): React.ReactNode => {
    switch (b.kind) {
      case 'header':
        return <DocHeader sol={sol} tfTex={tfTex} />;
      case 'routh':
        return (
          <div>
            <SectionTitle>R7 working — Routh array and stability</SectionTitle>
            <RouthPanel sol={solShown} print />
          </div>
        );
      case 'plot':
        return (
          <div>
            <SectionTitle>Final root locus</SectionTitle>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <div style={{ width: 620, flexShrink: 0 }}>
                <MainPlot sol={solShown} solNeg={solNeg} kMode={kMode} baseView={plotView} title={title} fixedWidth={620} bare />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                <LegendPanel sol={sol} rows={rows} />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // ---- phase 1: measure every block, then pack blocks onto pages
  useLayoutEffect(() => {
    if (pages) return;
    const el = measureRef.current;
    if (!el) return;
    const hOf = (sel: string): number => (el.querySelector(sel) as HTMLElement).offsetHeight;
    const headerH = hOf('[data-m="header"]');
    const theadH = hOf('thead');
    const rowH = [...el.querySelectorAll('tbody tr')].map((tr) => (tr as HTMLElement).offsetHeight);
    const routhH = hOf('[data-m="routh"]');
    const plotH = hOf('[data-m="plot"]');
    const height = (b: Block): number => (b.kind === 'header' ? headerH : b.kind === 'row' ? rowH[b.i] : b.kind === 'routh' ? routhH : plotH);

    const out: Block[][] = [];
    let cur: Block[] = [];
    let used = 0;
    for (const b of blocks) {
      const prev = cur[cur.length - 1];
      const startsTable = b.kind === 'row' && (!prev || prev.kind !== 'row');
      const need = height(b) + (startsTable ? theadH : 0) + (cur.length && (!prev || prev.kind !== 'row' || b.kind !== 'row') ? GAP : 0);
      if (cur.length && used + need > CONTENT_H) {
        out.push(cur);
        cur = [];
        used = 0;
        const again = height(b) + (b.kind === 'row' ? theadH : 0);
        cur.push(b);
        used = again;
        continue;
      }
      cur.push(b);
      used += need;
    }
    if (cur.length) out.push(cur);
    setPages(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // ---- phase 2: wait for fonts, shrink any page that is still too tall, then hand over
  useEffect(() => {
    if (!pages) return;
    let cancelled = false;
    void (async () => {
      await document.fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const root = rootRef.current;
      if (!root || cancelled) return;
      root.querySelectorAll<HTMLElement>('[data-pdf-content]').forEach((c) => {
        const s = Math.min(1, CONTENT_H / c.scrollHeight, CONTENT_W / c.scrollWidth);
        if (s < 1) {
          c.style.transform = `scale(${s})`;
          c.style.width = `${CONTENT_W / s}px`;
        }
      });
      if (!cancelled && !fired.current) {
        fired.current = true;
        readyRef.current(root);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pages]);

  if (!pages)
    return (
      <div ref={measureRef} style={{ width: CONTENT_W, fontFamily: FONT }}>
        <div data-m="header">{renderBlock({ kind: 'header' })}</div>
        <table className="rl rl-pdf">
          <TableHead />
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} r={r} sol={sol} locus={solShown.locus} />
            ))}
          </tbody>
        </table>
        <div data-m="routh">{renderBlock({ kind: 'routh' })}</div>
        <div data-m="plot">{renderBlock({ kind: 'plot' })}</div>
      </div>
    );

  /** Render a page: consecutive rows become one table with its column header. */
  const renderPage = (bs: Block[]): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < bs.length) {
      const b = bs[i];
      if (b.kind === 'row') {
        const run: number[] = [];
        while (i < bs.length && bs[i].kind === 'row') run.push((bs[i++] as { kind: 'row'; i: number }).i);
        out.push(
          <table key={`t${run[0]}`} className="rl rl-pdf" style={{ marginTop: out.length ? GAP : 0 }}>
            <TableHead />
            <tbody>
              {run.map((k) => (
                <Row key={rows[k].id} r={rows[k]} sol={sol} locus={solShown.locus} />
              ))}
            </tbody>
          </table>,
        );
      } else {
        out.push(
          <div key={b.kind} style={{ marginTop: out.length ? GAP : 0 }}>
            {renderBlock(b)}
          </div>,
        );
        i++;
      }
    }
    return out;
  };

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pages.map((bs, pi) => (
        <div
          key={pi}
          data-pdf-a4=""
          style={{ width: A4.w, height: A4.h, padding: PAD, boxSizing: 'border-box', background: '#ffffff', fontFamily: FONT, color: '#1b1f24', overflow: 'hidden' }}
        >
          <div data-pdf-content="" style={{ transformOrigin: 'top left', width: CONTENT_W }}>
            {renderPage(bs)}
          </div>
        </div>
      ))}
    </div>
  );
}
