/**
 * F0.5 exit-gate benchmark (execution spec §8, Rev 3.1).
 *
 * Measures the three numbers the F0.5 gate names, by driving the REAL route
 * handlers over supertest against a LOCAL disposable Postgres:
 *
 *   A. Claim inclusion decision at the 5,000-member ceiling — target p95 < 2s
 *      (`READINESS_SNAPSHOTS_ENABLED=true`, chunked `createMany` member
 *      snapshots). Verifies 5,001 snapshot rows in <= 11 chunks, every member
 *      result <= 1 KB, the aggregate <= 64 KB.
 *   B. Single-entity decision overhead — target < 50ms p95 for the audit row +
 *      snapshot insert inside the decision transaction. Measured on lot conform
 *      (`POST /api/lots/:id/conform`), the representative single-entity
 *      decision, two ways: the directly-measured in-transaction audit+snapshot
 *      time, and the flag-ON minus flag-OFF route-latency delta.
 *   C. Paginated claim-readiness (the F0.2a cursor API) at pages of 100 and 500
 *      over the 5,000-lot dataset.
 *
 * Phase attribution comes from the existing `usePrismaMiddleware` shim
 * (`src/lib/prisma.ts`), so NO product code is instrumented for this benchmark.
 * `$queryRaw` does not pass through the model-operation extension, so the raw
 * `SELECT ... FOR UPDATE` lock time lands in the reported "unattributed"
 * remainder alongside JS/serialisation time.
 *
 * Run (local disposable DB only — `assertSafeTestDatabaseUrl` refuses anything
 * non-local or without a test/e2e/ci marker in the name):
 *
 *   cd backend
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test_f05bench \
 *     npm run bench:f05
 *
 * Flags: --claim-iterations=N (default 20), --entity-iterations=N (default 50),
 *        --page-iterations=N (default 20), --lots=N (default 5000),
 *        --keep (skip teardown so the seeded dataset can be inspected).
 */

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Agent } from 'node:http';
import { performance } from 'node:perf_hooks';

import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';

dotenv.config();

// Defaults matching `vitest.config.ts`, so the routes behave as they do under
// the DB-backed suites: local storage, UTC, no production integrations.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'UTC';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'f05-benchmark-local-jwt-secret-not-a-production-secret';

// Product modules are imported DYNAMICALLY and only after the database-safety
// guard has run: a static import would construct the Prisma client (reading
// DATABASE_URL) before the guard could reject a non-local target.
const { assertSafeTestDatabaseUrl } = await import('../src/test/databaseSafety.js');
assertSafeTestDatabaseUrl();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (point it at a local disposable test database)');
}

