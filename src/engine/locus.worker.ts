/// <reference lib="webworker" />
/** Web Worker: heavy numeric work (locus tracking + numeric stability scan) off the main thread. */
import { trackLocus, type Locus } from './locus';
import { numericCrossCheck } from './stability';
import type { LocusJob } from './solve';

export interface LocusRequest {
  id: number;
  job: LocusJob;
  complementary: boolean;
}
export interface LocusReply {
  id: number;
  locus: Locus;
  locusNeg: Locus | null;
  numericCheck: { points: number; mismatches: number };
}

self.onmessage = (e: MessageEvent<LocusRequest>) => {
  const { id, job, complementary } = e.data;
  const locus = trackLocus(job.ol, { view: job.view, mandatory: job.mandatory });
  const locusNeg = complementary ? trackLocus(job.ol, { view: job.view, sign: -1, mandatory: job.mandatoryNeg }) : null;
  const numericCheck = numericCrossCheck(job.ol, job.boundaries, job.stable);
  const reply: LocusReply = { id, locus, locusNeg, numericCheck };
  (self as unknown as Worker).postMessage(reply);
};
