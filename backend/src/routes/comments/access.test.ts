import { beforeEach, describe, expect, it, vi } from 'vitest';

// DB-free coverage of the comment entity access gate. prisma and the projectAccess
// helpers are mocked via vi.hoisted spies so no database is touched. We pin the
// progress-claim commercial-role gate (audit finding: claim comment threads must
// honour the same owner/admin/project_manager boundary the claims API enforces,
// rather than admitting any active project member) and confirm non-claim entities
// keep their existing any-member access. The DB-backed wiring is also exercised by
// the comments route suite in CI.

const { progressClaimFindUnique, ncrFindUnique } = vi.hoisted(() => ({
  progressClaimFindUnique: vi.fn(),
  ncrFindUnique: vi.fn(),
}));

const { isStandalone, getEffectiveRole, checkAccess } = vi.hoisted(() => ({
  isStandalone: vi.fn(),
  getEffectiveRole: vi.fn(),
  checkAccess: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    progressClaim: { findUnique: progressClaimFindUnique },
    nCR: { findUnique: ncrFindUnique },
  },
}));

vi.mock('../../lib/projectAccess.js', () => ({
  activeSubcontractorCompanyWhere: vi.fn(),
  checkProjectAccess: checkAccess,
  getSubcontractorPortalModuleAccessDeniedMessage: vi.fn(() => 'module denied'),
  hasPortalModuleEnabled: vi.fn(),
  isStandaloneSubcontractorPortalIdentity: isStandalone,
  getEffectiveProjectRole: getEffectiveRole,
}));

import { requireCommentEntityAccess } from './access.js';

const internalUser = { id: 'user-1', roleInCompany: 'member', companyId: 'company-1' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  isStandalone.mockReturnValue(false);
  checkAccess.mockResolvedValue(true);
  progressClaimFindUnique.mockResolvedValue({ projectId: 'project-1' });
  ncrFindUnique.mockResolvedValue({ projectId: 'project-1' });
});

describe('requireCommentEntityAccess — progress claim commercial gate', () => {
  it('denies an internal non-commercial role (foreman) on progress_claim comments', async () => {
    getEffectiveRole.mockResolvedValue('foreman');

    await expect(
      requireCommentEntityAccess(internalUser, 'progress_claim', 'claim-1'),
    ).rejects.toThrow('Commercial access required');
  });

  it('allows a commercial role (project_manager) on progress_claim comments', async () => {
    getEffectiveRole.mockResolvedValue('project_manager');

    await expect(
      requireCommentEntityAccess(internalUser, 'progress_claim', 'claim-1'),
    ).resolves.toBe('project-1');
  });

  it('denies when the internal user has no effective project role on a claim', async () => {
    getEffectiveRole.mockResolvedValue(null);

    await expect(
      requireCommentEntityAccess(internalUser, 'progressclaim', 'claim-1'),
    ).rejects.toThrow('Commercial access required');
  });

  it('does not apply the commercial gate to non-claim entities (ncr)', async () => {
    // A foreman holds no commercial role, but NCR comment threads are not
    // commercially restricted — they must stay reachable via project access.
    getEffectiveRole.mockResolvedValue('foreman');

    await expect(requireCommentEntityAccess(internalUser, 'ncr', 'ncr-1')).resolves.toBe(
      'project-1',
    );
    expect(checkAccess).toHaveBeenCalledWith('user-1', 'project-1');
    expect(getEffectiveRole).not.toHaveBeenCalled();
  });
});
