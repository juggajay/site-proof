import { getPaginationMeta } from '../../lib/pagination.js';
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

export function buildNcrListResponse(ncrs: unknown[], total: number, page: number, limit: number) {
  const sanitizedNcrs = ncrs.map(sanitizeNcrEvidence);
  return {
    data: sanitizedNcrs,
    pagination: getPaginationMeta(total, page, limit),
    ncrs: sanitizedNcrs,
  };
}

export function buildNcrResponse(ncr: unknown) {
  return { ncr: sanitizeNcrEvidence(ncr) };
}

export function buildNcrUpdatedResponse(ncr: unknown) {
  return { ncr: sanitizeNcrEvidence(ncr), message: 'NCR updated' };
}
