import { describe, expect, it } from 'vitest';
import {
  CONFORMED_LOT_BUDGET_EDIT_FIELDS,
  LOT_BUDGET_EDITORS,
  LOT_EDITORS,
  getProvidedUpdateFields,
} from './updateFields.js';

// getProvidedUpdateFields is typed against the inferred updateLotSchema shape,
// but at runtime it only walks Object.entries — so these DB-free cases pass
// plain objects cast to the parameter type.
type UpdateInput = Parameters<typeof getProvidedUpdateFields>[0];
const fields = (data: Record<string, unknown>) =>
  getProvidedUpdateFields(data as unknown as UpdateInput);

describe('lots update-field helpers (pure, DB-free)', () => {
  describe('getProvidedUpdateFields', () => {
    it('omits keys whose value is undefined', () => {
      expect(fields({ lotNumber: 'L1', description: undefined, status: undefined })).toEqual([
        'lotNumber',
      ]);
    });

    it('keeps keys explicitly set to null, false, or 0 (only undefined is absent)', () => {
      const result = fields({
        budgetAmount: 0,
        isPrimary: false,
        assignedSubcontractorId: null,
        notes: undefined,
      });
      // Order follows the object's keys; `notes` (undefined) is dropped.
      expect(result).toEqual(['budgetAmount', 'isPrimary', 'assignedSubcontractorId']);
      expect(result).not.toContain('notes');
    });

    it('returns an empty array when every field is undefined', () => {
      expect(fields({ description: undefined, status: undefined })).toEqual([]);
    });
  });

  describe('CONFORMED_LOT_BUDGET_EDIT_FIELDS', () => {
    it('is exactly the budget-only fields a conformed lot may still edit', () => {
      expect(CONFORMED_LOT_BUDGET_EDIT_FIELDS.has('budgetAmount')).toBe(true);
      expect(CONFORMED_LOT_BUDGET_EDIT_FIELDS.has('expectedUpdatedAt')).toBe(true);
      // A non-budget field (e.g. status) must not be editable once conformed.
      expect(CONFORMED_LOT_BUDGET_EDIT_FIELDS.has('status')).toBe(false);
      expect(CONFORMED_LOT_BUDGET_EDIT_FIELDS.size).toBe(2);
      expect([...CONFORMED_LOT_BUDGET_EDIT_FIELDS].sort()).toEqual([
        'budgetAmount',
        'expectedUpdatedAt',
      ]);
    });
  });

  describe('editor role constants', () => {
    it('LOT_EDITORS lists the lot-editing roles', () => {
      expect(LOT_EDITORS).toEqual([
        'owner',
        'admin',
        'project_manager',
        'site_engineer',
        'quality_manager',
        'foreman',
      ]);
      // site_manager can create lots but is intentionally not a lot editor.
      expect(LOT_EDITORS).not.toContain('site_manager');
    });

    it('LOT_BUDGET_EDITORS is the narrower budget-editing set', () => {
      expect(LOT_BUDGET_EDITORS).toEqual(['owner', 'admin', 'project_manager']);
      // Every budget editor is also a lot editor (budget editors ⊂ lot editors).
      expect(LOT_BUDGET_EDITORS.every((role) => LOT_EDITORS.includes(role))).toBe(true);
    });
  });
});
