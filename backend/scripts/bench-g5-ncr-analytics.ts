/**
 * Wave G G5 benchmark — §8 P4: `GET /api/ncrs/analytics/:projectId` at 5,000
 * NCRs on one project, target **p95 < 2s**.
 *
 * The spec names the shipped implementation as one that will not meet this: it
 * loaded every matching NCR into memory with `findMany` and aggregated in JS,
 * with no pagination, and returned a `drillDown` block carrying every NCR id in
 * every bucket. G5 moved the breakdowns to SQL aggregation.
 *
 * So this script measures BOTH, on the same dataset, in the same process:
 *
 *   - the route as shipped after G5 (SQL `groupBy` + three parameterised raw
 *     queries), and
 *   - a faithful reproduction of the pre-G5 in-memory pass, run against the same
 *     rows.
 *
 * A "we made it faster" claim with only the after number is not evidence, and
 * the before number is unmeasurable once the code is gone. Both go in the
 * committed record.
 *
 * Run (local disposable DB only — `assertSafeTestDatabaseUrl` refuses anything
 * non-local or without a test/e2e/ci marker in the name):
 *
 *   cd backend
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test \
 *     npm run bench:g5
 *
 * Flags: --ncrs=N (default 5000), --subs=N (default 40),
 *        --iterations=N (default 8; the first is discarded as cold),
 *        --no-write (skip the committed JSON record), --keep (leave the data).
 */

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Agent } from 'node:http';
import { performance } from 'node:perf_hooks';

import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';

import { machineBlock, sampleMachineLoad, writeBenchResult } from './benchResults.js';

const STARTED_AT = new Date().toISOString();

dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'UTC';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'g5-benchmark-local-jwt-secret-not-a-production-secret';

// Dynamic, and only after the safety guard: a static import would construct the
// Prisma client (reading DATABASE_URL) before the guard could reject a
// non-local target. Same reasoning as `bench-c3-test-coverage.ts`.
const { assertSafeTestDatabaseUrl } = await import('../src/test/databaseSafety.js');
assertSafeTestDatabaseUrl();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (point it at a local disposable test database)');
}

