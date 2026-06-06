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
};

export function useDocketSubmitActions({
  docket,
  queryResponse,
  saveDocketNotes,
  navigate,
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

      navigate('/subcontractor-portal');
    } catch (err) {
      handleApiError(err, 'Failed to submit docket');
    } finally {
      setSubmitting(false);
    }
  }, [docket, navigate, saveDocketNotes]);

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

      navigate('/subcontractor-portal');
    } catch (err) {
      handleApiError(err, 'Failed to respond to query');
    } finally {
      setRespondingToQuery(false);
    }
  }, [docket, navigate, queryResponse, saveDocketNotes]);

  return {
    submitting,
    respondingToQuery,
    submitDocket,
    respondToQuery,
  };
}
