type NcrEvidenceRecord = {
  evidenceType: string;
  [key: string]: unknown;
};

export function buildNcrEvidenceAlreadyLinkedResponse(evidence: unknown) {
  return {
    evidence,
    message: 'Evidence already linked to NCR',
  };
}

export function buildNcrEvidenceAddedResponse(evidence: unknown) {
  return {
    evidence,
    message: 'Evidence added to NCR successfully',
  };
}

export function buildNcrEvidenceListResponse(evidence: NcrEvidenceRecord[]) {
  const grouped = {
    photos: evidence.filter((item) => item.evidenceType === 'photo'),
    certificates: evidence.filter(
      (item) => item.evidenceType === 'certificate' || item.evidenceType === 'retest_certificate',
    ),
    documents: evidence.filter(
      (item) => !['photo', 'certificate', 'retest_certificate'].includes(item.evidenceType),
    ),
    all: evidence,
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
