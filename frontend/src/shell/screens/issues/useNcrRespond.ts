/**
 * useNcrRespond — the shell's "respond to NCR" mutation.
 *
 * PARITY: the endpoint, HTTP method, and payload match the desktop register's
 * `useNCRActions.handleRespond` verbatim — POST /api/ncrs/:id/respond with
 * { rootCauseCategory, rootCauseDescription, proposedCorrectiveAction } (both
 * descriptions trimmed). We do NOT reach below apiFetch; the foreman respond is
 * online-only (there is no offline queue path for NCR responses today).
 *
 * Cache invalidation: after a successful response we invalidate the shared NCR
 * register key (queryKeys.ncrs(projectId)) so the shell list AND the desktop
 * register refetch and the status flips from Open → Investigating everywhere.
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface NcrRespondInput {
  rootCauseCategory: string;
  rootCauseDescription: string;
  proposedCorrectiveAction: string;
}

export interface UseNcrRespondResult {
  submitting: boolean;
  /** Resolves true on success, false on failure (the caller navigates on true). */
  respond: (ncrId: string, input: NcrRespondInput) => Promise<boolean>;
}

export function useNcrRespond(projectId: string | null): UseNcrRespondResult {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const respond = useCallback(
    async (ncrId: string, input: NcrRespondInput): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setSubmitting(true);
      try {
        await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}/respond`, {
          method: 'POST',
          body: JSON.stringify({
            rootCauseCategory: input.rootCauseCategory,
            rootCauseDescription: input.rootCauseDescription.trim(),
            proposedCorrectiveAction: input.proposedCorrectiveAction.trim(),
          }),
        });

        toast({
          variant: 'success',
          description: 'Response submitted — status changed to Investigating',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.ncrs(projectId ?? undefined) });
        return true;
      } catch (error) {
        logError('Error responding to NCR:', error);
        toast({
          variant: 'error',
          description: extractErrorMessage(error, 'Failed to submit response'),
        });
        return false;
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [projectId, queryClient],
  );

  return { submitting, respond };
}
