import { useMemo, useState } from 'react';
import { buildTF, InputError, makeOpenLoop, type TFInput } from '../engine';
import { factoredTex, polyTex } from '../engine/latex';
import { qlead } from '../engine/qpoly';
import { EXAMPLES, type Example } from '../lib/examples';
import { Tex } from './Tex';

interface Props {
  input: TFInput;
  setInput: (i: TFInput) => void;
  onSolve: (i: TFInput) => void;
  error: string | null;
  warnings: string[];
}

const MODES: Array<{ id: TFInput['mode']; label: string }> = [
  { id: 'nd', label: 'N(s) / D(s)' },
  { id: 'string', label: 'One line' },
  { id: 'pz', label: 'Poles & zeros' },
];

function convert(inp: TFInput, mode: TFInput['mode']): TFInput {
  if (inp.mode === mode) return inp;
  try {
    const tf = buildTF(inp);
    const ol = makeOpenLoop(tf.N, tf.D);
    const num = polyTex(tf.N).replace(/[{}]/g, '');
    const den = polyTex(tf.D).replace(/[{}]/g, '');
    if (mode === 'nd') return { mode, num, den };
    if (mode === 'string') return { mode, expr: `K(${num})/(${den})` };
    const list = (rs: typeof ol.poles): string => rs.map((z) => (z.im === 0 ? `${+z.re.toFixed(6)}` : `${+z.re.toFixed(6)}${z.im < 0 ? '-' : '+'}${+Math.abs(z.im).toFixed(6)}j`)).join(', ');
    const gain = qlead(tf.N).div(qlead(tf.D)).toNumber();
    return { mode, zeros: list(ol.zeros), poles: list(ol.poles), gain: String(+gain.toPrecision(10)) };
  } catch {
    return mode === 'nd' ? { mode, num: '1', den: 's(s+4)(s+5)' } : mode === 'string' ? { mode, expr: 'K/(s(s+4)(s+5))' } : { mode, zeros: '', poles: '0, -4, -5', gain: '1' };
  }
}

export function InputCard({ input, setInput, onSolve, error, warnings }: Props) {
  const [exampleId, setExampleId] = useState('');
  const preview = useMemo(() => {
    try {
      const tf = buildTF(input);
      const ol = makeOpenLoop(tf.N, tf.D);
      const lead = qlead(tf.N).toNumber(),
        dl = qlead(tf.D).toNumber();
      const num = factoredTex(ol.zerosM, lead / dl);
      const den = factoredTex(ol.polesM, 1);
      const kn = num === '1' ? 'K' : num.startsWith('-') ? `-K${num.slice(1) === '1' ? '' : `\\,${num.slice(1)}`}` : `K\\,${num}`;
      return { tex: `G(s)H(s) = \\dfrac{${kn}}{${den}}`, err: null as string | null };
    } catch (e) {
      return { tex: null, err: e instanceof InputError ? e.message : (e as Error).message };
    }
  }, [input]);
  const pick = (ex: Example): void => {
    const inp: TFInput = { mode: 'nd', num: ex.num, den: ex.den };
    setInput(inp);
    onSolve(inp);
  };
  const groups = [...new Set(EXAMPLES.map((e) => e.group))];
  const field = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-[15px] shadow-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30';
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') onSolve(input);
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSolve(input);
      }}
      aria-label="Transfer function input"
    >
      <div>
        <label htmlFor="examples" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
          Examples
        </label>
        <select
          id="examples"
          className={field + ' font-sans text-sm'}
          value={exampleId}
          onChange={(e) => {
            setExampleId(e.target.value);
            const ex = EXAMPLES.find((x) => x.id === e.target.value);
            if (ex) pick(ex);
          }}
        >
          <option value="">— choose an example —</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {EXAMPLES.filter((e) => e.group === g).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div role="radiogroup" aria-label="Input mode" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-[13px]">
        {MODES.map((m) => (
          <button
            type="button"
            role="radio"
            aria-checked={input.mode === m.id}
            key={m.id}
            onClick={() => setInput(convert(input, m.id))}
            className={`rounded-md px-2 py-1.5 font-medium ${input.mode === m.id ? 'bg-white text-navy shadow' : 'text-slate-600 hover:text-navy'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {input.mode === 'nd' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="num" className="mb-1 block text-sm font-medium text-slate-700">
              Numerator N(s) <span className="font-normal text-slate-600">(G(s)H(s) = K·N/D)</span>
            </label>
            <input id="num" className={field} value={input.num} spellCheck={false} autoComplete="off" onKeyDown={onKey} onChange={(e) => setInput({ ...input, num: e.target.value })} aria-describedby="tfhelp" />
          </div>
          <div>
            <label htmlFor="den" className="mb-1 block text-sm font-medium text-slate-700">
              Denominator D(s)
            </label>
            <input id="den" className={field} value={input.den} spellCheck={false} autoComplete="off" onKeyDown={onKey} onChange={(e) => setInput({ ...input, den: e.target.value })} aria-describedby="tfhelp" />
          </div>
        </div>
      )}
      {input.mode === 'string' && (
        <div>
          <label htmlFor="expr" className="mb-1 block text-sm font-medium text-slate-700">
            G(s)H(s)
          </label>
          <input id="expr" className={field} value={input.expr} spellCheck={false} autoComplete="off" onKeyDown={onKey} onChange={(e) => setInput({ ...input, expr: e.target.value })} aria-describedby="tfhelp" />
        </div>
      )}
      {input.mode === 'pz' && (
        <div className="space-y-2">
          {(
            [
              ['poles', 'Poles', '0, -4, -1+2j'],
              ['zeros', 'Zeros', 'none'],
              ['gain', 'Gain (multiplies K)', '1'],
            ] as const
          ).map(([k, label, ph]) => (
            <div key={k}>
              <label htmlFor={`pz-${k}`} className="mb-1 block text-sm font-medium text-slate-700">
                {label}
              </label>
              <input
                id={`pz-${k}`}
                className={field}
                placeholder={ph}
                value={input[k]}
                spellCheck={false}
                autoComplete="off"
                onKeyDown={onKey}
                onChange={(e) => setInput({ ...input, [k]: e.target.value })}
                aria-describedby="tfhelp"
              />
            </div>
          ))}
        </div>
      )}

      <div className="min-h-[56px] rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2" aria-live="polite">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Preview</div>
        {preview.tex ? (
          <div className="overflow-x-auto py-1 text-[15px]">
            <Tex tex={preview.tex} display />
          </div>
        ) : (
          <p className="text-sm text-red-700">⚠ {preview.err}</p>
        )}
      </div>

      <button type="submit" className="w-full rounded-md bg-navy px-4 py-2.5 text-[15px] font-semibold text-white shadow hover:bg-navy-600">
        Solve
      </button>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-800">
          ⚠ {error}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-[12.5px] text-amber-900" aria-label="Notices">
          {warnings.map((w, i) => (
            <li key={i}>ℹ {w}</li>
          ))}
        </ul>
      )}
      <p id="tfhelp" className="text-[12px] leading-relaxed text-slate-600">
        Products or polynomials: <code className="rounded bg-slate-100 px-1">s(s+3)(s^2+2s+2)</code>,{' '}
        <code className="rounded bg-slate-100 px-1">(s+1)^2(s+4)</code>, <code className="rounded bg-slate-100 px-1">2(s+3)</code>.
        Implicit multiplication, decimals and <code className="rounded bg-slate-100 px-1">^</code> powers are allowed.
        Lists accept complex values such as <code className="rounded bg-slate-100 px-1">-1+2j</code>. Press Enter to solve.
      </p>
    </form>
  );
}
