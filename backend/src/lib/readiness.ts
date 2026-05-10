import type { Request, Response } from 'express';
import { prisma } from './prisma.js';

const DEFAULT_READINESS_DB_TIMEOUT_MS = 1000;

export async function checkDatabaseReadiness(
  timeoutMs = DEFAULT_READINESS_DB_TIMEOUT_MS,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Database readiness check timed out')),
          timeoutMs,
        );
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function createReadinessHandler(isShuttingDown: () => boolean) {
  return async (_req: Request, res: Response) => {
    if (isShuttingDown()) {
      res.status(503).json({ status: 'shutting_down', message: 'Server is shutting down' });
      return;
    }

    try {
      await checkDatabaseReadiness();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unready', message: 'Database unavailable' });
    }
  };
}