const { prisma, usePrismaMiddleware } = await import('../src/lib/prisma.js');
const { authRouter } = await import('../src/routes/auth.js');
const { default: claimsRouter } = await import('../src/routes/claims.js');
const { lotsRouter } = await import('../src/routes/lots.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { registerTestUser } = await import('../src/test/routeTestHarness.js');
const { buildTemplateSnapshot } = await import('../src/routes/itp/helpers/templateSnapshot.js');
const { MEMBER_RESULT_MAX_BYTES, RESULT_MAX_BYTES, SNAPSHOT_CHUNK_SIZE } =
  await import('../src/lib/readiness/recordDecision.js');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function intArg(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const parsed = Number(raw.slice(name.length + 3));
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

const LOT_COUNT = intArg('lots', 5000);
const CLAIM_ITERATIONS = intArg('claim-iterations', 20);
const ENTITY_ITERATIONS = intArg('entity-iterations', 50);
const PAGE_ITERATIONS = intArg('page-iterations', 20);
const KEEP_DATA = process.argv.includes('--keep');
/** `--only=A`, `--only=BC`, … to re-run one section. Default: all three. */
const ONLY = (
  process.argv.find((arg) => arg.startsWith('--only='))?.slice(7) ?? 'ABCD'
).toUpperCase();

// ---------------------------------------------------------------------------
// Prisma operation recorder (existing `$use` compatibility shim — tests only)
// ---------------------------------------------------------------------------

interface OpSample {
  key: string;
  ms: number;
}

const recorder = { on: false, ops: [] as OpSample[] };

usePrismaMiddleware(async (params, next) => {
  if (!recorder.on) return next(params);
  const started = performance.now();
  try {
    return await next(params);
  } finally {
    // The `(include)` suffix separates the two `Lot.findMany` calls the claim
    // decision fires: the plain eligibility read and the deep conformance
    // hydration. They differ by ~2 orders of magnitude, so collapsing them
    // would hide the bottleneck.
    const deep = params.args && typeof params.args === 'object' && 'include' in params.args;
    recorder.ops.push({
      key: `${params.model ?? 'raw'}.${params.action}${deep ? '(include)' : ''}`,
      ms: performance.now() - started,
    });
  }
});

function startRecording(): void {
  recorder.ops = [];
  recorder.on = true;
}

function stopRecording(): OpSample[] {
  recorder.on = false;
  return recorder.ops;
}

function sumOps(ops: OpSample[], keys: string[]): number {
  const wanted = new Set(keys);
  return ops.filter((op) => wanted.has(op.key)).reduce((total, op) => total + op.ms, 0);
}

function countOps(ops: OpSample[], key: string): number {
  return ops.filter((op) => op.key === key).length;
}

/** Per-operation totals, heaviest first — the bottleneck breakdown. */
function opBreakdown(ops: OpSample[]): { key: string; calls: number; ms: number }[] {
  const totals = new Map<string, { calls: number; ms: number }>();
  for (const op of ops) {
    const entry = totals.get(op.key) ?? { calls: 0, ms: 0 };
    entry.calls += 1;
    entry.ms += op.ms;
    totals.set(op.key, entry);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.ms - a.ms);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface Stats {
  n: number;
  p50: number;
  p95: number;
  max: number;
  min: number;
  mean: number;
}

function stats(samples: number[]): Stats {
  if (samples.length === 0) throw new Error('no samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return {
    n: sorted.length,
    min: sorted[0],
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

const ms = (value: number) => `${value.toFixed(1)}ms`;

function reportStats(label: string, samples: number[]): Stats {
  const s = stats(samples);
  console.log(
    `  ${label.padEnd(46)} n=${String(s.n).padStart(3)}  p50=${ms(s.p50).padStart(9)}  ` +
      `p95=${ms(s.p95).padStart(9)}  max=${ms(s.max).padStart(9)}  mean=${ms(s.mean).padStart(9)}`,
  );
  return s;
}

function verdict(label: string, actual: number, budget: number): void {
  const pass = actual <= budget;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${label} — p95 ${ms(actual)} vs budget ${ms(budget)}` +
      `  (${((actual / budget) * 100).toFixed(0)}% of budget)`,
  );
  if (!pass) failures.push(`${label}: p95 ${ms(actual)} > ${ms(budget)}`);
}

const failures: string[] = [];

// ---------------------------------------------------------------------------
// App under test — the real routers, mounted as `src/server.ts` mounts them.
// ---------------------------------------------------------------------------

const app = express();
// 10mb, not the 100kb default: a 5,000-lot claim body is ~350KB.
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/projects', claimsRouter);
app.use(errorHandler);

// ONE long-lived listener with keep-alive, not supertest's default
// server-per-request: a 500-item claim-readiness response over a fresh
// per-request socket resets the connection on Windows, and per-request listen()
// churn would otherwise sit inside every measurement.
const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 4 });
const server: Server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

/** An authenticated supertest request against the live listener. */
function api(method: 'get' | 'post', path: string) {
  return request(baseUrl)
    [method](path)
    .agent(keepAliveAgent)
    .set('Authorization', `Bearer ${authToken}`);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const RUN_ID = `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;
const CHECKLIST_ITEM_COUNT = 12;
const SEED_CHUNK = 2000;
const ACTIVITY_TYPES = ['Earthworks', 'Subgrade', 'Pavement', 'Drainage', 'Concrete'];

async function createManyChunked<T>(
  label: string,
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += SEED_CHUNK) {
    await insert(rows.slice(start, start + SEED_CHUNK));
  }
  console.log(`    seeded ${rows.length} ${label}`);
}

interface SeededProject {
  projectId: string;
  lotIds: string[];
}

let companyId: string;
let userId: string;
let authToken: string;

async function bootstrapTenant(): Promise<void> {
  const company = await prisma.company.create({ data: { name: `F0.5 Bench Co ${RUN_ID}` } });
  companyId = company.id;

  const user = await registerTestUser(app, {
    emailPrefix: 'f05-bench',
    fullName: 'F0.5 Bench PM',
    companyId,
    roleInCompany: 'project_manager',
  });
  authToken = user.token;
  userId = user.userId;
}

/**
 * A project of `lotCount` lots, each with a real ITP instance (12 items, all
 * completed, none test-gated) so the conformance gate reads production-shaped
 * data rather than a bare legacy lot: `checkConformancePrerequisitesBatch`
 * hydrates `itpInstance -> template -> checklistItems` + `completions` for every
 * lot in the decision, and that hydration is the dominant cost at 5,000 lots.
 */
async function seedProject(
  name: string,
  lotCount: number,
  lotStatus: string,
): Promise<SeededProject> {
  console.log(`  seeding project "${name}" (${lotCount} lots, status=${lotStatus})...`);
  const project = await prisma.project.create({
    data: {
      name: `${name} ${RUN_ID}`,
      projectNumber: `F05-${name.replace(/\W+/g, '').slice(0, 8)}-${RUN_ID}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  await prisma.projectUser.create({
    data: { projectId: project.id, userId, role: 'project_manager', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: project.id,
      name: `Earthworks ITP ${RUN_ID}`,
      activityType: 'Earthworks',
      stateSpec: 'TfNSW',
      checklistItems: {
        create: Array.from({ length: CHECKLIST_ITEM_COUNT }, (_, index) => ({
          sequenceNumber: index + 1,
          description: `Inspection point ${index + 1} — verify to R44 clause ${index + 1}`,
          acceptanceCriteria: 'Conforms to specification',
          pointType: index === 3 ? 'witness' : 'standard',
          responsibleParty: 'contractor',
          // `evidenceRequired: 'none'` + no `testType` keeps `itpRequiresTest`
          // false, so a completed checklist is genuinely conformable without
          // also seeding 5,000 verified lab results.
          evidenceRequired: 'none',
        })),
      },
    },
    include: { checklistItems: true },
  });
  const templateSnapshot = JSON.stringify(buildTemplateSnapshot(template));

  const conformedAt = lotStatus === 'conformed' ? new Date('2026-07-01T00:00:00.000Z') : null;
  const lots = Array.from({ length: lotCount }, (_, index) => {
    const chainageStart = index * 20;
    const padded = String(index + 1).padStart(4, '0');
    return {
      id: randomUUID(),
      projectId: project.id,
      // Realistic AU civil chainage lot number, zero-padded so the register's
      // natural key order (`lotNumber ASC, id ASC`) is stable for keyset paging.
      lotNumber: `EW-L${padded}-CH${chainageStart}`,
      lotType: 'chainage',
      description: `Bulk earthworks CH ${chainageStart} to ${chainageStart + 20}`,
      chainageStart,
      chainageEnd: chainageStart + 20,
      layer: 'Subgrade',
      activityType: ACTIVITY_TYPES[index % ACTIVITY_TYPES.length],
      status: lotStatus,
      itpTemplateId: template.id,
      budgetAmount: 12_500 + (index % 40) * 250,
      createdById: userId,
      conformedAt,
      conformedById: conformedAt ? userId : null,
    };
  });
  await createManyChunked('lots', lots, (chunk) => prisma.lot.createMany({ data: chunk }));

  const instances = lots.map((lot) => ({
    id: randomUUID(),
    lotId: lot.id,
    templateId: template.id,
    templateSnapshot,
    status: 'completed',
  }));
  await createManyChunked('ITP instances', instances, (chunk) =>
    prisma.iTPInstance.createMany({ data: chunk }),
  );

  const completedAt = new Date('2026-06-30T00:00:00.000Z');
  const completions = instances.flatMap((instance) =>
    template.checklistItems.map((item) => ({
      itpInstanceId: instance.id,
      checklistItemId: item.id,
      status: 'completed',
      completedById: userId,
      completedAt,
      verificationStatus: 'none',
    })),
  );
  await createManyChunked('ITP completions', completions, (chunk) =>
    prisma.iTPCompletion.createMany({ data: chunk }),
  );

  return { projectId: project.id, lotIds: lots.map((lot) => lot.id) };
}

// ---------------------------------------------------------------------------
// A. Claim inclusion decision at the 5,000-member ceiling
// ---------------------------------------------------------------------------

const EVALUATE_OPS = [
  'ProgressClaim.findFirst',
  'Lot.findMany',
  'Lot.findMany(include)',
  'HoldPoint.findMany',
  'Variation.findMany',
  'ClaimedLot.findMany',
  'ClaimedLot.aggregate',
  'ClaimedLot.groupBy',
];
const MUTATE_OPS = [
  'ProgressClaim.create',
  'ProgressClaim.create(include)',
  'ProgressClaim.findUniqueOrThrow(include)',
  'Variation.updateMany',
  'Lot.updateMany',
  'ProgressClaim.findUniqueOrThrow',
];
const AUDIT_OPS = ['AuditLog.create'];
const SNAPSHOT_OP = 'RequirementEvaluation.createManyAndReturn';

/** Fresh claim state for the next iteration: delete the decision, re-open the lots. */
async function resetClaimState(projectId: string): Promise<void> {
  await prisma.lot.updateMany({
    where: { projectId },
    data: { status: 'conformed', claimedInId: null },
  });
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
  await prisma.progressClaim.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
}

interface ClaimIteration {
  totalMs: number;
  ops: OpSample[];
}

async function runClaimDecision(project: SeededProject): Promise<ClaimIteration> {
  const body = {
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    // 100% of every lot: the worst case — all 5,000 members flip to `claimed`,
    // so the `lot.updateMany` and the member snapshot chunking both run at full
    // width.
    lots: project.lotIds.map((lotId) => ({ lotId, percentageComplete: 100 })),
  };

  startRecording();
  const started = performance.now();
  const res = await api('post', `/api/projects/${project.projectId}/claims`).send(body);
  const totalMs = performance.now() - started;
  const ops = stopRecording();

  if (res.status !== 201) {
    throw new Error(`claim create failed: ${res.status} ${JSON.stringify(res.body).slice(0, 500)}`);
  }
  return { totalMs, ops };
}

interface SnapshotAudit {
  totalRows: number;
  aggregateRows: number;
  memberRows: number;
  chunkCalls: number;
  maxMemberBytes: number;
  maxAggregateBytes: number;
}

async function auditSnapshotRows(projectId: string, ops: OpSample[]): Promise<SnapshotAudit> {
  const rows = await prisma.requirementEvaluation.findMany({
    where: { projectId },
    select: { entityType: true, result: true },
  });
  let maxMemberBytes = 0;
  let maxAggregateBytes = 0;
  let memberRows = 0;
  let aggregateRows = 0;
  for (const row of rows) {
    const bytes = Buffer.byteLength(JSON.stringify(row.result), 'utf8');
    if (row.entityType === 'claim_lot' || row.entityType === 'claim_variation') {
      memberRows += 1;
      maxMemberBytes = Math.max(maxMemberBytes, bytes);
    } else {
      aggregateRows += 1;
      maxAggregateBytes = Math.max(maxAggregateBytes, bytes);
    }
  }
  return {
    totalRows: rows.length,
    aggregateRows,
    memberRows,
    chunkCalls: countOps(ops, SNAPSHOT_OP),
    maxMemberBytes,
    maxAggregateBytes,
  };
}

function check(label: string, pass: boolean, detail: string): void {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label} — ${detail}`);
  if (!pass) failures.push(`${label}: ${detail}`);
}

async function benchClaimDecisions(project: SeededProject): Promise<void> {
  console.log(`\n=== A. Claim inclusion decision (${LOT_COUNT} members, flag ON) ===`);
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';

  const samples: number[] = [];
  let lastOps: OpSample[] = [];
  let snapshotAudit: SnapshotAudit | null = null;
  const phase = {
    evaluate: [] as number[],
    mutate: [] as number[],
    audit: [] as number[],
    snapshot: [] as number[],
  };

  for (let iteration = 1; iteration <= CLAIM_ITERATIONS; iteration += 1) {
    await resetClaimState(project.projectId);
    const { totalMs, ops } = await runClaimDecision(project);
    samples.push(totalMs);
    lastOps = ops;
    phase.evaluate.push(sumOps(ops, EVALUATE_OPS));
    phase.mutate.push(sumOps(ops, MUTATE_OPS));
    phase.audit.push(sumOps(ops, AUDIT_OPS));
    phase.snapshot.push(sumOps(ops, [SNAPSHOT_OP]));
    // Audit the snapshot rows on the first iteration, while the decision's rows
    // are the only ones in the project.
    if (iteration === 1) snapshotAudit = await auditSnapshotRows(project.projectId, ops);
    console.log(`    iteration ${String(iteration).padStart(2)}: ${ms(totalMs)}`);
  }

  console.log('\n  route latency (POST /api/projects/:projectId/claims):');
  const total = reportStats(`claim create, ${LOT_COUNT} members, flag ON`, samples);

  console.log('\n  in-decision phase attribution (measured Prisma op time):');
  reportStats('evaluate  (reads inside the transaction)', phase.evaluate);
  reportStats('mutate    (claim + members + status flips)', phase.mutate);
  reportStats('audit     (AuditLog.create)', phase.audit);
  reportStats(`snapshot  (${SNAPSHOT_OP})`, phase.snapshot);
  const unattributed = samples.map(
    (value, index) =>
      value -
      phase.evaluate[index] -
      phase.mutate[index] -
      phase.audit[index] -
      phase.snapshot[index],
  );
  // Everything not in the four buckets: the pre-transaction auth/role reads,
  // the raw `SELECT ... FOR UPDATE` locks (invisible to the model-operation
  // extension), body parsing, and JS. See the op breakdown below for the split.
  reportStats('unattributed (auth reads, raw locks, JS)', unattributed);

  console.log('\n  heaviest operations, last iteration:');
  for (const row of opBreakdown(lastOps).slice(0, 12)) {
    console.log(`    ${row.key.padEnd(44)} calls=${String(row.calls).padStart(3)}  ${ms(row.ms)}`);
  }

  console.log('\n  snapshot verification (first iteration):');
  const expectedChunks = Math.ceil((LOT_COUNT + 1) / SNAPSHOT_CHUNK_SIZE);
  const audit = snapshotAudit!;
  check(
    'snapshot rows',
    audit.totalRows === LOT_COUNT + 1 &&
      audit.aggregateRows === 1 &&
      audit.memberRows === LOT_COUNT,
    `${audit.totalRows} rows = ${audit.aggregateRows} aggregate + ${audit.memberRows} members (expected ${LOT_COUNT + 1} = 1 + ${LOT_COUNT})`,
  );
  check(
    'createMany chunks',
    audit.chunkCalls === expectedChunks && audit.chunkCalls <= 11,
    `${audit.chunkCalls} ${SNAPSHOT_OP} calls (expected ${expectedChunks} at chunk size ${SNAPSHOT_CHUNK_SIZE}, budget <= 11)`,
  );
  check(
    'member result size',
    audit.maxMemberBytes <= MEMBER_RESULT_MAX_BYTES,
    `max ${audit.maxMemberBytes} bytes vs ${MEMBER_RESULT_MAX_BYTES}-byte budget`,
  );
  check(
    'aggregate result size',
    audit.maxAggregateBytes <= RESULT_MAX_BYTES,
    `max ${audit.maxAggregateBytes} bytes vs ${RESULT_MAX_BYTES}-byte budget`,
  );

  // The same decision with snapshots OFF: the pre-F0.4b-PR5 cost of this route,
  // so the results can say whether the snapshot work is what misses the budget.
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
  const flagOff: number[] = [];
  for (let iteration = 1; iteration <= CLAIM_ITERATIONS; iteration += 1) {
    await resetClaimState(project.projectId);
    flagOff.push((await runClaimDecision(project)).totalMs);
  }
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
  console.log('\n  same decision with snapshots OFF (baseline):');
  const off = reportStats(`claim create, ${LOT_COUNT} members, flag OFF`, flagOff);
  console.log(
    `  ${'snapshot cost (flag ON p95 - flag OFF p95)'.padEnd(46)} ${ms(total.p95 - off.p95)}`,
  );

  console.log('');
  verdict(`Target 1: claim decision at ${LOT_COUNT} members`, total.p95, 2000);
  await resetClaimState(project.projectId);
}

// ---------------------------------------------------------------------------
// B. Single-entity decision overhead (lot conform)
// ---------------------------------------------------------------------------

async function conformLot(lotId: string): Promise<{ totalMs: number; ops: OpSample[] }> {
  startRecording();
  const started = performance.now();
  const res = await api('post', `/api/lots/${lotId}/conform`).send({});
  const totalMs = performance.now() - started;
  const ops = stopRecording();
  if (res.status !== 200) {
    throw new Error(`conform failed: ${res.status} ${JSON.stringify(res.body).slice(0, 500)}`);
  }
  return { totalMs, ops };
}

async function benchSingleEntityDecision(project: SeededProject): Promise<void> {
  console.log('\n=== B. Single-entity decision (lot conform) ===');
  if (project.lotIds.length < ENTITY_ITERATIONS * 2) {
    throw new Error('not enough seeded lots for the single-entity benchmark');
  }
  const onLots = project.lotIds.slice(0, ENTITY_ITERATIONS);
  const offLots = project.lotIds.slice(ENTITY_ITERATIONS, ENTITY_ITERATIONS * 2);

  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
  const onSamples: number[] = [];
  const overhead: number[] = [];
  for (const lotId of onLots) {
    const { totalMs, ops } = await conformLot(lotId);
    onSamples.push(totalMs);
    overhead.push(sumOps(ops, AUDIT_OPS) + sumOps(ops, [SNAPSHOT_OP]));
  }

  delete process.env.READINESS_SNAPSHOTS_ENABLED;
  const offSamples: number[] = [];
  for (const lotId of offLots) {
    const { totalMs } = await conformLot(lotId);
    offSamples.push(totalMs);
  }
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';

  console.log('\n  route latency (POST /api/lots/:id/conform):');
  const on = reportStats('flag ON  (audit + snapshot in transaction)', onSamples);
  const off = reportStats('flag OFF (audit in transaction, no snapshot)', offSamples);

  console.log('\n  decision overhead:');
  const overheadStats = reportStats('audit row + snapshot insert (measured)', overhead);
  console.log(
    `  ${'flag ON minus flag OFF (p95 delta)'.padEnd(46)} ${ms(on.p95 - off.p95)} (snapshot insert only)`,
  );

  console.log('');
  verdict('Target 2: single-entity decision overhead', overheadStats.p95, 50);
}

// ---------------------------------------------------------------------------
// C. Paginated claim-readiness (F0.2a cursor API)
// ---------------------------------------------------------------------------

async function fetchReadinessPage(
  projectId: string,
  limit: number,
  cursor?: string,
): Promise<{ totalMs: number; nextCursor: string | null; items: number; ops: OpSample[] }> {
  const query = cursor ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`;
  startRecording();
  const started = performance.now();
  const res = await api('get', `/api/projects/${projectId}/claim-readiness${query}`);
  const totalMs = performance.now() - started;
  const ops = stopRecording();
  if (res.status !== 200) {
    throw new Error(
      `claim-readiness failed: ${res.status} ${JSON.stringify(res.body).slice(0, 500)}`,
    );
  }
  return {
    totalMs,
    nextCursor: (res.body.nextCursor as string | null) ?? null,
    items: (res.body.items as unknown[]).length,
    ops,
  };
}

async function benchClaimReadiness(project: SeededProject): Promise<void> {
  console.log(`\n=== C. Paginated claim-readiness over ${LOT_COUNT} lots ===`);

  for (const limit of [100, 500]) {
    const firstPage: number[] = [];
    const deepPage: number[] = [];
    let cursor: string | null = null;
    let lastOps: OpSample[] = [];

    for (let iteration = 0; iteration < PAGE_ITERATIONS; iteration += 1) {
      const first = await fetchReadinessPage(project.projectId, limit);
      firstPage.push(first.totalMs);
      cursor = first.nextCursor;
      const expectedItems = Math.min(limit, LOT_COUNT);
      if (iteration === 0 && first.items !== expectedItems) {
        throw new Error(`expected ${expectedItems} items on page 1, got ${first.items}`);
      }
      // A mid-register page: same page size, keyset offset, and no `total` count
      // (the route only counts on the first page).
      if (cursor) {
        const deep = await fetchReadinessPage(project.projectId, limit, cursor);
        deepPage.push(deep.totalMs);
        lastOps = deep.ops;
      }
    }

    console.log(`\n  GET /api/projects/:projectId/claim-readiness?limit=${limit}`);
    const first = reportStats(`page 1 of ${limit} (includes total count)`, firstPage);
    if (deepPage.length > 0) {
      reportStats(`page 2 of ${limit} (cursor, no count)`, deepPage);
      console.log('    heaviest operations, last page:');
      for (const row of opBreakdown(lastOps).slice(0, 6)) {
        console.log(
          `      ${row.key.padEnd(42)} calls=${String(row.calls).padStart(3)}  ${ms(row.ms)}`,
        );
      }
    }
    // §8 sets no standalone API number for this endpoint; the enclosing budget
    // is `CreateClaimModal` first-page render p95 < 1s `[R2-8]`, so the API call
    // inside it is measured against that.
    verdict(`Target 3: claim-readiness page of ${limit}`, first.p95, 1000);
  }
}

// ---------------------------------------------------------------------------
// D. Diagnostic (read-only): where the 5,000-lot conformance read spends time.
//
// NOT a product change and not part of the gate — it sizes the levers named in
// the results write-up. Every instance seeded here carries a `templateSnapshot`
// (as `POST /itp/instances` writes one), and `getChecklistItemsForInstance`
// therefore reads the snapshot JSON and NEVER touches `template.checklistItems`
// — yet `CONFORMANCE_LOT_INCLUDE` hydrates those rows for every lot in the
// decision. Variant 2 measures what dropping that dead hydration would save.
// ---------------------------------------------------------------------------

async function diagnoseConformanceRead(project: SeededProject): Promise<void> {
  console.log(`\n=== D. Diagnostic: the ${LOT_COUNT}-lot conformance read (read-only) ===`);
  const ids = project.lotIds;
  const reps = 5;

  const timed = async (label: string, run: () => Promise<unknown>) => {
    const samples: number[] = [];
    for (let index = 0; index < reps; index += 1) {
      const started = performance.now();
      await run();
      samples.push(performance.now() - started);
    }
    reportStats(label, samples);
  };

  await timed('1. plain lot.findMany (eligibility read)', () =>
    prisma.lot.findMany({
      where: {
        id: { in: ids },
        projectId: project.projectId,
        status: 'conformed',
        claimedInId: null,
      },
    }),
  );
  await timed('2. CONFORMANCE_LOT_INCLUDE as shipped', () =>
    prisma.lot.findMany({
      where: { id: { in: ids } },
      include: {
        itpInstance: {
          include: { template: { include: { checklistItems: true } }, completions: true },
        },
        testResults: {
          select: {
            id: true,
            itpChecklistItemId: true,
            testType: true,
            passFail: true,
            status: true,
          },
        },
        ncrLots: {
          where: { ncr: { status: { notIn: ['closed', 'closed_concession'] } } },
          include: {
            ncr: { select: { id: true, ncrNumber: true, description: true, status: true } },
          },
        },
      },
    }),
  );
  await timed('3. same, minus template.checklistItems', () =>
    prisma.lot.findMany({
      where: { id: { in: ids } },
      include: {
        itpInstance: { include: { completions: true } },
        testResults: {
          select: {
            id: true,
            itpChecklistItemId: true,
            testType: true,
            passFail: true,
            status: true,
          },
        },
        ncrLots: {
          where: { ncr: { status: { notIn: ['closed', 'closed_concession'] } } },
          include: {
            ncr: { select: { id: true, ncrNumber: true, description: true, status: true } },
          },
        },
      },
    }),
  );
  await timed('4. same, completions narrowed to gate columns', () =>
    prisma.lot.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
        itpInstance: {
          select: {
            templateSnapshot: true,
            completions: {
              select: { checklistItemId: true, status: true, verificationStatus: true },
            },
          },
        },
        testResults: {
          select: {
            id: true,
            itpChecklistItemId: true,
            testType: true,
            passFail: true,
            status: true,
          },
        },
        ncrLots: {
          where: { ncr: { status: { notIn: ['closed', 'closed_concession'] } } },
          select: {
            ncr: { select: { id: true, ncrNumber: true, description: true, status: true } },
          },
        },
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function teardown(projectIds: string[]): Promise<void> {
  if (KEEP_DATA) {
    console.log('\n--keep: leaving the seeded dataset in place.');
    return;
  }
  for (const projectId of projectIds) {
    await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
    await prisma.progressClaim.deleteMany({ where: { projectId } });
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  }
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
  if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
}

async function shutdown(): Promise<void> {
  keepAliveAgent.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startedAt = Date.now();
const projectIds: string[] = [];

try {
  console.log('F0.5 exit-gate benchmark (execution spec §8, Rev 3.1)');
  console.log(`  database: ${new URL(process.env.DATABASE_URL).pathname.slice(1)} (local)`);
  console.log(
    `  lots=${LOT_COUNT} claim-iterations=${CLAIM_ITERATIONS} ` +
      `entity-iterations=${ENTITY_ITERATIONS} page-iterations=${PAGE_ITERATIONS}\n`,
  );

  await bootstrapTenant();

  let claimProject: SeededProject | null = null;
  if (ONLY.includes('A') || ONLY.includes('C')) {
    claimProject = await seedProject('Claim ceiling', LOT_COUNT, 'conformed');
    projectIds.push(claimProject.projectId);
  }
  // The single-entity decisions need lots that are NOT yet conformed, and they
  // must not inflate the 5,000-lot readiness dataset, so they get their own
  // project.
  let conformProject: SeededProject | null = null;
  if (ONLY.includes('B')) {
    conformProject = await seedProject('Single entity', ENTITY_ITERATIONS * 2, 'in_progress');
    projectIds.push(conformProject.projectId);
  }
  console.log(`  seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  if (claimProject && ONLY.includes('A')) await benchClaimDecisions(claimProject);
  if (conformProject) await benchSingleEntityDecision(conformProject);
  if (claimProject && ONLY.includes('C')) await benchClaimReadiness(claimProject);
  if (claimProject && ONLY.includes('D')) await diagnoseConformanceRead(claimProject);

  console.log(`\n=== Verdict ===`);
  if (failures.length === 0) {
    console.log('  ALL TARGETS PASS');
  } else {
    console.log(`  ${failures.length} FAILURE(S):`);
    for (const failure of failures) console.log(`    - ${failure}`);
  }
  console.log(`  total runtime ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  await teardown(projectIds);
  await shutdown();
  process.exit(failures.length === 0 ? 0 : 1);
} catch (error) {
  console.error('\nBENCHMARK ERROR:', error);
  await teardown(projectIds).catch(() => {});
  await shutdown().catch(() => {});
  process.exit(2);
}
