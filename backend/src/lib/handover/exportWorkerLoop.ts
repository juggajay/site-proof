// Wave D `D1c.2` — the worker's loop, separated from the process it runs in
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.7, §10.5,
// §13; `[DH-j]`).
//
// The PROCESS is `src/worker/handoverExportWorker.ts`. This is the part a test
// can drive without one.
//
// ONE JOB AT A TIME, deliberately. Two concurrent 8 GiB assemblies in one
// process would double every memory figure §4.5.1 fixture 1 bounds; horizontal
// scale is another instance of the service, which the lease and its fencing
// token already make safe (§4.6.2).

import { resolveArchiveObjectStore, type ArchiveObjectStore } from './archiveObjectStore.js';
import { findNextExportJob, runExportJob } from './exportRunner.js';
import { sweepHandoverArtifacts } from './exportSweeper.js';
import { logError, logInfo } from '../serverLogger.js';

/** How often an idle worker looks for work — short enough that an export starts
 * while the requester is still on the screen. */
export const POLL_INTERVAL_MS = 5_000;
/** Hourly, so an expired artefact's window is measured in hours, not days. */
export const SWEEP_INTERVAL_MS = 60 * 60_000;

export interface WorkerHandle {
  readonly stop: () => Promise<void>;
}

export interface WorkerOptions {
  readonly pollIntervalMs?: number;
  readonly sweepIntervalMs?: number;
  readonly leaseOwner?: string;
  /** Injected by tests. In production this is resolved once at boot, and an
   * unconfigured production worker throws here rather than claiming a job it
   * cannot finish durably (§10.3). */
  readonly store?: ArchiveObjectStore;
}

/** One pass: at most one job, plus the retention sweep when it is due. */
export async function runWorkerTick(params: {
  store: ArchiveObjectStore;
  leaseOwner: string;
  at: Date;
  sweepDue: boolean;
}): Promise<{ exportId: string | null; outcome: string | null; swept: boolean }> {
  const exportId = await findNextExportJob(params.at);
  let outcome: string | null = null;

  if (exportId) {
    outcome = await runExportJob({
      exportId,
      leaseOwner: params.leaseOwner,
      store: params.store,
    });
    logInfo('[Handover Worker] Job finished', { exportId, outcome });
  }

  if (params.sweepDue) {
    await sweepHandoverArtifacts({ store: params.store, at: params.at });
  }

  return { exportId, outcome, swept: params.sweepDue };
}

export function startHandoverExportWorker(options: WorkerOptions = {}): WorkerHandle {
  const store = options.store ?? resolveArchiveObjectStore();
  const leaseOwner = options.leaseOwner ?? `${process.env.HOSTNAME ?? 'worker'}:${process.pid}`;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;

  let stopped = false;
  let lastSweep = 0;

  const loop = async () => {
    while (!stopped) {
      const at = new Date();
      const sweepDue = at.getTime() - lastSweep >= sweepIntervalMs;
      try {
        if (sweepDue) lastSweep = at.getTime();
        await runWorkerTick({ store, leaseOwner, at, sweepDue });
      } catch (error) {
        // A throw here would take the process down and Railway would restart
        // it — survivable but noisy, and the job's own failure handling has
        // already run inside `runExportJob`.
        logError('[Handover Worker] Loop iteration failed', error);
      }
      if (stopped) break;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  };

  const idle = loop();
  logInfo('[Handover Worker] Started', { leaseOwner, storage: store.kind, pollIntervalMs });

  return {
    stop: async () => {
      stopped = true;
      await idle;
      logInfo('[Handover Worker] Stopped');
    },
  };
}
