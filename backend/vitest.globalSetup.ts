// Provisions one database per vitest worker, cloned from the migrated test
// database. Runs ONCE in the vitest main process, before any worker starts —
// see `src/test/workerDatabase.ts` for why the clones exist at all.
//
// Lives outside `src/` on purpose: `CREATE DATABASE` cannot be parameterised, so
// this needs `$executeRawUnsafe`, which CI's "Check for unsafe patterns" step
// bans under `src/` and `scripts/`. The identifiers here are derived from
// `DATABASE_URL`, never from a request.
//
// Escape hatch: `SITEPROOF_TEST_WORKER_DATABASES=off` skips provisioning and
// leaves every worker on the shared database — the fast path when iterating on
// a single non-DB test file. Add `--no-file-parallelism` if you set it while
// running DB suites.

import { PrismaClient } from '@prisma/client';

import { assertSafeTestDatabaseUrl } from './src/test/databaseSafety.js';
import {
  TEST_WORKER_COUNT,
  WORKER_DATABASES_OFF,
  databaseNameFromUrl,
  withDatabaseName,
  workerDatabaseName,
} from './src/test/workerDatabase.js';

/** Postgres identifier quoting: double the double-quotes, wrap in double-quotes. */
function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * `CREATE DATABASE ... TEMPLATE` needs the template idle, and a previous run's
 * Prisma engine can take a moment to let go. Wait it out rather than dropping
 * the whole run back to the shared database over a race.
 */
async function withRetry(run: () => Promise<unknown>, attempts = 6): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await run();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

async function cloneWorkerDatabases(baseUrl: string, baseName: string): Promise<void> {
  // `postgres` is the maintenance database: CREATE/DROP DATABASE cannot run
  // while connected to the database being replaced.
  const admin = new PrismaClient({
    datasources: { db: { url: withDatabaseName(baseUrl, 'postgres') } },
  });
  try {
    for (let workerId = 1; workerId <= TEST_WORKER_COUNT; workerId += 1) {
      const name = quoteIdentifier(workerDatabaseName(baseName, workerId));
      // FORCE terminates connections a crashed previous run left behind (PG 13+).
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await withRetry(() =>
        admin.$executeRawUnsafe(`CREATE DATABASE ${name} TEMPLATE ${quoteIdentifier(baseName)}`),
      );
    }
  } finally {
    await admin.$disconnect();
  }
}

export async function setup(): Promise<void> {
  const baseUrl = process.env.DATABASE_URL?.trim();
  if (!baseUrl || process.env.SITEPROOF_TEST_WORKER_DATABASES === WORKER_DATABASES_OFF) return;

  // The same guard the per-file setup applies, run before we create anything:
  // never clone a database this repo would refuse to test against.
  assertSafeTestDatabaseUrl();

  const baseName = databaseNameFromUrl(baseUrl);
  if (!baseName) return;

  try {
    await cloneWorkerDatabases(baseUrl, baseName);
  } catch (error) {
    const advice =
      `Could not provision per-worker test databases from "${baseName}": ` +
      `${error instanceof Error ? error.message : String(error)}\n` +
      'Fix: close any open session on that database (CREATE DATABASE ... TEMPLATE ' +
      'needs it idle) and make sure the connecting role has CREATEDB.';
    // In CI a silent fallback would resurrect the cross-suite 409 flake this
    // exists to remove, and it would look like a product bug. Fail loudly.
    if (process.env.CI) throw new Error(advice);
    // Workers are forked after this returns, so they inherit the flag.
    process.env.SITEPROOF_TEST_WORKER_DATABASES = WORKER_DATABASES_OFF;
    console.warn(
      `\n[test-db] ${advice}\n[test-db] Falling back to the shared database. ` +
        'DB-backed decision suites may report spurious 409 DECISION_CONFLICTs ' +
        'under file parallelism; `--no-file-parallelism` avoids that locally.\n',
    );
  }
}
