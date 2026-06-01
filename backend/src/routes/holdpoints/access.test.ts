import { describe, expect, it } from 'vitest';

import { isSubcontractorUser, type AuthenticatedUser } from './access.js';

// DB-free characterization of the subcontractor-detection predicate, which gates
// the hold-point access helpers. The other access helpers in this module query
// Prisma (project membership, lot assignments) and are exercised by the
// DB-backed holdpoints.test.ts access-control suite in CI; only this pure
// predicate is unit-tested here.

function makeUser(roleInCompany: string): AuthenticatedUser {
  return {
    id: 'user-1',
    userId: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    roleInCompany,
    role: roleInCompany,
    companyId: 'company-1',
  };
}

describe('isSubcontractorUser', () => {
  it('returns true for subcontractor portal roles', () => {
    expect(isSubcontractorUser(makeUser('subcontractor'))).toBe(true);
    expect(isSubcontractorUser(makeUser('subcontractor_admin'))).toBe(true);
  });

  it('returns false for internal company roles', () => {
    const internalRoles = [
      'owner',
      'admin',
      'project_manager',
      'site_engineer',
      'foreman',
      'quality_manager',
      'superintendent',
    ];
    for (const role of internalRoles) {
      expect(isSubcontractorUser(makeUser(role))).toBe(false);
    }
  });

  it('returns false for an unknown/empty role', () => {
    expect(isSubcontractorUser(makeUser(''))).toBe(false);
    expect(isSubcontractorUser(makeUser('member'))).toBe(false);
  });
});