const { prisma } = await import('../src/lib/prisma.js');
const { authRouter } = await import('../src/routes/auth.js');
const { ncrsRouter } = await import('../src/routes/ncrs/index.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { registerTestUser } = await import('../src/test/routeTestHarness.js');

function flag(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return raw ? Number(raw.split('=')[1]) : fallback;
}

const TOTAL_NCRS = flag('ncrs', 5000);
const TOTAL_SUBS = flag('subs', 40);
const ITERATIONS = flag('iterations', 8);
const SEED_CHUNK = 1000;
const P4_BUDGET_MS = 2000;
const RUN_ID = `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;
const tag = `bench-g5-${RUN_ID}`;

const CATEGORIES = ['materials', 'workmanship', 'documentation', 'process', 'design', 'other'];
const ROOT_CAUSES = ['human_error', 'equipment', 'materials', 'process', 'training', 'other'];
const STATUSES = ['open', 'investigating', 'rectification', 'verification', 'closed'];

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use(errorHandler);

const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 4 });
const server: Server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/**
 * The pre-G5 aggregation, reproduced faithfully enough to be a fair
 * counterfactual: one unbounded `findMany` over the project's NCRs, every
 * breakdown computed in JS, and the per-bucket id arrays the old `drillDown`
 * block emitted. Nothing here is called by the product — it exists so the
 * "before" side of the comparison is a measurement rather than a memory.
 */
async function legacyAggregation(projectId: string): Promise<number> {
  const ncrs = await prisma.nCR.findMany({
    where: { projectId },
    select: {
      id: true,
      ncrNumber: true,
      status: true,
      severity: true,
      category: true,
      rootCauseCategory: true,
      raisedAt: true,
      closedAt: true,
      dueDate: true,
      responsibleSubcontractorId: true,
      description: true,
    },
  });

  const rootCauseBreakdown: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  for (const ncr of ncrs) {
    const cause = ncr.rootCauseCategory || 'Not categorized';
    rootCauseBreakdown[cause] = (rootCauseBreakdown[cause] || 0) + 1;
    const category = ncr.category || 'Uncategorized';
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    statusBreakdown[ncr.status] = (statusBreakdown[ncr.status] || 0) + 1;
  }

  const subcontractorIssues: Record<string, { ncrIds: string[]; categories: string[] }> = {};
  for (const ncr of ncrs) {
    if (!ncr.responsibleSubcontractorId) continue;
    const bucket = subcontractorIssues[ncr.responsibleSubcontractorId] ?? {
      ncrIds: [],
      categories: [],
    };
    bucket.ncrIds.push(ncr.id);
    if (!bucket.categories.includes(ncr.category || 'Uncategorized')) {
      bucket.categories.push(ncr.category || 'Uncategorized');
    }
    subcontractorIssues[ncr.responsibleSubcontractorId] = bucket;
  }

  // The unbounded per-bucket id arrays — the shape [GR-N4] flags, doubled.
  const drillDown = {
    rootCause: Object.fromEntries(
      Object.keys(rootCauseBreakdown).map((cause) => [
        cause,
        ncrs
          .filter((ncr) => (ncr.rootCauseCategory || 'Not categorized') === cause)
          .map((n) => n.id),
      ]),
    ),
    category: Object.fromEntries(
      Object.keys(categoryBreakdown).map((category) => [
        category,
        ncrs.filter((ncr) => (ncr.category || 'Uncategorized') === category).map((n) => n.id),
      ]),
    ),
  };

  // Serialising is part of the cost the client actually pays.
  return JSON.stringify({ drillDown, subcontractorIssues, statusBreakdown }).length;
}

async function main(): Promise<void> {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  const user = await registerTestUser(app, {
    emailPrefix: 'bench-g5',
    fullName: 'Bench G5 User',
    companyId: company.id,
    roleInCompany: 'owner',
  });

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId: company.id,
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  await prisma.projectUser.create({
    data: { projectId: project.id, userId: user.userId, role: 'quality_manager', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: { projectId: project.id, name: `Tpl ${tag}`, activityType: 'earthworks_general' },
  });
  // Enough distinct items that the recurrence grouping has real work: the
  // lineage walk and the per-item detail fetch are the two new queries.
  const items = await Promise.all(
    Array.from({ length: 25 }, (_unused, index) =>
      prisma.iTPChecklistItem.create({
        data: {
          templateId: template.id,
          description: `Checklist item ${index}`,
          sequenceNumber: index + 1,
        },
      }),
    ),
  );

  const subs = await Promise.all(
    Array.from({ length: TOTAL_SUBS }, (_unused, index) =>
      prisma.subcontractorCompany.create({
        data: {
          projectId: project.id,
          companyName: `Sub ${index} ${tag}`,
          primaryContactName: 'Contact',
          primaryContactEmail: `${tag}-sub-${index}@example.com`,
          status: 'approved',
        },
      }),
    ),
  );

  // One lot per 50 NCRs, half of them with a null activitySlug so the
  // "activity not classified" join has both branches to walk.
  const lotCount = Math.max(1, Math.floor(TOTAL_NCRS / 50));
  await prisma.lot.createMany({
    data: Array.from({ length: lotCount }, (_unused, index) => ({
      projectId: project.id,
      lotNumber: `${tag}-L${index}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: index % 2 === 0 ? 'earthworks_general' : null,
      status: 'in_progress',
    })),
  });
  const lots = await prisma.lot.findMany({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { lotNumber: 'asc' },
  });

  process.stdout.write(`seeding ${TOTAL_NCRS} NCRs across ${TOTAL_SUBS} subcontractors…\n`);
  const now = Date.now();
  for (let offset = 0; offset < TOTAL_NCRS; offset += SEED_CHUNK) {
    const size = Math.min(SEED_CHUNK, TOTAL_NCRS - offset);
    await prisma.nCR.createMany({
      data: Array.from({ length: size }, (_unused, chunkIndex) => {
        const index = offset + chunkIndex;
        const closed = index % 5 === 0;
        // Spread across ~24 months so the monthly trend queries group real buckets.
        const raisedAt = new Date(now - (index % 730) * 24 * 60 * 60 * 1000);
        return {
          projectId: project.id,
          ncrNumber: `${tag}-N${index}`,
          description: `Bench NCR ${index}`,
          // A tenth off-vocabulary, so the folding does real work.
          category: index % 10 === 0 ? `Legacy free text ${index % 7}` : CATEGORIES[index % 6],
          rootCauseCategory: index % 11 === 0 ? null : ROOT_CAUSES[index % 6],
          severity: index % 4 === 0 ? 'major' : 'minor',
          status: closed ? 'closed' : STATUSES[index % 5],
          raisedById: user.userId,
          raisedAt,
          closedAt: closed ? new Date(raisedAt.getTime() + 6 * 24 * 60 * 60 * 1000) : null,
          dueDate: new Date(raisedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
          responsibleSubcontractorId: subs[index % TOTAL_SUBS].id,
          // Two thirds carry the checklist-item link, which is roughly the
          // coverage a project that adopted G5 mid-stream would have.
          itpChecklistItemId: index % 3 === 0 ? null : items[index % items.length].id,
        };
      }),
    });
  }

  const ncrRows = await prisma.nCR.findMany({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { ncrNumber: 'asc' },
  });
  for (let offset = 0; offset < ncrRows.length; offset += SEED_CHUNK) {
    await prisma.nCRLot.createMany({
      data: ncrRows.slice(offset, offset + SEED_CHUNK).map((ncr, chunkIndex) => ({
        ncrId: ncr.id,
        lotId: lots[(offset + chunkIndex) % lots.length].id,
      })),
    });
  }

  process.stdout.write(`measuring ${ITERATIONS} iterations (first discarded as cold)…\n`);
  const machine = await machineBlock();
  const routeMs: number[] = [];
  const legacyMs: number[] = [];
  let cold = 0;
  let shape = '';
  let responseBytes = 0;
  let legacyBytes = 0;

  for (let run = 0; run < ITERATIONS; run += 1) {
    let started = performance.now();
    const res = await request(baseUrl)
      .get(`/api/ncrs/analytics/${project.id}`)
      .agent(keepAliveAgent)
      .set('Authorization', `Bearer ${user.token}`);
    const elapsed = performance.now() - started;
    if (res.status !== 200) throw new Error(`route returned ${res.status}: ${res.text}`);
    if (run === 0) {
      cold = elapsed;
      responseBytes = JSON.stringify(res.body).length;
      shape =
        `${res.body.summary.total} NCRs · ${res.body.repeatOffenders.data.length} offenders · ` +
        `${res.body.recurringItems.data.length} recurring items · ` +
        `${res.body.charts.activity.data.length} activity buckets`;
    } else {
      routeMs.push(elapsed);
    }

    started = performance.now();
    legacyBytes = await legacyAggregation(project.id);
    if (run > 0) legacyMs.push(performance.now() - started);
  }

  const line = (values: number[]) => values.map((value) => Math.round(value)).join(' / ');
  process.stdout.write(`\n  shape: ${shape}\n`);
  process.stdout.write(`  cold first call: ${Math.round(cold)} ms\n`);
  process.stdout.write(`  GET /api/ncrs/analytics/:projectId: ${line(routeMs)} ms\n`);
  process.stdout.write(
    `    median ${Math.round(percentile(routeMs, 50))} ms · p95 ${Math.round(
      percentile(routeMs, 95),
    )} ms (P4 budget ${P4_BUDGET_MS} ms)\n`,
  );
  process.stdout.write(`  pre-G5 in-memory aggregation: ${line(legacyMs)} ms\n`);
  process.stdout.write(
    `    median ${Math.round(percentile(legacyMs, 50))} ms · p95 ${Math.round(
      percentile(legacyMs, 95),
    )} ms\n`,
  );
  process.stdout.write(
    `  payload: ${Math.round(responseBytes / 1024)} KiB now vs ` +
      `${Math.round(legacyBytes / 1024)} KiB of drilldown/offender arrays before\n\n`,
  );

  if (!process.argv.includes('--no-write')) {
    const summary = (values: number[]) => ({
      n: values.length,
      minMs: Math.round(Math.min(...values)),
      medianMs: Math.round(percentile(values, 50)),
      p95Ms: Math.round(percentile(values, 95)),
      maxMs: Math.round(Math.max(...values)),
      samplesMs: values.map((value) => Math.round(value)),
    });
    const shipped = summary(routeMs);
    const legacy = summary(legacyMs);
    const out = writeBenchResult('g5-ncr-analytics', {
      benchmark: 'wave-g/G5 NCR analytics read',
      spec: 'docs/plans/wave-g-execution-spec-2026-07-31.md §8 P4 (p95 < 2s at 5,000 NCRs/project)',
      startedAt: STARTED_AT,
      finishedAt: new Date().toISOString(),
      machine: { ...machine, loadAfterMeasurement: await sampleMachineLoad() },
      options: { ncrs: TOTAL_NCRS, subcontractors: TOTAL_SUBS, iterations: ITERATIONS },
      shape,
      results: {
        shippedRoute: { route: 'GET /api/ncrs/analytics/:projectId', ...shipped },
        legacyInMemory: { call: 'pre-G5 findMany + JS aggregation (reproduced)', ...legacy },
        coldFirstCallMs: Math.round(cold),
        responseBytes,
        legacyDrilldownBytes: legacyBytes,
      },
      verdict: {
        budgetMs: P4_BUDGET_MS,
        p95Ms: shipped.p95Ms,
        pass: shipped.p95Ms < P4_BUDGET_MS,
      },
    });
    process.stdout.write(`  results: ${out}\n\n`);
  }

  if (!process.argv.includes('--keep')) {
    await prisma.nCR.deleteMany({ where: { projectId: project.id } });
    await prisma.lot.deleteMany({ where: { projectId: project.id } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId: project.id } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId: project.id } });
    await prisma.projectUser.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
  server.close();
  keepAliveAgent.destroy();
}
