type FatalDetails = unknown;

function formatFatalFallback(details: FatalDetails): string {
  if (details instanceof Error) {
    return `${details.name}: ${details.message}`;
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details) ?? String(details);
  } catch {
    return String(details);
  }
}

async function logFatal(message: string, details: FatalDetails): Promise<void> {
  try {
    const { logError } = await import('./lib/serverLogger.js');
    logError(message, details);
  } catch {
    process.stderr.write(`${message} ${formatFatalFallback(details)}\n`);
  }
}

async function reportFatal(message: string, details: FatalDetails): Promise<void> {
  await logFatal(message, details);
  try {
    const { captureFatal, flushMonitoring } = await import('./lib/monitoring.js');
    captureFatal(message, details);
    await flushMonitoring(2000);
  } catch {
    // Monitoring is best-effort and must not delay the fatal exit.
  }
}

function exitAfterFatal(message: string, details: FatalDetails): void {
  void reportFatal(message, details).finally(() => process.exit(1));
}

// Register fatal handlers before loading application modules. Static ESM imports
// are evaluated before module body code, so startup dependencies are loaded below
// through dynamic imports instead.
process.on('uncaughtException', (error) => {
  exitAfterFatal('[FATAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  exitAfterFatal('[FATAL] Unhandled Rejection:', { promise, reason });
});

async function bootstrap(): Promise<void> {
  await import('dotenv/config');

  // Initialise error monitoring early so startup/config failures are reported.
  // No-op unless SENTRY_DSN is configured.
  const { initMonitoring } = await import('./lib/monitoring.js');
  await initMonitoring();

  const { validateRuntimeConfig } = await import('./lib/runtimeConfig.js');
  validateRuntimeConfig();

  const { startServer } = await import('./server.js');
  await startServer();
}

void bootstrap().catch((error) => {
  exitAfterFatal('[FATAL] Startup failed:', error);
});
