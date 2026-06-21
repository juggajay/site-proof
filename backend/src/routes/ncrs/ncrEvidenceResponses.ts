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
  const grouped = {
    photos: sanitizedEvidence.filter((item) => item.evidenceType === 'photo'),
    certificates: sanitizedEvidence.filter(
      (item) => item.evidenceType === 'certificate' || item.evidenceType === 'retest_certificate',
    ),
    documents: sanitizedEvidence.filter(
      (item) => !['photo', 'certificate', 'retest_certificate'].includes(item.evidenceType),
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
