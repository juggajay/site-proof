import { apiFetch } from './api';

// The list endpoints (GET /api/lots, /api/test-results, /api/ncrs, …) are
// paginated (default 20, max 100 per page) and return
// { <records>, pagination:{ totalPages } }, where the record key differs per
// endpoint (data/lots, testResults, ncrs). Callers that need the WHOLE set —
// bounded lists rendered without infinite-scroll UI, or compliance PDFs that
// must include every record — fetch every page at the max size and concatenate.
// A lot with >20 test results / a subbie with >20 assigned lots would otherwise
// silently get only the first 20.
const PAGE_SIZE = 100;

interface PageEnvelope {
  pagination?: { totalPages?: number };
}

/**
 * Fetch every page of a paginated list endpoint and return the concatenated
 * records. `basePath` carries the caller's own query params; this helper only
 * appends limit/page. `extractRecords` pulls the record array out of each page's
 * envelope (the key varies per endpoint).
 */
export async function fetchAllPages<T>(
  basePath: string,
  extractRecords: (page: PageEnvelope) => T[],
): Promise<T[]> {
  const sep = basePath.includes('?') ? '&' : '?';
  const pageUrl = (page: number) => `${basePath}${sep}limit=${PAGE_SIZE}&page=${page}`;

  const first = await apiFetch<PageEnvelope>(pageUrl(1));
  const records = [...extractRecords(first)];
  const totalPages = first.pagination?.totalPages ?? 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await apiFetch<PageEnvelope>(pageUrl(page));
    records.push(...extractRecords(next));
  }

  return records;
}

interface LotPageEnvelope<T> extends PageEnvelope {
  data?: T[];
  lots?: T[];
}

/**
 * Fetch every page of GET /api/lots. `basePath` carries the caller's own query
 * params (projectId, portalModule, includeITP, subcontractorCompanyId, …).
 */
export async function fetchAllLotPages<T>(basePath: string): Promise<T[]> {
  return fetchAllPages<T>(basePath, (page) => {
    const env = page as LotPageEnvelope<T>;
    return env.data ?? env.lots ?? [];
  });
}
