import { isCertificateEvidenceType, isPhotoEvidenceType } from './ncrEvidencePhase.js';

type NcrEvidenceRecord = {
  evidenceType: string;
  document?: unknown;
  [key: string]: unknown;
};

export function stripNcrEvidenceDocumentFileUrl<TEvidence>(evidence: TEvidence): TEvidence {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return evidence;
  }

  const record = evidence as Record<string, unknown>;
  const document = record.document;
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return evidence;
  }

  const { fileUrl: _fileUrl, ...documentWithoutFileUrl } = document as Record<string, unknown>;
  return {
    ...record,
    document: documentWithoutFileUrl,
  } as TEvidence;
}

export function buildNcrEvidenceAlreadyLinkedResponse(evidence: unknown) {
  return {
    evidence: stripNcrEvidenceDocumentFileUrl(evidence),
    message: 'Evidence already linked to NCR',
  };
}

export function buildNcrEvidenceAddedResponse(evidence: unknown) {
  return {
    evidence: stripNcrEvidenceDocumentFileUrl(evidence),
    message: 'Evidence added to NCR successfully',
  };
}

export function buildNcrEvidenceListResponse(evidence: NcrEvidenceRecord[]) {
  const sanitizedEvidence = evidence.map(stripNcrEvidenceDocumentFileUrl);
  // `photos` covers every photo phase (plain/before/after) so the mobile shell's
  // photo grid keeps showing before/after captures instead of demoting them to
  // `documents`.
  const grouped = {
    photos: sanitizedEvidence.filter((item) => isPhotoEvidenceType(item.evidenceType)),
    certificates: sanitizedEvidence.filter((item) => isCertificateEvidenceType(item.evidenceType)),
    documents: sanitizedEvidence.filter(
      (item) =>
        !isPhotoEvidenceType(item.evidenceType) && !isCertificateEvidenceType(item.evidenceType),
    ),
    all: sanitizedEvidence,
  };

  return {
    evidence: grouped.all,
    grouped,
    count: evidence.length,
  };
}

export function buildNcrEvidenceRemovedResponse() {
  return { message: 'Evidence removed successfully' };
}
