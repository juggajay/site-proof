// Wave D `D1b` — the lot page's folio surface
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9).
//
// The whole client contribution to issuance is TWO POSTS WITH EMPTY BODIES.
// The server assembles the payload, resolves the profile, reserves the version,
// renders the bytes and computes the SHA (`[DH-i]`, `[DR2-B4]`) — there is
// nothing here to get wrong, and a client-supplied `sha256` or `compiledFrom`
// would be a 400 rather than a silently stripped field (**AT-124**).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, authFetch } from '@/lib/api';
import { downloadBlob } from '@/lib/downloads';
import { queryKeys } from '@/lib/queryKeys';

/** Who may issue, mirroring the backend `FOLIO_ISSUERS` (§9 permission matrix). */
export const FOLIO_ISSUER_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager'];

export interface IssuedFolio {
  id: string;
  version: number;
  issuedAt: string;
  sha256: string;
  fileSize: number;
  lotStatusAtIssue: string;
  issuedBy: { id: string; name: string } | null;
}

interface FolioSessionResponse {
  folioIssueId: string;
}

export function useLotFolios(lotId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lotFolios(lotId ?? ''),
    queryFn: () => apiFetch<{ folios: IssuedFolio[] }>(`/api/lots/${lotId}/folios`),
    enabled: Boolean(lotId) && enabled,
  });
}

/**
 * Issue a folio: open a session, then issue against it.
 *
 * TWO round trips rather than one, deliberately — §4.4.2's sequence exists so
 * the slow work (render + object write) happens outside any database
 * transaction. A single endpoint would hide that and invite somebody to put the
 * render back inside the transaction.
 */
export function useIssueFolio(lotId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const session = await apiFetch<FolioSessionResponse>(`/api/lots/${lotId}/folio/sessions`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return apiFetch<IssuedFolio>(`/api/folios/${session.folioIssueId}/issue`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries(queryKeys.lotFolios(lotId ?? ''));
    },
  });
}

/**
 * Download through the AUTHENTICATED backend route (§10.2) — no public link, no
 * Supabase signed URL. The route verifies the stored object against the row's
 * `sha256` before sending a byte (**AT-125**).
 */
export async function downloadFolio(folio: IssuedFolio, lotNumber: string): Promise<void> {
  const response = await authFetch(`/api/folios/${folio.id}/download`);
  if (!response.ok) {
    throw new Error('Could not download this folio');
  }
  downloadBlob(await response.blob(), `folio-${lotNumber}-v${folio.version}.pdf`, 'folio.pdf');
}
