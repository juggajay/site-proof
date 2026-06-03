import type { ChecklistItem } from './itpPageData';

// ---------------------------------------------------------------------------
// Form item types
//
// These describe the create/edit template modal forms. They were previously
// declared inline in ITPPage; the modal components (and their tests) now share
// a single definition through this module.
// ---------------------------------------------------------------------------

/** A checklist row being created — no persisted id or server-assigned order. */
export type NewChecklistItem = Omit<ChecklistItem, 'id' | 'order'>;

/** A checklist row being edited — keeps its order, drops only the persisted id. */
export type EditableChecklistItem = Omit<ChecklistItem, 'id'>;

/**
 * The fields the shared checklist editor reads and writes. Both
 * NewChecklistItem and EditableChecklistItem include all of these, so the
 * editor's change callback is typed against this common subset and works for
 * either modal.
 */
export type ChecklistEditorItem = Pick<
  ChecklistItem,
  | 'description'
  | 'category'
  | 'responsibleParty'
  | 'isHoldPoint'
  | 'pointType'
  | 'evidenceRequired'
  | 'testType'
>;

/** Per-field change handler both modals expose to the shared checklist editor. */
export type ChecklistItemChange = <K extends keyof ChecklistEditorItem>(
  index: number,
  field: K,
  value: ChecklistEditorItem[K],
) => void;

// Activity types offered in the create/edit template dropdowns.
export const TEMPLATE_ACTIVITY_TYPES = [
  'Earthworks',
  'Drainage',
  'Pavement',
  'Concrete',
  'Structures',
  'General',
];

/**
 * A blank checklist row matching the create modal's initial item and the
 * "Add Item" default. Returns a fresh object each call so rows never share a
 * reference.
 */
export function createEmptyChecklistItem(): NewChecklistItem {
  return {
    description: '',
    category: 'general',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
  };
}

/**
 * Trim each row's description and drop the now-empty rows — the validation both
 * modals ran before submitting. Generic so it preserves any extra fields (for
 * example the edit modal's `order`).
 */
export function buildValidChecklistItems<T extends { description: string }>(items: T[]): T[] {
  return items
    .map((item) => ({ ...item, description: item.description.trim() }))
    .filter((item) => item.description);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  asphalt_prep: 'Asphalt prep',
  pavement_bound: 'Pavement (bound)',
  pavement_concrete: 'Pavement (concrete)',
  pavement_unbound: 'Pavement (unbound)',
};

/** Human-readable label for a template's activity type. */
export function formatActivityTypeLabel(activityType: string): string {
  const trimmed = activityType.trim();
  if (!trimmed) return 'Unspecified';
  if (ACTIVITY_TYPE_LABELS[trimmed]) return ACTIVITY_TYPE_LABELS[trimmed];
  if (!/[_-]/.test(trimmed)) return trimmed;

  return trimmed
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
