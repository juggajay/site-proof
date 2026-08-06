/**
 * NCR evidence phase — before/after rectification.
 *
 * The phase rides in the existing free-text `NCREvidence.evidenceType` column,
 * so there is no schema change: `before_photo` / `after_photo` sit alongside the
 * pre-existing `photo` and `retest_certificate` values.
 *
 * Legacy evidence predates the split and is tagged plain `photo`. It must keep
 * rendering AND must keep old NCRs closable, so the close gate asks "is anything
 * here NOT a before photo" rather than "is anything here tagged after". A record
 * whose entire evidence set is before photos is the only one blocked.
 */
import { AppError } from '../../lib/AppError.js';

export const NCR_EVIDENCE_BEFORE_PHOTO = 'before_photo';
export const NCR_EVIDENCE_AFTER_PHOTO = 'after_photo';

const PHOTO_EVIDENCE_TYPES: readonly string[] = [
  'photo',
  NCR_EVIDENCE_BEFORE_PHOTO,
  NCR_EVIDENCE_AFTER_PHOTO,
];

const CERTIFICATE_EVIDENCE_TYPES: readonly string[] = ['certificate', 'retest_certificate'];

export function isPhotoEvidenceType(evidenceType: string): boolean {
  return PHOTO_EVIDENCE_TYPES.includes(evidenceType);
}

export function isCertificateEvidenceType(evidenceType: string): boolean {
  return CERTIFICATE_EVIDENCE_TYPES.includes(evidenceType);
}

/** Untagged/legacy evidence counts as after-evidence; only an explicit before photo does not. */
export function countsAsAfterEvidence(evidenceType: string): boolean {
  return evidenceType !== NCR_EVIDENCE_BEFORE_PHOTO;
}

/**
 * The close gate: a clean close needs evidence of the completed rectification.
 *
 * A concession close accepts the defect as-is — there is no rectification to
 * photograph — so it is deliberately exempt.
 */
export function assertAfterEvidencePresent(
  evidence: ReadonlyArray<{ evidenceType: string }>,
  options: { withConcession?: boolean } = {},
): void {
  if (options.withConcession) {
    return;
  }

  if (evidence.some((item) => countsAsAfterEvidence(item.evidenceType))) {
    return;
  }

  throw AppError.badRequest(
    'Add at least one photo of the completed rectification before closing.',
    { code: 'NCR_MISSING_AFTER_EVIDENCE', afterEvidenceCount: 0 },
  );
}
