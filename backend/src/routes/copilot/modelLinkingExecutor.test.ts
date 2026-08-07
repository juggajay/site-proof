import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { extractModelLotLinkingProposal, MODEL_LOT_LINKING_STAGE } from './modelLinkingExecutor.js';
import { decideProposal, rollbackProposal } from './proposalService.js';

describe('model_lot_linking executor (DB-backed)', () => {
  let companyId: string;
  let userId: string;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const company = await prisma.company.create({ data: { name: `Model linking ${stamp}` } });
    companyId = company.id;
    const user = await prisma.user.create({
      data: {
        email: `model-linking-${stamp}@example.com`,
        passwordHash: 'x',
        companyId,
        roleInCompany: 'project_manager',
      },
    });
    userId = user.id;
    const projectData = {
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    };
    projectId = (
      await prisma.project.create({
        data: { ...projectData, name: 'Model link project', projectNumber: `ML-${stamp}` },
      })
    ).id;
    otherProjectId = (
      await prisma.project.create({
        data: { ...projectData, name: 'Other model project', projectNumber: `MLO-${stamp}` },
      })
    ).id;
  });

  beforeEach(async () => {
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.designModel.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  });

  afterAll(async () => {
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.designModel.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  async function createVersion(versionNumber: number) {
    let model = await prisma.designModel.findFirst({ where: { projectId } });
    model ??= await prisma.designModel.create({
      data: { projectId, name: 'Federated model', createdById: userId },
    });
    return prisma.designModelVersion.create({
      data: {
        modelId: model.id,
        versionNumber,
        status: 'ready',
        fileName: `model-v${versionNumber}.ifc`,
        sourceSizeBytes: 100n,
        sourceSha256: versionNumber.toString().padStart(64, '0'),
      },
    });
  }

  async function createLot(project: string, lotNumber: string) {
    return prisma.lot.create({
      data: {
        projectId: project,
        lotNumber,
        lotType: 'general',
        activityType: 'Earthworks',
      },
    });
  }

  it('extracts buckets, applies reviewed links, rejects a cross-project lot, and rolls back', async () => {
    const [lot1, collisionA, collisionB, otherLot] = await Promise.all([
      createLot(projectId, 'LOT-1'),
      createLot(projectId, 'LOT-2'),
      createLot(projectId, ' lot-2 '),
      createLot(otherProjectId, 'OTHER-LOT'),
    ]);
    const version = await createVersion(1);
    const elements = await Promise.all([
      prisma.modelElement.create({
        data: { versionId: version.id, ifcGuid: 'guid-1', lotNumberValue: ' lot-1 ' },
      }),
      prisma.modelElement.create({
        data: { versionId: version.id, ifcGuid: 'guid-2', lotNumberValue: 'LOT-2' },
      }),
      prisma.modelElement.create({
        data: { versionId: version.id, ifcGuid: 'guid-3', lotNumberValue: null },
      }),
    ]);

    const extracted = await extractModelLotLinkingProposal({
      projectId,
      versionId: version.id,
      requestedById: userId,
    });
    expect(extracted.proposal.stage).toBe(MODEL_LOT_LINKING_STAGE);
    expect(extracted.proposal.model).toBe('deterministic');
    expect(extracted.payload.counts).toMatchObject({
      elements: 3,
      linked: 1,
      ambiguous: 1,
      unlinked: 1,
    });
    expect(extracted.payload.ambiguous[0].candidateLotIds).toEqual(
      expect.arrayContaining([collisionA.id, collisionB.id]),
    );

    const editedPayload = {
      ...extracted.payload,
      links: [
        ...extracted.payload.links,
        {
          elementId: elements[1].id,
          ifcGuid: elements[1].ifcGuid,
          lotNumberValue: elements[1].lotNumberValue,
          lotId: collisionA.id,
          source: 'manual',
        },
      ],
    };
    const decided = await decideProposal({
      proposalId: extracted.proposal.id,
      projectId,
      userId,
      action: 'accept',
      editedPayload,
    });
    expect(await prisma.modelElementLotLink.findMany({ where: { versionId: version.id } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ elementId: elements[0].id, lotId: lot1.id, source: 'auto' }),
        expect.objectContaining({
          elementId: elements[1].id,
          lotId: collisionA.id,
          source: 'manual',
          createdById: userId,
        }),
      ]),
    );

    await rollbackProposal({ proposalId: decided.id, projectId, userId });
    expect(await prisma.modelElementLotLink.count({ where: { versionId: version.id } })).toBe(0);

    const second = await extractModelLotLinkingProposal({
      projectId,
      versionId: version.id,
      requestedById: userId,
    });
    await expect(
      decideProposal({
        proposalId: second.proposal.id,
        projectId,
        userId,
        action: 'accept',
        editedPayload: {
          ...second.payload,
          links: [
            {
              elementId: elements[0].id,
              ifcGuid: elements[0].ifcGuid,
              lotNumberValue: elements[0].lotNumberValue,
              lotId: otherLot.id,
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('pre-seeds retained manual GUID links and reports orphaned manual links', async () => {
    const lot = await createLot(projectId, 'LOT-MANUAL');
    const first = await createVersion(1);
    const [retained, removed] = await Promise.all([
      prisma.modelElement.create({
        data: { versionId: first.id, ifcGuid: 'retained-guid', lotNumberValue: 'OLD' },
      }),
      prisma.modelElement.create({
        data: { versionId: first.id, ifcGuid: 'removed-guid', lotNumberValue: 'OLD' },
      }),
    ]);
    await prisma.modelElementLotLink.createMany({
      data: [retained, removed].map((element) => ({
        versionId: first.id,
        elementId: element.id,
        lotId: lot.id,
        source: 'manual',
        createdById: userId,
      })),
    });

    const second = await createVersion(2);
    const newRetained = await prisma.modelElement.create({
      data: { versionId: second.id, ifcGuid: 'retained-guid', lotNumberValue: 'NEW' },
    });
    const extracted = await extractModelLotLinkingProposal({
      projectId,
      versionId: second.id,
      requestedById: userId,
    });

    expect(extracted.payload.links).toContainEqual(
      expect.objectContaining({
        elementId: newRetained.id,
        lotId: lot.id,
        source: 'manual',
        carriedForward: true,
      }),
    );
    expect(extracted.payload.orphanedManual).toContainEqual(
      expect.objectContaining({ ifcGuid: 'removed-guid', lotId: lot.id }),
    );
  });
});
