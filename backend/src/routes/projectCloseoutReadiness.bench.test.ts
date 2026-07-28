// Wave D `D1a` — the §12 latency measurement, left runnable.
//
//   Closeout readiness, 5,000 lots: p95 < 2 s server-side.
//
// Opt-in, because seeding the reference lot count takes longer than the whole
// rest of the backend suite. Run it — and re-run it when the query changes —
// with:
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test \
//     CLOSEOUT_BENCH=1 npx vitest run src/routes/projectCloseoutReadiness.bench.test.ts
//
// It measures `buildCloseoutReadiness` directly rather than through supertest,
// so the number is the server-side figure §12 sets a budget on and not a local
// HTTP round trip. `[DH-B4]` forbids caching the verdict, so if this misses the
// fix is the query.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { buildCloseoutReadiness } from './projectCloseoutReadiness.js';

const enabled = process.env.CLOSEOUT_BENCH === '1';
const LOT_COUNT = Number(process.env.CLOSEOUT_BENCH_LOTS ?? 5000);
const RUNS = Number(process.env.CLOSEOUT_BENCH_RUNS ?? 10);

const tag = `closeout-bench-${Date.now()}`;
let companyId = '';
let projectId = '';
let userId = '';

describe.skipIf(!enabled)(`§12 — closeout readiness at ${LOT_COUNT} lots`, () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `Co ${tag}` } })).id;
    userId = (
      await prisma.user.create({
        data: {
          email: `${tag}@example.test`,
          passwordHash: 'x',
          fullName: 'Bench',
          companyId,
          roleInCompany: 'owner',
        },
      })
    ).id;
    projectId = (
      await prisma.project.create({
        data: {
          name: `Project ${tag}`,
          projectNumber: `${tag}-P1`,
          companyId,
          state: 'VIC',
          specificationSet: 'VicRoads',
          testSufficiencyMode: 'block',
        },
      })
    ).id;

    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: `Tpl ${tag}`, activityType: 'Earthworks' },
    });
    const items = await Promise.all(
      ['a', 'b'].map((key, index) =>
        prisma.iTPChecklistItem.create({
          data: {
            templateId: template.id,
            sequenceNumber: index + 1,
            description: `Item ${key}`,
            pointType: 'standard',
            responsibleParty: 'contractor',
            evidenceRequired: 'none',
          },
        }),
      ),
    );

    // Bulk-inserted: the point of the bench is the READ path.
    await prisma.lot.createMany({
      data: Array.from({ length: LOT_COUNT }, (_, i) => ({
        projectId,
        lotNumber: `${tag}-${String(i).padStart(5, '0')}`,
        lotType: 'roadworks',
        activityType: 'Earthworks',
        status: i % 5 === 0 ? 'conformed' : 'in_progress',
        chainageStart: i * 10,
        chainageEnd: i * 10 + 10,
        activitySlug: i % 3 === 0 ? null : 'earthworks_general',
      })),
    });
    const lots = await prisma.lot.findMany({ where: { projectId }, select: { id: true } });

    await prisma.iTPInstance.createMany({
      data: lots.map((lot) => ({ lotId: lot.id, templateId: template.id })),
    });
    const instances = await prisma.iTPInstance.findMany({
      where: { lot: { projectId } },
      select: { id: true },
    });
    // One of the two items completed on every lot — so every lot has a real
    // `itp_incomplete` derivation to run rather than an empty short circuit.
    await prisma.iTPCompletion.createMany({
      data: instances.map((instance) => ({
        itpInstanceId: instance.id,
        checklistItemId: items[0].id,
        status: 'completed',
      })),
    });

    // A tenth of the lots carry an unreleased hold point and an open major NCR,
    // so both groupBys return real rows rather than empty sets.
    const sample = lots.filter((_, i) => i % 10 === 0);
    await prisma.holdPoint.createMany({
      data: sample.map((lot) => ({
        lotId: lot.id,
        itpChecklistItemId: items[1].id,
        pointType: 'hold_point',
        status: 'pending',
      })),
    });
    const ncrs = await Promise.all(
      sample.map((lot, i) =>
        prisma.nCR
          .create({
            data: {
              projectId,
              ncrNumber: `${tag}-NCR-${i}`,
              description: 'Bench NCR',
              category: 'workmanship',
              severity: 'major',
              status: 'open',
              raisedById: userId,
            },
          })
          .then((ncr) => ({ ncrId: ncr.id, lotId: lot.id })),
      ),
    );
    await prisma.nCRLot.createMany({ data: ncrs });

    // Load-bearing. A freshly bulk-inserted table has no statistics, so the
    // planner seq-scans and the measurement reads ~10x the real figure (6.0 s
    // vs 0.6 s, measured). Any database that has been alive long enough to hold
    // 5,000 lots has been analysed; the bench has to be too, or it benchmarks
    // an empty `pg_statistic` rather than the query.
    //
    // `$executeRaw` as a TAGGED TEMPLATE, never the string-taking variant: this
    // statement has no inputs, and the tagged form cannot be handed a built
    // string at all — which is the property CI's unsafe-pattern guard exists to
    // preserve.
    await prisma.$executeRaw`ANALYZE`;
  }, 900_000);

  afterAll(async () => {
    // `CLOSEOUT_BENCH_KEEP=1` leaves the dataset in the local test DB so a
    // follow-up profiling run does not pay the seed cost again.
    if (!projectId || process.env.CLOSEOUT_BENCH_KEEP === '1') return;
    await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { lot: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  }, 900_000);

  it(`p95 is under 2 s over ${RUNS} runs`, async () => {
    const timings: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const started = performance.now();
      const body = await buildCloseoutReadiness(projectId);
      timings.push(performance.now() - started);
      expect(body.verdicts).toHaveLength(LOT_COUNT + 1);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.min(timings.length - 1, Math.ceil(timings.length * 0.95) - 1)];
    console.log(
      `[closeout bench] lots=${LOT_COUNT} runs=${RUNS} ` +
        `min=${timings[0].toFixed(0)}ms median=${timings[Math.floor(timings.length / 2)].toFixed(0)}ms ` +
        `p95=${p95.toFixed(0)}ms max=${timings[timings.length - 1].toFixed(0)}ms`,
    );
    expect(p95).toBeLessThan(2000);
  }, 900_000);
});
