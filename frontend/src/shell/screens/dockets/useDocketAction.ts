/**
 * useDocketAction — the shell's approve / reject / query mutation.
 *
 * PARITY: the endpoint, HTTP method, and payload come VERBATIM from the shared
 * docketActionData builders (the same source of truth the desktop + mobile
 * DocketActionModal uses):
 *   - endpoint  : resolveDocketActionEndpoint(actionType)  → approve|reject|query
 *   - path      : buildDocketActionPath(docketId, endpoint)
 *   - payload   : buildDocketActionPayload(actionType, { … })
 *
 * So an approve here sends exactly { foremanNotes, adjustedLabourHours,
 * adjustedPlantHours, adjustmentReason }; a query sends { questions }; a reject
 * sends { reason } — identical to today.
 *
 * Cache invalidation: after a successful action we invalidate the whole
 * ['dockets', projectId] key prefix. That covers BOTH the shell's status='all'
 * list query AND the Home tile's status='pending_approval' count query
 * (queryKeys.dockets(projectId, 'pending_approval')), so the home "N waiting"
 * count refreshes after an action — plus the foreman badge query used by the
 * worklist. We never reach below apiFetch; the mutation is online-only (there is
 * no offline queue path for docket approval today).
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  type DocketActionType,
  buildDocketActionPath,
  buildDocketActionPayload,
  resolveDocketActionEndpoint,
} from '@/pages/dockets/docketActionData';

interface RunActionParams {
  docketId: string;
  actionType: DocketActionType;
  actionNotes?: string;
  adjustedLabourHours?: number;
  adjustedPlantHours?: number;
  adjustmentReason?: string;
}

const PAST_TENSE: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  query: 'queried',
};

export interface UseDocketActionResult {
  submitting: boolean;
  /** Resolves true on success, false on failure (the caller navigates on true). */
  runAction: (params: RunActionParams) => Promise<boolean>;
}

export function useDocketAction(projectId: string | null): UseDocketActionResult {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const runAction = useCallback(
    async ({
      docketId,
      actionType,
      actionNotes = '',
      adjustedLabourHours,
      adjustedPlantHours,
      adjustmentReason = '',
    }: RunActionParams): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setSubmitting(true);

      const endpoint = resolveDocketActionEndpoint(actionType);
      try {
        await apiFetch(buildDocketActionPath(docketId, endpoint), {
          method: 'POST',
          body: JSON.stringify(
            buildDocketActionPayload(actionType, {
              actionNotes,
              adjustedLabourHours,
              adjustedPlantHours,
              adjustmentReason,
            }),
          ),
        });

        toast({
          variant: 'success',
          description: `Docket ${PAST_TENSE[endpoint]} successfully`,
        });

        // Refresh every docket list (all statuses) + the foreman badge so the
        // Home "N waiting" tile and worklist update after the action.
        await queryClient.invalidateQueries({ queryKey: ['dockets', projectId ?? 'all-projects'] });
        if (projectId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.foremanBadges(projectId),
          });
        }
        return true;
      } catch (error) {
        logError(`Error ${actionType}ing docket:`, error);
        toast({
          variant: 'error',
          description: extractErrorMessage(error, `Failed to ${actionType} docket`),
        });
        return false;
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [projectId, queryClient],
  );

  return { submitting, runAction };
}
