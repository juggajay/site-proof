/**
 * Shared ITP completion-action hook (toggle / mark N/A / mark Failed / update
 * notes), extracted so the subcontractor portal page and the lot-detail (HC)
 * mobile path drive the SAME request + control logic from ONE place.
 *
 * TRUST BOUNDARY — read before changing:
 * This hook NEVER reads `user.role` / `actualRole` / `isSubcontractor`. The
 * caller (the page) owns the capability gate and passes it in as `requireAccess`.
 * Every mutating action calls `requireAccess()` FIRST and aborts when it returns
 * false, so no consumer can perform an action the page did not already permit.
 * The portal passes its `requireCompletionAccess` (view-only gate derived from
 * the lot's `subcontractorAssignments[].canCompleteITP`); the HC page passes its
 * own gate. The hook grants nothing on its own.
 *
 * API-SHAPE INJECTION — the parts that legitimately differ between the two call
 * sites are injected, never branched-on-role internally:
 *  - `onAfterMutate`     : how the page refreshes after a successful write. The
 *                          portal injects its full refetch (`fetchData`); the HC
 *                          path would inject its optimistic-merge wrapper. This
 *                          hook does NOT introduce optimistic merge for the
 *                          portal — it just calls what it is given.
 *  - `naDefaultNote`     : N/A note used when the typed reason is blank. Portal
 *                          sends the trimmed reason as-is (''); HC sends
 *                          'Marked as N/A'. Injected so neither side is flattened.
 *  - `updateNotes`       : the notes wire differs (portal PATCHes an existing
 *                          completion; HC POSTs an upsert), so the request itself
 *                          is injected by the caller.
 *  - `onAfterFailure`    : optional side-effect after a Failed write settles
 *                          (e.g. the HC's NCR refetch). The portal omits it.
 *
 * Request bodies that are IDENTICAL across both sites (the Failed body, the
 * toggle body, the not_applicable body) are built here so their shape — and the
 * audit-critical Failed/NCR payload — lives in exactly one tested place.
 */
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandling';
import type { ITPInstance } from '../types';

/** NCR summary the API returns alongside a Failed completion (used for the toast). */
interface FailedCompletionResult {
  ncr?: { ncrNumber: string } | null;
}

export interface UseItpCompletionActionsParams {
  /** Current ITP instance; actions abort when null (nothing to mutate). */
  itpInstance: ITPInstance | null;
  /**
   * Capability gate, decided and owned by the PAGE (the trust boundary). Called
   * before every mutating action; a falsy return aborts with no request. The
   * page is responsible for any "view only" feedback toast.
   */
  requireAccess: () => boolean;
  /** Sets the per-item in-flight id (disables the row); cleared in `finally`. */
  setUpdatingItem: (checklistItemId: string | null) => void;
  /** Page-owned refresh after a successful write (portal: full refetch). */
  onAfterMutate: () => Promise<void>;
  /** N/A note when the typed reason is blank ('' for the portal). */
  naDefaultNote: string;
  /**
   * Caller-supplied notes write. The wire differs per page (portal PATCHes an
   * existing completion only; HC POSTs an upsert), so the request is injected.
   */
  updateNotes: (checklistItemId: string, notes: string) => Promise<void>;
  /** Optional side-effect run after a Failed write settles (HC: NCR refetch). */
  onAfterFailure?: () => Promise<void>;
  /** Optional toast copy overrides (defaults preserve the portal's wording). */
  toastCopy?: {
    toggleTitle?: string;
    toggleDescription?: string;
    naTitle?: string;
    naDescription?: string;
    failedTitle?: string;
    /** When the response has no NCR number, the Failed toast description. */
    failedDescriptionFallback?: string;
  };
}

const DEFAULT_TOAST = {
  toggleTitle: 'Success',
  toggleDescription: 'Item updated',
  naTitle: 'Success',
  naDescription: 'Item marked as N/A',
  failedTitle: 'Success',
  failedDescriptionFallback: 'Item marked as failed',
} as const;

export function useItpCompletionActions({
  itpInstance,
  requireAccess,
  setUpdatingItem,
  onAfterMutate,
  naDefaultNote,
  updateNotes,
  onAfterFailure,
  toastCopy,
}: UseItpCompletionActionsParams) {
  const copy = { ...DEFAULT_TOAST, ...toastCopy };

  const handleToggleCompletion = async (
    checklistItemId: string,
    isCompleted: boolean,
    notes: string | null,
  ): Promise<boolean> => {
    if (!itpInstance) return false;
    if (!requireAccess()) return false;
    setUpdatingItem(checklistItemId);

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted,
          notes,
        }),
      });

      await onAfterMutate();
      toast({ title: copy.toggleTitle, description: copy.toggleDescription, variant: 'success' });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to update item');
      return false;
    } finally {
      setUpdatingItem(null);
    }
  };

  // Returns true on success so the mobile sheet can close; false when the write
  // failed or was gated, so the sheet stays open with the typed reason intact.
  const handleMarkNotApplicable = async (
    checklistItemId: string,
    reason: string,
  ): Promise<boolean> => {
    if (!itpInstance) return false;
    if (!requireAccess()) return false;
    setUpdatingItem(checklistItemId);

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim() || naDefaultNote,
        }),
      });

      await onAfterMutate();
      toast({ title: copy.naTitle, description: copy.naDescription, variant: 'success' });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
      return false;
    } finally {
      setUpdatingItem(null);
    }
  };

  // Returns true on success / false on failure, same contract as mark-N/A.
  const handleMarkFailed = async (checklistItemId: string, reason: string): Promise<boolean> => {
    if (!itpInstance) return false;
    if (!requireAccess()) return false;
    setUpdatingItem(checklistItemId);

    try {
      const data = await apiFetch<FailedCompletionResult>(`/api/itp/completions`, {
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
      });

      await onAfterMutate();
      await onAfterFailure?.();

      // Surface the raised NCR number when the API returns it (parity with the
      // HC path); fall back to the plain message otherwise.
      toast({
        title: copy.failedTitle,
        description: data?.ncr
          ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
          : copy.failedDescriptionFallback,
        variant: 'success',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark as failed');
      return false;
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return;
    if (!requireAccess()) return;
    setUpdatingItem(checklistItemId);

    try {
      await updateNotes(checklistItemId, notes);
      await onAfterMutate();
    } catch (err) {
      handleApiError(err, 'Failed to update notes');
    } finally {
      setUpdatingItem(null);
    }
  };

  return {
    handleToggleCompletion,
    handleMarkNotApplicable,
    handleMarkFailed,
    handleUpdateNotes,
  };
}
