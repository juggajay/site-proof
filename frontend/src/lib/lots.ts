import { apiFetch } from './api';

// GET /api/lots is paginated (default 20, max 100 per page) and returns
// { data, lots, pagination:{ totalPages } }. The subbie work/ITP/docket surfaces
// show ONE subcontractor's assigned lots as a bounded list, so we fetch every
// page at the max size and concatenate rather than build infinite-scroll UI.
// A subbie with >20 assigned lots would otherwise silently see only the first 20.
const LOT_PAGE_SIZE = 100;

interface LotPageEnvelope<T> {
  data?: T[];
  lots?: T[];
  pagination?: { totalPages?: number };
}

function pageRecords<T>(res: LotPageEnvelope<T>): T[] {
  return res.data ?? res.lots ?? [];
}

/**
 * Fetch every page of GET /api/lots for the given base path and return the
 * concatenated records. `basePath` carries the caller's own query params
 * (projectId, portalModule, includeITP, subcontractorCompanyId, …); this helper
 * only appends limit/page.
 */
export async function fetchAllLotPages<T>(basePath: string): Promise<T[]> {
  const sep = basePath.includes('?') ? '&' : '?';
  const pageUrl = (page: number) => `${basePath}${sep}limit=${LOT_PAGE_SIZE}&page=${page}`;

  const first = await apiFetch<LotPageEnvelope<T>>(pageUrl(1));
  const records = [...pageRecords(first)];
  const totalPages = first.pagination?.totalPages ?? 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await apiFetch<LotPageEnvelope<T>>(pageUrl(page));
    records.push(...pageRecords(next));
  }

  return records;
}
