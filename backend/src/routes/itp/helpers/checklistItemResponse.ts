/**
 * The one wire shape for a checklist item.
 *
 * This mapping was duplicated inline at nine read sites (template list, get,
 * create, clone, update, archive/restore, and both instance responses) and had
 * drifted: every copy returned `acceptanceCriteria` but none returned
 * `testType` or `notes`. Because the edit modal seeds its form from this
 * response and `PATCH /templates/:id` replaces items wholesale
 * (`deleteMany` + `create`), a field missing here was written back as null —
 * so any template edit silently erased the item's test type and the clause
 * citation every seeder parks in `notes`.
 *
 * Adding a persisted field to the editor means adding it here too, or it will
 * round-trip to null the same way.
 */
export interface ChecklistItemSource {
  id: string;
  description: string;
  sequenceNumber: number;
  pointType: string | null;
  responsibleParty: string | null;
  evidenceRequired: string | null;
  acceptanceCriteria: string | null;
  testType: string | null;
  notes: string | null;
}

export function toChecklistItemResponse(item: ChecklistItemSource) {
  return {
    id: item.id,
    description: item.description,
    category: item.responsibleParty || 'general',
    responsibleParty: item.responsibleParty || 'contractor',
    isHoldPoint: item.pointType === 'hold_point',
    pointType: item.pointType || 'standard',
    evidenceRequired: item.evidenceRequired || 'none',
    order: item.sequenceNumber,
    acceptanceCriteria: item.acceptanceCriteria,
    testType: item.testType,
    notes: item.notes,
  };
}
