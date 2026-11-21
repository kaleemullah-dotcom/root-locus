/** Shared, pre-computed description of the open loop K·N(s)/D(s). */
import type { Complex } from './complex';
import { qdeg, qlead, qToFloat, type QPoly } from './qpoly';
import { expandRoots, rootsExact, sortRoots, type RootM } from './roots';

export interface OpenLoop {
  N: QPoly;
  D: QPoly;
  Nf: number[];
  Df: number[];
  /** distinct poles / zeros with multiplicity */
  polesM: RootM[];
  zerosM: RootM[];
  /** flattened (with repetition), teacher ordering */
  poles: Complex[];
  zeros: Complex[];
  n: number;
  m: number;
  q: number;
  /** true: ordinary 180° locus (K·N/D with positive effective gain); false: 0° locus */
  is180: boolean;
}

export function makeOpenLoop(N: QPoly, D: QPoly): OpenLoop {
  const polesM = rootsExact(D);
  const zerosM = rootsExact(N);
  const n = qdeg(D),
    m = Math.max(0, qdeg(N));
  return {
    N,
    D,
    Nf: qToFloat(N),
    Df: qToFloat(D),
    polesM,
    zerosM,
    poles: sortRoots(expandRoots(polesM)),
    zeros: sortRoots(expandRoots(zerosM)),
    n,
    m,
    q: n - m,
    is180: qlead(N).sign() * qlead(D).sign() > 0,
  };
}
