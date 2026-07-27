import { calculatePassFail } from './constants';
import type { ExtractedField, TestResult } from './types';

/**
 * H13: keep the reviewed pass/fail in sync with the result value + spec bounds
 * when an AI-extracted certificate is being reviewed before confirm. Recomputes
 * pass/fail from the current value/min/max; only overwrites when the data yields
 * a definite pass/fail, so a manual override survives an edit that leaves the
 * outcome indeterminate (calculatePassFail returns 'pending'). Returns a new
 * object — never mutates the input.
 */
export function recomputeReviewPassFail(form: Record<string, string>): Record<string, string> {
  const computed = calculatePassFail(
    form.resultValue || '',
    form.specificationMin || '',
    form.specificationMax || '',
  );
  if (computed === 'pending') {
    return form;
  }
  return { ...form, passFail: computed };
}

// The ten fields the certificate extraction can speak to, in the shape the
// review form uses. Kept in step with ExtractedCertificateFieldName on the
// backend (backend/src/routes/testResults/certificateExtraction.ts).
const CERTIFICATE_REVIEW_FIELDS = [
  'testType',
  'laboratoryName',
  'laboratoryReportNumber',
  'sampleDate',
  'testDate',
  'sampleLocation',
  'resultValue',
  'resultUnit',
  'specificationMin',
  'specificationMax',
] as const;

type CertificateReviewField = (typeof CERTIFICATE_REVIEW_FIELDS)[number];

export type AttachReviewRow = Pick<TestResult, CertificateReviewField | 'passFail' | 'lotId'>;

const DATE_FIELDS = new Set<CertificateReviewField>(['sampleDate', 'testDate']);

// The backend's "I could not read the test type" sentinel — emitted by
// inferTestTypeFromFilename's no-match branch, and therefore present on EVERY
// degraded extraction (no API key, AI call failed, unreadable file). It is a
// non-empty string that means exactly what '' means, so the seeding filter must
// treat it the same way or a QM's test type is silently replaced by a
// placeholder — and with it the sufficiency rule the test counts toward.
const UNREAD_TEST_TYPE = 'Certificate Review Required';

function rowValueAsFormString(row: AttachReviewRow, field: CertificateReviewField): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return '';
  }
  // Stored dates arrive as full ISO timestamps; <input type="date"> needs the
  // YYYY-MM-DD prefix or it renders blank and the value is silently lost.
  return DATE_FIELDS.has(field) ? String(value).slice(0, 10) : String(value);
}

/**
 * C2 Phase 1 [C2R-B3] [C2R-A1]: seed the extraction-review form when a
 * certificate is attached to an EXISTING (planned or entered) test result.
 *
 * The rule, field by field: take the extracted value ONLY when it is non-empty,
 * otherwise keep what is already on the row. `extractCertificateFields` returns
 * `{ value: '', confidence: 0 }` for anything it could not read — and returns
 * that for all ten fields whenever the AI call fails or no key is configured —
 * so an empty string means "I did not read this", never "this is blank". Taking
 * it wholesale would blank a QM's hand-entered sample date, laboratory, result
 * and spec bounds every time extraction degraded.
 *
 * `testType` is the same rule but matters most: it is the attribution key the
 * sufficiency engine counts a test through, so an extraction that read nothing
 * must not replace "Field Density (Nuclear)" with a placeholder.
 *
 * `lotId` is seeded from the row because the confirm payload sends every key it
 * holds — an unseeded lot would be submitted as '' and null the row's lot link.
 * `itpChecklistItemId` is deliberately NOT seeded: it is not on the register row,
 * and buildExtractionCorrections drops the key when empty, so the stored link
 * survives untouched. ponytail: absent beats guessed.
 */
export function seedAttachReviewForm(
  extractedFields: Record<string, ExtractedField | undefined> | undefined,
  row: AttachReviewRow,
): Record<string, string> {
  const seeded: Record<string, string> = {};

  for (const field of CERTIFICATE_REVIEW_FIELDS) {
    let extracted = (extractedFields?.[field]?.value ?? '').trim();
    if (field === 'testType' && extracted === UNREAD_TEST_TYPE) {
      extracted = '';
    }
    seeded[field] = extracted || rowValueAsFormString(row, field);
  }

  seeded.passFail = row.passFail || 'pending';
  seeded.lotId = row.lotId || '';

  // Same H13 treatment the upload path gives its seed: show a computed outcome
  // when the effective value + bounds decide one, leave it alone when they don't.
  return recomputeReviewPassFail(seeded);
}
