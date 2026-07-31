/**
 * Wave `C5.3` benchmark — what surveys and deliveries cost the folio.
 *
 * Spec `docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §9,
 * exit gate item 5, **AT-179**: *"C5's two collections add < 50 rows at p99 per
 * lot"*, *"`FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is not raised"*, and *"folio
 * assemble p95 delta < 15%"* — **measured on the reference dataset and recorded
 * in the PR body — a number, not an adjective.**
 *
 * WHAT IS ACTUALLY MEASURED, and what is assumed. The per-lot row delta is
 * `surveys.length + deliveries.length` for that lot, so it is a property of the
 * DATA, not of the code — a benchmark can only report the delta for a stated
 * distribution. This script therefore seeds an explicitly stated distribution
 * (see `--help`), reports the p50/p95/p99/max delta over every lot, and reports
 * the assemble latency of the same lots with the survey flag off and on. The
 * distribution is recorded in the output JSON so a reader can disagree with it
 * rather than having to reverse-engineer it.
 *
 * The default heavy tail is deliberately ABOVE what §9 predicts ("single-digit
 * surveys and low-tens deliveries"): a benchmark seeded at the estimate can
 * only confirm the estimate.
 *
 * Run (local disposable DB only — `assertSafeTestDatabaseUrl` refuses anything
 * non-local or without a test/e2e/ci marker in the name):
 *
 *   cd backend
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test \
 *     npm run bench:c5
 *
 * Flags: --lots=N (default 500), --iterations=N (default 8; first discarded as
 *        cold), --no-write (skip the committed JSON record).
 *
 * MEASURING AGAINST THE PRE-C5 BASELINE. §9's assemble budget is *"p95 delta
 * < 15% over the pre-C5 baseline"*, and this script cannot produce that number
 * on its own — the pre-C5 assembler is not in the tree any more. The method
 * used for `C5.3`, repeat it rather than trusting the numbers below:
 *
 *   git show origin/master:backend/src/routes/folio/assemble.ts \
 *     > backend/src/routes/folio/assembleBaselineTmp.ts
 *   # rename its export, and replace its `countEvidenceRows(evidence)` call
 *   # with a local sum — the shipped helper now reads two collections that a
 *   # master-shaped payload does not carry.
 *   # then sweep the SAME seeded lots through both assemblers and delete the
 *   # temporary file.
 *
 * Measured that way at `ba20a703` vs this branch, 500 lots x 8 iterations:
 *   pre-C5 (master)      p50 3.63 ms   p95 4.90 ms
 *   C5.3, flag OFF       p50 3.87 ms   p95 5.05 ms   (+0.14 ms, +2.9%)
 *   C5.3, flag ON        p50 4.85 ms   p95 6.68 ms   (+1.77 ms, +36.1%)
 *
 * So the state this merges into production — flag off — is inside §9's budget,
 * and the flag-on state misses it as a PERCENTAGE of a ~5 ms baseline while
 * costing 1.77 ms absolute against §12's 2,000 ms session budget. Recorded
 * rather than rounded away.
 */

import { performance } from 'node:perf_hooks';

import dotenv from 'dotenv';

import { machineBlock, writeBenchResult } from './benchResults.js';

const STARTED_AT = new Date().toISOString();

dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'UTC';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_ANON_KEY = '';

// Dynamic, and only after the safety guard: a static import would construct the
// Prisma client (reading DATABASE_URL) before the guard could reject a
// non-local target. Same reasoning as `bench-c3-test-coverage.ts`.
const { assertSafeTestDatabaseUrl } = await import('../src/test/databaseSafety.js');
assertSafeTestDatabaseUrl();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (point it at a local disposable test database)');
}

const { prisma } = await import('../src/lib/prisma.js');
const { assembleFolioPayload, FOLIO_EVIDENCE_ROW_CEILING_DEFAULT } =
  await import('../src/routes/folio/assemble.js');

