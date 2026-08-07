import { resolveModelObjectStore, type ModelObjectStore } from '../models/modelObjectStore.js';
import { ORTHO_UPLOAD_SCRATCH, sweepStaleUploadParts } from '../models/uploadParts.js';
import { logError, logInfo } from '../serverLogger.js';
import { runNextOrthoTiling, type OrthoRunOutcome } from './orthoRunner.js';

export const ORTHO_POLL_INTERVAL_MS = 5_000;
export const ORTHO_SWEEP_INTERVAL_MS = 60 * 60_000;

export interface OrthoTilingWorkerHandle {
  readonly stop: () => Promise<void>;
}

export interface OrthoTilingWorkerOptions {
  readonly pollIntervalMs?: number;
  readonly sweepIntervalMs?: number;
  readonly leaseOwner?: string;
  readonly store?: ModelObjectStore;
  readonly runner?: typeof runNextOrthoTiling;
}

export async function runOrthoTilingWorkerTick(params: {
  store: ModelObjectStore;
  leaseOwner: string;
  at: Date;
  sweepDue: boolean;
  runner?: typeof runNextOrthoTiling;
}): Promise<{ outcome: OrthoRunOutcome; swept: number }> {
  const outcome = await (params.runner ?? runNextOrthoTiling)({
    store: params.store,
    leaseOwner: params.leaseOwner,
  });
  const swept = params.sweepDue ? await sweepStaleUploadParts(params.at, ORTHO_UPLOAD_SCRATCH) : 0;
  return { outcome, swept };
}

export function startOrthoTilingWorker(
  options: OrthoTilingWorkerOptions = {},
): OrthoTilingWorkerHandle {
  const store = options.store ?? resolveModelObjectStore();
  const leaseOwner =
    options.leaseOwner ?? `${process.env.HOSTNAME ?? 'worker'}:${process.pid}:ortho`;
  const pollIntervalMs = options.pollIntervalMs ?? ORTHO_POLL_INTERVAL_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? ORTHO_SWEEP_INTERVAL_MS;
  let stopped = false;
  let lastSweep = 0;

  const loop = async () => {
    while (!stopped) {
      const at = new Date();
      const sweepDue = at.getTime() - lastSweep >= sweepIntervalMs;
      try {
        const result = await runOrthoTilingWorkerTick({
          store,
          leaseOwner,
          at,
          sweepDue,
          runner: options.runner,
        });
        if (sweepDue) lastSweep = at.getTime();
        if (result.outcome !== 'idle') logInfo('[Ortho Tiling Worker] Tick finished', result);
      } catch (error) {
        logError('[Ortho Tiling Worker] Loop iteration failed', error);
      }
      if (stopped) break;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  };

  const idle = loop();
  logInfo('[Ortho Tiling Worker] Started', { leaseOwner, storage: store.kind, pollIntervalMs });
  return {
    stop: async () => {
      stopped = true;
      await idle;
      logInfo('[Ortho Tiling Worker] Stopped');
    },
  };
}
