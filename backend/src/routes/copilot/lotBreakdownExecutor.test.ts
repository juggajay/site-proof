import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { createProposal, decideProposal, rollbackProposal } from './proposalService.js';
// Importing the executor registers the lot_breakdown apply/rollback handlers.
import { LOT_BREAKDOWN_STAGE } from './lotBreakdownExecutor.js';

// A straight control line spanning CH 0–200 in GDA2020 MGA56 — lots CH 0–100 and
// 100–200 sit inside it, so geometry generation succeeds.
const CONTROL_POINTS = [
  { chainage: 0, easting: 500000, northing: 6250000 },
  { chainage: 200, easting: 500200, northing: 6250000 },
];

describe('lot_breakdown apply/rollback (DB-backed)', () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let controlLineId: string;
  let templateId: string;

  const geometry = () => ({ controlLineId, offsetLeft: 5, offsetRight: 5 });
  const twoLots = (withTemplate: boolean) => [
    {
      lotNumber: 'RD-001',
      description: 'CH 0-100',
      chainageStart: 0,
      chainageEnd: 100,
      activityType: 'Earthworks',
      lotType: 'chainage',
      ...(withTemplate ? { itpTemplateId: templateId } : {}),
    },
    {
      lotNumber: 'RD-002',
      description: 'CH 100-200',
      chainageStart: 100,
      chainageEnd: 200,
      activityType: 'Pavement',
      lotType: 'chainage',
    },
  ];

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `LB Co ${stamp}` } })).id;
    const user = await prisma.user.create({
      data: {
        email: `lb-user-${stamp}@example.com`,
        fullName: 'LB User',
        passwordHash: 'x',
        companyId,
        roleInCompany: 'project_manager',
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        name: 'LB Project',
        projectNumber: `LB-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;
    const controlLine = await prisma.controlLine.create({
      data: {
        projectId,
        name: 'MC01',
        coordinateSystem: 'EPSG:7856',
        points: CONTROL_POINTS as unknown as object,
        geometryWgs84: { type: 'Feature' } as unknown as object,
      },
      select: { id: true },
    });
    controlLineId = controlLine.id;
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Earthworks ITP',
        activityType: 'Earthworks',
        isActive: true,
        checklistItems: {
          create: [{ sequenceNumber: 1, description: 'Proof roll' }],
        },
      },
      select: { id: true },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.controlLine.deleteMany({ where: { projectId } });
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  beforeEach(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
  });

  async function seed(payload: unknown) {
    return createProposal({
      projectId,
      stage: LOT_BREAKDOWN_STAGE,
      requestedById: userId,
      model: 'deterministic',
      sourceRefs: [{ note: 'From control line MC01' }],
      payload,
    });
  }

  it('creates lots + ITP instance + geometry on accept, and rollback deletes them all', async () => {
    const proposal = await seed({ geometry: geometry(), lots: twoLots(true) });
    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    expect(decided.status).toBe('accepted');

    const lots = await prisma.lot.findMany({ where: { projectId }, orderBy: { lotNumber: 'asc' } });
    expect(lots.map((l) => l.lotNumber)).toEqual(['RD-001', 'RD-002']);
    expect(await prisma.iTPInstance.count({ where: { lot: { projectId } } })).toBe(1);
    expect(await prisma.lotGeometry.count({ where: { lot: { projectId } } })).toBe(2);

    const groups = decided.appliedRecordIds as unknown as Array<{ model: string; ids: string[] }>;
    expect(groups.find((g) => g.model === 'Lot')?.ids).toHaveLength(2);
    expect(groups.find((g) => g.model === 'ITPInstance')?.ids).toHaveLength(1);
    expect(groups.find((g) => g.model === 'LotGeometry')?.ids).toHaveLength(2);

    const rolled = await rollbackProposal({ proposalId: proposal.id, projectId, userId });
    expect(rolled.status).toBe('rolled_back');
    expect(await prisma.lot.count({ where: { projectId } })).toBe(0);
    expect(await prisma.lotGeometry.count({ where: { lot: { projectId } } })).toBe(0);
    expect(await prisma.iTPInstance.count({ where: { lot: { projectId } } })).toBe(0);
  });

  it('creates lots without geometry when none is requested', async () => {
    const proposal = await seed({ lots: twoLots(false) });
    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    expect(decided.status).toBe('accepted');
    expect(await prisma.lot.count({ where: { projectId } })).toBe(2);
    expect(await prisma.lotGeometry.count({ where: { lot: { projectId } } })).toBe(0);
    const groups = decided.appliedRecordIds as unknown as Array<{ model: string }>;
    expect(groups.some((g) => g.model === 'LotGeometry')).toBe(false);
  });

  it('rejects an accept with an empty lots array', async () => {
    const proposal = await seed({ lots: [] });
    await expect(
      decideProposal({ proposalId: proposal.id, projectId, userId, action: 'accept' }),
    ).rejects.toBeInstanceOf(AppError);
    expect(await prisma.lot.count({ where: { projectId } })).toBe(0);
  });

  it('rejects an accept whose geometry chainage runs past the control line', async () => {
    const proposal = await seed({
      geometry: geometry(),
      lots: [
        {
          lotNumber: 'RD-OOR',
          chainageStart: 0,
          chainageEnd: 400,
          activityType: 'Earthworks',
          lotType: 'chainage',
        },
      ],
    });
    await expect(
      decideProposal({ proposalId: proposal.id, projectId, userId, action: 'accept' }),
    ).rejects.toMatchObject({ details: { code: 'GEOMETRY_OUT_OF_RANGE' } });
    expect(await prisma.lot.count({ where: { projectId } })).toBe(0);
  });

  it('refuses rollback when a created lot has recorded work', async () => {
    const proposal = await seed({ geometry: geometry(), lots: twoLots(false) });
    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    const created = await prisma.lot.findFirst({ where: { projectId }, select: { id: true } });

    // A test result on one created lot is "recorded work" — rollback must refuse.
    await prisma.testResult.create({
      data: { projectId, lotId: created!.id, testType: 'density' },
    });

    await expect(
      rollbackProposal({ proposalId: proposal.id, projectId, userId }),
    ).rejects.toMatchObject({ code: 'LOTS_IN_USE' });
    // Both lots survive the refused rollback.
    expect(await prisma.lot.count({ where: { projectId } })).toBe(2);
    expect(decided.status).toBe('accepted');
  });
});