function flag(name: string, fallback: number): number {
  const raw = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const parsed = Number(raw.split('=')[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const LOTS = flag('lots', 500);
const ITERATIONS = flag('iterations', 8);
const WRITE = !process.argv.includes('--no-write');

/**
 * The seeded distribution, stated rather than implied.
 *
 * Deliveries: most civil lots take a handful of loads; a big pour day takes
 * tens. Surveys: set-out and conformance, occasionally re-surveyed. The tail
 * buckets are over-weighted relative to §9's own estimate on purpose.
 */
// `lotsPerHundred`, not a fractional share. The first version of this used
// `share: 0.5 | 0.3 | 0.15 | 0.04 | 0.01` and summed them, and floating point
// made the cumulative total 0.9900000000000001 — so `position === 0.99` fell
// into the FOURTH bucket and the heavy tail this list exists to exercise never
// ran once in 500 lots. Integers cannot do that.
const DISTRIBUTION = [
  { lotsPerHundred: 50, surveys: 1, deliveries: 2 },
  { lotsPerHundred: 30, surveys: 2, deliveries: 6 },
  { lotsPerHundred: 15, surveys: 3, deliveries: 14 },
  { lotsPerHundred: 4, surveys: 5, deliveries: 30 },
  // The tail: a lot that swallowed a whole week of concrete.
  { lotsPerHundred: 1, surveys: 8, deliveries: 60 },
] as const;

function bucketForIndex(index: number): (typeof DISTRIBUTION)[number] {
  // Deterministic round-robin, so a re-run seeds the same shape and two
  // records are comparable.
  const position = index % 100;
  let cumulative = 0;
  for (const bucket of DISTRIBUTION) {
    cumulative += bucket.lotsPerHundred;
    if (position < cumulative) return bucket;
  }
  return DISTRIBUTION[DISTRIBUTION.length - 1]!;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index]!;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

const tag = `c5-bench-${Date.now()}`;

interface SeededProject {
  companyId: string;
  userId: string;
  projectId: string;
  diaryId: string;
  lotIds: string[];
  seededSurveys: number[];
  seededDeliveries: number[];
}

async function seedProject(): Promise<SeededProject> {
  const company = await prisma.company.create({ data: { name: `Bench ${tag}` } });
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      fullName: 'Bench Operator',
      passwordHash: 'x',
      companyId: company.id,
      roleInCompany: 'owner',
    },
  });
  const project = await prisma.project.create({
    data: {
      name: `Bench ${tag}`,
      projectNumber: tag,
      companyId: company.id,
      state: 'QLD',
      specificationSet: 'TMR',
    },
  });
  const diary = await prisma.dailyDiary.create({
    data: { projectId: project.id, date: new Date('2026-07-16T00:00:00.000Z') },
  });

  process.stdout.write(`Seeding ${LOTS} lots…\n`);
  const lotIds: string[] = [];
  const seededSurveys: number[] = [];
  const seededDeliveries: number[] = [];

  for (let index = 0; index < LOTS; index += 1) {
    const bucket = bucketForIndex(index);
    const lot = await prisma.lot.create({
      data: {
        projectId: project.id,
        lotNumber: `${tag}-${index}`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
      },
    });
    lotIds.push(lot.id);
    seededSurveys.push(bucket.surveys);
    seededDeliveries.push(bucket.deliveries);

    await prisma.surveyRecord.createMany({
      data: Array.from({ length: bucket.surveys }, (_unused, n) => ({
        projectId: project.id,
        lotId: lot.id,
        kind: n === 0 ? 'set_out' : 'conformance',
        status: 'accepted',
        surveyorName: 'J. Smith',
        surveyorCompany: 'Smith Surveys Pty Ltd',
        surveyorVerdict: 'conforms',
        acceptedById: user.id,
        acceptedAt: new Date('2026-07-20T00:00:00.000Z'),
      })),
    });
    await prisma.diaryDelivery.createMany({
      data: Array.from({ length: bucket.deliveries }, (_unused, n) => ({
        diaryId: diary.id,
        lotId: lot.id,
        description: 'N32 concrete',
        supplier: 'Boral Concrete',
        docketNumber: `DK-${index}-${n}`,
        batchRef: `BATCH-${index}-${n}`,
      })),
    });
  }

  return {
    companyId: company.id,
    userId: user.id,
    projectId: project.id,
    diaryId: diary.id,
    lotIds,
    seededSurveys,
    seededDeliveries,
  };
}

/** The bench seeds thousands of rows; leaving them makes the next run's numbers lies. */
async function teardown(seeded: SeededProject): Promise<void> {
  await prisma.diaryDelivery.deleteMany({ where: { diaryId: seeded.diaryId } });
  await prisma.dailyDiary.deleteMany({ where: { projectId: seeded.projectId } });
  await prisma.surveyRecord.deleteMany({ where: { projectId: seeded.projectId } });
  await prisma.lot.deleteMany({ where: { projectId: seeded.projectId } });
  await prisma.project.delete({ where: { id: seeded.projectId } });
  await prisma.user.delete({ where: { id: seeded.userId } });
  await prisma.company.delete({ where: { id: seeded.companyId } });
}

