import { z } from 'zod';
import { updateLotSchema } from './validation.js';

// =============================================================================
// Lot update-field helpers: the editor/budget-editor role sets, the set of
// fields a conformed lot may still have edited, and the helper that lists the
// fields actually provided in an update payload. Extracted verbatim from
// lots.ts to keep update authorization and field handling identical
// (behavior-preserving) — same roles, same conformed-budget-only field set,
// and same provided-field detection (only `undefined` is treated as absent).
// =============================================================================

// Roles that can edit lots
export const LOT_EDITORS = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
  'foreman',
];
export const LOT_BUDGET_EDITORS = ['owner', 'admin', 'project_manager'];
export const CONFORMED_LOT_BUDGET_EDIT_FIELDS = new Set(['budgetAmount', 'expectedUpdatedAt']);

export function getProvidedUpdateFields(data: z.infer<typeof updateLotSchema>) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}
