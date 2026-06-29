import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DB-free unit tests for the ITP-evidence attachment resolution used by
 * POST /api/documents/upload (the endpoint the offline photo sync worker
 * posts to). Prisma and the ITP access helpers are mocked so these freeze the
 * contract without a database:
 *  - only entityType 'itp' with an entityId resolves (others -> null, no query)
 *  - unknown completion -> null (orphan-safe: the upload must NOT fail)
 *  - cross-project / cross-lot ids -> the attach endpoint's 400 wording
 *  - lot-scoped uploads run the attach endpoint's role + subcontractor
 *    permission checks; project-scoped (no lot) uploads forbid subcontractors
 *  - the attachment row links the resolved completion to the new document
 *
 * Route-level coverage (real HTTP + database) lives in documents.test.ts.
 */

const mocks = vi.hoisted(() => ({
  completionFindUnique: vi.fn(),
  attachmentCreate: vi.fn(),
  requireItpLotRole: vi.fn(),
  requireItpProjectRole: vi.fn(),
  requireItpSubcontractorCompletionPermission: vi.fn(),
  isItpSubcontractorUser: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    iTPCompletion: { findUnique: mocks.completionFindUnique },
    iTPCompletionAttachment: { create: mocks.attachmentCreate },
  },
}));

vi.mock('../itp/helpers/access.js', () => ({
  ITP_WRITE_ROLES: ['owner', 'admin', 'foreman', 'subcontractor'],
  isItpSubcontractorUser: mocks.isItpSubcontractorUser,
  requireItpLotRole: mocks.requireItpLotRole,
  requireItpProjectRole: mocks.requireItpProjectRole,
  requireItpSubcontractorCompletionPermission: mocks.requireItpSubcontractorCompletionPermission,
}));

import { AppError } from '../../lib/AppError.js';
import type { AuthUser } from '../../lib/auth.js';
import {
  attachDocumentToItpCompletion,
  resolveItpEvidenceAttachmentTarget,
} from './itpEvidenceAttachment.js';

const user: AuthUser = {
  userId: 'user-1',
  email: 'foreman@example.test',
  role: 'foreman',
};