async function main(): Promise<void> {
  const seeded = await seedProject();
  const { lotIds, seededSurveys, seededDeliveries } = seeded;

  /** Assemble every lot once, returning the per-lot row counts and the wall clock. */
  async function sweep(): Promise<{ counts: number[]; durations: number[] }> {
    const counts: number[] = [];
    const durations: number[] = [];
    for (const lotId of lotIds) {
      const started = performance.now();
      const assembled = await prisma.$transaction((tx) =>
        assembleFolioPayload(tx, {
          lotId,
          folioIssueId: '11111111-2222-3333-4444-555555555555',
          version: 1,
          compiledAt: new Date('2026-07-31T00:00:00.000Z'),
          compiledByName: 'Bench Operator',
        }),
      );
      durations.push(performance.now() - started);
      counts.push(assembled.payload.evidenceRowCount);
    }
    return { counts, durations };
  }

  async function repeat(flagValue: string | undefined): Promise<{
    counts: number[];
    p50: number;
    p95: number;
  }> {
    if (flagValue === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = flagValue;
    }
    let counts: number[] = [];
    const allDurations: number[] = [];
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const result = await sweep();
      counts = result.counts;
      // Discard the first pass: cold caches and a cold Prisma pool.
      if (iteration > 0) allDurations.push(...result.durations);
    }
    return {
      counts,
      p50: percentile(allDurations, 50),
      p95: percentile(allDurations, 95),
    };
  }

  process.stdout.write(`Sweeping ${LOTS} lots x ${ITERATIONS} iterations, flag OFF…\n`);
  const off = await repeat(undefined);
  process.stdout.write(`Sweeping ${LOTS} lots x ${ITERATIONS} iterations, flag ON…\n`);
  const on = await repeat('true');
  delete process.env.C5_SURVEY_RECORDS_ENABLED;

  // What the FLAG alone adds, measured rather than assumed: the two sweeps
  // differ only in `C5_SURVEY_RECORDS_ENABLED`, so the difference is the survey
  // collection. If this ever stops matching the seeded survey counts, either
  // the flag leaks or the projection drops rows — both worth failing over.
  const surveyOnlyDelta = on.counts.map((count, index) => count - off.counts[index]!);
  const surveyMismatch = surveyOnlyDelta.filter(
    (delta, index) => delta !== seededSurveys[index],
  ).length;

  // The delta the spec asks for: what C5's TWO collections add to one lot,
  // against what a pre-C5.3 build produced for the same lot. Deliveries are
  // unflagged, so they are already inside `off.counts` and have to be added
  // back to reach the pre-C5 baseline.
  const perLotDelta = surveyOnlyDelta.map((delta, index) => delta + seededDeliveries[index]!);

  const record = {
    benchmark: 'c5-folio-rows',
    spec: 'docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md §9, AT-179',
    startedAt: STARTED_AT,
    finishedAt: new Date().toISOString(),
    machine: await machineBlock(),
    options: { lots: LOTS, iterations: ITERATIONS, distribution: DISTRIBUTION },
    results: {
      perLotRowDelta: {
        note: 'surveys + deliveries added to one lot vs a pre-C5.3 build',
        p50: percentile(perLotDelta, 50),
        p95: percentile(perLotDelta, 95),
        p99: percentile(perLotDelta, 99),
        max: Math.max(...perLotDelta),
        budget: 50,
      },
      surveyOnlyRowDelta: {
        note: 'what the C5_SURVEY_RECORDS_ENABLED flag alone adds',
        p99: percentile(surveyOnlyDelta, 99),
        max: Math.max(...surveyOnlyDelta),
        lotsWhereMeasuredDeltaDisagreesWithSeed: surveyMismatch,
      },
      worstLotEvidenceRowCount: {
        flagOff: Math.max(...off.counts),
        flagOn: Math.max(...on.counts),
        ceiling: FOLIO_EVIDENCE_ROW_CEILING_DEFAULT,
      },
      assembleP95Ms: {
        flagOff: round(off.p95),
        flagOn: round(on.p95),
        // BOTH forms, because the percentage alone misleads at this magnitude.
        // §9's budget is a percentage over a baseline it assumed would be large;
        // on a local disposable database that baseline is single-digit
        // milliseconds, and two extra CONCURRENT queries inside the existing
        // `Promise.all` cannot cost less than 15% of ~5 ms. The absolute delta
        // is the number to weigh against §12's 2-second session budget.
        deltaMs: round(on.p95 - off.p95),
        deltaPercent: off.p95 > 0 ? round(((on.p95 - off.p95) / off.p95) * 100) : 0,
        budgetPercent: 15,
        p50FlagOff: round(off.p50),
        p50FlagOn: round(on.p50),
      },
    },
    verdict: {
      perLotRowDeltaUnderBudget: percentile(perLotDelta, 99) < 50,
      ceilingNotRaised: FOLIO_EVIDENCE_ROW_CEILING_DEFAULT === 5000,
      worstLotUnderCeiling: Math.max(...on.counts) < FOLIO_EVIDENCE_ROW_CEILING_DEFAULT,
      flagAddsExactlyTheSeededSurveys: surveyMismatch === 0,
      assembleP95DeltaUnderBudget: off.p95 === 0 || ((on.p95 - off.p95) / off.p95) * 100 < 15,
    },
  };

  process.stdout.write(`${JSON.stringify(record.results, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(record.verdict, null, 2)}\n`);
  if (WRITE) {
    process.stdout.write(`Wrote ${writeBenchResult('c5-folio-rows', record)}\n`);
  }

  await teardown(seeded);
}

await main();
await prisma.$disconnect();
