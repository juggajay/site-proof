/**
 * NCR evidence phase — before/after rectification.
 *
 * The phase lives on `NCREvidence.evidenceType`, the relation-level field that
 * already distinguishes 'photo' / 'retest_certificate'. No migration, and
 * deliberately NOT the Document caption or category: those are document-wide
 * and overloading them would corrupt register filters, search and exports.
 *
 * Two rules keep this safe on a live database:
 *
 * 1. Legacy evidence is never silently reclassified as "after". An NCR raised
 *    before {@link NCR_EVIDENCE_PHASE_ROLLOUT} carries 'photo' evidence that
 *    cannot prove a rectification, so the gate is switched OFF for it entirely.
 *    Without this, every NCR already in flight becomes permanently unclosable.
 * 2. Qualification is strict for everything raised after the marker: the
 *    evidence must carry the after phase AND resolve to a stored image
 *    document. A PDF mislabelled as an after photo does not qualify.
 */
import type { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';

export const NCR_EVIDENCE_BEFORE_PHOTO = 'before_photo';
export const NCR_EVIDENCE_AFTER_PHOTO = 'after_photo';

/** The phases a client may set or reclassify to. Legacy values stay valid for display only. */
export const NCR_EVIDENCE_PHASES = [NCR_EVIDENCE_BEFORE_PHOTO, NCR_EVIDENCE_AFTER_PHOTO] as const;

/**
 * NCRs raised before this instant predate the before/after dropzones and are
 * exempt from the after-photo gate.
 *
 * MUST NOT be earlier than the production deploy of this feature — an NCR
 * raised after the marker but before the UI shipped would have no way to
 * attach a phased photo and could not be closed.
 */
export const NCR_EVIDENCE_PHASE_ROLLOUT = new Date('2026-08-07T00:00:00.000Z');

export const MISSING_AFTER_EVIDENCE_MESSAGE =
  'Add at least one photo of the completed rectification before closing.';

const PHOTO_EVIDENCE_TYPES: readonly string[] = [
  'photo',
  'rectification_photo',
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

export function ncrPredatesPhaseRollout(createdAt: Date): boolean {
  return createdAt.getTime() < NCR_EVIDENCE_PHASE_ROLLOUT.getTime();
}

/** Evidence carries a required Document FK, but checking it explicitly keeps an orphan from qualifying. */
export interface QualifiableEvidence {
  evidenceType: string;
  document?: { mimeType: string | null } | null;
}

export function qualifiesAsAfterEvidence(item: QualifiableEvidence): boolean {
  return (
    item.evidenceType === NCR_EVIDENCE_AFTER_PHOTO &&
    Boolean(item.document?.mimeType?.toLowerCase().startsWith('image/'))
  );
}

/**
 * The same predicate as a Prisma relation filter, so the close guard can sit
 * inside the transactional `updateMany` rather than in a read a concurrent
 * delete could invalidate.
 */
export const AFTER_EVIDENCE_WHERE = {
  some: {
    evidenceType: NCR_EVIDENCE_AFTER_PHOTO,
    document: { is: { mimeType: { startsWith: 'image/', mode: 'insensitive' } } },
  },
} satisfies Prisma.NCREvidenceListRelationFilter;

export interface AfterEvidenceGateInput {
  createdAt: Date;
  ncrEvidence: ReadonlyArray<QualifiableEvidence>;
}

/**
 * Whether the after-photo gate applies to this NCR at all.
 *
 * A concession accepts the defect as-is — there is no rectification to
 * photograph — and a pre-rollout NCR cannot satisfy the gate by construction.
 */
export function afterEvidenceGateApplies(
  ncr: { createdAt: Date },
  options: { withConcession?: boolean } = {},
): boolean {
  return !options.withConcession && !ncrPredatesPhaseRollout(ncr.createdAt);
}

export function assertAfterEvidencePresent(
  ncr: AfterEvidenceGateInput,
  options: { withConcession?: boolean } = {},
): void {
  if (!afterEvidenceGateApplies(ncr, options)) {
    return;
  }

  if (ncr.ncrEvidence.some(qualifiesAsAfterEvidence)) {
    return;
  }

  throw AppError.badRequest(MISSING_AFTER_EVIDENCE_MESSAGE, {
    code: 'NCR_MISSING_AFTER_EVIDENCE',
  });
}
