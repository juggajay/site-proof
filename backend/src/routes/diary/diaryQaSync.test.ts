import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { zonedDateParts } from '../../lib/projectTimeZone.js';
import { syncDiaryQaEvents } from './diaryQaSync.js';
import { createTestCompany, createTestProject, createTestLot } from '../../test/setup.js';

// DB-backed: runs against the local disposable Postgres (see CLAUDE.md).
const SYDNEY = 'Australia/Sydney';

let companyId: string;
let projectId: string;
let lotId: string;
let instanceId: string;
const itemIds: string[] = [];
let diaryDate: Date;
let ncrSeq = 0;

const now = () => new Date();

async function freshDiary(status: 'draft' | 'submitted' = 'draft', lockedAt: Date | null = null) {
  return prisma.dailyDiary.create({
    data: {
      projectId,
      date: diaryDate,
      status,
      lockedAt,
      submittedAt: status === 'submitted' ? now() : null,
    },
    select: { id: true, projectId: true, date: true, status: true, lockedAt: true },
  });
}

async function seedItpActivity(passed: number, failed: number) {
  // Reuse the shared 3 checklist items; extra completions beyond items would
  // violate the (instance,item) unique, so keep passed+failed <= itemIds.length.
  const statuses = [...Array(passed).fill('completed'), ...Array(failed).fill('failed')];
  for (let i = 0; i < statuses.length; i++) {
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: itemIds[i],
        status: statuses[i],
        completedAt: now(),
      },
    });
  }
}

async function seedReleasedHoldPoint() {
  return prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: itemIds[0],
      pointType: 'hold',
      description: 'Subgrade proof roll',
      status: 'released',
      releasedAt: now(),
      releasedByName: 'A. Superintendent',
    },
  });
}

async function seedNcr(opts: { raisedAt?: Date; closedAt?: Date; status?: string }) {
  ncrSeq += 1;
  const ncr = await prisma.nCR.create({
    data: {
      projectId,
      ncrNumber: `NCR-${Date.now()}-${ncrSeq}`,
      description: 'Compaction below spec',
      category: 'workmanship',
      severity: 'major',
      status: opts.status ?? 'open',
      raisedAt: opts.raisedAt ?? now(),
      closedAt: opts.closedAt ?? null,
    },
  });
  await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId } });
  return ncr;
}

async function qaEvents(diaryId: string) {
  return prisma.diaryEvent.findMany({
    where: { diaryId, source: 'qa' },
    orderBy: { sourceRef: 'asc' },
  });
}

beforeAll(async () => {
  const company = await createTestCompany();
  companyId = company.id;
  const project = await createTestProject(companyId, { state: 'NSW' });
  projectId = project.id;
  const lot = await createTestLot(projectId);
  lotId = lot.id;

  const template = await prisma.iTPTemplate.create({
    data: { name: 'Earthworks ITP', projectId },
  });
  for (let i = 0; i < 3; i++) {
    const item = await prisma.iTPChecklistItem.create({
      data: { templateId: template.id, sequenceNumber: i + 1, description: `Item ${i + 1}` },
    });
    itemIds.push(item.id);
  }
  const instance = await prisma.iTPInstance.create({
    data: { lotId, templateId: template.id },
  });
  instanceId = instance.id;

  const parts = zonedDateParts(new Date(), SYDNEY);
  diaryDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
});

afterAll(async () => {
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  await prisma.$disconnect();
});

