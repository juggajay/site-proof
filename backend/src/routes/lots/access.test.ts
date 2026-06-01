import { describe, it, expect } from 'vitest';
import { canViewLotBudget, isSubcontractorUser, type AuthenticatedUser } from './access.js';

// These two helpers are pure (no Prisma, no I/O), so they are characterized
// here without a database. The remaining access helpers in ./access.ts query
// Prisma and are covered by the DB-backed route suite (src/routes/lots.test.ts)
// in CI. This locks the commercial-field-hiding and subcontractor-detection
// contracts called out as behavior-preserving for the lots access extraction.

const asUser = (roleInCompany: string | null): AuthenticatedUser =>
  ({ roleInCompany }) as unknown as AuthenticatedUser;

describe('lots access helpers (pure, DB-free)', () => {
  describe('canViewLotBudget', () => {
    it('allows the commercial roles to view budgets', () => {
      expect(canViewLotBudget('owner')).toBe(true);
      expect(canViewLotBudget('admin')).toBe(true);
      expect(canViewLotBudget('project_manager')).toBe(true);
    });

    it('hides budgets from non-commercial roles', () => {
      expect(canViewLotBudget('site_manager')).toBe(false);
      expect(canViewLotBudget('foreman')).toBe(false);
      expect(canViewLotBudget('subcontractor')).toBe(false);
    });

    it('treats a null role as non-commercial', () => {
      expect(canViewLotBudget(null)).toBe(false);
    });
  });

  describe('isSubcontractorUser', () => {
    it('detects subcontractor portal roles', () => {
      expect(isSubcontractorUser(asUser('subcontractor'))).toBe(true);
      expect(isSubcontractorUser(asUser('subcontractor_admin'))).toBe(true);
    });

    it('treats internal roles as non-subcontractor', () => {
      expect(isSubcontractorUser(asUser('owner'))).toBe(false);
      expect(isSubcontractorUser(asUser('admin'))).toBe(false);
      expect(isSubcontractorUser(asUser('project_manager'))).toBe(false);
      expect(isSubcontractorUser(asUser('site_manager'))).toBe(false);
      expect(isSubcontractorUser(asUser('foreman'))).toBe(false);
    });
  });
});
