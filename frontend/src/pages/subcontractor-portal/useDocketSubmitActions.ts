import { useCallback, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import type { Docket } from './docketEditData';

type SaveDocketNotes = (targetDocket?: Docket | null) => Promise<Docket | null | undefined>;

type UseDocketSubmitActionsParams = {
  docket: Docket | null;
  queryResponse: string;
  saveDocketNotes: SaveDocketNotes;
  navigate: NavigateFunction;
  /**
   * Where to send the subbie after a successful submit / query-response. Defaults
   * to the classic portal dashboard so the classic DocketEditPage stays
   * byte-for-byte identical; the /p/* shell passes its own success target.
   *
   * If `onSubmitted` / `onResponded` is supplied it runs INSTEAD of the
   * navigate(redirectTo) (the /p/* shell uses this to show its own confirmation
   * state rather than leaving the screen). When omitted (classic), the hook
   * navigates exactly as before.
   */
  redirectTo?: string;
  onSubmitted?: () => void;
  onResponded?: () => void;
};

export function useDocketSubmitActions({
  docket,
  queryResponse,
  saveDocketNotes,
  navigate,
  redirectTo = '/subcontractor-portal',
  onSubmitted,
  onResponded,
}: UseDocketSubmitActionsParams) {
  const [submitting, setSubmitting] = useState(false);
  const [respondingToQuery, setRespondingToQuery] = useState(false);

  const submitDocket = useCallback(async () => {
    if (!docket) return;

    if (docket.labourEntries.length === 0 && docket.plantEntries.length === 0) {
      toast({
        title: 'Cannot submit',
        description: 'Add at least one labour or plant entry',
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      await saveDocketNotes(docket);
      await apiFetch(`/api/dockets/${docket.id}/submit`, {
        method: 'POST',
      });

      toast({
        title: 'Docket submitted',
        description: 'Your docket has been sent for approval',
        variant: 'success',
      });

      if (onSubmitted) {
        onSubmitted();
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      handleApiError(err, 'Failed to submit docket');
    } finally {
      setSubmitting(false);
    }
  }, [docket, navigate, redirectTo, onSubmitted, saveDocketNotes]);

  const respondToQuery = useCallback(async () => {
    if (!docket || !queryResponse.trim()) return;

    setRespondingToQuery(true);
    try {
      await saveDocketNotes(docket);
      await apiFetch(`/api/dockets/${docket.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response: queryResponse.trim() }),
      });

      toast({
        title: 'Response sent',
        description: 'Your docket has been resubmitted for approval',
        variant: 'success',
      });

      if (onResponded) {
        onResponded();
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      handleApiError(err, 'Failed to respond to query');
    } finally {
      setRespondingToQuery(false);
    }
  }, [docket, navigate, redirectTo, onResponded, queryResponse, saveDocketNotes]);

  return {
    submitting,
    respondingToQuery,
    submitDocket,
    respondToQuery,
  };
}
