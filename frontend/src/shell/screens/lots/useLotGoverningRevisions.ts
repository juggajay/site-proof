/**
 * useLotGoverningRevisions — the lot's governing-revision links (Wave G G1).
 *
 * ZERO new endpoints: `GET /api/revisions/lots/:lotId/governing-revisions` is
 * shipped and foreman-readable (`requireRevisionReadAccess` admits every
 * internal role). G1 adds only a computed `superseded` boolean per link, so the
 * shell can state the fact WITHOUT the commercial readiness endpoint that emits
 * `governing_revision_superseded` — which is role-gated away from the foreman.
 *
 * Flag off ⇒ the whole revisions router 404s ⇒ no links ⇒ no warning, silently
 * and correctly. Every failure is silent here on purpose: this drives a warning
 * banner, and a lot hub that cannot render its tiles because a warning could not
 * load has made a bad day worse.
 */
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getAuthToken } from '@/lib/auth';
import type { GoverningRevisionLink } from './lotsShellState';

const GOVERNING_REVISIONS_STALE_TIME_MS = 60_000;

export function useLotGoverningRevisions(
  lotId: string | null | undefined,
): GoverningRevisionLink[] {
  const { data } = useQuery({
    queryKey: queryKeys.lotGoverningRevisions(lotId ?? 'none'),
    queryFn: () =>
      apiGet<{ links: GoverningRevisionLink[] }>(
        `/api/revisions/lots/${encodeURIComponent(lotId!)}/governing-revisions`,
      ),
    enabled: Boolean(lotId) && Boolean(getAuthToken()),
    staleTime: GOVERNING_REVISIONS_STALE_TIME_MS,
    retry: false,
  });

  return data?.links ?? [];
}
