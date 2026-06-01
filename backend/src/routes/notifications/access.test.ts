import { afterEach, describe, expect, it } from 'vitest';
import {
  NOTIFICATION_ADMIN_ROLES,
  isSubcontractorRole,
  requireNonProductionDiagnostics,
  requireNotificationAdmin,
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

const userWithRole = (roleInCompany: string): AuthUser => ({ ...baseUser, roleInCompany });

describe('notifications access helpers (pure)', () => {
  describe('requireNotificationAdmin', () => {
    it('allows every role in NOTIFICATION_ADMIN_ROLES', () => {
      expect(NOTIFICATION_ADMIN_ROLES).toEqual(['owner', 'admin', 'project_manager']);
      for (const role of NOTIFICATION_ADMIN_ROLES) {
        expect(() => requireNotificationAdmin(userWithRole(role))).not.toThrow();
      }
    });

    it('rejects non-admin roles with the exact message', () => {
      for (const role of ['site_manager', 'foreman', 'subcontractor', 'subcontractor_admin', '']) {
        expect(() => requireNotificationAdmin(userWithRole(role))).toThrow(
          'Notification administration access required',
        );
      }
    });
  });

  describe('requireNonProductionDiagnostics', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('rejects only when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => requireNonProductionDiagnostics()).toThrow('Not available in production');
    });

    it('allows non-production environments', () => {
      for (const env of ['test', 'development', 'staging', '']) {
        process.env.NODE_ENV = env;
        expect(() => requireNonProductionDiagnostics()).not.toThrow();
      }

      delete process.env.NODE_ENV;
      expect(() => requireNonProductionDiagnostics()).not.toThrow();
    });
  });

  describe('isSubcontractorRole', () => {
    it('returns true for subcontractor portal roles', () => {
      expect(isSubcontractorRole('subcontractor')).toBe(true);
      expect(isSubcontractorRole('subcontractor_admin')).toBe(true);
    });

    it('returns false for internal roles, empty, null, and undefined', () => {
      for (const role of ['owner', 'admin', 'project_manager', 'site_manager', 'foreman', '']) {
        expect(isSubcontractorRole(role)).toBe(false);
      }
      expect(isSubcontractorRole(null)).toBe(false);
      expect(isSubcontractorRole(undefined)).toBe(false);
    });
  });
});
