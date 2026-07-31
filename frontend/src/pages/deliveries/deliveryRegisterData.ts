/**
 * Wave C5-b — the delivery register's contract with the shipped C5.1 API.
 *
 * Types, URL<->query translation and the one query hook. Kept out of the page
 * so the filter/paging rules — the part with the honesty gates on it — are
 * testable without rendering a table.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface DeliveryRow {
  id: string;
  diaryId: string;
  description: string | null;
  supplier: string | null;
  docketNumber: string | null;
  quantity: string | number | null;
  unit: string | null;
  lotId: string | null;
  batchRef: string | null;
  docketDocumentId: string | null;
  lot: { id: string; lotNumber: string } | null;
  docketDocument: { id: string; filename: string; mimeType: string | null } | null;
  diary: { id: string; date: string; projectId: string; status: string | null };
}

export interface DeliveryRegisterResponse {
  deliveries: DeliveryRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  unlinkedCount: number;
  missingDocketCount: number;
}

export type LotLinkFilter = 'all' | 'linked' | 'unlinked';
export type DocketFilter = 'all' | 'filed' | 'not_filed';

export interface DeliveryRegisterFilters {
  supplier: string;
  lotId: string;
  link: LotLinkFilter;
  docket: DocketFilter;
  from: string;
  to: string;
}

export const EMPTY_DELIVERY_FILTERS: DeliveryRegisterFilters = {
  supplier: '',
  lotId: '',
  link: 'all',
  docket: 'all',
  from: '',
  to: '',
};

/**
 * The register's page size. The API caps at 200 (`DELIVERY_REGISTER_MAX_LIMIT`)
 * and the CSV export says "current page" precisely because of this — see
 * `buildDeliveryCsvRows`.
 */
export const DELIVERY_REGISTER_PAGE_SIZE = 50;

/** URL query-string keys. Same names in the address bar and in this module. */
const URL_KEYS = ['supplier', 'lotId', 'link', 'docket', 'from', 'to'] as const;

function readLinkFilter(value: string | null): LotLinkFilter {
  return value === 'linked' || value === 'unlinked' ? value : 'all';
}

function readDocketFilter(value: string | null): DocketFilter {
  return value === 'filed' || value === 'not_filed' ? value : 'all';
}

/** Filters as they appear in the address bar → the shape the page renders from. */
export function readFiltersFromParams(params: URLSearchParams): DeliveryRegisterFilters {
  return {
    supplier: params.get('supplier') ?? '',
    lotId: params.get('lotId') ?? '',
    link: readLinkFilter(params.get('link')),
    docket: readDocketFilter(params.get('docket')),
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  };
}

export function readOffsetFromParams(params: URLSearchParams): number {
  const parsed = Number.parseInt(params.get('offset') ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Write filters + offset back to the address bar, so a filtered register is a
 * link a QM can paste to the person who has to fix it.
 *
 * `offset` is dropped whenever the filters change: page 3 of "all deliveries"
 * is not page 3 of "not filed", and keeping the offset lands the user on an
 * empty page that reads as "nothing to do".
 */
export function writeFiltersToParams(
  current: URLSearchParams,
  filters: DeliveryRegisterFilters,
  offset: number,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of URL_KEYS) {
    const value = filters[key];
    if (value && value !== 'all') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }
  if (offset > 0) {
    next.set('offset', String(offset));
  } else {
    next.delete('offset');
  }
  return next;
}

export function hasActiveDeliveryFilters(filters: DeliveryRegisterFilters): boolean {
  return URL_KEYS.some((key) => filters[key] && filters[key] !== 'all');
}

/** Filters → the C5.1 register endpoint. */
export function buildDeliveryRegisterPath(
  projectId: string,
  filters: DeliveryRegisterFilters,
  offset: number,
  limit = DELIVERY_REGISTER_PAGE_SIZE,
): string {
  const params = new URLSearchParams();
  if (filters.supplier) params.set('supplier', filters.supplier);
  if (filters.lotId) params.set('lotId', filters.lotId);
  if (filters.link !== 'all') params.set('linked', filters.link);
  // Server-side, always. Filtering the loaded page in the browser would report
  // "2 not filed" on a project holding 200 of them.
  if (filters.docket !== 'all') params.set('docket', filters.docket);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('limit', String(limit));
  if (offset > 0) params.set('offset', String(offset));

  return `/api/projects/${encodeURIComponent(projectId)}/deliveries?${params.toString()}`;
}

export function deliveryRegisterQueryKey(
  projectId: string | undefined,
  filters: DeliveryRegisterFilters,
  offset: number,
) {
  return ['delivery-register', projectId ?? 'none', filters, offset] as const;
}

export function useDeliveryRegisterQuery(
  projectId: string | undefined,
  filters: DeliveryRegisterFilters,
  offset: number,
) {
  return useQuery({
    queryKey: deliveryRegisterQueryKey(projectId, filters, offset),
    queryFn: () =>
      apiFetch<DeliveryRegisterResponse>(buildDeliveryRegisterPath(projectId!, filters, offset)),
    enabled: Boolean(projectId),
    // A failed refetch must not blank the table the user is reading, and a
    // filter change must not flash a skeleton over rows that are still valid.
    keepPreviousData: true,
  });
}

export function isDeliveryDocketFiled(delivery: DeliveryRow): boolean {
  return Boolean(delivery.docketDocumentId);
}

/** `12.5` + `m3` → `12.5 m3`; either half missing → whatever is there. */
export function formatDeliveryQuantity(delivery: DeliveryRow): string {
  const quantity =
    delivery.quantity === null || delivery.quantity === undefined ? '' : String(delivery.quantity);
  return [quantity, delivery.unit ?? ''].filter(Boolean).join(' ');
}

/**
 * CSV of THE ROWS ON SCREEN — the export button says "Export current page" for
 * this reason. The register pages at 50 and the API caps at 200, so a button
 * labelled "Export CSV" here would hand a QM a file that silently omits every
 * delivery past the page they happened to be on.
 *
 * ponytail: page-scoped export; a server-side filtered export endpoint is the
 * upgrade when someone actually needs the whole register in one file.
 */
export function buildDeliveryCsvRows(deliveries: DeliveryRow[]): string[][] {
  return [
    ['Diary date', 'Description', 'Supplier', 'Quantity', 'Lot', 'Batch / mix ref', 'Docket'],
    ...deliveries.map((delivery) => [
      delivery.diary?.date ? delivery.diary.date.slice(0, 10) : '',
      delivery.description ?? '',
      delivery.supplier ?? '',
      formatDeliveryQuantity(delivery),
      delivery.lot?.lotNumber ?? '',
      delivery.batchRef ?? '',
      delivery.docketDocument?.filename ?? 'Not filed in CIVOS',
    ]),
  ];
}
