import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputError, solveTF, type Solution, type TFInput } from './engine';
import { combinedView, emptyLocus, solveNegative } from './engine/solve';
import { useLocusWorker } from './lib/useLocusWorker';
import { closedLoopPoles } from './engine/stability';
import { factoredTex } from './engine/latex';
import { qlead } from './engine/qpoly';
import { buildRows, type RuleId } from './lib/content';
import { DEFAULT_EXAMPLE } from './lib/examples';
import { hashToInput, inputToHash } from './lib/urlState';
import { exportPdf, exportPng, exportSvg } from './lib/export';
import { InputCard } from './components/InputCard';
import { RuleTable } from './components/RuleTable';
import { RouthPanel } from './components/RouthPanel';
import { MainPlot, type KMode, type MainPlotHandle } from './components/MainPlot';
import { LegendPanel } from './components/LegendPanel';
import { KControl, kRange, type SimStatus } from './components/KControl';
const TeachMode = lazy(() => import('./components/TeachMode').then((m) => ({ default: m.TeachMode })));
import { Tex } from './components/Tex';
import { useIdleReady, useMediaQuery, useNearViewport } from './lib/hooks';

type View = 'solution' | 'teach';

function initialInput(): TFInput {
  const fromHash = typeof window !== 'undefined' ? hashToInput(window.location.hash) : null;
  return fromHash ?? { mode: 'nd', num: DEFAULT_EXAMPLE.num, den: DEFAULT_EXAMPLE.den };
}

function trySolve(inp: TFInput): { sol: Solution | null; error: string | null } {
  try {
    return { sol: solveTF(inp, { heavy: false }), error: null };
  } catch (e) {
    return { sol: null, error: e instanceof InputError || e instanceof Error ? e.message : String(e) };
  }
}

function defaultK(sol: Solution): number {
  const c = sol.cross.crossings[0]?.K;
  const b = sol.r5.accepted[0]?.K.re;
  if (c) return c * 0.5;
  if (b) return b * 2;
  const { lo, hi } = kRange(sol);
  return Math.sqrt(lo * hi);
}

/** Plain-text title like "G(s)H(s) = K / s(s+4)(s+5)". */
function plotTitle(sol: Solution): string {
  const strip = (t: string): string =>
    t
      .replace(/\^\{(\d+)\}/g, (_, d: string) => [...d].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]).join(''))
      .replace(/\s/g, '')
      .replace(/-/g, '−');
  const num = strip(factoredTex(sol.ol.zerosM, qlead(sol.ol.N).toNumber() / qlead(sol.ol.D).toNumber()));
  const den = strip(factoredTex(sol.ol.polesM, 1));
  return `Root locus of G(s)H(s) = K${num === '1' ? '' : '·' + num} / ${den}`;
}

