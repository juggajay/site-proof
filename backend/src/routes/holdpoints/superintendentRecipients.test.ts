import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterizes the hold-point superintendent release-recipient helpers extracted
 * verbatim from backend/src/routes/holdpoints.ts.
 *
 * The DB-backed eligibility query is kept DB-free by mocking the Prisma client
 * module — no real database is touched. The pure `requiresSuperintendentApproval`
 * gate (from validation.ts) is used as-is. These tests freeze:
 *  - the eligible-role constant,
 *  - the short-circuit when approval is not required or there are no recipients,
 *  - the Prisma where/select shapes used to gather eligible recipients,
 *  - dedupe-by-lowercased-email (company admins overriding project users),
 *  - trim + lowercase matching of requested recipients against the eligible set,
 *  - the 403 forbidden message for an ineligible recipient, and
 *  - AppError.notFound('Project') when the project is missing.
 */

const mocks = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  projectUserFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    projectUser: { findMany: mocks.projectUserFindMany },
    user: { findMany: mocks.userFindMany },
  },
}));

import {
  HP_SUPERINTENDENT_RELEASE_ROLES,
  getEligibleSuperintendentReleaseRecipients,
  requireSuperintendentApprovalRecipients,
} from './superintendentRecipients.js';
import type { HPProjectSettings } from './validation.js';

const REQUIRES_APPROVAL: HPProjectSettings = { hpApprovalRequirement: 'superintendent' };
const NO_APPROVAL: HPProjectSettings = { hpApprovalRequirement: 'none' };

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults; individual tests override as needed.
  mocks.projectFindUnique.mockResolvedValue({ companyId: 'company-1' });
  mocks.projectUserFindMany.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

describe('HP_SUPERINTENDENT_RELEASE_ROLES', () => {
  it('pins the eligible superintendent-release roles', () => {
    expect(HP_SUPERINTENDENT_RELEASE_ROLES).toEqual([
      'owner',
      'admin',
      'project_manager',
      'superintendent',
    ]);
  });
});

describe('requireSuperintendentApprovalRecipients — short-circuit (no DB)', () => {
  it('returns recipients unchanged when approval is not required', async () => {
    const recipients = [{ email: 'foreman@example.com', fullName: 'Fore Man' }];
    const result = await requireSuperintendentApprovalRecipients('p1', NO_APPROVAL, recipients);

    expect(result).toBe(recipients); // same array returned, untouched
    expect(mocks.projectFindUnique).not.toHaveBeenCalled();
  });

  it('returns an empty recipients list unchanged even when approval is required', async () => {
    const recipients: { email: string; fullName: string | null }[] = [];
    const result = await requireSuperintendentApprovalRecipients(
      'p1',
      REQUIRES_APPROVAL,
      recipients,
    );

    expect(result).toEqual([]);
    expect(mocks.projectFindUnique).not.toHaveBeenCalled();
  });
});

describe('requireSuperintendentApprovalRecipients — eligibility (mocked DB)', () => {
  it('resolves a requested recipient to the eligible record, matching case-insensitively and trimming', async () => {
    mocks.projectUserFindMany.mockResolvedValue([
      { user: { email: 'Super@Example.com', fullName: 'Super Intendent' } },
    ]);

    const result = await requireSuperintendentApprovalRecipients('p1', REQUIRES_APPROVAL, [
      { email: '  super@example.com  ', fullName: null },
    ]);

    // Returns the canonical eligible record, not the (differently cased) input.
    expect(result).toEqual([{ email: 'Super@Example.com', fullName: 'Super Intendent' }]);
  });

  it('throws 403 with the exact forbidden message when a recipient is not eligible', async () => {
    mocks.projectUserFindMany.mockResolvedValue([
      { user: { email: 'eligible@example.com', fullName: 'Eligible One' } },
    ]);

    await expect(
      requireSuperintendentApprovalRecipients('p1', REQUIRES_APPROVAL, [
        { email: 'stranger@example.com', fullName: null },
      ]),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'This project requires superintendent approval to release hold points.',
    });
  });

  it("throws AppError.notFound('Project') when the project does not exist", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    await expect(
      requireSuperintendentApprovalRecipients('missing', REQUIRES_APPROVAL, [
        { email: 'someone@example.com', fullName: null },
      ]),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' });
  });
});

describe('getEligibleSuperintendentReleaseRecipients (mocked DB)', () => {
  it('queries eligible project users and company owners/admins with the frozen where/select shapes', async () => {
    await getEligibleSuperintendentReleaseRecipients('proj-9');

    expect(mocks.projectFindUnique).toHaveBeenCalledWith({
      where: { id: 'proj-9' },
      select: { companyId: true },
    });
    expect(mocks.projectUserFindMany).toHaveBeenCalledWith({
      where: {
        projectId: 'proj-9',
        status: 'active',
        role: { in: HP_SUPERINTENDENT_RELEASE_ROLES },
      },
      include: { user: { select: { email: true, fullName: true } } },
    });
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', roleInCompany: { in: ['owner', 'admin'] } },
      select: { email: true, fullName: true },
    });
  });

  it('dedupes by lowercased email, with company admins overriding project users', async () => {
    mocks.projectUserFindMany.mockResolvedValue([
      { user: { email: 'Dup@Example.com', fullName: 'Project User Name' } },
    ]);
    mocks.userFindMany.mockResolvedValue([
      { email: 'dup@example.com', fullName: 'Company Admin Name' },
    ]);

    const eligible = await getEligibleSuperintendentReleaseRecipients('p1');

    expect(eligible.size).toBe(1);
    // The company-admin loop runs second, so its record wins for the shared key.
    expect(eligible.get('dup@example.com')).toEqual({
      email: 'dup@example.com',
      fullName: 'Company Admin Name',
    });
  });

  it('keys distinct project users and company admins separately by lowercased email', async () => {
    mocks.projectUserFindMany.mockResolvedValue([
      { user: { email: 'PU@Example.com', fullName: 'PU' } },
    ]);
    mocks.userFindMany.mockResolvedValue([{ email: 'Admin@Example.com', fullName: 'Admin' }]);

    const eligible = await getEligibleSuperintendentReleaseRecipients('p1');

    expect(eligible.size).toBe(2);
    expect(eligible.get('pu@example.com')).toEqual({ email: 'PU@Example.com', fullName: 'PU' });
    expect(eligible.get('admin@example.com')).toEqual({
      email: 'Admin@Example.com',
      fullName: 'Admin',
    });
  });
});
