import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import type { Solution } from '../engine';
import type { RuleRow } from '../lib/content';
import { MainPlot } from './MainPlot';
import { RouthPanel } from './RouthPanel';
import { Lines, MathText } from './Tex';

/** Whiteboard-style walkthrough: one rule at a time, the plot builds up as you go. */
export function TeachMode({ sol, rows, step, setStep, title }: { sol: Solution; rows: RuleRow[]; step: number; setStep: (n: number) => void; title: string }) {
  const reduce = useReducedMotion();
  const total = rows.length + 1; // + Routh summary
  const r = rows[Math.min(step, rows.length - 1)];
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') setStep(Math.min(total - 1, step + 1));
      if (e.key === 'ArrowLeft') setStep(Math.max(0, step - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, setStep, total]);
  const isRouth = step >= rows.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-md border border-navy px-3 py-1.5 font-semibold text-navy disabled:opacity-40">
          ← Previous
        </button>
        <button type="button" onClick={() => setStep(Math.min(total - 1, step + 1))} disabled={step === total - 1} className="rounded-md bg-navy px-3 py-1.5 font-semibold text-white disabled:opacity-40">
          Next →
        </button>
        <ol className="ml-2 flex flex-wrap gap-1" aria-label="Steps">
          {[...rows.map((x) => x.id as string), 'Routh'].map((id, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i === step ? 'bg-navy text-white' : i < step ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
              >
                {id}
              </button>
            </li>
          ))}
        </ol>
        <span className="ml-auto text-xs text-slate-600">Tip: use ← → keys</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="min-w-0 rounded-lg border-2 border-grid bg-white"
            aria-live="polite"
          >
            {isRouth ? (
              <div className="p-4">
                <h3 className="mb-2 text-lg font-semibold text-navy">R7 working — Routh array</h3>
                <RouthPanel sol={sol} />
              </div>
            ) : (
              <div>
                <div className="bg-navy px-4 py-2 text-white">
                  <span className="text-lg font-semibold">
                    {r.id} · {r.name}
                  </span>
                </div>
                <div className="space-y-3 p-4 text-[14px]">
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Formula</h4>
                    <Lines lines={r.formula} className="f-red text-[15px]" />
                  </section>
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Working</h4>
                    <Lines lines={r.calc} />
                  </section>
                  <section className="rounded-md bg-blue-50 p-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Result</h4>
                    <Lines lines={r.results} className="f-blue text-[15px]" />
                  </section>
                  <p className="text-[13px] text-slate-700">
                    <MathText text={r.remarks} />
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
          <MainPlot sol={sol} reveal={isRouth ? 7 : step + 1} highlight={isRouth ? 'R7' : r.id} title={title} />
          <p className="px-2 pb-1 text-xs text-slate-600">The plot shows only what has been derived so far (rules 1 – {isRouth ? 7 : step + 1}).</p>
        </div>
      </div>
    </div>
  );
}
