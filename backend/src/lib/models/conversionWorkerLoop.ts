import { logError, logInfo } from '../serverLogger.js';
import { runNextConversion, type ConversionRunOutcome } from './conversionRunner.js';
import { resolveModelObjectStore, type ModelObjectStore } from './modelObjectStore.js';
import { sweepStaleUploadParts } from './uploadParts.js';

export const POLL_INTERVAL_MS = 5_000;
export const SWEEP_INTERVAL_MS = 60 * 60_000;

export interface ModelConversionWorkerHandle {
  readonly stop: () => Promise<void>;
}

export interface ModelConversionWorkerOptions {
  readonly pollIntervalMs?: number;
  readonly sweepIntervalMs?: number;
  readonly leaseOwner?: string;
  readonly store?: ModelObjectStore;
  readonly runner?: typeof runNextConversion;
}

export async function runModelConversionWorkerTick(params: {
  store: ModelObjectStore;
  leaseOwner: string;
  at: Date;
  sweepDue: boolean;
  runner?: typeof runNextConversion;
}): Promise<{ outcome: ConversionRunOutcome; swept: number }> {
  const outcome = await (params.runner ?? runNextConversion)({
    store: params.store,
    leaseOwner: params.leaseOwner,
  });
  const swept = params.sweepDue ? await sweepStaleUploadParts(params.at) : 0;
  return { outcome, swept };
}

export function startModelConversionWorker(
  options: ModelConversionWorkerOptions = {},
): ModelConversionWorkerHandle {
  const store = options.store ?? resolveModelObjectStore();
  const leaseOwner =
    options.leaseOwner ?? `${process.env.HOSTNAME ?? 'worker'}:${process.pid}:model`;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  let stopped = false;
  let lastSweep = 0;

  const loop = async () => {
    while (!stopped) {
      const at = new Date();
      const sweepDue = at.getTime() - lastSweep >= sweepIntervalMs;
      try {
        const result = await runModelConversionWorkerTick({
          store,
          leaseOwner,
          at,
          sweepDue,
          runner: options.runner,
        });
        if (sweepDue) lastSweep = at.getTime();
        if (result.outcome !== 'idle') {
          logInfo('[Model Conversion Worker] Tick finished', result);
        }
      } catch (error) {
        logError('[Model Conversion Worker] Loop iteration failed', error);
      }
      if (stopped) break;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  };

  const idle = loop();
  logInfo('[Model Conversion Worker] Started', {
    leaseOwner,
    storage: store.kind,
    pollIntervalMs,
  });
  return {
    stop: async () => {
      stopped = true;
      await idle;
      logInfo('[Model Conversion Worker] Stopped');
    },
  };
}
