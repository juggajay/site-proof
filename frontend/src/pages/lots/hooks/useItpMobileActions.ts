import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from '@/components/ui/toaster';
import { apiFetch, isRetriableNetworkFailure } from '@/lib/api';
import { updateChecklistItemOffline } from '@/lib/offlineDb';
import { handleApiError } from '@/lib/errorHandling';
import type { ITPCompletion, ITPInstance } from '../types';
import { mergeCompletionIntoInstance } from '../lib/itpCompletionState';

interface UseItpMobileActionsParams {
  /**
   * Owning lot id. Required to queue an N/A or FAIL mark to the offline pipeline
   * when the network is unavailable; without it the offline fallback is skipped.
   */
  lotId: string | undefined;
  itpInstance: ITPInstance | null;
  setItpInstance: Dispatch<SetStateAction<ITPInstance | null>>;
  updatingCompletionRef: MutableRefObject<string | null>;
  setUpdatingCompletion: Dispatch<SetStateAction<string | null>>;
  refetchReadiness: () => void;
  refreshNcrsAfterFailure: () => Promise<void>;
}

export function useItpMobileActions({
  lotId,
  itpInstance,
  setItpInstance,
  updatingCompletionRef,
  setUpdatingCompletion,
  refetchReadiness,
  refreshNcrsAfterFailure,
}: UseItpMobileActionsParams) {
  // Queue an N/A or FAIL mark to the offline pipeline and apply optimistic local
  // state, mirroring the PASS path's online-then-offline fallback
  // (writeItpCompletionToggle). Returns true when the mark was queued so the
  // caller can close the sheet — the entry is NOT lost. Returns false when there
  // is no lotId to key the offline cache, so the caller falls back to error UI.
  const queueOfflineMark = async (
    checklistItemId: string,
    offlineStatus: 'na' | 'failed',
    notes: string,
    ncrDetails?: { description: string; category: string; severity: string },
  ): Promise<boolean> => {
    if (!lotId) return false;

    await updateChecklistItemOffline(
      lotId,
      checklistItemId,
      offlineStatus,
      notes,
      'You (Offline)',
      ncrDetails,
    );

    const optimistic: ITPCompletion = {
      id: `offline-${checklistItemId}-${Date.now()}`,
      checklistItemId,
      isCompleted: false,
      isNotApplicable: offlineStatus === 'na',
      isFailed: offlineStatus === 'failed',
      notes,
      completedAt: new Date().toISOString(),
      completedBy: { id: 'offline', fullName: 'You (Offline)', email: '' },
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    };

    setItpInstance((prev) => mergeCompletionIntoInstance(prev, optimistic));
    refetchReadiness();
    return true;
  };

  // Returns true on success so the mobile sheet can close; false when the write
  // failed (or was skipped by the in-flight guard) so the sheet stays open and
  // the typed reason is preserved.
  const mobileMarkNA = async (checklistItemId: string, reason: string): Promise<boolean> => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return false;

    const notes = reason.trim() || 'Marked as N/A';

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes,
        }),
      });

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
      refetchReadiness();
      toast({
        title: 'Item marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      });
      return true;
    } catch (err) {
      // A no-signal site is the common case for field N/A marks: on a retriable
      // network failure, queue the mark offline so it syncs later instead of
      // being lost.
      if (isRetriableNetworkFailure(err)) {
        try {
          if (await queueOfflineMark(checklistItemId, 'na', notes)) {
            toast({
              title: 'Saved offline',
              description: "This N/A mark will sync when you're back online.",
            });
            return true;
          }
        } catch {
          // Offline write itself failed — fall through to the error path below.
        }
      }
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

    const notes = `Failed: ${reason.trim() || 'Item failed inspection'}`;

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
            notes,
            ncrDescription: reason.trim() || 'Item failed ITP inspection',
            ncrCategory: 'workmanship',
            ncrSeverity: 'minor',
          }),
        },
      );

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
      refetchReadiness();

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
      // Recording a defect/FAIL is the highest-value field action and most likely
      // to happen offline. Queue it so the failed result is not lost; on sync the
      // backend raises the NCR from the failed status (the typed reason is kept in
      // the queued notes).
      if (isRetriableNetworkFailure(err)) {
        try {
          // Match the online FAIL body so the queued completion raises the same
          // NCR on sync (the backend needs a non-blank ncrDescription for a
          // failed status).
          const ncrDetails = {
            description: reason.trim() || 'Item failed ITP inspection',
            category: 'workmanship',
            severity: 'minor',
          };
          if (await queueOfflineMark(checklistItemId, 'failed', notes, ncrDetails)) {
            toast({
              title: 'Saved offline',
              description: "This failed item will sync and raise an NCR when you're back online.",
            });
            return true;
          }
        } catch {
          // Offline write itself failed — fall through to the error path below.
        }
      }
      handleApiError(err, 'Failed to mark item');
      return false;
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  return { mobileMarkNA, mobileMarkFailed };
}
