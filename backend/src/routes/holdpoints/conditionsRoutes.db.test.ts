import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { updateLotStatusFromITP } from '../itp/helpers/lotProgression.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';
import { holdPointConditionsRouter } from './conditionsRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdPointConditionsRouter);
app.use(errorHandler);

const tag = `hp-conditions-${Date.now()}`;
const VERIFICATION_ATTRIBUTION = 'verified on recorded satisfaction of release conditions';

let companyId: string;
let projectId: string;
let otherProjectId: string;
let templateId: string;
let checklistItemId: string;
let qualityManagerId: string;
let qualityManagerToken: string;
let foremanId: string;
let foremanToken: string;
let sequence = 0;

async function createFixture(options: { conditional?: boolean; conditionCount?: number } = {}) {
  sequence += 1;
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT-${sequence}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      status: 'in_progress',
    },
  });
  const template = await prisma.iTPTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });
  const instance = await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId,
      templateSnapshot: JSON.stringify(buildTemplateSnapshot(template)),
      status: 'in_progress',
    },
  });
  await prisma.iTPCompletion.create({
    data: {
      itpInstanceId: instance.id,
      checklistItemId,
      status: 'completed',
      completedAt: new Date(),
      verificationStatus: options.conditional === false ? 'verified' : 'none',
    },
  });
  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId: lot.id,
      itpChecklistItemId: checklistItemId,
      pointType: 'hold_point',
      description: options.conditional === false ? 'HP-UNCONDITIONAL' : 'HP-3',
      status: 'released',
      releasedAt: new Date(),
      authorityClass: 'principal',
    },
  });
  const conditional = options.conditional !== false;
  const round = await prisma.holdPointDecisionRound.create({
    data: {
      holdPointId: holdPoint.id,
      roundNumber: 1,
      authorityClass: 'principal',
      outcome: conditional ? 'released_with_conditions' : 'released',
      decidedAt: new Date(),
      decisionMethod: 'public_token',
      conditions: conditional
        ? {
            create: Array.from({ length: options.conditionCount ?? 2 }, (_, index) => ({
              sequence: index + 1,
              text: `Condition ${index + 1}`,
            })),
          }
        : undefined,
    },
    include: { conditions: { orderBy: { sequence: 'asc' } } },
  });
  await prisma.holdPoint.update({
    where: { id: holdPoint.id },
    data: { currentRoundId: round.id },
  });
  return { lot, instance, holdPoint, round };
}

