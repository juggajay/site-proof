import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  nCREvidence: {
    findFirst: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  projectUser: {
    findFirst: vi.fn(),
  },
  subcontractorUser: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lot: {
    findFirst: vi.fn(),
  },
}));

const projectAccessMocks = vi.hoisted(() => ({
  assertProjectAllowsWrite: vi.fn(),
  checkProjectAccess: vi.fn(),
  hasSubcontractorPortalModuleAccess: vi.fn(),
  requireSubcontractorPortalModuleAccess: vi.fn(),
}));

const ncrAccessMocks = vi.hoisted(() => ({
  canReadNcr: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../lib/projectAccess.js', () => ({
  activeSubcontractorCompanyWhere: (where = {}) => ({
    ...where,
    status: { notIn: ['suspended', 'removed'] },
  }),
  assertProjectAllowsWrite: projectAccessMocks.assertProjectAllowsWrite,
  checkProjectAccess: projectAccessMocks.checkProjectAccess,
  getSubcontractorPortalModuleAccessDeniedMessage: (module: string) => `${module} denied`,
  hasSubcontractorPortalModuleAccess: projectAccessMocks.hasSubcontractorPortalModuleAccess,
  hasPortalModuleEnabled: (
    portalAccess: Record<string, boolean> | null | undefined,
    module: string,
  ) => Boolean(portalAccess?.[module]),
  isStandaloneSubcontractorPortalIdentity: (user: {
    companyId?: string | null;
    roleInCompany?: string | null;
  }) =>
    !user.companyId && ['subcontractor', 'subcontractor_admin'].includes(user.roleInCompany ?? ''),
  requireSubcontractorPortalModuleAccess: projectAccessMocks.requireSubcontractorPortalModuleAccess,
}));

vi.mock('../ncrs/ncrAccess.js', () => ({
  canReadNcr: ncrAccessMocks.canReadNcr,
}));

import {
  canReadDocument,
  requireDocumentUploadAccess,
  type DocumentAccessRecord,
} from './access.js';

const subcontractorUser = {
  id: 'sub-user-1',
  userId: 'sub-user-1',
  email: 'subbie@example.com',
  fullName: 'Subbie User',
  roleInCompany: 'subcontractor',
  role: 'subcontractor',
  companyId: null,
} as const;

const ncrEvidenceDocument = {
  id: 'doc-1',
  projectId: 'project-1',
  lotId: null,
  uploadedById: 'other-user',
  documentType: 'photo',
  category: 'ncr_evidence',
} satisfies DocumentAccessRecord;

describe('document access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessMocks.checkProjectAccess.mockResolvedValue(true);
    projectAccessMocks.assertProjectAllowsWrite.mockResolvedValue(undefined);
    projectAccessMocks.hasSubcontractorPortalModuleAccess.mockImplementation(
      async ({ module }: { module: string }) => module === 'ncrs',
    );
    projectAccessMocks.requireSubcontractorPortalModuleAccess.mockImplementation(
      async ({ module }: { module: string }) => {
        if (module !== 'ncrs') {
          throw new Error(`${module} denied`);
        }
      },
    );
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1', companyId: 'headco-1' });
    mockPrisma.projectUser.findFirst.mockResolvedValue(null);
    mockPrisma.subcontractorUser.findFirst.mockResolvedValue({ role: 'user' });
    mockPrisma.subcontractorUser.findMany.mockResolvedValue([]);
    mockPrisma.lot.findFirst.mockResolvedValue(null);
    mockPrisma.nCREvidence.findFirst.mockResolvedValue(null);
    ncrAccessMocks.canReadNcr.mockResolvedValue(false);
  });

  it('uses NCR read access for linked NCR evidence documents', async () => {
    const linkedNcr = {
      projectId: 'project-1',
      responsibleUserId: null,
      responsibleSubcontractorId: 'subco-1',
      ncrLots: [{ lotId: 'lot-1' }],
    };
    mockPrisma.nCREvidence.findFirst.mockResolvedValue({ ncr: linkedNcr });

    ncrAccessMocks.canReadNcr.mockResolvedValueOnce(false);
    await expect(canReadDocument(subcontractorUser, ncrEvidenceDocument)).resolves.toBe(false);
    expect(ncrAccessMocks.canReadNcr).toHaveBeenLastCalledWith(linkedNcr, subcontractorUser);

    ncrAccessMocks.canReadNcr.mockResolvedValueOnce(true);
    await expect(canReadDocument(subcontractorUser, ncrEvidenceDocument)).resolves.toBe(true);
  });

  it('lets the uploading subcontractor read an unattached NCR evidence staging document', async () => {
    await expect(
      canReadDocument(subcontractorUser, {
        ...ncrEvidenceDocument,
        uploadedById: subcontractorUser.id,
      }),
    ).resolves.toBe(true);

    expect(mockPrisma.nCREvidence.findFirst).not.toHaveBeenCalled();
    expect(ncrAccessMocks.canReadNcr).not.toHaveBeenCalled();
  });

  it('allows subcontractors with NCR portal access to stage NCR evidence without a lot link', async () => {
    await expect(
      requireDocumentUploadAccess(subcontractorUser, 'project-1', null, 'ncr_evidence'),
    ).resolves.toBeUndefined();

    await expect(
      requireDocumentUploadAccess(subcontractorUser, 'project-1', null, 'Site Photos'),
    ).rejects.toThrow('documents denied');
  });
});
