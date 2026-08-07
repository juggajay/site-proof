import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from './prisma.js';
import { runHpDecisionRoundBackfill } from './hpDecisionRoundBackfill.js';

const tag = 'hp-round-backfill-' + Date.now();
const now = new Date('2026-08-07T06:00:00.000Z');
const releasedAt = new Date('2026-07-30T02:00:00.000Z');
const notificationSentAt = new Date('2026-08-01T03:00:00.000Z');

let companyId: string;
let principalProjectId: string;
let internalProjectId: string;
let principalTemplateId: string;
let internalTemplateId: string;
let sequence = 0;

type Fixture = Awaited<ReturnType<typeof createHoldPoint>>;

const fixtures = {} as {
  released: Fixture;
  completed: Fixture;
  notifiedLive: Fixture;
  notifiedExpired: Fixture;
  pending: Fixture;
  alreadyRounded: Fixture;
  internalApproval: Fixture;
};

function tokenHash(label: string): string {
  return (
    'sha256:' +
    crypto
      .createHash('sha256')
      .update(tag + '-' + label)
      .digest('hex')
  );
}

async function createHoldPoint(
  projectId: string,
  status: string,
  options: {
    createdAt?: Date;
    notificationSentAt?: Date;
    releasedAt?: Date;
    releasedByName?: string;
    releasedByOrg?: string;
  } = {},
) {
  sequence += 1;
  const templateId = projectId === principalProjectId ? principalTemplateId : internalTemplateId;
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: 'Backfill item ' + sequence,
      pointType: 'hold_point',
      sequenceNumber: sequence,
    },
  });
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: tag + '-LOT-' + sequence,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId: lot.id,
      itpChecklistItemId: item.id,
      pointType: 'hold_point',
      description: 'Backfill hold point ' + sequence,
      status,
      authorityClass: 'principal',
      createdAt: options.createdAt,
      notificationSentAt: options.notificationSentAt,
      releasedAt: options.releasedAt,
      releasedByName: options.releasedByName,
      releasedByOrg: options.releasedByOrg,
    },
  });
  return { holdPoint, item, lot };
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: 'Company ' + tag } });
  companyId = company.id;

  const principalProject = await prisma.project.create({
    data: {
      companyId,
      name: 'Principal project ' + tag,
      projectNumber: 'P-' + tag,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
      settings: JSON.stringify({ hpApprovalRequirement: 'superintendent' }),
    },
  });
  principalProjectId = principalProject.id;

  const internalProject = await prisma.project.create({
    data: {
      companyId,
      name: 'Internal project ' + tag,
      projectNumber: 'I-' + tag,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
      settings: JSON.stringify({ hpApprovalRequirement: 'internal' }),
    },
  });
  internalProjectId = internalProject.id;

  const principalTemplate = await prisma.iTPTemplate.create({
    data: {
      projectId: principalProjectId,
      name: 'Principal template ' + tag,
      activityType: 'Earthworks',
    },
  });
  principalTemplateId = principalTemplate.id;
  const internalTemplate = await prisma.iTPTemplate.create({
    data: {
      projectId: internalProjectId,
      name: 'Internal template ' + tag,
      activityType: 'Earthworks',
    },
  });
  internalTemplateId = internalTemplate.id;

  fixtures.released = await createHoldPoint(principalProjectId, 'released', {
    releasedAt,
    releasedByName: 'Alex Authority',
    releasedByOrg: 'Principal Org',
  });
  fixtures.completed = await createHoldPoint(principalProjectId, 'completed', {
    releasedByName: 'Casey Certifier',
    releasedByOrg: 'Principal Org',
  });
  fixtures.notifiedLive = await createHoldPoint(principalProjectId, 'notified', {
    notificationSentAt,
  });
  fixtures.notifiedExpired = await createHoldPoint(principalProjectId, 'notified', {
    createdAt: new Date('2026-07-28T01:00:00.000Z'),
  });
  fixtures.pending = await createHoldPoint(internalProjectId, 'pending');
  fixtures.alreadyRounded = await createHoldPoint(internalProjectId, 'released', {
    releasedAt,
  });
  fixtures.internalApproval = await createHoldPoint(internalProjectId, 'released', {
    releasedAt,
    releasedByName: 'Internal Approver',
    releasedByOrg: 'Builder Org',
  });

  await prisma.holdPointReleaseToken.createMany({
    data: [
      {
        holdPointId: fixtures.notifiedLive.holdPoint.id,
        recipientEmail: 'live-authority@example.com',
        recipientName: 'Live Authority',
        token: tokenHash('live'),
        expiresAt: new Date('2026-08-08T06:00:00.000Z'),
      },
      {
        holdPointId: fixtures.notifiedExpired.holdPoint.id,
        recipientEmail: 'expired-authority@example.com',
        recipientName: 'Expired Authority',
        token: tokenHash('expired'),
        expiresAt: new Date('2026-08-06T06:00:00.000Z'),
      },
    ],
  });

  const existingRound = await prisma.holdPointDecisionRound.create({
    data: {
      holdPointId: fixtures.alreadyRounded.holdPoint.id,
      roundNumber: 1,
      authorityClass: 'principal',
      requestedAt: new Date('2026-07-20T00:00:00.000Z'),
      outcome: 'released',
      decidedAt: releasedAt,
      decisionMethod: 'authenticated',
    },
  });
  await prisma.holdPoint.update({
    where: { id: fixtures.alreadyRounded.holdPoint.id },
    data: { currentRoundId: existingRound.id },
  });
});

