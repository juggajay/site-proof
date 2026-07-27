// One Postgres database PER VITEST WORKER, so DB-backed suites are safe under
// file parallelism.
//
// WHY, precisely — the fixtures were never the problem. Every DB suite already
// mints a unique per-file tag (`hp-batch-decision-${Date.now()}`, …) and cleans
// up project-scoped, so no two suites touch the same ROW. They still collided,
// because PostgreSQL Serializable conflicts are PHYSICAL, not logical:
//
//   - `recordDecision` runs every decision at `Serializable`
//     (`readiness/recordDecision.ts`), which takes SIRead predicate locks.
//   - Predicate locks escalate tuple -> page -> relation
//     (`max_pred_locks_per_page` defaults to 2). In a test database every
//     suite's rows for `hold_points`, `progress_claims`, `audit_logs` and
//     `requirement_evaluations` live on the same handful of heap pages, so
//     three tuples read by suite A relation-locks the table against suite B's
//     inserts — disjoint rows and all.
//   - The decision then burns its retries on a conflict that is not real and
//     returns 409 `DECISION_CONFLICT`, surfacing as `expected 409 to be 200`
//     (CI run 30241538767, `holdPointBatchReleaseDecision.db.test.ts`).
//
// Jittered backoff (shipped alongside this) makes the retry loop survive a
// short conflict, but measured over 12 concurrent suites it still failed 2 runs
// in 4 — the contention is sustained, not momentary. Predicate locks are scoped
// to a relation, and relations do not span databases, so giving each worker its
// own database removes the conflict rather than out-waiting it.
//
// ponytail: a database per WORKER, not per test file. Vitest reuses ~N worker
// processes for hundreds of files, so N clones cover every file, and a clone is
// a `CREATE DATABASE ... TEMPLATE` file copy (~0.3 s) rather than a migration.

import os from 'node:os';

/** `SITEPROOF_TEST_WORKER_DATABASES` value that keeps every worker on the shared DB. */
export const WORKER_DATABASES_OFF = 'off';

/**
 * How many worker databases {@link ../../vitest.globalSetup.ts} provisions, and
 * the `maxWorkers` `vitest.config.ts` pins so the two cannot disagree.
 *
 * Capped at 4 — the number of vCPUs a GitHub runner has, so CI loses nothing,
 * and a 16-core dev box does not pay for 15 clones of the schema to gain
 * parallelism it is already I/O-bound out of.
 */
export const TEST_WORKER_COUNT = Math.max(
  1,
  Math.min((os.availableParallelism?.() ?? os.cpus().length) - 1, 4),
);

/** `siteproof_test` -> `siteproof_test_w3`. Every worker DB keeps the `test` marker. */
export function workerDatabaseName(baseName: string, workerId: number): string {
  return `${baseName}_w${workerId}`;
}

/**
 * The base (template) database name in a Postgres connection URL, or null when
 * the URL is unusable — an unparseable or database-less URL is left alone for
 * `assertSafeTestDatabaseUrl` to reject with its own message.
 */
export function databaseNameFromUrl(url: string): string | null {
  try {
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
    return name || null;
  } catch {
    return null;
  }
}

/** The same URL pointed at `database`. */
export function withDatabaseName(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(database)}`;
  return parsed.toString();
}

/**
 * This worker's database URL.
 *
 * Returns `url` unchanged when there is no worker id (a plain `node` script, or
 * a vitest pool that does not set `VITEST_POOL_ID`) or when the URL carries no
 * database name — never invent a target the global setup did not provision.
 */
export function workerDatabaseUrl(url: string, poolId: string | undefined): string {
  const workerId = Number(poolId);
  if (!Number.isInteger(workerId) || workerId < 1) return url;
  const baseName = databaseNameFromUrl(url);
  if (!baseName) return url;
  // Modulo, so a pool larger than the provisioned set degrades to sharing a
  // database rather than connecting to one that does not exist.
  const slot = ((workerId - 1) % TEST_WORKER_COUNT) + 1;
  return withDatabaseName(url, workerDatabaseName(baseName, slot));
}
