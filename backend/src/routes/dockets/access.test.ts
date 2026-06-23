import { describe, expect, it } from 'vitest';
import {
  DOCKET_APPROVERS,
  isDocketEntryEditable,
  isSubcontractorUser,
  requireApprovedDocketResource,
  type AuthUser,
} from './access.js';

const baseUser: AuthUser = {
  id: 'u1',
  userId: 'u1',
  email: 'user@example.com',
  fullName: null,
  roleInCompany: 'admin',
  role: 'admin',
  companyId: 'c1',
};

const userWithRole = (
  roleInCompany: string,
  companyId: string | null = baseUser.companyId,
): AuthUser => ({
  ...baseUser,
  roleInCompany,
  companyId,
});

describe('dockets access helpers (pure)', () => {
  describe('DOCKET_APPROVERS (M35)', () => {
    it('includes quality_manager so QMs can approve/query/reject dockets', () => {
      expect(DOCKET_APPROVERS).toContain('quality_manager');
    });
  });

  describe('isSubcontractorUser', () => {
    it('returns true for subcontractor portal roles', () => {
      expect(isSubcontractorUser(userWithRole('subcontractor', null))).toBe(true);
      expect(isSubcontractorUser(userWithRole('subcontractor_admin', null))).toBe(true);
    });

    it('returns false for stale company-linked subcontractor portal roles', () => {
      expect(isSubcontractorUser(userWithRole('subcontractor', 'c1'))).toBe(false);
      expect(isSubcontractorUser(userWithRole('subcontractor_admin', 'c1'))).toBe(false);
    });

    it('returns false for company/staff roles and empty role', () => {
      for (const role of ['owner', 'admin', 'project_manager', 'site_manager', 'foreman', '']) {
        expect(isSubcontractorUser(userWithRole(role))).toBe(false);
      }
    });
  });

  describe('isDocketEntryEditable', () => {
    it('is editable only for draft, queried, and rejected', () => {
      expect(isDocketEntryEditable('draft')).toBe(true);
      expect(isDocketEntryEditable('queried')).toBe(true);
      expect(isDocketEntryEditable('rejected')).toBe(true);
    });

    it('is not editable for approved/pending/other statuses', () => {
      for (const status of ['approved', 'pending_approval', 'submitted', 'unknown', '']) {
        expect(isDocketEntryEditable(status)).toBe(false);
      }
    });
  });

  describe('requireApprovedDocketResource', () => {
    it('does not throw when the resource is approved', () => {
      expect(() => requireApprovedDocketResource('approved', 'Employee')).not.toThrow();
      expect(() => requireApprovedDocketResource('approved', 'Plant')).not.toThrow();
    });

    it('throws a resource-specific message for non-approved statuses', () => {
      expect(() => requireApprovedDocketResource('pending_approval', 'Employee')).toThrow(
        'Employee must be approved before it can be used on a docket',
      );
      expect(() => requireApprovedDocketResource('rejected', 'Plant')).toThrow(
        'Plant must be approved before it can be used on a docket',
      );
    });
  });
});
