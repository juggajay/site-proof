// In-process data-retention worker (GAP-B/C): periodically sweeps expired
// short-lived records so used/expired bearer and hold-point capability tokens
// do not accumulate forever. Mirrors the existing background-worker pattern
// (startScheduledReportWorker et al.): enabled by default in production, opt-out
// via env, idempotent so it is safe across replicas.
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';
import { applyRetentionPolicies } from './dataRetention.js';

const DEFAULT_RETENTION_WORKER_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDataRetentionWorkerEnabled(): boolean {
  const configured = process.env.DATA_RETENTION_WORKER_ENABLED?.trim().toLowerCase();
  if (configured === 'false' || configured === '0' || configured === 'no') {
    return false;
  }
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function getDataRetentionWorkerIntervalMs(): number {
  return parsePositiveInteger(
    process.env.DATA_RETENTION_WORKER_INTERVAL_MS,
    DEFAULT_RETENTION_WORKER_INTERVAL_MS,
  );
}

export function startDataRetentionWorker(): { stop: () => void } | null {
  if (!getDataRetentionWorkerEnabled()) {
    return null;
  }

  const intervalMs = getDataRetentionWorkerIntervalMs();
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await applyRetentionPolicies(prisma);
      if (result.totalDeleted > 0) {
        logInfo('[Data Retention] Swept expired records', { ...result });
      }
    } catch (error) {
      logError('[Data Retention] Worker run failed', error);
    } finally {
      isRunning = false;
    }
  };

  const initialTimer = setTimeout(
    () => {
      void run();
    },
    Math.min(5000, intervalMs),
  );
  const intervalTimer = setInterval(() => {
    void run();
  }, intervalMs);

  logInfo('[Data Retention] Worker started', { intervalMs });

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      logInfo('[Data Retention] Worker stopped');
    },
  };
}
