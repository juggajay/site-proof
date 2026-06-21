import { stripNcrEvidenceDocumentFileUrl } from './ncrEvidenceResponses.js';

function sanitizeNcrEvidence<TRow>(ncr: TRow): TRow {
  if (!ncr || typeof ncr !== 'object' || Array.isArray(ncr)) {
    return ncr;
  }

  const record = ncr as Record<string, unknown>;
  if (!Array.isArray(record.ncrEvidence)) {
    return ncr;
  }

  return {
    ...record,
    ncrEvidence: record.ncrEvidence.map(stripNcrEvidenceDocumentFileUrl),
  } as TRow;
}

export function buildNcrWorkflowResponse(ncr: unknown) {
  return { ncr: sanitizeNcrEvidence(ncr) };
}

export function buildNcrWorkflowMessageResponse(ncr: unknown, message: string) {
  return { ncr: sanitizeNcrEvidence(ncr), message };
}

export function buildNcrClosedResponse(ncr: unknown, severity: string) {
  return buildNcrWorkflowMessageResponse(
    ncr,
    severity === 'major'
      ? 'Major NCR closed successfully with QM approval'
      : 'NCR closed successfully',
  );
}

export function buildNcrClientNotificationResponse(
  ncr: unknown,
  notificationPackage: unknown,
  ncrNumber: string,
) {
  return {
    ncr: sanitizeNcrEvidence(ncr),
    notificationPackage,
    message: `Client notification sent for ${ncrNumber}`,
  };
}

export function buildNcrSubmittedForVerificationResponse(
  ncr: { ncrEvidence: unknown[] } & Record<string, unknown>,
) {
  const sanitizedNcr = sanitizeNcrEvidence(ncr);
  return {
    ncr: sanitizedNcr,
    message: 'NCR submitted for verification successfully',
    evidenceCount: ncr.ncrEvidence.length,
  };
}
