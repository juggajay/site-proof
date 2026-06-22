import { describe, expect, it } from 'vitest';

import type { AuthUser } from '../../../lib/auth.js';
import { isItpSubcontractorUser } from './access.js';

function makeUser(role: string, companyId: string | null = null): AuthUser {
  return {
    id: 'user-1',
    userId: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    role,
    companyId,
  };
}

describe('isItpSubcontractorUser', () => {
  it('returns true for standalone subcontractor portal roles', () => {
    expect(isItpSubcontractorUser(makeUser('subcontractor'))).toBe(true);
    expect(isItpSubcontractorUser(makeUser('subcontractor_admin'))).toBe(true);
  });

  it('returns false for company-linked subcontractor roles', () => {
    expect(isItpSubcontractorUser(makeUser('subcontractor', 'company-1'))).toBe(false);
    expect(isItpSubcontractorUser(makeUser('subcontractor_admin', 'company-1'))).toBe(false);
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
      expect(isItpSubcontractorUser(makeUser(role))).toBe(false);
    }
  });

  it('returns false for an unknown or empty role', () => {
    expect(isItpSubcontractorUser(makeUser(''))).toBe(false);
    expect(isItpSubcontractorUser(makeUser('member'))).toBe(false);
  });
});
