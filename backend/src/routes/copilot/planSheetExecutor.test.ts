import { randomUUID } from 'node:crypto';

import type { AiProposal, PlanSheet } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { PLAN_SHEETS_STAGE } from './planSheetExecutor.js';
import { applyHandlers, rollbackHandlers } from './proposalService.js';

const CRS = 'EPSG:7856';

// A valid reviewed registration payload (2-point similarity fit shape). The
// transform is arbitrary but well-formed — the executor validates shape, not the
// least-squares fit (that runs client-side, same as the manual save path).
function registrationPayload(planSheetId: string) {
  return {
    planSheetId,
    registration: {
      points: [
        { px: 10, py: 10, easting: 331000, northing: 6250000 },
        { px: 200, py: 180, easting: 331200, northing: 6249800 },
      ],
      transform: [1, 0, 331000, 0, -1, 6250180],
      rmsErrorM: 0.12,
    },
  };
}

describe('plan_sheets executor', () => {
  let companyId: string;
  let projectId: string;
  let userId: string;

  async function makeSheet(registration: unknown): Promise<PlanSheet> {
    return prisma.planSheet.create({
      data: {
        id: randomUUID(),
        projectId,
        name: 'Sheet A',
        pageNumber: 1,
        imageRef: `uploads/plan-sheets/${projectId}/${randomUUID()}/page.png`,
        imageWidth: 1000,
        imageHeight: 700,
        coordinateSystem: CRS,
        createdById: userId,
        registration: registration as never,
      },
    });
  }

  async function makeProposal(payload: unknown): Promise<AiProposal> {
    return prisma.aiProposal.create({
      data: {
        projectId,
        stage: PLAN_SHEETS_STAGE,
        requestedById: userId,
        model: 'claude-sonnet-5',
        sourceRefs: [] as never,
        payload: payload as never,
      },
    });
  }

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `PSExec Co ${stamp}` } })).id;
    userId = (
      await prisma.user.create({
        data: {
          email: `psexec-${stamp}@example.test`,
          passwordHash: 'x',
          fullName: 'PS Exec',
          companyId,
        },
      })
    ).id;
    projectId = (
      await prisma.project.create({
        data: {
          name: `PSExec Project ${stamp}`,
          projectNumber: `PSX-${stamp}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.planSheet.deleteMany({ where: { projectId } });
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('applies the reviewed registration and captures the prior (null → unregistered)', async () => {
    const sheet = await makeSheet(null);
    const proposal = await makeProposal({ planSheetId: sheet.id });

    const groups = await prisma.$transaction((tx) =>
      applyHandlers[PLAN_SHEETS_STAGE](tx, proposal, registrationPayload(sheet.id)),
    );

    const stored = await prisma.planSheet.findUnique({ where: { id: sheet.id } });
    expect(stored?.registration).toMatchObject({ rmsErrorM: 0.12 });
    expect(groups).toEqual([
      { model: 'PlanSheet', ids: [sheet.id], meta: { prior: { registration: null } } },
    ]);
  });

  it('rolls back to the prior registration (unregistered sheet clears to null)', async () => {
    const sheet = await makeSheet(null);
    const proposal = await makeProposal({ planSheetId: sheet.id });

    const groups = await prisma.$transaction((tx) =>
      applyHandlers[PLAN_SHEETS_STAGE](tx, proposal, registrationPayload(sheet.id)),
    );
    expect(
      (await prisma.planSheet.findUnique({ where: { id: sheet.id } }))?.registration,
    ).not.toBeNull();

    await prisma.$transaction((tx) => rollbackHandlers[PLAN_SHEETS_STAGE](tx, proposal, groups));

    expect(
      (await prisma.planSheet.findUnique({ where: { id: sheet.id } }))?.registration,
    ).toBeNull();
  });

  it('rollback restores a previously registered value verbatim', async () => {
    const priorReg = {
      points: [{ px: 1, py: 1, easting: 5, northing: 6 }],
      transform: [2, 0, 3, 0, 2, 4],
      rmsErrorM: 0.5,
    };
    const sheet = await makeSheet(priorReg);
    const proposal = await makeProposal({ planSheetId: sheet.id });

    const groups = await prisma.$transaction((tx) =>
      applyHandlers[PLAN_SHEETS_STAGE](tx, proposal, registrationPayload(sheet.id)),
    );
    await prisma.$transaction((tx) => rollbackHandlers[PLAN_SHEETS_STAGE](tx, proposal, groups));

    expect(
      (await prisma.planSheet.findUnique({ where: { id: sheet.id } }))?.registration,
    ).toMatchObject({ rmsErrorM: 0.5 });
  });

  it('rejects a malformed registration payload', async () => {
    const sheet = await makeSheet(null);
    const proposal = await makeProposal({ planSheetId: sheet.id });

    await expect(
      prisma.$transaction((tx) =>
        applyHandlers[PLAN_SHEETS_STAGE](tx, proposal, {
          planSheetId: sheet.id,
          registration: { points: [], transform: [1, 2, 3], rmsErrorM: -1 },
        }),
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('404s when the target sheet is not in the proposal project', async () => {
    const proposal = await makeProposal({ planSheetId: randomUUID() });
    await expect(
      prisma.$transaction((tx) =>
        applyHandlers[PLAN_SHEETS_STAGE](tx, proposal, registrationPayload(randomUUID())),
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