afterAll(async () => {
  const projectIds = [principalProjectId, internalProjectId].filter(Boolean);
  if (projectIds.length > 0) {
    await prisma.holdPointReleaseToken.deleteMany({
      where: { holdPoint: { lot: { projectId: { in: projectIds } } } },
    });
    await prisma.holdPoint.deleteMany({
      where: { lot: { projectId: { in: projectIds } } },
    });
    await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  }
  const templateIds = [principalTemplateId, internalTemplateId].filter(Boolean);
  if (templateIds.length > 0) {
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId: { in: templateIds } } });
    await prisma.iTPTemplate.deleteMany({ where: { id: { in: templateIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (companyId) {
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
});

describe('HP decision round backfill', () => {
  it('plans and applies exact legacy lifecycle recovery, then re-runs as a no-op', async () => {
    const completedBefore = await prisma.holdPoint.findUniqueOrThrow({
      where: { id: fixtures.completed.holdPoint.id },
      select: { updatedAt: true },
    });
    const expiredBefore = await prisma.holdPoint.findUniqueOrThrow({
      where: { id: fixtures.notifiedExpired.holdPoint.id },
      select: { createdAt: true },
    });

    const holdPointIds = Object.values(fixtures).map((fixture) => fixture.holdPoint.id);

    const dryRun = await runHpDecisionRoundBackfill(prisma, {
      now,
      sampleSize: 20,
      holdPointIds,
    });

    expect(dryRun).toMatchObject({
      created: 0,
      classRemediated: 0,
      tokensBound: 0,
      skippedDuringApply: 0,
      plan: {
        totalToBackfill: 5,
        classRemediationCount: 1,
        liveTokenBindingCount: 1,
      },
    });
    expect(dryRun.plan.statusPlans).toEqual([
      expect.objectContaining({ status: 'released', action: 'backfill', count: 2 }),
      expect.objectContaining({ status: 'completed', action: 'backfill', count: 1 }),
      expect.objectContaining({ status: 'notified', action: 'backfill', count: 2 }),
      expect.objectContaining({ status: 'pending', action: 'skip', count: 1 }),
    ]);
    expect(dryRun.plan.classRemediationSampleHoldPointIds).toEqual([
      fixtures.internalApproval.holdPoint.id,
    ]);
    expect(
      await prisma.holdPointDecisionRound.count({
        where: {
          holdPointId: {
            in: [
              fixtures.released.holdPoint.id,
              fixtures.completed.holdPoint.id,
              fixtures.notifiedLive.holdPoint.id,
              fixtures.notifiedExpired.holdPoint.id,
              fixtures.pending.holdPoint.id,
              fixtures.internalApproval.holdPoint.id,
            ],
          },
        },
      }),
    ).toBe(0);

    const applied = await runHpDecisionRoundBackfill(prisma, {
      write: true,
      now,
      batchSize: 2,
      holdPointIds,
    });
    expect(applied).toMatchObject({
      created: 5,
      classRemediated: 1,
      tokensBound: 1,
      skippedDuringApply: 0,
    });

    const rounds = await prisma.holdPointDecisionRound.findMany({
      where: {
        holdPointId: {
          in: Object.values(fixtures).map((fixture) => fixture.holdPoint.id),
        },
      },
      orderBy: { holdPointId: 'asc' },
    });
    const roundsByHoldPoint = new Map(rounds.map((round) => [round.holdPointId, round]));

    expect(roundsByHoldPoint.get(fixtures.released.holdPoint.id)).toMatchObject({
      roundNumber: 1,
      authorityClass: 'principal',
      outcome: 'released',
      decidedAt: releasedAt,
      decidedByName: 'Alex Authority',
      decidedByOrg: 'Principal Org',
      decisionMethod: 'backfill_synthetic',
      decisionReason: null,
      requestedById: null,
    });
    expect(roundsByHoldPoint.get(fixtures.completed.holdPoint.id)).toMatchObject({
      roundNumber: 1,
      authorityClass: 'principal',
      outcome: 'released',
      decidedAt: completedBefore.updatedAt,
      decidedByName: 'Casey Certifier',
      decidedByOrg: 'Principal Org',
      decisionMethod: 'backfill_synthetic',
      decisionReason: null,
      requestedById: null,
    });
    expect(roundsByHoldPoint.get(fixtures.notifiedLive.holdPoint.id)).toMatchObject({
      roundNumber: 1,
      authorityClass: 'principal',
      requestedAt: notificationSentAt,
      requestedById: null,
      recipientEmail: 'live-authority@example.com',
      recipientName: 'Live Authority',
      outcome: null,
      decisionMethod: null,
    });
    expect(roundsByHoldPoint.get(fixtures.notifiedExpired.holdPoint.id)).toMatchObject({
      roundNumber: 1,
      requestedAt: expiredBefore.createdAt,
      requestedById: null,
      recipientEmail: null,
      recipientName: null,
      outcome: null,
    });
    expect(roundsByHoldPoint.get(fixtures.pending.holdPoint.id)).toBeUndefined();

    const internalRound = roundsByHoldPoint.get(fixtures.internalApproval.holdPoint.id);
    expect(internalRound).toMatchObject({
      authorityClass: 'contractor_internal',
      outcome: 'released',
      decisionMethod: 'backfill_synthetic',
    });

    const updatedHoldPoints = await prisma.holdPoint.findMany({
      where: {
        id: {
          in: Object.values(fixtures).map((fixture) => fixture.holdPoint.id),
        },
      },
      select: { id: true, currentRoundId: true, authorityClass: true },
    });
    const holdPointsById = new Map(updatedHoldPoints.map((holdPoint) => [holdPoint.id, holdPoint]));
    for (const fixtureName of [
      'released',
      'completed',
      'notifiedLive',
      'notifiedExpired',
      'internalApproval',
    ] as const) {
      const holdPoint = holdPointsById.get(fixtures[fixtureName].holdPoint.id);
      expect(holdPoint?.currentRoundId).toBe(
        roundsByHoldPoint.get(fixtures[fixtureName].holdPoint.id)?.id,
      );
    }
    expect(holdPointsById.get(fixtures.internalApproval.holdPoint.id)?.authorityClass).toBe(
      'contractor_internal',
    );
    expect(holdPointsById.get(fixtures.pending.holdPoint.id)).toMatchObject({
      currentRoundId: null,
      authorityClass: 'principal',
    });

    expect(holdPointsById.get(fixtures.alreadyRounded.holdPoint.id)).toMatchObject({
      currentRoundId: roundsByHoldPoint.get(fixtures.alreadyRounded.holdPoint.id)?.id,
      authorityClass: 'principal',
    });

    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: {
        holdPointId: {
          in: [fixtures.notifiedLive.holdPoint.id, fixtures.notifiedExpired.holdPoint.id],
        },
      },
      select: { holdPointId: true, decisionRoundId: true },
    });
    expect(tokens).toContainEqual({
      holdPointId: fixtures.notifiedLive.holdPoint.id,
      decisionRoundId: roundsByHoldPoint.get(fixtures.notifiedLive.holdPoint.id)?.id,
    });
    expect(tokens).toContainEqual({
      holdPointId: fixtures.notifiedExpired.holdPoint.id,
      decisionRoundId: null,
    });

    const existingRound = roundsByHoldPoint.get(fixtures.alreadyRounded.holdPoint.id);
    expect(existingRound).toMatchObject({
      roundNumber: 1,
      decisionMethod: 'authenticated',
      authorityClass: 'principal',
    });
    expect(
      rounds.filter((round) => round.holdPointId === fixtures.alreadyRounded.holdPoint.id),
    ).toHaveLength(1);

    const secondRun = await runHpDecisionRoundBackfill(prisma, {
      write: true,
      now,
      batchSize: 2,
      holdPointIds,
    });
    expect(secondRun).toMatchObject({
      plan: {
        totalToBackfill: 0,
        classRemediationCount: 0,
        liveTokenBindingCount: 0,
        holdPointIdsToBackfill: [],
      },
      created: 0,
      classRemediated: 0,
      tokensBound: 0,
      skippedDuringApply: 0,
    });
    expect(
      await prisma.holdPointDecisionRound.count({
        where: {
          holdPointId: {
            in: Object.values(fixtures).map((fixture) => fixture.holdPoint.id),
          },
        },
      }),
    ).toBe(6);
  });
});
