import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from './prisma.js';
import { runLotStatusEventBackfill } from './lotStatusEventBackfill.js';

const tag = `lot-status-backfill-${Date.now()}`;
const times = Array.from(
  { length: 7 },
  (_, index) => new Date(`2026-08-0${index + 1}T0${index}:00:00.000Z`),
);

let companyId: string;
let projectId: string;
let userId: string;
let firstLotId: string;
let secondLotId: string;
let deletedLotId: string;
const auditIds: string[] = [];

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: { email: `${tag}@example.com`, fullName: 'Backfill Tester', companyId },
  });
  userId = user.id;
  const project = await prisma.project.create({
    data: {
      companyId,
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  const [firstLot, secondLot, deletedLot] = await Promise.all(
    ['FIRST', 'SECOND', 'DELETED'].map((suffix) =>
      prisma.lot.create({
        data: {
          projectId,
          lotNumber: `${tag}-${suffix}`,
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      }),
    ),
  );
  firstLotId = firstLot.id;
  secondLotId = secondLot.id;
  deletedLotId = deletedLot.id;
  await prisma.lot.delete({ where: { id: deletedLotId } });

  const rows = await Promise.all([
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: firstLotId,
        action: 'lot_status_changed',
        changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
        createdAt: times[0],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: firstLotId,
        action: 'lot_force_conformed',
        changes: JSON.stringify({ status: { from: 'completed', to: 'conformed' } }),
        createdAt: times[1],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: secondLotId,
        action: 'lot_updated',
        changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
        createdAt: times[2],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: secondLotId,
        action: 'lot_updated',
        changes: JSON.stringify({ fields: ['description'] }),
        createdAt: times[3],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'progress_claim',
        entityId: `${tag}-claim`,
        action: 'claim_created',
        changes: JSON.stringify({ fullyClaimedLotIds: [firstLotId, secondLotId] }),
        createdAt: times[4],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: deletedLotId,
        action: 'lot_status_changed',
        changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
        createdAt: times[5],
      },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType: 'lot',
        entityId: firstLotId,
        action: 'lot_status_changed',
        changes: '{malformed',
        createdAt: times[6],
      },
    }),
  ]);
  auditIds.push(...rows.map((row) => row.id));
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('lot status event audit backfill', () => {
  it('plans exact audit reconstruction, applies it, and is idempotent', async () => {
    const dryRun = await runLotStatusEventBackfill(prisma, {
      projectIds: [projectId],
      batchSize: 2,
      sampleSize: 10,
    });
    expect(dryRun).toMatchObject({
      created: 0,
      skippedDuringApply: 0,
      plan: {
        auditRowsScanned: 7,
        eventsDerivable: 6,
        alreadyPresent: 0,
        missingLotSkips: 1,
        toCreate: 5,
      },
    });
    expect(dryRun.plan.sampleLotIds).toEqual(expect.arrayContaining([firstLotId, secondLotId]));

    const applied = await runLotStatusEventBackfill(prisma, {
      projectIds: [projectId],
      write: true,
      batchSize: 2,
      sampleSize: 10,
    });
    expect(applied).toMatchObject({ created: 5, skippedDuringApply: 0 });

    const events = await prisma.lotStatusEvent.findMany({
      where: { source: 'backfill', sourceEntityId: { in: auditIds } },
      orderBy: { effectiveAt: 'asc' },
    });
    expect(events).toHaveLength(5);
    for (const event of events) {
      expect(event).toMatchObject({
        source: 'backfill',
        sourceEntityType: 'audit_log',
        reconstructionConfidence: 'exact',
        actorId: userId,
      });
      expect(event.recordedAt.getTime()).toBe(event.effectiveAt.getTime());
      expect(event.metadata).toEqual({
        auditAction: expect.any(String),
      });
    }
    expect(events.map((event) => event.effectiveAt.getTime())).toEqual([
      times[0].getTime(),
      times[1].getTime(),
      times[2].getTime(),
      times[4].getTime(),
      times[4].getTime(),
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lotId: firstLotId,
          fromStatus: 'not_started',
          toStatus: 'in_progress',
        }),
        expect.objectContaining({
          lotId: firstLotId,
          fromStatus: 'completed',
          toStatus: 'conformed',
        }),
        expect.objectContaining({
          lotId: firstLotId,
          fromStatus: 'conformed',
          toStatus: 'claimed',
        }),
        expect.objectContaining({
          lotId: secondLotId,
          fromStatus: 'conformed',
          toStatus: 'claimed',
        }),
      ]),
    );

    const secondRun = await runLotStatusEventBackfill(prisma, {
      projectIds: [projectId],
      write: true,
      batchSize: 2,
      sampleSize: 10,
    });
    expect(secondRun).toMatchObject({
      created: 0,
      skippedDuringApply: 0,
      plan: {
        auditRowsScanned: 7,
        eventsDerivable: 6,
        alreadyPresent: 5,
        missingLotSkips: 1,
        toCreate: 0,
      },
    });
    expect(
      await prisma.lotStatusEvent.count({
        where: { source: 'backfill', sourceEntityId: { in: auditIds } },
      }),
    ).toBe(5);
  });
});