export default function App() {
  const first = useMemo(() => ({ input: initialInput() }), []);
  const [input, setInput] = useState<TFInput>(first.input);
  const [sol, setSol] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RuleId | null>(null);
  const [K, setK] = useState<number>(1);
  const [playing, setPlaying] = useState(false);
  const [simStatus, setSimStatus] = useState<SimStatus | null>(null);
  const [kMode, setKModeRaw] = useState<KMode>('pos');
  const [view, setView] = useState<View>('solution');
  const [teachStep, setTeachStep] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const plotRef = useRef<MainPlotHandle>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const plotSection = useRef<HTMLElement>(null);
  const [plotVisible, setPlotVisible] = useState(false);

  const solve = useCallback((inp: TFInput) => {
    const r = trySolve(inp);
    setError(r.error);
    if (r.sol) {
      setSol(r.sol);
      setSelected(null);
      setPlaying(false);
      setTeachStep(0);
      setK(defaultK(r.sol));
      const h = inputToHash(inp);
      if (window.location.hash !== h) window.history.replaceState(null, '', h);
    }
  }, []);

  useEffect(() => {
    const onHash = (): void => {
      const inp = hashToInput(window.location.hash);
      if (inp) {
        setInput(inp);
        solve(inp);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [solve]);
  useEffect(() => {
    // solve after the first paint so the page shell appears immediately
    const t = window.setTimeout(() => solve(first.input), 0);
    return () => window.clearTimeout(t);
  }, [first, solve]);
  const idle = useIdleReady(sol);
  const mdUp = useMediaQuery('(min-width: 768px)');
  const routhSection = useRef<HTMLElement>(null);
  const routhNear = useNearViewport(routhSection, sol && view);
  const plotNear = useNearViewport(plotSection, sol && view);

  useEffect(() => {
    const el = plotSection.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setPlotVisible(es[0].isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [sol, view]);

  const rows = useMemo(() => (sol ? buildRows(sol) : []), [sol]);
  // K < 0 analysis (0° rules) — computed only when that range is shown
  const solNegBase = useMemo(() => (sol && kMode !== 'pos' ? solveNegative(sol) : null), [sol, kMode]);
  const plotView = useMemo(() => (sol ? combinedView(sol, solNegBase) : null), [sol, solNegBase]);
  const heavy = useLocusWorker(sol, kMode !== 'pos', plotView, solNegBase);
  const solNeg = useMemo(
    () => (solNegBase ? { ...solNegBase, locus: heavy?.locusNeg ?? emptyLocus(solNegBase.ol) } : null),
    [solNegBase, heavy],
  );
  const setKMode = (m: KMode): void => {
    setKModeRaw(m);
    if (!sol) return;
    if (m === 'pos' && K < 0) setK(defaultK(sol));
    if (m === 'neg' && K > 0) setK(-defaultK(solveNegative(sol)));
  };
  const solShown = useMemo(
    () =>
      sol && heavy
        ? { ...sol, locus: heavy.locus, locusNeg: heavy.locusNeg, stab: { ...sol.stab, numericCheck: heavy.numericCheck } }
        : sol,
    [sol, heavy],
  );
  const clPoles = useMemo(() => (sol ? closedLoopPoles(sol.ol, K) : []), [sol, K]);
  const title = useMemo(() => (sol ? plotTitle(sol) : ''), [sol]);

  const flash = (msg: string): void => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('Link copied — it opens this exact transfer function.');
    } catch {
      flash('Copy failed — use the address bar.');
    }
  };
  const doPdf = async (): Promise<void> => {
    if (!sol) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 120));
    try {
      if (exportRef.current) await exportPdf(exportRef.current, 'root-locus-solution.pdf', title.replace('Root locus of ', ''));
      flash('PDF downloaded.');
    } catch (e) {
      flash(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const tfTex = useMemo(() => {
    if (!sol) return '';
    const lead = qlead(sol.ol.N).toNumber() / qlead(sol.ol.D).toNumber();
    const num = factoredTex(sol.ol.zerosM, lead);
    return `G(s)H(s) = \\dfrac{${num === '1' ? 'K' : `K\\,${num}`}}{${factoredTex(sol.ol.polesM, 1)}}`;
  }, [sol]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to solution
      </a>
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1880px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden className="shrink-0">
            <rect width="64" height="64" rx="12" fill="#2a4c8a" />
            <path d="M8 32h48M32 8v48" stroke="#8fa3c7" strokeWidth="2" />
            <path d="M20 32c4-14 10-20 24-22M20 32c4 14 10 20 24 22" fill="none" stroke="#7fb0ff" strokeWidth="4" strokeLinecap="round" />
            <path d="M15 27l10 10M25 27L15 37" stroke="#ff8787" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight sm:text-xl">Root Locus Studio</h1>
            <p className="text-[12.5px] font-medium text-blue-100 sm:text-[13px]">Designed by Kaleem Ullah (CE-45 A)</p>
          </div>
          <div className="no-print ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
              Copy link
            </button>
            <button type="button" onClick={doPdf} disabled={!sol || exporting} className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-blue-50 disabled:opacity-60">
              {exporting ? 'Building PDF…' : 'Export PDF'}
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
              Print
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1880px] grid-cols-[minmax(0,1fr)] gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="no-print rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4" aria-label="Input">
          <InputCard input={input} setInput={setInput} onSolve={solve} error={error} warnings={sol?.tf.warnings ?? []} />
        </aside>

        <main id="main" className="min-w-0 space-y-4">
          {sol && solShown && (
            <>
              <div className="no-print sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div role="tablist" aria-label="View" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                  {(
                    [
                      ['solution', 'Full solution'],
                      ['teach', 'Step-by-step'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      type="button"
                      aria-selected={view === id}
                      onClick={() => setView(id)}
                      className={`rounded-md px-3 py-1 font-medium ${view === id ? 'bg-white text-navy shadow' : 'text-slate-600 hover:text-navy'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {view === 'solution' && (
                  <nav aria-label="Sections" className="flex gap-1 text-sm">
                    {[
                      ['#sec-table', 'Table'],
                      ['#sec-routh', 'Routh'],
                      ['#sec-plot', 'Plot'],
                    ].map(([href, l]) => (
                      <a key={href} href={href} onClick={(e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-md px-2.5 py-1 font-medium text-navy hover:bg-navy-50">
                        {l}
                      </a>
                    ))}
                  </nav>
                )}
                {mdUp && (
                  <div className="ml-auto min-w-0 truncate text-[13px] text-slate-600">
                    <Tex tex={tfTex} />
                  </div>
                )}
              </div>

              {view === 'teach' ? (
                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Step-by-step solution">
                  <Suspense fallback={<div className="h-96 rounded bg-slate-100" />}>
                    <TeachMode sol={solShown} rows={rows} step={teachStep} setStep={setTeachStep} title={title} />
                  </Suspense>
                </section>
              ) : (
                <>
                  <section id="sec-table" className="print-section scroll-mt-16 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-labelledby="h-table">
                    <h2 id="h-table" className="mb-1 overflow-x-auto overflow-y-hidden text-lg font-semibold">
                      <Tex tex={tfTex} />
                    </h2>
                    <p className="mb-3 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[13px] text-slate-600">
                      <span className="f-red font-semibold">Poles:</span>{' '}
                      {sol.ol.poles.map((z, i) => (
                        <span key={i} className="num mr-2 whitespace-nowrap">
                          P<sub>{i + 1}</sub> = {fmtC(z)}
                        </span>
                      ))}
                      <span className="f-red ml-2 font-semibold">Zeros:</span>{' '}
                      {sol.ol.zeros.length
                        ? sol.ol.zeros.map((z, i) => (
                            <span key={i} className="num mr-2 whitespace-nowrap">
                              z<sub>{i + 1}</sub> = {fmtC(z)}
                            </span>
                          ))
                        : 'none'}
                      <span className="ml-2 whitespace-nowrap">
                        n = {sol.ol.n}, m = {sol.ol.m}
                      </span>
                      <span className="no-print ml-2 text-slate-600">· Click a rule to highlight it on the plot.</span>
                    </p>
                    <RuleTable sol={sol} rows={rows} selected={selected} onSelect={setSelected} locus={solShown.locus} />
                  </section>

                  <section ref={routhSection} id="sec-routh" className="print-section scroll-mt-16 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-labelledby="h-routh">
                    <h2 id="h-routh" className="mb-3 text-lg font-semibold">
                      R7 working — Routh array
                    </h2>
                    {idle && routhNear ? <RouthPanel sol={solShown} /> : <div className="h-40 rounded bg-slate-100" />}
                  </section>

                  <section ref={plotSection} id="sec-plot" className="print-section scroll-mt-16 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-labelledby="h-plot">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 id="h-plot" className="text-lg font-semibold">
                        Final root locus
                      </h2>
                      <span className="text-[12px] text-slate-600">
                        {kMode === 'pos' ? 'K: 0 → +∞' : kMode === 'neg' ? 'K: 0 → −∞' : 'K: −∞ … 0 … +∞'} · drag to pan, Ctrl/⌘ + wheel or pinch to zoom, double-click to reset
                      </span>
                      <div className="no-print ml-auto flex flex-wrap gap-2 text-sm">
                        <button type="button" className="rounded-md border border-slate-300 px-2.5 py-1 font-medium hover:bg-slate-50" onClick={() => { const s = plotRef.current?.svg(); if (s) void exportPng(s); }}>
                          PNG
                        </button>
                        <button type="button" className="rounded-md border border-slate-300 px-2.5 py-1 font-medium hover:bg-slate-50" onClick={() => { const s = plotRef.current?.svg(); if (s) exportSvg(s); }}>
                          SVG
                        </button>
                      </div>
                    </div>
                    {idle && plotNear ? (
                    <>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
                      <div className="min-w-0">
                        <MainPlot
                          ref={plotRef}
                          sol={solShown}
                          solNeg={solNeg}
                          kMode={kMode}
                          baseView={plotView ?? undefined}
                          clPoles={clPoles}
                          clNegative={K < 0}
                          simK={K}
                          simStatus={simStatus}
                          highlight={selected}
                          title={title}
                        />
                      </div>
                      <div className="no-print rounded-lg border border-slate-200 bg-slate-50 p-3 xl:sticky xl:top-16" aria-label="Simulation">
                        <KControl
                          sol={solShown}
                          solNeg={solNeg}
                          mode={kMode}
                          setMode={setKMode}
                          K={K}
                          setK={setK}
                          playing={playing}
                          setPlaying={setPlaying}
                          clPoles={clPoles}
                          onStatus={setSimStatus}
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <LegendPanel sol={sol} rows={rows} selected={selected} onSelect={setSelected} columns />
                    </div>
                    </>
                    ) : (
                      <div className="h-[480px] rounded bg-slate-100" />
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {!sol && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600" aria-busy={!error}>
              {error ? 'Fix the input and press Solve.' : 'Computing the root locus…'}
            </div>
          )}
        </main>
      </div>

      {sol && solShown && view === 'solution' && selected && !plotVisible && (
        <div className="no-print fixed bottom-3 right-3 z-30 w-[min(380px,calc(100vw-24px))] rounded-xl border border-amber-300 bg-white p-2 shadow-2xl" role="dialog" aria-label={`${selected} on the plot`}>
          <div className="mb-1 flex items-center justify-between px-1 text-[13px] font-semibold text-navy">
            <span>{selected} on the plot</span>
            <span className="flex gap-1">
              <button type="button" className="rounded px-2 py-0.5 hover:bg-slate-100" onClick={() => document.getElementById('sec-plot')?.scrollIntoView({ behavior: 'smooth' })}>
                Go to plot ↓
              </button>
              <button type="button" aria-label="Close preview" className="rounded px-2 py-0.5 hover:bg-slate-100" onClick={() => setSelected(null)}>
                ✕
              </button>
            </span>
          </div>
          <MainPlot sol={solShown} highlight={selected} bare />
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {exporting && sol && solShown && (
        <div ref={exportRef} aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: 1500, background: '#fff' }}>
          <div data-pdf-page="Rule table" style={{ padding: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              <Tex tex={tfTex} />
            </h2>
            <RuleTable sol={sol} rows={rows} selected={null} onSelect={() => undefined} tableOnly locus={solShown.locus} />
          </div>
          <div data-pdf-page="Routh array" style={{ padding: 8, width: 1100 }}>
            <RouthPanel sol={sol} />
          </div>
          <div data-pdf-page="Root locus" style={{ display: 'flex', gap: 16, padding: 8 }}>
            <div style={{ width: 900 }}>
              <MainPlot sol={solShown} solNeg={solNeg} kMode={kMode} baseView={plotView ?? undefined} title={title} fixedWidth={900} pdfVector bare />
            </div>
            <div data-pdf-side style={{ width: 460 }}>
              <LegendPanel sol={sol} rows={rows} />
            </div>
          </div>
        </div>
      )}
      <footer className="no-print mx-auto max-w-[1880px] px-6 pb-6 text-center text-[12px] text-slate-600">
        Root Locus Studio · designed by Kaleem Ullah (CE-45 A) · exact engine verified against python-control
      </footer>
    </div>
  );
}

function fmtC(z: { re: number; im: number }): string {
  const r = (x: number): string => (Math.round(x * 1000) / 1000).toString().replace('-', '−');
  if (z.im === 0) return r(z.re);
  return `${z.re === 0 ? '' : r(z.re) + ' '}${z.im < 0 ? '−' : '+'} j${r(Math.abs(z.im))}`;
}
