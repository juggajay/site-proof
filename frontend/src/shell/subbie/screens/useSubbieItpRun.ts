/**
 * useSubbieItpRun — data + actions for the SUBBIE shell ITP run (/p/lots/:id/itp).
 *
 * This is the subbie counterpart to the foreman shell's useShellItpRun, but it is
 * deliberately wired to the CLASSIC SubcontractorLotITPPage's exact logic, not the
 * foreman one:
 *
 *   - Data: the classic subbie reads — GET /api/lots/:lotId?portalModule=itps for
 *     the lot + subcontractorAssignments[].canCompleteITP, and
 *     GET /api/itp/instances/lot/:lotId?subcontractorView=true for the instance.
 *   - Actions: the SHARED `useItpCompletionActions` hook (pages/lots/hooks),
 *     wired EXACTLY as the classic page wires it — `requireAccess` is the page's
 *     `requireCompletionAccess()` gate (derived from canCompleteITP), `naDefaultNote`
 *     is '', notes PATCH an existing completion only, and a Failed mark surfaces
 *     the raised NCR number via the hook's toast. The hook is the single source of
 *     the completion request shapes; this file never duplicates them.
 *   - Photo: the classic flow exactly — create a 'pending' completion if none
 *     exists, then `uploadItpEvidencePhotoWithOfflineFallback`; validate with
 *     `getItpPhotoValidationError`; the helper handles the offline queue.
 *
 * The hook exposes the same shape the run SCREEN consumes (instance, completionFor,
 * pass/markNA/markFailed/addPhoto returning booleans, canComplete, loading/error)
 * so the dark run screen mirrors the foreman run's structure while importing — not
 * forking — the foreman scrubber track/physics/drag modules.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { ITPCompletion, ITPInstance } from '@/pages/lots/types';
import { getItpPhotoValidationError } from '@/pages/lots/lib/itpEvidence';
import { useItpCompletionActions } from '@/pages/lots/hooks/useItpCompletionActions';
import { uploadItpEvidencePhotoWithOfflineFallback } from '@/pages/lots/hooks/useLotPhotoUpload';
import {
  buildPortalCompanyQuery,
  type PortalCompanyScope,
} from '@/pages/subcontractor-portal/portalCompanyScope';

interface SubbieLot {
  id: string;
  projectId: string;
  lotNumber: string;
  description?: string;
  status: string;
  subcontractorAssignments?: {
    canCompleteITP: boolean;
    itpRequiresVerification: boolean;
  }[];
}

export interface SubbieItpRun {
  lot: SubbieLot | null;
  instance: ITPInstance | null;
  loading: boolean;
  loadError: string | null;
  /** True when at least one assignment grants ITP completion access. */
  canComplete: boolean;
  /** Per-item in-flight id (disables the tri-state while a write is settling). */
  updatingItemId: string | null;
  completionFor: (checklistItemId: string) => ITPCompletion | undefined;
  /** PASS / mark complete — true on success. Caller must NOT invoke for un-released hold points. */
  pass: (checklistItemId: string, notes: string | null) => Promise<boolean>;
  markNA: (checklistItemId: string, reason: string) => Promise<boolean>;
  markFailed: (checklistItemId: string, reason: string) => Promise<boolean>;
  /** Attach an evidence photo (classic flow: create-completion-then-upload). */
  addPhoto: (checklistItemId: string, file: File) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSubbieItpRun(
  lotId: string | undefined,
  scope: PortalCompanyScope = {},
): SubbieItpRun {
  const { user } = useAuth();
  const [lot, setLot] = useState<SubbieLot | null>(null);
  const [instance, setInstance] = useState<ITPInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canComplete, setCanComplete] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const hasExplicitScope =
    Object.prototype.hasOwnProperty.call(scope, 'projectId') ||
    Object.prototype.hasOwnProperty.call(scope, 'subcontractorCompanyId');
  const scopeReady = !hasExplicitScope || (!!scope.projectId && !!scope.subcontractorCompanyId);
  const scopeQuery = buildPortalCompanyQuery({
    projectId: scope.projectId,
    subcontractorCompanyId: scope.subcontractorCompanyId,
  });

  // Classic SubcontractorLotITPPage fetch: lot (with assignments) + instance
  // (subcontractor view). Identical URLs + query params.
  const fetchData = useCallback(async () => {
    if (!lotId) {
      setLoading(false);
      return;
    }
    if (!scopeReady) {
      setLoading(true);
      setLoadError(null);
      return;
    }
    try {
      const encodedLotId = encodeURIComponent(lotId);
      const lotData = await apiFetch<{ lot: SubbieLot }>(
        `/api/lots/${encodedLotId}?portalModule=itps${scopeQuery ? `&${scopeQuery.slice(1)}` : ''}`,
      );
      setLot(lotData.lot);

      const canCompleteItems =
        lotData.lot.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;
      setCanComplete(canCompleteItems);

      try {
        const itpData = await apiFetch<{ instance: ITPInstance | null }>(
          `/api/itp/instances/lot/${encodedLotId}?subcontractorView=true${scopeQuery ? `&${scopeQuery.slice(1)}` : ''}`,
        );
        setInstance(itpData.instance);
      } catch {
        // No ITP instance for this lot (classic swallows this).
      }
    } catch (err) {
      logError('Subbie ITP run: fetch failed', err);
      setLoadError(extractErrorMessage(err, 'Failed to load ITP data'));
    } finally {
      setLoading(false);
    }
  }, [lotId, scopeQuery, scopeReady]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Trust boundary — the page owns the gate, exactly as the classic page does.
  // The shared hook never reads roles; it calls this before any write.
  const requireCompletionAccess = useCallback(() => {
    if (canComplete) return true;
    toast({
      title: 'View only',
      description: 'You do not have permission to complete ITP items for this lot.',
      variant: 'error',
    });
    return false;
  }, [canComplete]);

  const { handleToggleCompletion, handleMarkNotApplicable, handleMarkFailed } =
    useItpCompletionActions({
      itpInstance: instance,
      requireAccess: requireCompletionAccess,
      setUpdatingItem: setUpdatingItemId,
      onAfterMutate: fetchData,
      naDefaultNote: '',
      updateNotes: async (checklistItemId: string, notes: string) => {
        if (!instance) return;
        const completion = instance.completions.find((c) => c.checklistItemId === checklistItemId);
        if (completion) {
          await apiFetch(`/api/itp/completions/${completion.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ notes }),
          });
        }
      },
    });

  const completionFor = useCallback(
    (checklistItemId: string): ITPCompletion | undefined =>
      instance?.completions.find((c) => c.checklistItemId === checklistItemId),
    [instance],
  );

  // PASS — the shared toggle (POST isCompleted:true). Returns a boolean so the run
  // screen can advance only on success; the hook handles errors + its own toast.
  const pass = useCallback(
    async (checklistItemId: string, notes: string | null): Promise<boolean> => {
      const existing = instance?.completions.find((c) => c.checklistItemId === checklistItemId);
      const wasRejected = existing?.isRejected || existing?.verificationStatus === 'rejected';
      if (existing?.isCompleted && !wasRejected) return true; // idempotent advance
      try {
        return await handleToggleCompletion(checklistItemId, true, notes);
      } catch {
        return false;
      }
    },
    [instance, handleToggleCompletion],
  );

  const markNA = useCallback(
    (checklistItemId: string, reason: string) => handleMarkNotApplicable(checklistItemId, reason),
    [handleMarkNotApplicable],
  );

  const markFailed = useCallback(
    (checklistItemId: string, reason: string) => handleMarkFailed(checklistItemId, reason),
    [handleMarkFailed],
  );

  // Evidence photo — the classic SubcontractorLotITPPage handleAddPhoto flow,
  // byte-identical: gate, validate, create a 'pending' completion if none exists,
  // then upload-with-offline-fallback. The helper owns the offline queue.
  const addPhoto = useCallback(
    async (checklistItemId: string, file: File): Promise<void> => {
      if (!instance || !lot) return;
      if (!requireCompletionAccess()) return;

      const validationError = getItpPhotoValidationError(file);
      if (validationError) {
        toast({
          title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
          description: validationError,
          variant: 'error',
        });
        return;
      }

      setUpdatingItemId(checklistItemId);
      try {
        let completion = instance.completions.find((c) => c.checklistItemId === checklistItemId);
        if (!completion?.id) {
          const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
            method: 'POST',
            body: JSON.stringify({
              itpInstanceId: instance.id,
              checklistItemId,
              status: 'pending',
              notes: '',
            }),
          });
          completion = data.completion;
        }

        const result = await uploadItpEvidencePhotoWithOfflineFallback({
          projectId: lot.projectId,
          lotId: lot.id,
          completionId: completion.id,
          checklistItemId,
          file,
          capturedBy: user?.id ?? 'unknown',
        });

        if (result.status === 'queued') {
          toast({
            title: 'Saved Offline',
            description:
              'Photo is saved on this device and will attach to this checklist item when it syncs.',
          });
          return;
        }

        await fetchData();
        toast({ title: 'Success', description: 'Photo uploaded', variant: 'success' });
      } catch (err) {
        handleApiError(err, 'Failed to upload photo');
      } finally {
        setUpdatingItemId(null);
      }
    },
    [instance, lot, requireCompletionAccess, user?.id, fetchData],
  );

  return {
    lot,
    instance,
    loading,
    loadError,
    canComplete,
    updatingItemId,
    completionFor,
    pass,
    markNA,
    markFailed,
    addPhoto,
    refetch: fetchData,
  };
}
