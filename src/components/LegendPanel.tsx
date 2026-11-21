import type { Solution } from '../engine';
import type { RuleId, RuleRow } from '../lib/content';
import { describe } from '../lib/describe';
import { Lines, MathText } from './Tex';

export function LegendPanel({
  sol,
  rows,
  onSelect,
  selected,
  columns = false,
}: {
  sol: Solution;
  rows: RuleRow[];
  onSelect?: (r: RuleId | null) => void;
  selected?: RuleId | null;
  /** results table and description side by side */
  columns?: boolean;
}) {
  return (
    <div className={columns ? 'grid gap-4 md:grid-cols-2' : 'space-y-3'}>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Results summary (legend)</h3>
        <table className="sum">
          <thead>
            <tr>
              <th scope="col" className="w-[58px]">Rule #</th>
              <th scope="col">Results</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected === r.id ? 'bg-amber-50' : ''}>
                <td>
                  {onSelect ? (
                    <button type="button" className="font-bold text-navy hover:underline" aria-pressed={selected === r.id} onClick={() => onSelect(selected === r.id ? null : r.id)}>
                      {r.id}
                    </button>
                  ) : (
                    <b>{r.id}</b>
                  )}
                </td>
                <td className="f-blue">
                  <Lines lines={r.results} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Plot description</h3>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-snug">
          {describe(sol).map((t, i) => (
            <li key={i}>
              <MathText text={t} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
