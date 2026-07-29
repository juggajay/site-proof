// Wave D `D1c.3` — the handover export surface's data layer
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.5, §4.7.6,
// §9).
//
// THE REQUEST IS THE PREFLIGHT. There is no dry-run endpoint: `POST
// /api/projects/:id/handover-exports` estimates and then FREEZES in one
// transaction (`backend/src/routes/handoverExports/snapshot.ts:392`), refusing
// before any row is written. So the preflight numbers arrive two ways — in the
// 201 body when the scope fits, and in the 400's `error.details` when it does
// not — and {@link parseHandoverExportRefusal} is what stops the second one
// being flattened into a generic red toast.
//
// BYTE COUNTS ARE STRINGS. `totalBytes`, `fileSize` and `estimatedInputBytes`
// are `BigInt` on the wire-adjacent side and stringified deliberately (§4.5.5);
// `Number()` on a value near the 8 GiB cap is the bug that serialisation exists
// to prevent. Everything here keeps them as strings and formats via `BigInt`.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { downloadBlob } from '@/lib/downloads';
import { queryKeys } from '@/lib/queryKeys';

export type HandoverExportScope =
  | { kind: 'project' }
  | { kind: 'area'; areaId: string }
  | { kind: 'lots'; lotIds: string[] };

/** `backend/src/routes/handoverExports/index.ts:40` — `serializeExport`. */
export interface HandoverExportRow {
  id: string;
  projectId: string;
  scope: HandoverExportScope;
  status: string;
  requestedAt: string;
  requestedById: string | null;
  snapshotCutoffAt: string | null;
  totalMembers: number | null;
  processedMembers: number;
  totalBytes: string | null;
  fileSize: string | null;
  sha256: string | null;
  lastFailureReason: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

/** The 201 body's `preflight` block, and the same fields the 400 carries. */
export interface HandoverExportPreflight {
  estimatedInputBytes: string;
  measuredBytes: string;
  memberCount: number;
  unmeasuredMemberCount: number;
  unmeasuredAssumption: string;
  admissionCapBytes: number;
  archivesImpliedAtCap: number;
}

export interface CreateHandoverExportResponse {
  id: string;
  status: string;
  lotCount: number;
  snapshotCutoffAt: string;
  preflight: HandoverExportPreflight;
}

/**
 * A refusal, which is NOT an error state on the screen.
 *
 * §4.7.6: a reference-dataset project is ~6 archives and that is the design.
 * The two refusal codes below are the cap and the member-count limit; anything
 * else (a 403, a 500, a network failure) is a real failure and stays one.
 */
export interface HandoverExportRefusal {
  code: 'HANDOVER_EXPORT_OVER_CAP' | 'HANDOVER_EXPORT_MEMBER_LIMIT';
  /** The server's sentence, which already names the narrower scope. Rendered
   * verbatim — rewriting it here is how the two copies drift. */
  message: string;
  archivesImpliedAtCap: number | null;
  memberCount: number | null;
  unmeasuredMemberCount: number | null;
  unmeasuredAssumption: string | null;
  estimatedInputBytes: string | null;
}

const REFUSAL_CODES = ['HANDOVER_EXPORT_OVER_CAP', 'HANDOVER_EXPORT_MEMBER_LIMIT'] as const;

function readNumber(details: Record<string, unknown>, key: string): number | null {
  const value = details[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(details: Record<string, unknown>, key: string): string | null {
  const value = details[key];
  return typeof value === 'string' && value ? value : null;
}

/** `null` when this is an ordinary failure rather than a scope refusal. */
export function parseHandoverExportRefusal(error: unknown): HandoverExportRefusal | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;

  const body = error.data?.error;
  if (!body || typeof body === 'string') return null;

  const code = REFUSAL_CODES.find((candidate) => candidate === body.code);
  if (!code || !body.message) return null;

  const details = body.details ?? {};
  return {
    code,
    message: body.message,
    // The cheap member-count refusal fires before enumeration, so it carries no
    // archive count (`exportPreflight.ts:414`). Null means "not stated", never 0.
    archivesImpliedAtCap: readNumber(details, 'archivesImpliedAtCap'),
    memberCount: readNumber(details, 'memberCount'),
    unmeasuredMemberCount: readNumber(details, 'unmeasuredMemberCount'),
    unmeasuredAssumption: readString(details, 'unmeasuredAssumption'),
    estimatedInputBytes: readString(details, 'estimatedInputBytes'),
  };
}

/** §7.4's job vocabulary. A job in one of these is still moving. */
export const ACTIVE_HANDOVER_STATUSES = ['queued', 'snapshotting', 'processing'];

export function isHandoverExportActive(row: HandoverExportRow): boolean {
  return ACTIVE_HANDOVER_STATUSES.includes(row.status);
}

/**
 * §10.5: expiry is a DERIVED state, not a status. The sweeper nulls `fileUrl`
 * and the row survives — "generated, then expired" is a fact worth keeping
 * (**AT-148**) — so the screen reads the clock rather than waiting for an
 * `expired` enum that does not exist.
 */
export function isHandoverExportExpired(row: HandoverExportRow, now: number = Date.now()): boolean {
  return (
    row.status === 'complete' && row.expiresAt !== null && new Date(row.expiresAt).getTime() <= now
  );
}

const GIB = 1024n ** 3n;
const MIB = 1024n ** 2n;

/**
 * GiB/MiB with one decimal — binary units, mirroring the backend's `formatBytes`
 * (`lib/handover/exportPreflight.ts:250`) so the number in our own line and the
 * number inside the server's refusal sentence never disagree.
 */
export function formatArchiveBytes(value: string | null | undefined): string {
  if (!value) return '—';
  let bytes: bigint;
  try {
    bytes = BigInt(value);
  } catch {
    return '—';
  }

  const gib = Number((bytes * 10n) / GIB) / 10;
  if (gib >= 0.1) return `${gib.toFixed(1)} GiB`;
  const mib = Number((bytes * 10n) / MIB) / 10;
  return `${mib.toFixed(1)} MiB`;
}

export function describeScope(scope: HandoverExportScope): string {
  if (scope.kind === 'area') return 'One area';
  if (scope.kind === 'lots') return `${scope.lotIds.length} lots`;
  return 'Whole project';
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** How often a running job is re-read. Slow enough to be free, fast enough that
 * a short job is not over before the screen notices. */
const ACTIVE_POLL_INTERVAL_MS = 5000;

export function useHandoverExports(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.handoverExports(projectId ?? ''),
    queryFn: () =>
      apiFetch<{ exports: HandoverExportRow[] }>(
        `/api/projects/${encodeURIComponent(projectId!)}/handover-exports`,
      ),
    enabled: Boolean(projectId),
    // The list already carries `processedMembers`/`totalMembers` per row, so
    // there is nothing the per-job detail route would add — one poll covers
    // every job on the screen. (TanStack Query v4: `refetchInterval` takes the
    // data, not a query object.)
    refetchInterval: (data) =>
      data?.exports.some(isHandoverExportActive) ? ACTIVE_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export function useProjectAreaOptions(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projectAreas(projectId ?? ''),
    queryFn: () =>
      apiFetch<{ areas: { id: string; name: string }[] }>(
        `/api/projects/${encodeURIComponent(projectId!)}/areas`,
      ),
    enabled: Boolean(projectId) && enabled,
  });
}

const LOT_PAGE_LIMIT = 100;
const LOT_MAX_PAGES = 100;

export interface LotOption {
  id: string;
  lotNumber: string;
}

/**
 * Just enough of the lot register to drive a from/to range picker.
 *
 * Deliberately not `useLotsData` — that hook carries filters, mutations and
 * infinite scroll for a page this one is not.
 */
export function useProjectLotOptions(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.handoverExportLotOptions(projectId ?? ''),
    queryFn: async (): Promise<LotOption[]> => {
      const options: LotOption[] = [];
      for (let page = 1; page <= LOT_MAX_PAGES; page += 1) {
        const data = await apiFetch<{
          lots?: LotOption[];
          data?: LotOption[];
          pagination?: { hasNextPage?: boolean; totalPages?: number };
        }>(
          `/api/lots?projectId=${encodeURIComponent(projectId!)}&page=${page}&limit=${LOT_PAGE_LIMIT}`,
        );
        options.push(
          ...(data.lots ?? data.data ?? []).map((lot) => ({
            id: lot.id,
            lotNumber: lot.lotNumber,
          })),
        );
        if (!data.pagination?.hasNextPage || page >= (data.pagination.totalPages ?? page)) break;
      }
      return options;
    },
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateHandoverExport(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scope: HandoverExportScope) =>
      apiFetch<CreateHandoverExportResponse>(
        `/api/projects/${encodeURIComponent(projectId!)}/handover-exports`,
        { method: 'POST', body: JSON.stringify({ scope }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.handoverExports(projectId ?? '') });
    },
  });
}

