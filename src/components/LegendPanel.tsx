import type { Solution } from '../engine';
import type { RuleId, RuleRow } from '../lib/content';
import { describe } from '../lib/describe';
import { Lines, MathText } from './Tex';

function Key({ kind, label }: { kind: string; label: string }) {
  const icon = (() => {
    switch (kind) {
      case 'pole':
        return <path d="M4 4l10 10M4 14L14 4" stroke="#c92a2a" strokeWidth={2.4} strokeLinecap="round" />;
      case 'zero':
        return <circle cx={9} cy={9} r={5} fill="#fff" stroke="#c92a2a" strokeWidth={2} />;
      case 'locus':
        return <line x1={1} y1={9} x2={17} y2={9} stroke="#2a6fdb" strokeWidth={3} />;
      case 'asym':
        return <line x1={1} y1={9} x2={17} y2={9} stroke="#e8590c" strokeWidth={2} strokeDasharray="4 3" />;
      case 'centroid':
        return <rect x={5} y={5} width={8} height={8} transform="rotate(45 9 9)" fill="#e8590c" />;
      case 'brk':
        return <circle cx={9} cy={9} r={5} fill="#2b8a3e" />;
      case 'cross':
        return <circle cx={9} cy={9} r={5} fill="#7b2cbf" />;
      case 'comp':
        return <line x1={1} y1={9} x2={17} y2={9} stroke="#94a3b8" strokeWidth={2} strokeDasharray="3 2" />;
      default:
        return <circle cx={9} cy={9} r={6} fill="#fab005" stroke="#212529" />;
    }
  })();
  return (
    <li className="flex items-center gap-1.5">
      <svg width={18} height={18} aria-hidden>
        {icon}
      </svg>
      {label}
    </li>
  );
}

export function PlotKeys({ sol, showComp, showK }: { sol: Solution; showComp: boolean; showK: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-700" aria-label="Plot legend">
      <Key kind="pole" label="Open-loop poles" />
      {sol.ol.m > 0 && <Key kind="zero" label="Open-loop zeros" />}
      <Key kind="locus" label="Root locus (K: 0 → ∞)" />
      {sol.ol.q >= 2 && <Key kind="asym" label="Asymptotes" />}
      {sol.ol.q >= 2 && <Key kind="centroid" label="Centroid σ" />}
      {sol.r5.accepted.length > 0 && <Key kind="brk" label="Breakaway / entry" />}
      {sol.cross.crossings.length > 0 && <Key kind="cross" label="jω crossing" />}
      {showComp && <Key kind="comp" label="Complementary (K < 0)" />}
      {showK && <Key kind="cl" label="Closed-loop poles at K" />}
    </ul>
  );
}

export function LegendPanel({
  sol,
  rows,
  onSelect,
  selected,
}: {
  sol: Solution;
  rows: RuleRow[];
  onSelect?: (r: RuleId | null) => void;
  selected?: RuleId | null;
}) {
  return (
    <div className="space-y-3">
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
