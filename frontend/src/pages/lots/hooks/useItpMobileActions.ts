import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandling';
import type { ITPCompletion, ITPInstance } from '../types';
import { mergeCompletionIntoInstance } from '../lib/itpCompletionState';

interface UseItpMobileActionsParams {
  itpInstance: ITPInstance | null;
  setItpInstance: Dispatch<SetStateAction<ITPInstance | null>>;
  updatingCompletionRef: MutableRefObject<string | null>;
  setUpdatingCompletion: Dispatch<SetStateAction<string | null>>;
  refreshNcrsAfterFailure: () => Promise<void>;
}

export function useItpMobileActions({
  itpInstance,
  setItpInstance,
  updatingCompletionRef,
  setUpdatingCompletion,
  refreshNcrsAfterFailure,
}: UseItpMobileActionsParams) {
  // Returns true on success so the mobile sheet can close; false when the write
  // failed (or was skipped by the in-flight guard) so the sheet stays open and
  // the typed reason is preserved.
  const mobileMarkNA = async (checklistItemId: string, reason: string): Promise<boolean> => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return false;

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim() || 'Marked as N/A',
        }),
      });

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
      toast({
        title: 'Item marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
      return false;
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  // Returns true on success / false on failure, same contract as mobileMarkNA.
  const mobileMarkFailed = async (checklistItemId: string, reason: string): Promise<boolean> => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return false;

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);
      const data = await apiFetch<{ completion: ITPCompletion; ncr?: { ncrNumber: string } }>(
        '/api/itp/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId,
            status: 'failed',
            notes: `Failed: ${reason.trim() || 'Item failed inspection'}`,
            ncrDescription: reason.trim() || 'Item failed ITP inspection',
            ncrCategory: 'workmanship',
            ncrSeverity: 'minor',
          }),
        },
      );

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));

      // Refresh page-owned NCR state.
      await refreshNcrsAfterFailure();

      toast({
        title: 'Item marked as Failed',
        description: data.ncr
          ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
          : 'The item has been marked as failed.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark item');
      return false;
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  return { mobileMarkNA, mobileMarkFailed };
}
