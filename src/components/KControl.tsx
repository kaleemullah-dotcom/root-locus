import { useEffect, useMemo, useRef } from 'react';
import { useMediaQuery } from '../lib/hooks';
import type { Complex, Solution } from '../engine';
import { poleInfo, stepResponse } from '../engine/closedloop';
import { fcomplex, tnum } from '../engine/latex';

interface Props {
  sol: Solution;
  K: number;
  setK: (k: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  clPoles: Complex[];
}

/** Slider range: from well below the first interesting K to past the last one. */
export function kRange(sol: Solution): { lo: number; hi: number } {
  const marks = [
    ...sol.r5.accepted.map((c) => c.K.re),
    ...sol.cross.crossings.map((c) => c.K),
    ...sol.stab.boundaries,
  ].filter((x) => x > 0);
  const ref = marks.length ? marks : [1];
  const lo = Math.min(...ref) / 100;
  const hi = Math.max(Math.max(...ref) * 20, Math.min(sol.locus.Kmax, Math.max(...ref) * 1000));
  return { lo, hi };
}

export function KControl({ sol, K, setK, playing, setPlaying, clPoles }: Props) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  const { lo, hi } = useMemo(() => kRange(sol), [sol]);
  const toU = (k: number): number => (Math.log(k) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  const fromU = (u: number): number => Math.exp(Math.log(lo) + u * (Math.log(hi) - Math.log(lo)));
  const raf = useRef(0);
  const uRef = useRef(toU(K));
  uRef.current = toU(K);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const dur = reduce ? 4000 : 7000;
    const tick = (t: number): void => {
      const dt = t - last;
      last = t;
      let u = uRef.current + dt / dur;
      if (u >= 1) {
        u = 1;
        setPlaying(false);
      }
      setK(fromU(u));
      if (u < 1) raf.current = requestAnimationFrame(tick);
    };
    if (uRef.current >= 0.999) uRef.current = 0;
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, lo, hi]);

  const stable = clPoles.length > 0 && clPoles.every((p) => p.re < -1e-9 * Math.max(1, Math.abs(p.re) + Math.abs(p.im)));
  const marginal = !stable && clPoles.every((p) => p.re <= 1e-7 * Math.max(1, Math.abs(p.im)));
  const step = useMemo(() => stepResponse(sol.ol, K), [sol, K]);
  const dominant = useMemo(() => {
    const cpx = clPoles.filter((p) => p.im > 1e-9);
    const pool = cpx.length ? cpx : clPoles;
    return pool.length ? pool.reduce((a, b) => (b.re > a.re ? b : a)) : null;
  }, [clPoles]);
  const info = dominant ? poleInfo(dominant) : null;
  const marks = [
    ...sol.r5.accepted.filter((c) => c.s.im >= 0).map((c) => ({ k: c.K.re, label: c.kind === 'entry' ? 'entry' : 'brk', color: '#1e6b30' })),
    ...sol.cross.crossings.map((c) => ({ k: c.K, label: 'Kₓ', color: '#5f1f99' })),
  ]
    .filter((m) => m.k > lo && m.k < hi)
    .sort((a, b) => a.k - b.k)
    .map((m, i, arr) => ({ ...m, row: i > 0 && toU(m.k) - toU(arr[i - 1].k) < 0.07 ? 1 : 0 }));

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="rounded-md bg-navy px-4 py-2 font-semibold text-white shadow hover:bg-navy-600"
            aria-pressed={playing}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <label htmlFor="kslider" className="text-sm font-medium text-slate-700">
            Gain K (log scale)
          </label>
          <output htmlFor="kslider" className="num rounded bg-slate-100 px-2 py-1 text-sm" aria-live="off">
            K = {tnum(K, 4)}
          </output>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${stable ? 'bg-green-100 text-green-800' : marginal ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}
            role="status"
          >
            {stable ? '● STABLE' : marginal ? '◐ MARGINAL' : '▲ UNSTABLE'}
          </span>
        </div>
        <div className="relative mt-3">
          <input
            id="kslider"
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(toU(K) * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setK(fromU(Number(e.target.value) / 1000));
            }}
            aria-valuetext={`K = ${tnum(K, 4)}, ${stable ? 'stable' : marginal ? 'marginally stable' : 'unstable'}`}
            className="w-full accent-[#1f3b6e]"
          />
          <div className="relative h-8 text-[10px]" aria-hidden>
            {marks.map((m, i) => (
              <button
                type="button"
                tabIndex={-1}
                key={i}
                onClick={() => setK(m.k)}
                className="absolute -translate-x-1/2 whitespace-nowrap font-semibold"
                style={{ left: `${toU(m.k) * 100}%`, top: m.row * 13, color: m.color }}
                title={`K = ${tnum(m.k, 4)}`}
              >
                ▲{m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[13px]">
          <div className="font-medium text-slate-700">Closed-loop poles at this K:</div>
          <ul className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            {clPoles
              .filter((p) => p.im >= 0)
              .map((p, i) => {
                const pi = poleInfo(p);
                return (
                  <li key={i} className={p.re > 1e-9 ? 'text-red-700' : ''}>
                    {p.im > 0 ? fcomplex({ re: p.re, im: p.im }, 3, true).replace('+', '±') : fcomplex(p, 3, true)}
                    {p.im > 0 && <span className="text-slate-600"> (ζ={tnum(pi.zeta, 3)}, ωₙ={tnum(pi.wn, 3)})</span>}
                  </li>
                );
              })}
          </ul>
          {info && (
            <p className="mt-1 text-[12.5px] text-slate-600">
              Dominant pole: ζ = <span className="num">{tnum(info.zeta, 3)}</span>, ωₙ = <span className="num">{tnum(info.wn, 3)}</span> rad/s
            </p>
          )}
        </div>
      </div>
      <StepChart step={step} />
    </div>
  );
}

function StepChart({ step }: { step: ReturnType<typeof stepResponse> }) {
  const W = 300,
    H = 170,
    pl = 34,
    pb = 22,
    pt = 18,
    pr = 8;
  const ys = step.y;
  const ymax = Math.max(1e-9, ...ys, step.final ?? 0) * 1.1;
  const ymin = Math.min(0, ...ys) * 1.1;
  const T = step.t[step.t.length - 1] || 1;
  const X = (t: number): number => pl + (t / T) * (W - pl - pr);
  const Y = (y: number): number => pt + ((ymax - y) / (ymax - ymin || 1)) * (H - pt - pb);
  const d = step.t.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join('');
  return (
    <figure className="rounded-md border border-slate-200 bg-white p-2">
      <figcaption className="text-[12px] font-semibold text-slate-700">Closed-loop step response</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Step response, ${step.stable ? `settles at ${tnum(step.final ?? 0, 3)}` : step.marginal ? 'sustained oscillation' : 'unstable'}`}>
        <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} fill="#fff" stroke="#dee2e6" />
        {step.final !== null && (
          <line x1={pl} x2={W - pr} y1={Y(step.final)} y2={Y(step.final)} stroke="#2b8a3e" strokeDasharray="4 3" />
        )}
        <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke="#adb5bd" />
        <path d={d} fill="none" stroke={step.stable ? '#2a6fdb' : step.marginal ? '#e67700' : '#c92a2a'} strokeWidth={2} />
        <text x={pl - 4} y={Y(ymax / 1.1) + 4} fontSize={10} textAnchor="end" fill="#495057">
          {tnum(ymax / 1.1, 2)}
        </text>
        <text x={pl - 4} y={Y(0) + 4} fontSize={10} textAnchor="end" fill="#495057">
          0
        </text>
        <text x={W - pr} y={H - 6} fontSize={10} textAnchor="end" fill="#495057">
          t = {tnum(T, 2)} s
        </text>
        {!step.stable && (
          <text x={pl + 8} y={pt + 14} fontSize={11} fill={step.marginal ? '#e67700' : '#c92a2a'} fontWeight={600}>
            {step.marginal ? 'marginal: sustained oscillation' : 'unstable'}
            {step.clipped ? ' (clipped)' : ''}
          </text>
        )}
      </svg>
    </figure>
  );
}