beforeEach(async () => {
  // FK-safe teardown of per-test QA activity + diaries.
  await prisma.diaryEvent.deleteMany({ where: { diary: { projectId } } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: instanceId } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.nCRLot.deleteMany({ where: { lotId } });
  await prisma.nCR.deleteMany({ where: { projectId } });
  await prisma.dailyDiary.deleteMany({ where: { projectId } });
});

describe('syncDiaryQaEvents', () => {
  it('rolls ITP checklist activity into ONE event per lot with pass/fail counts', async () => {
    await seedItpActivity(2, 1);
    const diary = await freshDiary();

    await syncDiaryQaEvents(diary);

    const events = await qaEvents(diary.id);
    const itp = events.filter((e) => e.eventType === 'itp_progress');
    expect(itp).toHaveLength(1);
    expect(itp[0].description).toBe('ITP: 2 passed, 1 failed — Earthworks ITP');
    expect(itp[0].lotId).toBe(lotId);
    expect(itp[0].sourceRef).toBe(`itp:${lotId}`);
  });

  it('creates one event each for hold point release, NCR raised, and NCR closed', async () => {
    await seedReleasedHoldPoint();
    await seedNcr({ raisedAt: now() });
    // Closed NCR raised on a prior day so it only surfaces as "closed" today.
    await seedNcr({
      raisedAt: new Date(Date.UTC(2000, 0, 1)),
      closedAt: now(),
      status: 'closed',
    });
    const diary = await freshDiary();

    await syncDiaryQaEvents(diary);

    const types = (await qaEvents(diary.id)).map((e) => e.eventType).sort();
    expect(types).toEqual(['hold_point_released', 'ncr_closed', 'ncr_raised']);
  });

  it('is idempotent and refreshes rollup counts in place on re-run', async () => {
    await seedItpActivity(2, 0);
    const diary = await freshDiary();

    await syncDiaryQaEvents(diary);
    const first = await qaEvents(diary.id);
    expect(first).toHaveLength(1);
    expect(first[0].description).toContain('2 passed');
    const firstId = first[0].id;

    // A third item fails later in the day; re-sync must update the same row.
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: itemIds[2],
        status: 'failed',
        completedAt: now(),
      },
    });
    await syncDiaryQaEvents(diary);

    const second = await qaEvents(diary.id);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(firstId); // same row, updated in place
    expect(second[0].description).toBe('ITP: 2 passed, 1 failed — Earthworks ITP');
  });

  it('never touches manual events', async () => {
    const manual = await prisma.diaryEvent.create({
      data: {
        diaryId: (await freshDiary()).id,
        eventType: 'safety',
        description: 'Toolbox talk',
      },
    });
    const diary = {
      ...(await prisma.dailyDiary.findUniqueOrThrow({
        where: { id: manual.diaryId },
        select: { id: true, projectId: true, date: true, status: true, lockedAt: true },
      })),
    };
    await seedItpActivity(1, 0);

    await syncDiaryQaEvents(diary);

    const stillThere = await prisma.diaryEvent.findUnique({ where: { id: manual.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.source).toBe('manual');
    expect(stillThere!.description).toBe('Toolbox talk');
    // And a QA row was added alongside it.
    expect(await qaEvents(diary.id)).toHaveLength(1);
  });

  it('removes a QA event when its source record disappears (reconciliation)', async () => {
    await seedItpActivity(1, 0);
    const ncr = await seedNcr({ raisedAt: now() });
    const diary = await freshDiary();

    await syncDiaryQaEvents(diary);
    expect(await qaEvents(diary.id)).toHaveLength(2);

    // NCR voided -> re-sync drops its auto row, ITP rollup stays.
    await prisma.nCRLot.deleteMany({ where: { ncrId: ncr.id } });
    await prisma.nCR.delete({ where: { id: ncr.id } });
    await syncDiaryQaEvents(diary);

    const remaining = await qaEvents(diary.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].eventType).toBe('itp_progress');
  });

  it('aborts writes when the diary is submitted AFTER the snapshot was taken (TOCTOU)', async () => {
    await seedItpActivity(2, 1);
    // Snapshot fetched while draft (what the read handler would pass in)...
    const staleSnapshot = await freshDiary('draft');
    // Seed a manual row to prove nothing gets touched either.
    const manual = await prisma.diaryEvent.create({
      data: { diaryId: staleSnapshot.id, eventType: 'safety', description: 'Toolbox talk' },
    });

    // ...then a concurrent submit locks the diary before the sync's writes run.
    await prisma.dailyDiary.update({
      where: { id: staleSnapshot.id },
      data: { status: 'submitted', submittedAt: now(), lockedAt: now() },
    });

    // Sync called with the STALE draft snapshot must write zero QA rows.
    await syncDiaryQaEvents(staleSnapshot);

    expect(await qaEvents(staleSnapshot.id)).toHaveLength(0);
    const stillThere = await prisma.diaryEvent.findUnique({ where: { id: manual.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.description).toBe('Toolbox talk');
  });

  it('skips submitted or locked diaries (legal record — never mutated)', async () => {
    await seedItpActivity(2, 1);

    const submitted = await freshDiary('submitted');
    await syncDiaryQaEvents(submitted);
    expect(await qaEvents(submitted.id)).toHaveLength(0);

    await prisma.dailyDiary.deleteMany({ where: { projectId } });
    const locked = await freshDiary('draft', now());
    await syncDiaryQaEvents(locked);
    expect(await qaEvents(locked.id)).toHaveLength(0);
  });
});
