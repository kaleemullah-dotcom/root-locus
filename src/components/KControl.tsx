import { useEffect, useMemo, useRef, useState } from 'react';
import type { Complex, Solution } from '../engine';
import { poleInfo, stepResponse } from '../engine/closedloop';
import { fcomplex, tnum } from '../engine/latex';
import type { KMode } from './MainPlot';

interface Props {
  sol: Solution;
  /** K < 0 analysis (gains reported as K' = −K) */
  solNeg: Solution | null;
  mode: KMode;
  setMode: (m: KMode) => void;
  K: number;
  setK: (k: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  clPoles: Complex[];
}

/** Gain magnitude range for the slider: from well below the first interesting |K| to past the last. */
export function kRange(sol: Solution): { lo: number; hi: number } {
  const marks = [...sol.r5.accepted.map((c) => c.K.re), ...sol.cross.crossings.map((c) => c.K), ...sol.stab.boundaries].filter((x) => x > 0);
  const ref = marks.length ? marks : [1];
  const lo = Math.min(...ref) / 100;
  const hi = Math.max(Math.max(...ref) * 20, Math.min(sol.locus.Kmax, Math.max(...ref) * 1000));
  return { lo, hi };
}

/** Seconds for one sweep 0 → ±∞. */
const SPEEDS = [
  { id: 'vslow', label: 'Very slow', secs: 40 },
  { id: 'slow', label: 'Slow', secs: 24 },
  { id: 'normal', label: 'Normal', secs: 12 },
  { id: 'fast', label: 'Fast', secs: 6 },
] as const;

const MODES: Array<{ id: KMode; label: string; title: string }> = [
  { id: 'pos', label: 'K > 0', title: 'Positive gain, K from 0 to +∞' },
  { id: 'neg', label: 'K < 0', title: 'Negative gain, K from 0 to −∞ (complementary locus)' },
  { id: 'both', label: 'Both', title: 'Both ranges' },
];

export function KControl({ sol, solNeg, mode, setMode, K, setK, playing, setPlaying, clPoles }: Props) {
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['id']>('slow');
  const pr = useMemo(() => kRange(sol), [sol]);
  const nr = useMemo(() => (solNeg ? kRange(solNeg) : pr), [solNeg, pr]);
  const effMode: KMode = mode !== 'pos' && !solNeg ? 'pos' : mode;

  // ---- slider position u ∈ [0, 1]  ↔  K
  const L = (x: number): number => Math.log(x);
  const fromU = (u: number): number => {
    const posK = (t: number): number => Math.exp(L(pr.lo) + t * (L(pr.hi) - L(pr.lo)));
    const negK = (t: number): number => -Math.exp(L(nr.lo) + t * (L(nr.hi) - L(nr.lo)));
    if (effMode === 'pos') return posK(u);
    if (effMode === 'neg') return negK(u);
    return u >= 0.5 ? posK((u - 0.5) / 0.5) : negK((0.5 - u) / 0.5);
  };
  const toU = (k: number): number => {
    const clamp = (x: number): number => Math.min(1, Math.max(0, x));
    const tp = (x: number): number => clamp((L(Math.max(x, 1e-300)) - L(pr.lo)) / (L(pr.hi) - L(pr.lo)));
    const tn = (x: number): number => clamp((L(Math.max(x, 1e-300)) - L(nr.lo)) / (L(nr.hi) - L(nr.lo)));
    if (effMode === 'pos') return tp(Math.abs(k));
    if (effMode === 'neg') return tn(Math.abs(k));
    return k >= 0 ? 0.5 + 0.5 * tp(k) : 0.5 - 0.5 * tn(-k);
  };
  // Play timeline. K > 0 / K < 0: one sweep 0 → ±∞.
  // Both: 0 → +∞, back +∞ → 0, pause at K = 0, then 0 → −∞ and back −∞ → 0.
  const PAUSE = 1.6; // seconds at K = 0
  const secs = SPEEDS.find((s) => s.id === speed)?.secs ?? 24;
  const phases = useMemo(
    () =>
      effMode === 'both'
        ? [
            { from: 0.5, to: 1, dur: secs, label: 'K: 0 → +∞' },
            { from: 1, to: 0.5, dur: secs * 0.6, label: 'K: +∞ → 0' },
            { from: 0.5, to: 0.5, dur: PAUSE, label: 'K = 0 (pause)' },
            { from: 0.5, to: 0, dur: secs, label: 'K: 0 → −∞' },
            { from: 0, to: 0.5, dur: secs * 0.6, label: 'K: −∞ → 0' },
          ]
        : [{ from: 0, to: 1, dur: secs, label: effMode === 'neg' ? 'K: 0 → −∞' : 'K: 0 → +∞' }],
    [effMode, secs],
  );
  const total = phases.reduce((a, p) => a + p.dur, 0);
  const posAt = (time: number): { u: number; phase: number } => {
    let t = time;
    for (let i = 0; i < phases.length; i++) {
      const ph = phases[i];
      if (t <= ph.dur || i === phases.length - 1) {
        const f = Math.min(1, Math.max(0, t / ph.dur));
        const e = f; // linear in log|K|
        return { u: ph.from + (ph.to - ph.from) * e, phase: i };
      }
      t -= ph.dur;
    }
    return { u: phases[0].from, phase: 0 };
  };
  const [phaseIdx, setPhaseIdx] = useState<number | null>(null);
  const tRef = useRef(0);

  const raf = useRef(0);
  useEffect(() => {
    if (!playing) {
      setPhaseIdx(null);
      return;
    }
    let last = performance.now();
    if (tRef.current >= total - 1e-6) tRef.current = 0;
    // resume from the slider position when it lies on the first phase
    if (tRef.current === 0) {
      const u = toU(K);
      const ph = phases[0];
      const f = (u - ph.from) / (ph.to - ph.from || 1);
      if (f > 0 && f < 0.98) tRef.current = f * ph.dur;
    }
    const tick = (now: number): void => {
      const dt = Math.min(100, now - last) / 1000;
      last = now;
      tRef.current = Math.min(total, tRef.current + dt);
      const { u, phase } = posAt(tRef.current);
      setPhaseIdx(phase);
      setK(fromU(u));
      if (tRef.current >= total) {
        tRef.current = total;
        setPlaying(false);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phases, pr, nr]);
  useEffect(() => {
    tRef.current = 0;
  }, [effMode, sol]);

  const tol = (p: Complex): number => 1e-9 * Math.max(1, Math.abs(p.re) + Math.abs(p.im));
  const stable = clPoles.length > 0 && clPoles.every((p) => p.re < -tol(p));
  const marginal = !stable && clPoles.every((p) => p.re <= 1e-7 * Math.max(1, Math.abs(p.im)));
  const step = useMemo(() => stepResponse(sol.ol, K), [sol, K]);
  const dominant = useMemo(() => {
    const cpx = clPoles.filter((p) => p.im > 1e-9);
    const pool = cpx.length ? cpx : clPoles;
    return pool.length ? pool.reduce((a, b) => (b.re > a.re ? b : a)) : null;
  }, [clPoles]);
  const info = dominant ? poleInfo(dominant) : null;

  const marks = useMemo(() => {
    const m: Array<{ k: number; label: string; color: string }> = [];
    if (effMode !== 'neg') {
      sol.r5.accepted.filter((c) => c.s.im >= 0).forEach((c) => m.push({ k: c.K.re, label: c.kind === 'entry' ? 'entry' : 'brk', color: '#1e6b30' }));
      sol.cross.crossings.forEach((c) => m.push({ k: c.K, label: 'Kₓ', color: '#5f1f99' }));
    }
    if (effMode !== 'pos' && solNeg) {
      solNeg.r5.accepted.filter((c) => c.s.im >= 0).forEach((c) => m.push({ k: -c.K.re, label: c.kind === 'entry' ? 'entry' : 'brk', color: '#1e6b30' }));
      solNeg.cross.crossings.forEach((c) => m.push({ k: -c.K, label: 'Kₓ', color: '#5f1f99' }));
    }
    const withU = m.map((x) => ({ ...x, u: toU(x.k) })).filter((x) => x.u > 0.001 && x.u < 0.999);
    withU.sort((a, b) => a.u - b.u);
    let lastRow0 = -1;
    return withU.map((x) => {
      const row = x.u - lastRow0 < 0.09 ? 1 : 0;
      if (!row) lastRow0 = x.u;
      return { ...x, row };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sol, solNeg, effMode, pr, nr]);

  const seg = 'rounded-md px-2.5 py-1 text-[13px] font-semibold';
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600" id="kmode-label">
          Gain range shown &amp; simulated
        </div>
        <div role="radiogroup" aria-labelledby="kmode-label" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/70 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              title={m.title}
              onClick={() => {
                setPlaying(false);
                setMode(m.id);
              }}
              className={`${seg} ${mode === m.id ? (m.id === 'neg' ? 'bg-[#0b7285] text-white shadow' : 'bg-navy text-white shadow') : 'text-slate-700 hover:bg-white'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="rounded-md bg-navy px-4 py-2 font-semibold text-white shadow hover:bg-navy-600"
          aria-pressed={playing}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <label className="flex items-center gap-1.5 text-[13px] text-slate-700">
          <span>Speed</span>
          <select value={speed} onChange={(e) => setSpeed(e.target.value as typeof speed)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px]">
            {SPEEDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.secs} s / sweep)
              </option>
            ))}
          </select>
        </label>
        {playing && phaseIdx !== null && (
          <span className="num rounded bg-white px-2 py-0.5 text-[12px] text-slate-700 shadow-sm" aria-live="polite">
            {phases[phaseIdx].label}
          </span>
        )}
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${stable ? 'bg-green-100 text-green-800' : marginal ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}
          role="status"
        >
          {stable ? '● STABLE' : marginal ? '◐ MARGINAL' : '▲ UNSTABLE'}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="kslider" className="text-[13px] font-medium text-slate-700">
            Gain K (log scale{effMode === 'both' ? ', 0 in the middle' : ''})
          </label>
          <output htmlFor="kslider" className="num rounded bg-white px-2 py-0.5 text-sm shadow-sm" aria-live="off">
            K = {tnum(K, 4)}
          </output>
        </div>
        <input
          id="kslider"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(toU(K) * 1000)}
          onChange={(e) => {
            setPlaying(false);
            tRef.current = 0;
            setK(fromU(Number(e.target.value) / 1000));
          }}
          aria-valuetext={`K = ${tnum(K, 4)}, ${stable ? 'stable' : marginal ? 'marginally stable' : 'unstable'}`}
          className={`mt-1 w-full ${effMode === 'neg' ? 'accent-[#0b7285]' : 'accent-[#1f3b6e]'}`}
        />
        <div className="relative h-9 text-[10px]" aria-hidden>
          {effMode === 'both' && (
            <>
              <span className="absolute left-0 top-0 font-semibold text-[#0b7285]">−∞</span>
              <span className="absolute left-1/2 top-0 -translate-x-1/2 font-semibold text-slate-700">0</span>
              <span className="absolute right-0 top-0 font-semibold text-navy">+∞</span>
            </>
          )}
          {marks.map((m, i) => (
            <button
              type="button"
              tabIndex={-1}
              key={i}
              onClick={() => {
                setPlaying(false);
                setK(m.k);
              }}
              className="absolute -translate-x-1/2 whitespace-nowrap font-semibold"
              style={{ left: `${m.u * 100}%`, top: 12 + m.row * 12, color: m.color }}
              title={`K = ${tnum(m.k, 4)}`}
            >
              ▲{m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[13px]">
        <div className="font-medium text-slate-700">Closed-loop poles at this K</div>
        <ul className="num mt-1 space-y-0.5 text-[12.5px]">
          {clPoles
            .filter((p) => p.im >= 0)
            .map((p, i) => {
              const pi = poleInfo(p);
              return (
                <li key={i} className={p.re > 1e-9 ? 'text-red-700' : ''}>
                  {p.im > 0 ? fcomplex(p, 3, true).replace('+', '±') : fcomplex(p, 3, true)}
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
      <StepChart step={step} />
    </div>
  );
}

function StepChart({ step }: { step: ReturnType<typeof stepResponse> }) {
  const W = 300,
    H = 150,
    pl = 34,
    pb = 22,
    pt = 16,
    pr = 8;
  const ys = step.y;
  const ymax = Math.max(1e-9, ...ys, step.final ?? 0) * 1.1;
  const ymin = Math.min(0, ...ys) * 1.1;
  const T = step.t[step.t.length - 1] || 1;
  const X = (t: number): number => pl + (t / T) * (W - pl - pr);
  const Y = (y: number): number => pt + ((ymax - y) / (ymax - ymin || 1)) * (H - pt - pb);
  const d = step.t.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join('');
  const color = step.stable ? '#2a6fdb' : step.marginal ? '#e67700' : '#c92a2a';
  return (
    <figure className="rounded-md border border-slate-200 bg-white p-2">
      <figcaption className="text-[12px] font-semibold text-slate-700">Closed-loop step response</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Step response, ${step.stable ? `settles at ${tnum(step.final ?? 0, 3)}` : step.marginal ? 'sustained oscillation' : 'unstable'}`}>
        <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} fill="#fff" stroke="#dee2e6" />
        {step.final !== null && <line x1={pl} x2={W - pr} y1={Y(step.final)} y2={Y(step.final)} stroke="#2b8a3e" strokeDasharray="4 3" />}
        <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke="#adb5bd" />
        <path d={d} fill="none" stroke={color} strokeWidth={2} />
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
          <text x={pl + 8} y={pt + 14} fontSize={11} fill={color} fontWeight={600}>
            {step.marginal ? 'marginal: sustained oscillation' : 'unstable'}
            {step.clipped ? ' (clipped)' : ''}
          </text>
        )}
      </svg>
    </figure>
  );
}
