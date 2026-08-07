// Wave D `D1c.2` — THE SHARED HEAVY-WORKER ENTRYPOINT, a separate PROCESS
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.7, §10.3,
// §13; `[DH-j]`). §15 item 11.
//
// `node dist/worker/handoverExportWorker.js` — the existing Railway worker
// service, and EXPLICITLY NOT another loop in the API process. Wave 5a adds
// model conversion beside handover assembly in this same process; it does not
// add another Railway service.
//
// WHY, and it is measured rather than preferred. `[DH-j]`: `D1c.0` recorded
// maximum single-tick event-loop stalls of 100–700 ms across ALL FOUR ZIP
// writers, and the SELECTED writer (`archiver` 8.0.0) still measures 69.99 ms
// at the 8,334-member ceiling on a certified-quiet box — over the 50 ms bar,
// across five confirming samples. In the API process every request queued
// behind that tick waits, so an archive job would be a user-visible outage.
// `[DH-j]`'s flip condition required the selected writer to hold ≤50 ms and it
// does not, so this process boundary is LOAD-BEARING: §16.1 J10 scopes fixture
// 3 to the API process *because* the worker is outside it.
//
// IT REFUSES TO START WITHOUT DURABLE STORAGE (§10.3, `[DR-B8]`). The store is
// resolved once, at boot; an unconfigured production worker exits non-zero with
// a stated reason instead of claiming jobs it cannot finish durably.
//
// ROLLBACK (§13): scale this service to zero. In-flight jobs are reclaimed on
// lease expiry; if the worker stays off they sit `queued`, which is visible
// rather than lost.
//
// The bootstrap shape mirrors `src/index.ts` — fatal handlers registered before
// any application module is loaded, everything else through dynamic imports.

type FatalDetails = unknown;

function formatFatalFallback(details: FatalDetails): string {
  if (details instanceof Error) return `${details.name}: ${details.message}`;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details) ?? String(details);
  } catch {
    return String(details);
  }
}

async function logFatal(message: string, details: FatalDetails): Promise<void> {
  try {
    const { logError } = await import('../lib/serverLogger.js');
    logError(message, details);
  } catch {
    process.stderr.write(`${message} ${formatFatalFallback(details)}\n`);
  }
}

function exitAfterFatal(message: string, details: FatalDetails): void {
  void logFatal(message, details).finally(() => process.exit(1));
}

process.on('uncaughtException', (error) => {
  exitAfterFatal('[FATAL] Worker uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  exitAfterFatal('[FATAL] Worker unhandled rejection:', { promise, reason });
});

async function bootstrap(): Promise<void> {
  await import('dotenv/config');

  const { initSentry } = await import('../lib/sentry.js');
  initSentry();

  const { startHandoverExportWorker } = await import('../lib/handover/exportWorkerLoop.js');
  const { startModelConversionWorker } = await import('../lib/models/conversionWorkerLoop.js');
  const handoverHandle = startHandoverExportWorker();
  const modelHandle = startModelConversionWorker();

  const { prisma } = await import('../lib/prisma.js');
  const { logInfo } = await import('../lib/serverLogger.js');

  const shutdown = async (signal: string) => {
    logInfo(`[Worker] ${signal} received; finishing current jobs`);
    await Promise.all([handoverHandle.stop(), modelHandle.stop()]);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap().catch((error) => {
  exitAfterFatal('[FATAL] Worker startup failed:', error);
});
