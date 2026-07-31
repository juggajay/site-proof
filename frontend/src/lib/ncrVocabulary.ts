/**
 * Frontend mirror of `backend/src/lib/ncrVocabulary.ts` (Wave G G5, spec §5.2
 * gap 1). Byte-for-byte on the two lists, the same pattern `roles.ts` and
 * `activityTaxonomy.ts` use; a pinned-equality test on each side asserts the
 * exact value and label lists, so drift on either side breaks CI.
 *
 * The backend module additionally carries `ncrLearningLoopEnabled()`, which
 * reads an env var and has no browser equivalent — the G5 surfaces self-gate on
 * a 404 instead, the way G1's revision timeline does.
 */

export interface NcrVocabularyOption {
  value: string;
  label: string;
}

export const NCR_CATEGORIES: readonly NcrVocabularyOption[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'workmanship', label: 'Workmanship' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'process', label: 'Process' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
] as const;

export const NCR_ROOT_CAUSE_CATEGORIES: readonly NcrVocabularyOption[] = [
  { value: 'human_error', label: 'Human Error' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'materials', label: 'Materials' },
  { value: 'process', label: 'Process' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
] as const;

export const NCR_CATEGORY_VALUES: readonly string[] = NCR_CATEGORIES.map((option) => option.value);
export const NCR_ROOT_CAUSE_VALUES: readonly string[] = NCR_ROOT_CAUSE_CATEGORIES.map(
  (option) => option.value,
);

export const NCR_VOCABULARY_OTHER = 'other';
export const NCR_VOCABULARY_NOT_RECORDED = 'not_recorded';

const NOT_RECORDED_LABEL = 'Not recorded';

const CATEGORY_LABELS = new Map(NCR_CATEGORIES.map((option) => [option.value, option.label]));
const ROOT_CAUSE_LABELS = new Map(
  NCR_ROOT_CAUSE_CATEGORIES.map((option) => [option.value, option.label]),
);

export function isCanonicalNcrCategory(value: unknown): boolean {
  return typeof value === 'string' && CATEGORY_LABELS.has(value);
}

export function isCanonicalNcrRootCause(value: unknown): boolean {
  return typeof value === 'string' && ROOT_CAUSE_LABELS.has(value);
}

function fold(value: string | null | undefined, known: Map<string, string>): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return NCR_VOCABULARY_NOT_RECORDED;
  return known.has(trimmed) ? trimmed : NCR_VOCABULARY_OTHER;
}

export function foldNcrCategory(value: string | null | undefined): string {
  return fold(value, CATEGORY_LABELS);
}

export function foldNcrRootCause(value: string | null | undefined): string {
  return fold(value, ROOT_CAUSE_LABELS);
}

export function ncrCategoryLabel(foldedValue: string): string {
  if (foldedValue === NCR_VOCABULARY_NOT_RECORDED) return NOT_RECORDED_LABEL;
  return CATEGORY_LABELS.get(foldedValue) ?? foldedValue;
}

export function ncrRootCauseLabel(foldedValue: string): string {
  if (foldedValue === NCR_VOCABULARY_NOT_RECORDED) return NOT_RECORDED_LABEL;
  return ROOT_CAUSE_LABELS.get(foldedValue) ?? foldedValue;
}
