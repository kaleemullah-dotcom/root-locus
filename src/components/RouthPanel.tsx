import type { Solution } from '../engine';
import { polyTex, routhEntryTex, fnum, fcomplex } from '../engine/latex';
import { charEqTex, conditionLines, stabilityText } from '../lib/content';
import { Lines, MathText, Tex } from './Tex';

export function RouthPanel({ sol }: { sol: Solution }) {
  const { routh, cross } = sol;
  const lastNonZero = (row: (typeof routh.rows)[number]): number => {
    let k = row.entries.length;
    while (k > 1 && row.entries[k - 1].val.n.length === 0) k--;
    return k;
  };
  const cols = Math.max(...routh.rows.map(lastNonZero));
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 max-w-full overflow-x-auto">
        <p className="mb-2 text-[13px] text-slate-600">
          Characteristic equation: <Tex tex={charEqTex(sol)} />
        </p>
        <table className="routh" aria-label="Routh array">
          <tbody>
            {routh.rows.map((r, i) => (
              <tr key={r.power} className={`${i === 1 ? 'sep' : ''} ${r.special ? 'special' : ''}`}>
                <th scope="row">
                  <Tex tex={`s^{${r.power}}`} />
                </th>
                {r.entries.slice(0, cols).map((e, j) => (
                  <td key={j}>{j < lastNonZero(r) ? <Tex tex={routhEntryTex(e)} /> : null}</td>
                ))}
                <td className="text-[11px] text-orange-700">
                  {r.special === 'epsilon' ? 'ε replaces 0' : r.special === 'aux' ? `from dA/ds (row s^${r.aux?.power})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="min-w-0 flex-1 basis-[280px] space-y-2 overflow-x-auto text-[13.5px] leading-relaxed">
        <h3 className="font-semibold">Stability conditions (first column &gt; 0)</h3>
        {conditionLines(sol).length ? (
          <Lines lines={conditionLines(sol)} />
        ) : (
          <p>The first column has no K terms.</p>
        )}
        <p className="font-semibold text-green-800">
          <span aria-hidden>✔ </span>
          {stabilityText(sol)}
          {sol.stab.conditionallyStable ? ' (conditionally stable)' : ''}
        </p>
        {cross.crossings.map((c, i) => (
          <div key={i} className="rounded-md bg-violet-50 p-2">
            <MathText
              text={`**Crossing ${cross.crossings.length > 1 ? i + 1 : ''}:** $K_x = ${fnum(c.K, 3)}$` + (c.routhPower !== null ? ` (row $s^{${c.routhPower}}$ vanishes)` : '')}
            />
            {c.aux && c.auxPower !== null && (
              <div>
                <MathText text={`Auxiliary equation ($s^{${c.auxPower}}$ row, $K = K_x$): $${polyTex(c.aux, 's', 3)} = 0$`} />
                <div>
                  <MathText
                    text={`$\\Rightarrow$ **$s_x = \\pm j${fnum(c.omega, 3)}$** (roots: ${(c.auxRoots ?? []).map((z) => `$${fcomplex(z, 3)}$`).join(', ')})`}
                  />
                </div>
              </div>
            )}
            {!c.aux && <MathText text={`**$s_x = \\pm j${fnum(c.omega, 3)}$**`} />}
          </div>
        ))}
        {cross.originK !== null && (
          <p>
            <MathText text={`A real root passes through $s = 0$ at $K = ${fnum(cross.originK, 3)}$ (the $s^0$ entry changes sign).`} />
          </p>
        )}
        {cross.jwSegments.length > 0 && (
          <p>
            <MathText text="$D(j\omega)/N(j\omega)$ is real for every ω: part of the jω axis lies on the locus (marginal stability)." />
          </p>
        )}
        {routh.notes.length > 0 && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-2 text-[12.5px]">
            <h4 className="font-semibold text-orange-800">Special cases</h4>
            {routh.notes.map((n, i) => (
              <p key={i}>
                <MathText text={n.replace(/s\^(\d+)/g, '$s^{$1}$')} />
              </p>
            ))}
          </div>
        )}
        <details className="text-[12.5px] text-slate-600">
          <summary className="cursor-pointer select-none font-medium text-navy">How the K ranges were verified</summary>
          <p className="mt-1">
            Each interval between candidate boundaries was tested exactly with a rational K (Routh–Hurwitz over the rationals),
            then cross-checked by a numeric scan of {sol.stab.numericCheck.points} values of K:{' '}
            <strong>{sol.stab.numericCheck.mismatches === 0 ? 'all agree' : `${sol.stab.numericCheck.mismatches} disagreements`}</strong>.
          </p>
        </details>
      </div>
    </div>
  );
}
