/**
 * NCR evidence phase — before/after rectification.
 *
 * Mirrors `backend/src/routes/ncrs/ncrEvidencePhase.ts`. The phase lives on the
 * relation-level `evidenceType`, never on the Document caption or category —
 * those are document-wide and overloading them would corrupt register filters,
 * search and exports.
 *
 * Keep the rollout marker and the qualification rule identical to the server's;
 * this copy only decides what the UI enables, the server decides what is legal.
 */
export const NCR_EVIDENCE_BEFORE_PHOTO = 'before_photo';
export const NCR_EVIDENCE_AFTER_PHOTO = 'after_photo';

/** Must match `NCR_EVIDENCE_PHASE_ROLLOUT` in the backend module. */
export const NCR_EVIDENCE_PHASE_ROLLOUT = Date.parse('2026-08-07T00:00:00.000Z');

export const MISSING_AFTER_EVIDENCE_MESSAGE =
  'Add at least one photo of the completed rectification before closing.';

export const MISSING_AFTER_EVIDENCE_SUBMIT_MESSAGE =
  'Add at least one photo of the completed rectification before submitting for verification.';

export interface PhasedEvidenceItem {
  evidenceType: string;
  document?: { mimeType?: string | null } | null;
}

const PHOTO_EVIDENCE_TYPES: readonly string[] = [
  'photo',
  'rectification_photo',
  NCR_EVIDENCE_BEFORE_PHOTO,
  NCR_EVIDENCE_AFTER_PHOTO,
];

export function isPhotoEvidenceType(evidenceType: string): boolean {
  return PHOTO_EVIDENCE_TYPES.includes(evidenceType);
}

export interface EvidencePhaseGroups<T> {
  before: T[];
  after: T[];
  unphased: T[];
}

/**
 * Groups, not pairs. There is no pair identifier on the record, so nothing here
 * may imply that before[i] corresponds to after[i].
 */
export function groupEvidenceByPhase<T extends PhasedEvidenceItem>(
  evidence: readonly T[],
): EvidencePhaseGroups<T> {
  const groups: EvidencePhaseGroups<T> = { before: [], after: [], unphased: [] };

  for (const item of evidence) {
    if (item.evidenceType === NCR_EVIDENCE_BEFORE_PHOTO) {
      groups.before.push(item);
    } else if (item.evidenceType === NCR_EVIDENCE_AFTER_PHOTO) {
      groups.after.push(item);
    } else {
      groups.unphased.push(item);
    }
  }

  return groups;
}

/** An NCR raised before the rollout has no way to carry a phased photo, so the gate is off. */
export function ncrPredatesPhaseRollout(createdAt: string | null | undefined): boolean {
  if (!createdAt) {
    // Unknown age: assume legacy rather than block a close the server would allow.
    return true;
  }
  const raised = Date.parse(createdAt);
  return Number.isNaN(raised) || raised < NCR_EVIDENCE_PHASE_ROLLOUT;
}

export function qualifiesAsAfterEvidence(item: PhasedEvidenceItem): boolean {
  return (
    item.evidenceType === NCR_EVIDENCE_AFTER_PHOTO &&
    Boolean(item.document?.mimeType?.toLowerCase().startsWith('image/'))
  );
}

/** Mirrors the server's `assertAfterEvidencePresent` — see that module for the rules. */
export function hasRequiredAfterEvidence(ncr: {
  createdAt?: string | null;
  ncrEvidence?: readonly PhasedEvidenceItem[];
}): boolean {
  if (ncrPredatesPhaseRollout(ncr.createdAt)) {
    return true;
  }
  return (ncr.ncrEvidence ?? []).some(qualifiesAsAfterEvidence);
}
