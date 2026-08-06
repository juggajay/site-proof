/**
 * NCR evidence phase — before/after rectification.
 *
 * Mirrors `backend/src/routes/ncrs/ncrEvidencePhase.ts`: the phase rides in the
 * existing `evidenceType` string, so evidence uploaded before this shipped is
 * simply "unphased" and still renders. Grouping never drops an item.
 */
export const NCR_EVIDENCE_BEFORE_PHOTO = 'before_photo';
export const NCR_EVIDENCE_AFTER_PHOTO = 'after_photo';

export interface PhasedEvidenceItem {
  evidenceType: string;
}

const PHOTO_EVIDENCE_TYPES: readonly string[] = [
  'photo',
  NCR_EVIDENCE_BEFORE_PHOTO,
  NCR_EVIDENCE_AFTER_PHOTO,
];

export function isPhotoEvidenceType(evidenceType: string): boolean {
  return PHOTO_EVIDENCE_TYPES.includes(evidenceType);
}

/** Caption suffix so the phase stays legible in the document library, where evidenceType isn't shown. */
export function evidencePhaseCaption(evidenceType: string): string {
  if (evidenceType === NCR_EVIDENCE_BEFORE_PHOTO) return ' (before rectification)';
  if (evidenceType === NCR_EVIDENCE_AFTER_PHOTO) return ' (after rectification)';
  return '';
}

export interface EvidencePhaseGroups<T> {
  before: T[];
  after: T[];
  unphased: T[];
}

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

/**
 * Mirrors the server's close gate (`assertAfterEvidencePresent`): untagged
 * legacy evidence counts, only an all-before-photos set is missing its after.
 */
export function hasAfterEvidence(evidence: readonly PhasedEvidenceItem[]): boolean {
  return evidence.some((item) => item.evidenceType !== NCR_EVIDENCE_BEFORE_PHOTO);
}

export const MISSING_AFTER_EVIDENCE_MESSAGE =
  'Add at least one photo of the completed rectification before closing.';
