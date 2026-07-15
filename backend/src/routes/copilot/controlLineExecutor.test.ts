import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { createProposal, decideProposal, rollbackProposal } from './proposalService.js';
// Importing the executor registers the control_line apply/rollback handlers.
import { CONTROL_LINE_STAGE } from './controlLineExecutor.js';

// Two valid GDA2020 MGA56 alignments — the shape cleanSetoutCandidate produces.
const ALIGN_A = {
  name: 'MC01',
  coordinateSystem: 'EPSG:7856',
  points: [
    { chainage: 0, easting: 500000, northing: 6250000 },
    { chainage: 100, easting: 500100, northing: 6250000 },
  ],
};
const ALIGN_B = {
  name: 'MC02',
  coordinateSystem: 'EPSG:7856',
  points: [
    { chainage: 0, easting: 501000, northing: 6250000 },
    { chainage: 80, easting: 501080, northing: 6250000 },
  ],
};

describe('control_line apply/rollback (DB-backed)', () => {
  let companyId: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `CL Co ${stamp}` } })).id;
    const user = await prisma.user.create({
      data: {
        email: `cl-user-${stamp}@example.com`,
        fullName: 'CL User',
        passwordHash: 'x',
        companyId,
        roleInCompany: 'project_manager',
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        name: 'CL Project',
        projectNumber: `CL-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.controlLine.deleteMany({ where: { projectId } });
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  beforeEach(async () => {
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.controlLine.deleteMany({ where: { projectId } });
  });

  async function seed(payload: unknown) {
    return createProposal({
      projectId,
      stage: CONTROL_LINE_STAGE,
      requestedById: userId,
      model: 'claude-sonnet-5',
      sourceRefs: [{ fileName: 'setout.pdf', note: 'Read from setout sheet' }],
      payload,
    });
  }

  it('creates one control line per alignment on a verbatim accept, and rollback deletes them', async () => {
    const proposal = await seed({ alignments: [ALIGN_A, ALIGN_B], warnings: [] });

    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    expect(decided.status).toBe('accepted');

    const lines = await prisma.controlLine.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
    expect(lines.map((l) => l.name)).toEqual(['MC01', 'MC02']);
    expect(lines[0].coordinateSystem).toBe('EPSG:7856');
    expect(lines[0].geometryWgs84).toBeTruthy();

    const groups = decided.appliedRecordIds as unknown as Array<{ model: string; ids: string[] }>;
    expect(groups).toHaveLength(1);
    expect(groups[0].model).toBe('ControlLine');
    expect(groups[0].ids).toHaveLength(2);

    const rolled = await rollbackProposal({ proposalId: proposal.id, projectId, userId });
    expect(rolled.status).toBe('rolled_back');
    expect(await prisma.controlLine.count({ where: { projectId } })).toBe(0);
  });

  it('only creates checked alignments, honouring an edited name and CRS', async () => {
    const proposal = await seed({ alignments: [ALIGN_A, ALIGN_B], warnings: [] });

    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
      editedPayload: {
        alignments: [
          { ...ALIGN_A, name: 'MC01 – main', coordinateSystem: 'EPSG:7855', selected: true },
          { ...ALIGN_B, selected: false },
        ],
      },
    });
    expect(decided.status).toBe('edited');

    const lines = await prisma.controlLine.findMany({ where: { projectId } });
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe('MC01 – main');
    expect(lines[0].coordinateSystem).toBe('EPSG:7855');
  });

  it('falls back to a stable label when a selected alignment has a blank name', async () => {
    const proposal = await seed({
      alignments: [{ ...ALIGN_A, name: '   ' }],
      warnings: [],
    });
    await decideProposal({ proposalId: proposal.id, projectId, userId, action: 'accept' });
    const lines = await prisma.controlLine.findMany({ where: { projectId } });
    expect(lines[0].name).toBe('Alignment 1');
  });

  it('rejects an accept whose alignment carries an unsupported CRS', async () => {
    const proposal = await seed({
      alignments: [{ ...ALIGN_A, coordinateSystem: 'EPSG:9999' }],
      warnings: [],
    });
    await expect(
      decideProposal({ proposalId: proposal.id, projectId, userId, action: 'accept' }),
    ).rejects.toBeInstanceOf(AppError);
    expect(await prisma.controlLine.count({ where: { projectId } })).toBe(0);
  });

  it('rejects an accept where no alignment is selected', async () => {
    const proposal = await seed({ alignments: [ALIGN_A], warnings: [] });
    await expect(
      decideProposal({
        proposalId: proposal.id,
        projectId,
        userId,
        action: 'accept',
        editedPayload: { alignments: [{ ...ALIGN_A, selected: false }] },
      }),
    ).rejects.toMatchObject({ code: 'NO_ALIGNMENT_SELECTED' });
  });

  it('refuses rollback while a lot footprint still references a created control line', async () => {
    const proposal = await seed({ alignments: [ALIGN_A], warnings: [] });
    const decided = await decideProposal({
      proposalId: proposal.id,
      projectId,
      userId,
      action: 'accept',
    });
    const groups = decided.appliedRecordIds as unknown as Array<{ ids: string[] }>;
    const controlLineId = groups[0].ids[0];

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'L1',
        lotType: 'general',
        activityType: 'earthworks',
        status: 'not_started',
      },
      select: { id: true },
    });
    await prisma.lotGeometry.create({
      data: {
        lotId: lot.id,
        kind: 'chainage_offset',
        controlLineId,
        geometryWgs84: { type: 'Feature' } as unknown as object,
      },
    });

    await expect(
      rollbackProposal({ proposalId: proposal.id, projectId, userId }),
    ).rejects.toMatchObject({ code: 'CONTROL_LINE_IN_USE' });
    // The control line survives the refused rollback.
    expect(await prisma.controlLine.count({ where: { id: controlLineId } })).toBe(1);
  });
});
