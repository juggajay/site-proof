import { describe, expect, it } from 'vitest';

import { HP_REQUEST_ROLES, isSubcontractorUser, type AuthenticatedUser } from './access.js';

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

describe('HP_REQUEST_ROLES', () => {
  // site_manager (ROLE_HIERARCHY 70) outranks foreman (60) and, like foreman, can
  // complete ITP checklist items (ITP_WRITE_ROLES includes site_manager). It must
  // therefore also be allowed to request hold point release, otherwise a senior
  // field role drives the checklist to a hold point and is blocked from requesting
  // inspection while their subordinates are not. This list is the single source of
  // truth for the request guard (requireProjectRole), the in-app release allow-list
  // (HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent']) and the
  // frontend-facing canRequestHoldPointRelease flag.
  it('includes site_manager alongside foreman', () => {
    expect(HP_REQUEST_ROLES).toContain('site_manager');
    expect(HP_REQUEST_ROLES).toContain('foreman');
  });

  it('pins the exact set of roles allowed to request hold point release', () => {
    expect([...HP_REQUEST_ROLES].sort()).toEqual(
      [
        'admin',
        'foreman',
        'owner',
        'project_manager',
        'quality_manager',
        'site_engineer',
        'site_manager',
      ].sort(),
    );
  });

  it('never allows subcontractor portal roles', () => {
    expect(HP_REQUEST_ROLES).not.toContain('subcontractor');
    expect(HP_REQUEST_ROLES).not.toContain('subcontractor_admin');
  });
});
