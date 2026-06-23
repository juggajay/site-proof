import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';

/**
 * A subbie portal request was rejected because module access was revoked.
 * Duck-typed on the HTTP status (ApiError carries `status`) rather than an
 * `instanceof` check so it stays correct when `@/lib/api` is partially mocked
 * in tests and across module boundaries.
 */
export function isAccessRevokedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 403
  );
}

/**
 * Mid-session a PM can turn a portal module off; the cached my-company data still
 * says it's enabled, so the static gate passes and the module query 403s. When
 * that happens, refresh the my-company cache (so the nav/gates re-evaluate) and
 * signal the screen to show a consistent "access changed" notice instead of a
 * generic error (M53). Returns whether access was revoked.
 */
export function useModuleAccessRevoked(error: unknown): boolean {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const revoked = isAccessRevokedError(error);

  useEffect(() => {
    if (revoked) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalCompanies(user?.id) });
    }
  }, [revoked, queryClient, user?.id]);

  return revoked;
}
