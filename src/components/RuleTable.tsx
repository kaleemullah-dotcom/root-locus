import type { Solution } from '../engine';
import type { RuleId, RuleRow } from '../lib/content';
import { MiniSketch } from './MiniSketch';
import { Lines, MathText } from './Tex';
import { useMediaQuery } from '../lib/hooks';
import { useEffect, useState } from 'react';

interface Props {
  sol: Solution;
  rows: RuleRow[];
  selected: RuleId | null;
  onSelect: (r: RuleId | null) => void;
  /** number of rules revealed (teach mode); 7 = all */
  reveal?: number;
  /** render only the desktop table (export) */
  tableOnly?: boolean;
  /** traced locus for the R7 sketch (arrives later from the worker) */
  locus?: Solution['locus'];
}

export function RuleTable({ sol, rows, selected, onSelect, reveal = 7, tableOnly = false, locus }: Props) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const showTable = tableOnly || wide;
  // progressive rendering: two rules first, the rest in idle-time chunks (keeps the main thread free)
  const [count, setCount] = useState(showTable ? 7 : 1);
  useEffect(() => {
    setCount(showTable ? 7 : 1);
  }, [sol, showTable]);
  useEffect(() => {
    if (count >= rows.length) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(() => setCount((c) => c + 1), { timeout: 300 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), 16);
    return () => window.clearTimeout(t);
  }, [count, rows.length]);
  const visible = rows.slice(0, Math.min(reveal, count));
  // mobile cards: working collapsed by default (expanded for printing)
  const [open, setOpen] = useState<Set<RuleId>>(new Set());
  useEffect(() => {
    const all = (): void => setOpen(new Set(rows.map((r) => r.id)));
    window.addEventListener('beforeprint', all);
    return () => window.removeEventListener('beforeprint', all);
  }, [rows]);
  const toggle = (id: RuleId): void => onSelect(selected === id ? null : id);
  // staggered entry (CSS; disabled under prefers-reduced-motion)
  const anim = (i: number): { className: string; style: React.CSSProperties } => ({
    className: 'row-in',
    style: { animationDelay: `${50 + i * 70}ms` },
  });
  return (
    <>
      {showTable && (
      <div className="rule-table">
        <table className="rl" aria-label="Root-locus rules R1 to R7">
          <thead>
            <tr>
              <th scope="col" className="w-[64px]">Rule #</th>
              <th scope="col" className="w-[96px]">Name</th>
              <th scope="col" className="w-[17%]">Formula</th>
              <th scope="col">Calculations</th>
              <th scope="col" className="w-[15%]">Results</th>
              <th scope="col" className="w-[186px]">Plot</th>
              <th scope="col" className="w-[15%]">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr
                key={r.id}
                {...(tableOnly ? {} : anim(i))}
                aria-selected={selected === r.id}
                onClick={() => toggle(r.id)}
              >
                <td>
                  <button
                    type="button"
                    className="rounded px-1 font-bold text-navy hover:underline"
                    aria-pressed={selected === r.id}
                    aria-label={`${r.id} ${r.name}: highlight on the plot`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(r.id);
                    }}
                  >
                    {r.id}
                  </button>
                </td>
                <td className="f-blue font-medium">{r.name}</td>
                <td className="f-red">
                  <Lines lines={r.formula} />
                </td>
                <td>
                  <Lines lines={r.calc} />
                </td>
                <td className="f-blue">
                  <Lines lines={r.results} />
                </td>
                <td className="p-1">
                  <MiniSketch sol={sol} rule={r.id} locus={r.id === 'R7' ? locus : undefined} />
                </td>
                <td className="text-[12px] text-slate-700">
                  <MathText text={r.remarks} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {!showTable && (
        <div className="rule-cards space-y-3">
          {visible.map((r, i) => (
            <article
              key={`${r.id}-c`}
              style={anim(i).style}
              className={`row-in overflow-hidden rounded-lg border-2 bg-white ${selected === r.id ? 'border-amber-400' : 'border-grid'}`}
              aria-labelledby={`card-${r.id}`}
            >
              <button
                type="button"
                id={`card-${r.id}`}
                onClick={() => toggle(r.id)}
                aria-pressed={selected === r.id}
                className="flex w-full items-center justify-between bg-navy px-3 py-2 text-left text-white"
              >
                <span className="font-semibold">
                  {r.id} · {r.name}
                </span>
                <span className="text-xs opacity-80">{selected === r.id ? 'shown on plot' : 'tap to highlight'}</span>
              </button>
              <div className="grid gap-2 p-3 text-[13px] sm:grid-cols-[1fr_180px]">
                <div className="min-w-0 space-y-2">
                  <section>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Results</h3>
                    <Lines lines={r.results} className="f-blue overflow-x-auto" />
                  </section>
                  {open.has(r.id) && (
                    <>
                      <section>
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Formula</h3>
                        <Lines lines={r.formula} className="f-red overflow-x-auto" />
                      </section>
                      <section>
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Calculations</h3>
                        <Lines lines={r.calc} className="overflow-x-auto break-words" />
                      </section>
                      <p className="text-[12px] text-slate-700">
                        <MathText text={r.remarks} />
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-[12.5px] font-semibold text-navy underline-offset-2 hover:underline"
                    aria-expanded={open.has(r.id)}
                    onClick={() =>
                      setOpen((o) => {
                        const n = new Set(o);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  >
                    {open.has(r.id) ? 'Hide working ▴' : 'Show formula & working ▾'}
                  </button>
                </div>
                <div>
                  <MiniSketch sol={sol} rule={r.id} locus={r.id === 'R7' ? locus : undefined} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