function completionRecord(
  overrides: {
    lotId?: string | null;
    lotProjectId?: string | null;
    responsibleParty?: string | null;
    templateSnapshot?: string | null;
  } = {},
) {
  const lotId = overrides.lotId === undefined ? 'lot-1' : overrides.lotId;
  const lotProjectId = overrides.lotProjectId === undefined ? 'project-1' : overrides.lotProjectId;
  const responsibleParty =
    overrides.responsibleParty === undefined ? 'contractor' : overrides.responsibleParty;
  return {
    id: 'completion-1',
    checklistItemId: 'checklist-item-1',
    checklistItem: {
      id: 'checklist-item-1',
      description: 'Inspect work',
      sequenceNumber: 1,
      pointType: 'standard',
      responsibleParty,
      evidenceRequired: 'none',
      acceptanceCriteria: null,
      testType: null,
    },
    itpInstance: {
      lotId,
      templateSnapshot:
        overrides.templateSnapshot === undefined ? null : overrides.templateSnapshot,
      lot: lotId ? { projectId: lotProjectId } : null,
      template: { projectId: 'project-1' },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isItpSubcontractorUser.mockReturnValue(false);
  mocks.requireItpLotRole.mockResolvedValue('foreman');
  mocks.requireItpProjectRole.mockResolvedValue('foreman');
  mocks.requireItpSubcontractorCompletionPermission.mockResolvedValue(null);
});

describe('resolveItpEvidenceAttachmentTarget', () => {
  it('resolves the completion and runs the lot-scoped attach checks for entityType itp', async () => {
    mocks.completionFindUnique.mockResolvedValue(completionRecord());

    const target = await resolveItpEvidenceAttachmentTarget(user, {
      entityType: 'itp',
      entityId: 'completion-1',
      projectId: 'project-1',
      lotId: 'lot-1',
    });

    expect(target).toEqual({ completionId: 'completion-1', lotId: 'lot-1' });
    expect(mocks.completionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'completion-1' } }),
    );
    // The attach endpoint's exact gates: write role on the lot + the
    // subcontractor canCompleteITP permission.
    expect(mocks.requireItpLotRole).toHaveBeenCalledWith(
      user,
      'project-1',
      'lot-1',
      expect.arrayContaining(['foreman']),
      'ITP attachment write access required',
    );
    expect(mocks.requireItpSubcontractorCompletionPermission).toHaveBeenCalledWith(
      user,
      'project-1',
      'lot-1',
    );
  });

  it('returns null without querying for non-itp entity types', async () => {
    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'general',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).resolves.toBeNull();

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: null,
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).resolves.toBeNull();

    expect(mocks.completionFindUnique).not.toHaveBeenCalled();
  });

  it('returns null without querying when entityId is missing', async () => {
    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: null,
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).resolves.toBeNull();

    expect(mocks.completionFindUnique).not.toHaveBeenCalled();
  });

  it('is orphan-safe: an unknown completion resolves to null instead of failing the upload', async () => {
    mocks.completionFindUnique.mockResolvedValue(null);

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'gone-completion',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).resolves.toBeNull();

    expect(mocks.requireItpLotRole).not.toHaveBeenCalled();
  });

  it("rejects a foreign-project completion id with the attach endpoint's 400 contract", async () => {
    mocks.completionFindUnique.mockResolvedValue(
      completionRecord({ lotProjectId: 'other-company-project' }),
    );

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Document must belong to the same project as the ITP completion',
    });

    // Rejection happens before any role check fires.
    expect(mocks.requireItpLotRole).not.toHaveBeenCalled();
  });

  it('rejects a cross-lot upload (document lot differs from the completion lot)', async () => {
    mocks.completionFindUnique.mockResolvedValue(completionRecord());

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'different-lot',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Document must belong to the same lot as the ITP completion',
    });
  });

  it('returns the completion lot when the queued upload omits lotId', async () => {
    mocks.completionFindUnique.mockResolvedValue(completionRecord());

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: null,
      }),
    ).resolves.toEqual({ completionId: 'completion-1', lotId: 'lot-1' });
  });

  it('propagates the role gate rejection (authz failure on the lot)', async () => {
    mocks.completionFindUnique.mockResolvedValue(completionRecord());
    mocks.requireItpLotRole.mockRejectedValue(
      AppError.forbidden('ITP attachment write access required'),
    );

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects subcontractor uploads to hidden ITP checklist items', async () => {
    mocks.completionFindUnique.mockResolvedValue(
      completionRecord({ responsibleParty: 'superintendent' }),
    );
    mocks.isItpSubcontractorUser.mockReturnValue(true);

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'ITP attachment write access required',
    });
  });

  it('uses the ITP instance snapshot when checking subcontractor item visibility', async () => {
    mocks.completionFindUnique.mockResolvedValue(
      completionRecord({
        responsibleParty: 'contractor',
        templateSnapshot: JSON.stringify({
          id: 'template-1',
          name: 'Snapshot',
          checklistItems: [
            {
              id: 'checklist-item-1',
              description: 'Superintendent witness',
              sequenceNumber: 1,
              responsibleParty: 'superintendent',
            },
          ],
        }),
      }),
    );
    mocks.isItpSubcontractorUser.mockReturnValue(true);

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: 'lot-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'ITP attachment write access required',
    });
  });

  it('falls back to the template project and forbids subcontractors when the instance has no lot', async () => {
    mocks.completionFindUnique.mockResolvedValue(completionRecord({ lotId: null }));
    mocks.isItpSubcontractorUser.mockReturnValue(true);

    await expect(
      resolveItpEvidenceAttachmentTarget(user, {
        entityType: 'itp',
        entityId: 'completion-1',
        projectId: 'project-1',
        lotId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.requireItpProjectRole).toHaveBeenCalledWith(
      user,
      'project-1',
      expect.arrayContaining(['foreman']),
      'ITP attachment write access required',
    );
    expect(mocks.requireItpLotRole).not.toHaveBeenCalled();
  });
});

describe('attachDocumentToItpCompletion', () => {
  it('creates the same ITPCompletionAttachment row the attach endpoint creates', async () => {
    await attachDocumentToItpCompletion(
      { completionId: 'completion-1', lotId: 'lot-1' },
      'document-9',
    );

    expect(mocks.attachmentCreate).toHaveBeenCalledWith({
      data: { completionId: 'completion-1', documentId: 'document-9' },
    });
  });
});