function recordSatisfaction(
  holdPointId: string,
  conditionId: string,
  token: string,
  body: { note?: string; evidenceDocumentId?: string } = {},
) {
  return request(app)
    .post(`/api/holdpoints/${holdPointId}/conditions/${conditionId}/record-satisfaction`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function readinessForLot(lotId: string) {
  const conformance = await checkConformancePrerequisites(lotId);
  if (!conformance.lot || !conformance.prerequisites || conformance.canConform === undefined) {
    throw new Error('Conformance fixture was not loaded');
  }
  return {
    conformance,
    readiness: buildLotReadinessFromInputs({
      lot: {
        id: conformance.lot.id,
        lotNumber: conformance.lot.lotNumber,
        status: conformance.lot.status,
        budgetAmount: null,
        claimedInId: null,
      },
      canViewCommercial: false,
      conformStatus: {
        canConform: conformance.canConform,
        blockingReasons: conformance.blockingReasons ?? [],
        prerequisites: conformance.prerequisites,
      },
      evidenceCounts: {
        unreleasedHoldPoints: 0,
        releasedHoldPoints: 1,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: 0,
        photos: 0,
        pendingTests: 0,
      },
    }),
  };
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;
  const qualityManager = await registerTestUser(app, {
    emailPrefix: `${tag}-qm`,
    fullName: 'Quinn Quality',
    companyId,
    roleInCompany: 'member',
  });
  qualityManagerId = qualityManager.userId;
  qualityManagerToken = qualityManager.token;
  const foreman = await registerTestUser(app, {
    emailPrefix: `${tag}-foreman`,
    fullName: 'Frank Foreman',
    companyId,
    roleInCompany: 'member',
  });
  foremanId = foreman.userId;
  foremanToken = foreman.token;

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
  const otherProject = await prisma.project.create({
    data: {
      companyId,
      name: `Other project ${tag}`,
      projectNumber: `OTHER-${tag}`,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  otherProjectId = otherProject.id;
  await prisma.projectUser.createMany({
    data: [
      { projectId, userId: qualityManagerId, role: 'quality_manager', status: 'active' },
      { projectId, userId: foremanId, role: 'foreman', status: 'active' },
    ],
  });
  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag}`, activityType: 'Earthworks' },
  });
  templateId = template.id;
  const checklistItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      sequenceNumber: 1,
      description: 'HP-3',
      pointType: 'hold_point',
    },
  });
  checklistItemId = checklistItem.id;
});

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.document.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.iTPChecklistItem.deleteMany({ where: { id: checklistItemId } });
  await prisma.iTPTemplate.deleteMany({ where: { id: templateId } });
  await prisma.projectUser.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: [qualityManagerId, foremanId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [qualityManagerId, foremanId] } } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('hold-point release conditions', () => {
  it('blocks conformance and lot progression through the shared current-round predicate and emits the named readiness reason', async () => {
    const fixture = await createFixture();

    await updateLotStatusFromITP(fixture.instance.id);
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: fixture.lot.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'in_progress' });

    const { conformance, readiness } = await readinessForLot(fixture.lot.id);
    expect(conformance.canConform).toBe(false);
    expect(conformance.prerequisites).toMatchObject({
      noOpenHoldPointConditions: false,
      openHoldPointConditions: [
        { holdPointId: fixture.holdPoint.id, holdPointName: 'HP-3', openConditionCount: 2 },
      ],
    });
    expect(readiness.conformance.blockers).toContainEqual(
      expect.objectContaining({
        code: 'hp_conditions_open',
        count: 2,
        detail: 'Hold point HP-3 released with 2 conditions not yet recorded satisfied',
      }),
    );
  });

  it('records satisfaction one by one, stays blocked until the last, then verifies the ITP completion with system attribution', async () => {
    const fixture = await createFixture();
    const evidence = await prisma.document.create({
      data: {
        projectId,
        lotId: fixture.lot.id,
        documentType: 'photo',
        filename: `${tag}-evidence.jpg`,
        fileUrl: `supabase://documents/${tag}-evidence.jpg`,
      },
    });

    const first = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[0].id,
      qualityManagerToken,
      { note: 'First condition complete', evidenceDocumentId: evidence.id },
    );
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      remainingOpenConditionCount: 1,
      itpCompletionVerified: false,
      condition: {
        recordedSatisfiedByName: 'Quinn Quality',
        satisfactionEvidenceDocumentId: evidence.id,
      },
    });
    expect((await readinessForLot(fixture.lot.id)).conformance.canConform).toBe(false);
    expect(
      await prisma.iTPCompletion.findUniqueOrThrow({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: fixture.instance.id,
            checklistItemId,
          },
        },
        select: { verificationStatus: true, verifiedAt: true },
      }),
    ).toEqual({ verificationStatus: 'none', verifiedAt: null });

    const last = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[1].id,
      qualityManagerToken,
      { note: 'Final condition complete' },
    );
    expect(last.status).toBe(200);
    expect(last.body).toMatchObject({
      remainingOpenConditionCount: 0,
      itpCompletionVerified: true,
    });
    expect((await readinessForLot(fixture.lot.id)).conformance.canConform).toBe(true);
    expect(
      await prisma.iTPCompletion.findUniqueOrThrow({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: fixture.instance.id,
            checklistItemId,
          },
        },
        select: {
          status: true,
          verificationStatus: true,
          verifiedById: true,
          verifiedAt: true,
          verificationNotes: true,
        },
      }),
    ).toMatchObject({
      status: 'completed',
      verificationStatus: 'verified',
      verifiedById: null,
      verifiedAt: expect.any(Date),
      verificationNotes: VERIFICATION_ATTRIBUTION,
    });
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: fixture.lot.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'completed' });
    expect(
      await prisma.auditLog.count({
        where: {
          projectId,
          entityId: fixture.holdPoint.id,
          action: AuditAction.HP_CONDITION_SATISFACTION_RECORDED,
        },
      }),
    ).toBe(2);

    const duplicate = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[1].id,
      qualityManagerToken,
    );
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.message).toContain('already been recorded');
  });

  it('rejects foremen and does not mutate the condition', async () => {
    const fixture = await createFixture({ conditionCount: 1 });
    const response = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[0].id,
      foremanToken,
    );
    expect(response.status).toBe(403);
    expect(
      await prisma.holdPointReleaseCondition.findUniqueOrThrow({
        where: { id: fixture.round.conditions[0].id },
        select: { recordedSatisfiedAt: true },
      }),
    ).toEqual({ recordedSatisfiedAt: null });
  });

  it('rejects an evidence document from another project without closing the condition', async () => {
    const fixture = await createFixture({ conditionCount: 1 });
    const foreignDocument = await prisma.document.create({
      data: {
        projectId: otherProjectId,
        documentType: 'photo',
        filename: `${tag}-foreign.jpg`,
        fileUrl: `supabase://documents/${tag}-foreign.jpg`,
      },
    });
    const response = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[0].id,
      qualityManagerToken,
      { evidenceDocumentId: foreignDocument.id },
    );
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('this project');
    expect(
      await prisma.holdPointReleaseCondition.findUniqueOrThrow({
        where: { id: fixture.round.conditions[0].id },
        select: { recordedSatisfiedAt: true },
      }),
    ).toEqual({ recordedSatisfiedAt: null });
  });

  it('enforces the 5000-character note cap', async () => {
    const fixture = await createFixture({ conditionCount: 1 });
    const response = await recordSatisfaction(
      fixture.holdPoint.id,
      fixture.round.conditions[0].id,
      qualityManagerToken,
      { note: 'x'.repeat(5001) },
    );
    expect(response.status).toBe(400);
  });

  it('leaves an unconditionally released lot conformable and able to auto-progress', async () => {
    const fixture = await createFixture({ conditional: false });
    const { conformance, readiness } = await readinessForLot(fixture.lot.id);
    expect(conformance.canConform).toBe(true);
    expect(conformance.prerequisites).toMatchObject({
      noOpenHoldPointConditions: true,
      openHoldPointConditions: [],
    });
    expect(readiness.conformance.blockers.map((item) => item.code)).not.toContain(
      'hp_conditions_open',
    );

    await updateLotStatusFromITP(fixture.instance.id);
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: fixture.lot.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'completed' });
  });

  it('ignores open conditions on a superseded round', async () => {
    const fixture = await createFixture({ conditionCount: 1 });
    const currentRound = await prisma.holdPointDecisionRound.create({
      data: {
        holdPointId: fixture.holdPoint.id,
        roundNumber: 2,
        outcome: 'released',
        decidedAt: new Date(),
      },
    });
    await prisma.holdPoint.update({
      where: { id: fixture.holdPoint.id },
      data: { currentRoundId: currentRound.id },
    });

    expect((await readinessForLot(fixture.lot.id)).conformance.canConform).toBe(true);
    await updateLotStatusFromITP(fixture.instance.id);
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: fixture.lot.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'completed' });
  });
});
