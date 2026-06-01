import { getPaginationMeta } from '../../lib/pagination.js';

export function buildNcrListResponse(ncrs: unknown[], total: number, page: number, limit: number) {
  return {
    data: ncrs,
    pagination: getPaginationMeta(total, page, limit),
    ncrs,
  };
}

export function buildNcrResponse(ncr: unknown) {
  return { ncr };
}

export function buildNcrUpdatedResponse(ncr: unknown) {
  return { ncr, message: 'NCR updated' };
}
