import { useEffect, useRef, useState } from 'react';
import { locusJob, type Solution } from '../engine/solve';
import type { ViewBox } from '../engine/view';
import { trackLocus, type Locus } from '../engine/locus';
import { numericCrossCheck } from '../engine/stability';
import type { LocusReply, LocusRequest } from '../engine/locus.worker';

export interface HeavyResult {
  locus: Locus;
  locusNeg: Locus | null;
  numericCheck: { points: number; mismatches: number };
}

/**
 * Runs locus tracking and the numeric stability scan in a Web Worker so the main thread stays
 * responsive. Falls back to synchronous computation when workers are unavailable.
 */
export function useLocusWorker(
  sol: Solution | null,
  complementary: boolean,
  view?: ViewBox | null,
  negSol?: Solution | null,
): HeavyResult | null {
  const [res, setRes] = useState<{ sol: Solution; comp: boolean; r: HeavyResult } | null>(null);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, { sol: Solution; comp: boolean }>());

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    try {
      const w = new Worker(new URL('../engine/locus.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<LocusReply>) => {
        const meta = pending.current.get(e.data.id);
        pending.current.delete(e.data.id);
        if (meta && e.data.id === seq.current)
          setRes({ ...meta, r: { locus: e.data.locus, locusNeg: e.data.locusNeg, numericCheck: e.data.numericCheck } });
      };
      worker.current = w;
      return () => w.terminate();
    } catch {
      worker.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sol) return;
    const job = locusJob(sol, view ?? sol.view);
    if (negSol) job.mandatoryNeg = [...negSol.r5.accepted.map((c) => c.K.re), ...negSol.cross.crossings.map((c) => c.K)];
    const id = ++seq.current;
    const w = worker.current;
    if (w) {
      pending.current.set(id, { sol, comp: complementary });
      const msg: LocusRequest = { id, job, complementary };
      w.postMessage(msg);
    } else {
      const t = window.setTimeout(() => {
        const locus = trackLocus(job.ol, { view: job.view, mandatory: job.mandatory });
        const locusNeg = complementary ? trackLocus(job.ol, { view: job.view, sign: -1, mandatory: job.mandatoryNeg }) : null;
        setRes({ sol, comp: complementary, r: { locus, locusNeg, numericCheck: numericCrossCheck(job.ol, job.boundaries, job.stable) } });
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [sol, complementary, view, negSol]);

  // keep showing the previous locus for the same solution while the complementary one is computed
  if (!res || res.sol !== sol) return null;
  return res.r;
}
