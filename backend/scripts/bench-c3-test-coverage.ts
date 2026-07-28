/**
 * Wave C3 Phase A benchmark — the testing-overlay read (spec §12, exit item 8).
 *
 * The spec is explicit that this route inherits NO budget: C1 exit item 8 has
 * no passing measurement, and the closest measured analogue is a lighter shape.
 * So the number is MEASURED, not claimed, and this script is how it is measured
 * — and re-measured, by whoever changes the batch next.
 *
 * It drives the REAL route over supertest against the program's reference
 * dataset shape (plan line 138: 5,000 lots), with `--drawn` of them carrying a
 * geometry, and prints the series plus p95.
 *
 * It also measures the SAME batch WITHOUT `[C3R-A1]`'s geometry-bearing scope,
 * because the scope is the wave's only latency lever and a lever nobody has
 * weighed is a guess.
 *
 * Run (local disposable DB only — `assertSafeTestDatabaseUrl` refuses anything
 * non-local or without a test/e2e/ci marker in the name):
 *
 *   cd backend
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test \
 *     npm run bench:c3
 *
 * Flags: --lots=N (default 5000), --drawn=N (default 400),
 *        --iterations=N (default 12; the first is discarded as cold),
 *        --no-write (skip the committed JSON record).
 *
 * Every run writes `scripts/bench-results/c3-test-coverage-<stamp>.json`. Cite
 * that file, not a PR body — the 2026-07-28 deep review found this bench's
 * numbers existed only in #1644's description.
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
  process.env.JWT_SECRET ?? 'c3-benchmark-local-jwt-secret-not-a-production-secret';

// Dynamic, and only after the safety guard: a static import would construct the
// Prisma client (reading DATABASE_URL) before the guard could reject a
// non-local target. Same reasoning as `scripts/bench-f05.ts`.
const { assertSafeTestDatabaseUrl } = await import('../src/test/databaseSafety.js');
assertSafeTestDatabaseUrl();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (point it at a local disposable test database)');
}

const { prisma } = await import('../src/lib/prisma.js');
const { authRouter } = await import('../src/routes/auth.js');
const { projectTestCoverageRouter } = await import('../src/routes/projectTestCoverage.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { registerTestUser } = await import('../src/test/routeTestHarness.js');
const { checkConformancePrerequisitesBatch } =
  await import('../src/lib/conformancePrerequisites.js');
const { prismaRegimeStreamFetcher } =
  await import('../src/lib/readiness/sufficiency/prismaStream.js');

function flag(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return raw ? Number(raw.split('=')[1]) : fallback;
}

const TOTAL_LOTS = flag('lots', 5000);
const DRAWN_LOTS = flag('drawn', 400);
const ITERATIONS = flag('iterations', 12);
const SEED_CHUNK = 1000;
const RUN_ID = `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;
const tag = `bench-c3-${RUN_ID}`;

const POLYGON = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [151.0, -33.8],
        [151.001, -33.8],
        [151.001, -33.801],
        [151.0, -33.8],
      ],
    ],
  },
};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/projects', projectTestCoverageRouter);
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

async function main(): Promise<void> {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  const user = await registerTestUser(app, {
    emailPrefix: 'bench-c3',
    fullName: 'Bench C3 User',
    companyId: company.id,
    roleInCompany: 'owner',
  });

  // VIC/VicRoads so the CONFIRMED pack resolves — a project resolving no
  // ruleset would measure the cheap path and prove nothing.
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId: company.id,
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  await prisma.projectUser.create({
    data: { projectId: project.id, userId: user.userId, role: 'project_manager', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: { projectId: project.id, name: `Tpl ${tag}`, activityType: 'Earthworks' },
  });
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId: template.id,
      description: 'Compaction test point',
      sequenceNumber: 1,
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'compaction',
    },
  });

  process.stdout.write(`seeding ${TOTAL_LOTS} lots (${DRAWN_LOTS} drawn)…\n`);
  await prisma.lot.createMany({
    data: Array.from({ length: TOTAL_LOTS }, (_, i) => ({
      projectId: project.id,
      lotNumber: `${tag}-L${i}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      testScale: 'A',
      // A third conformed, so the regime stream has real entries to fold over.
      status: i % 3 === 0 ? 'conformed' : 'in_progress',
      ...(i % 3 === 0
        ? { conformedAt: new Date(Date.now() - i * 1000), conformedById: user.userId }
        : {}),
    })),
  });
  const lots = await prisma.lot.findMany({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { lotNumber: 'asc' },
  });

  await prisma.iTPInstance.createMany({
    data: lots.map((lot) => ({ lotId: lot.id, templateId: template.id })),
  });
  const instances = await prisma.iTPInstance.findMany({
    where: { lot: { projectId: project.id } },
    select: { id: true },
  });
  for (let i = 0; i < instances.length; i += SEED_CHUNK) {
    await prisma.iTPCompletion.createMany({
      data: instances.slice(i, i + SEED_CHUNK).map((instance) => ({
        itpInstanceId: instance.id,
        checklistItemId: item.id,
        status: 'completed',
      })),
    });
  }
  // Two verified passing tests per lot: the regime fetcher's nested
  // `testResults -> itpChecklistItem` select is the heavy shape, and an empty
  // one would measure nothing.
  for (let i = 0; i < lots.length; i += SEED_CHUNK) {
    await prisma.testResult.createMany({
      data: lots.slice(i, i + SEED_CHUNK).flatMap((lot) =>
        [0, 1].map(() => ({
          projectId: project.id,
          lotId: lot.id,
          itpChecklistItemId: item.id,
          testType: 'compaction',
          passFail: 'pass',
          status: 'verified',
          enteredById: user.userId,
        })),
      ),
    });
  }
  await prisma.lotGeometry.createMany({
    data: lots.slice(0, DRAWN_LOTS).map((lot) => ({
      lotId: lot.id,
      kind: 'drawn',
      geometryWgs84: POLYGON,
      areaM2: 1234.5,
    })),
  });

  process.stdout.write(`measuring ${ITERATIONS} iterations (first discarded as cold)…\n`);
  // Bracketing the measurement, not the seed: these are wall-clock numbers on a
  // shared workstation, so a record without its contention is not comparable
  // with any other record.
  const machine = await machineBlock();
  const routeMs: number[] = [];
  const unscopedMs: number[] = [];
  const allLotIds = lots.map((lot) => lot.id);
  let cold = 0;
  let shape = '';

  for (let run = 0; run < ITERATIONS; run += 1) {
    let started = performance.now();
    const res = await request(baseUrl)
      .get(`/api/projects/${project.id}/lots/test-coverage`)
      .agent(keepAliveAgent)
      .set('Authorization', `Bearer ${user.token}`);
    const elapsed = performance.now() - started;
    if (res.status !== 200) throw new Error(`route returned ${res.status}: ${res.text}`);
    if (run === 0) {
      cold = elapsed;
      shape = `${res.body.lots.length} evaluated · ${res.body.lotsWithoutGeometry} counted off-map`;
    } else {
      routeMs.push(elapsed);
    }

    // The counterfactual: the same batch over EVERY lot, i.e. what the route
    // would cost without `[C3R-A1]`. Interleaved so cache warmth is shared.
    started = performance.now();
    await checkConformancePrerequisitesBatch(allLotIds, prisma, {
      regimeFetcher: prismaRegimeStreamFetcher(prisma),
    });
    if (run > 0) unscopedMs.push(performance.now() - started);
  }

  const line = (values: number[]) => values.map((v) => Math.round(v)).join(' / ');
  process.stdout.write(`\n  shape: ${shape}\n`);
  process.stdout.write(`  cold first call: ${Math.round(cold)} ms\n`);
  process.stdout.write(`  GET .../lots/test-coverage: ${line(routeMs)} ms\n`);
  process.stdout.write(
    `    median ${Math.round(percentile(routeMs, 50))} ms · p95 ${Math.round(
      percentile(routeMs, 95),
    )} ms\n`,
  );
  process.stdout.write(`  same batch UNSCOPED (all ${TOTAL_LOTS}): ${line(unscopedMs)} ms\n`);
  process.stdout.write(
    `    median ${Math.round(percentile(unscopedMs, 50))} ms · p95 ${Math.round(
      percentile(unscopedMs, 95),
    )} ms\n\n`,
  );

  if (!process.argv.includes('--no-write')) {
    const summary = (values: number[]) => ({
      n: values.length,
      minMs: Math.round(Math.min(...values)),
      medianMs: Math.round(percentile(values, 50)),
      p95Ms: Math.round(percentile(values, 95)),
      maxMs: Math.round(Math.max(...values)),
      samplesMs: values.map((v) => Math.round(v)),
    });
    const scoped = summary(routeMs);
    const unscoped = summary(unscopedMs);
    const out = writeBenchResult('c3-test-coverage', {
      benchmark: 'wave-c3/Phase A testing-overlay read',
      spec: 'docs/plans/wave-c3-exit-evidence-2026-07-28.md (exit item 8); spec §12',
      startedAt: STARTED_AT,
      finishedAt: new Date().toISOString(),
      machine: { ...machine, loadAfterMeasurement: await sampleMachineLoad() },
      options: { lots: TOTAL_LOTS, drawn: DRAWN_LOTS, iterations: ITERATIONS },
      shape,
      results: {
        // The route as shipped: `[C3R-A1]` scopes the batch to geometry-bearing
        // lots only.
        scopedRoute: { route: 'GET /api/projects/:projectId/lots/test-coverage', ...scoped },
        // The counterfactual: the same batch over every lot, i.e. what the route
        // would cost without `[C3R-A1]`. The wave's only latency lever.
        unscopedBatch: { call: 'checkConformancePrerequisitesBatch(allLotIds)', ...unscoped },
        coldFirstCallMs: Math.round(cold),
        scopeSpeedupMedian: Number((unscoped.medianMs / scoped.medianMs).toFixed(2)),
      },
      // The spec grants this route no budget (C1 exit item 8 has no passing
      // measurement and the closest analogue is a lighter shape), so the record
      // states the measurement rather than a pass/fail.
      verdict: { budget: null, note: 'MEASURED, no inherited budget — see the header comment.' },
    });
    process.stdout.write(`  results: ${out}\n\n`);
  }

  if (!process.argv.includes('--keep')) {
    await prisma.testResult.deleteMany({ where: { projectId: project.id } });
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId: project.id } } });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstance: { lot: { projectId: project.id } } },
    });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: project.id } } });
    await prisma.lot.deleteMany({ where: { projectId: project.id } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId: project.id } });
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
}