export function useCancelHandoverExport(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exportId: string) =>
      apiFetch<{ id: string; status: string }>(
        `/api/handover-exports/${encodeURIComponent(exportId)}/cancel`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.handoverExports(projectId ?? '') });
    },
  });
}

/**
 * §10.2, §4.7.4: an authenticated app request against the backend's streaming
 * route. Never a storage URL — the object is private, the route checks
 * ownership at the storage path level, and the last 64 KiB are withheld until
 * the SHA matches.
 *
 * `timeoutMs: 0` disables `authFetch`'s 30 s default. That default aborts the
 * whole body stream, not just the handshake, and an 8 GiB archive on a site
 * connection is not a 30-second request.
 *
 * ponytail: `.blob()` buffers the response before it hits disk; browsers back
 * large blobs with disk storage, so this holds to the cap. If a real 8 GiB
 * download proves it does not, the upgrade is a `showSaveFilePicker` +
 * `ReadableStream` pipe on the same route — not a signed URL.
 */
export async function downloadHandoverExport(exportId: string): Promise<void> {
  const response = await authFetch(
    `/api/handover-exports/${encodeURIComponent(exportId)}/download`,
    undefined,
    0,
  );
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  downloadBlob(await response.blob(), `handover-export-${exportId}.zip`, 'handover-export.zip');
}
