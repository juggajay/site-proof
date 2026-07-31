/**
 * Wave G G5 — the NCR category and root-cause vocabularies
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5.2 gap 1).
 *
 * Both lists shipped as frontend-only dropdown constants
 * (`frontend/src/pages/ncr/constants.ts`); the server validated length alone
 * (`NCR_CATEGORY_MAX_LENGTH = 120`). A trend computed over an unconstrained
 * string degrades silently — two spellings of the same cause read as two
 * causes — so G5 moves the vocabulary here and mirrors it byte-for-byte at
 * `frontend/src/lib/ncrVocabulary.ts`, the same pattern `roles.ts` and
 * `activityTaxonomy.ts` use. A pinned-equality test on each side means drift on
 * either side breaks CI.
 *
 * The values and labels are the SHIPPED six-entry lists, reproduced verbatim.
 * G5 constrains what already existed; it does not re-design the taxonomy.
 *
 * Existing rows are never rewritten. A stored value outside the canonical list
 * folds to `other` **in the aggregation only** (spec §5.2) — a migration that
 * rewrote a quality record's stated category would be editing evidence.
 */

import { AppError } from './AppError.js';

export interface NcrVocabularyOption {
  value: string;
  label: string;
}

/** Shipped verbatim from `frontend/src/pages/ncr/constants.ts` NCR_CATEGORIES. */
export const NCR_CATEGORIES: readonly NcrVocabularyOption[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'workmanship', label: 'Workmanship' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'process', label: 'Process' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
] as const;

/** Shipped verbatim from `frontend/src/pages/ncr/constants.ts` ROOT_CAUSE_CATEGORIES. */
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

/**
 * Where an off-vocabulary stored value lands in an aggregation. Deliberately the
 * SAME bucket as a deliberate `other`: the alternative is a "legacy" bucket
 * whose meaning changes as free text is cleaned up, which is a worse chart.
 */
export const NCR_VOCABULARY_OTHER = 'other';

/**
 * Where an ABSENT value lands. Distinct from `other`, because "nobody has
 * recorded a root cause yet" and "the root cause was assessed as Other" are
 * different facts and a management chart that merged them would overstate how
 * much of the corpus has been analysed.
 */
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

/** Canonical → itself · absent → `not_recorded` · anything else → `other`. */
export function foldNcrCategory(value: string | null | undefined): string {
  return fold(value, CATEGORY_LABELS);
}

/** Canonical → itself · absent → `not_recorded` · anything else → `other`. */
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

/**
 * Spec §5.4 flag `NCR_LEARNING_LOOP_ENABLED` — opt-IN, default OFF everywhere
 * INCLUDING production. Parse shape copied from
 * `readiness/recordDecision.ts:236-239` and reproduced inline for the reason G1
 * states: `dataRetentionWorker.ts` parses the same three tokens and inverts the
 * default, so there is no house convention to point at.
 *
 * What this flag gates, and what it deliberately does NOT:
 *
 *  - GATED — the template-revision proposal routes (new surface), and
 *    server-side rejection of an off-vocabulary category or root cause (a
 *    tightening of a LIVE write contract; unset means today's behaviour, byte
 *    for byte).
 *  - NOT GATED — the analytics endpoint's aggregation fixes. Capping
 *    `repeatOffenders` ([GR-N4]) and moving the breakdowns off an unbounded
 *    `findMany` (§8 P4) are defect fixes on a route with zero frontend
 *    consumers at HEAD, and the office-role gate on that route closes §7 row 7.
 *    A flag on a defect fix means the defect ships. Same reasoning that leaves
 *    G3.1 and G4a unflagged (spec §3.6, §9).
 */
export function ncrLearningLoopEnabled(): boolean {
  const configured = process.env.NCR_LEARNING_LOOP_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}

/**
 * AT-G27, first half: an NCR written with a category or root cause outside the
 * canonical list is rejected 400 — **while the flag is on**.
 *
 * Deliberately a route-time assertion rather than a `z.enum` in the shipped
 * schemas, for two reasons. The zod schemas are module-level constants and
 * cannot read a per-request flag; and this tightens a LIVE write contract, so
 * unset must mean "byte-for-byte today's behaviour" — a free-text category from
 * an offline queue replayed a week later still lands.
 *
 * AT-G27's second half needs no code: a pre-existing free-text value still
 * READS, because nothing rewrites stored rows, and it aggregates into `other`
 * through `foldNcrCategory` (spec §5.2).
 */
export function assertCanonicalNcrVocabulary(values: {
  category?: string | null;
  rootCauseCategory?: string | null;
}): void {
  if (!ncrLearningLoopEnabled()) return;

  if (
    values.category != null &&
    values.category !== '' &&
    !isCanonicalNcrCategory(values.category)
  ) {
    throw AppError.badRequest(`category must be one of: ${NCR_CATEGORY_VALUES.join(', ')}`, {
      code: 'NCR_CATEGORY_NOT_CANONICAL',
    });
  }

  if (
    values.rootCauseCategory != null &&
    values.rootCauseCategory !== '' &&
    !isCanonicalNcrRootCause(values.rootCauseCategory)
  ) {
    throw AppError.badRequest(
      `rootCauseCategory must be one of: ${NCR_ROOT_CAUSE_VALUES.join(', ')}`,
      { code: 'NCR_ROOT_CAUSE_NOT_CANONICAL' },
    );
  }
}
