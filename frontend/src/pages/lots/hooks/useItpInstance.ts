/**
 * ITP instance data + completion-mutation hook, extracted from LotDetailPage.tsx.
 *
 * Owns the ITP instance fetch, the offline write-through / cache-fallback, the
 * 20s hold-point-release polling, template assignment, AND (since PR-C) the
 * completion mutations: toggle, notes, mark N/A, mark failed, the mobile mark
 * actions, witness-point completion, and the `updatingCompletion` double-submit
 * guard.
 *
 * The UI trust boundary stays in the page: modal open/close state and the
 * "after failed" lot/NCR refresh live in LotDetailPage. The hook reaches back
 * through callbacks — `onRequestWitness` / `onRequestEvidenceWarning` open the
 * page's gate modals, `onToggleSettled` dismisses the evidence prompt once a
 * toggle settles, and `refreshLotAfterFailure` / `refreshNcrsAfterFailure`
 * re-fetch the page-owned lot/NCR state after a failure is recorded.
 *
 * Field-write resilience: a failed completion POST falls back to the offline
 * path (local write + sync queue + "Saved Offline" toast) on ANY retriable
 * network failure — browser offline, timeout, fetch-level failure, or 5xx —
 * via isRetriableNetworkFailure, not only when navigator.onLine is false.
 * Definitive 4xx rejections still surface as errors. The photo / evidence
 * upload + AI-classification handlers live in useLotPhotoUpload (the PR-D
 * slice) and reuse the `setUpdatingCompletion` / `updatingCompletionRef` guard
 * this hook exposes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { logError } from '@/lib/logger';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { cacheITPChecklist, getCachedITPChecklist, getPendingSyncCount } from '@/lib/offlineDb';
import type { ITPCompletion, ITPInstance, ITPTemplate, LotTab } from '../types';
import { mergeCompletionIntoInstance } from '../lib/itpCompletionState';
import { writeItpCompletionToggle } from '../lib/itpCompletionWrite';
import { mapCachedToItpInstance, mapInstanceToOfflineItems } from '../lib/itpOfflineMapping';
import { useItpMobileActions } from './useItpMobileActions';
import { useItpReleasePolling } from './useItpReleasePolling';
import { useItpTemplateAssignment } from './useItpTemplateAssignment';

/** Prompt payload for the page's witness-point modal (gate before completing). */
export interface WitnessPrompt {
  checklistItemId: string;
  itemDescription: string;
  existingNotes: string | null;
}

/** Prompt payload for the page's evidence-warning modal (gate before completing). */
export interface EvidenceWarningPrompt {
  checklistItemId: string;
  itemDescription: string;
  evidenceType: string;
  currentNotes: string | null;
}

/** Witness details collected by the page modal, passed back to complete the point. */
export interface CompleteWitnessPointInput {
  checklistItemId: string;
  existingNotes: string | null;
  witnessPresent: boolean;
  witnessName?: string;
  witnessCompany?: string;
}

interface UseItpInstanceParams {
  projectId: string | undefined;
  lotId: string | undefined;
  currentTab: LotTab;
  /** From useOfflineStatus(); re-triggers the fetch when connectivity flips. */
  isOnline: boolean;
  /** Page-owned readiness query refetch, run after a successful assignment. */
  refetchReadiness: () => void;
  /** Page-owned conform-status fetch, run after a successful assignment. */
  refetchConformStatus: () => void;
  /** Open the page's witness-point modal when a witness item is being completed. */
  onRequestWitness: (prompt: WitnessPrompt) => void;
  /** Open the page's evidence-warning modal when required evidence is missing. */
  onRequestEvidenceWarning: (prompt: EvidenceWarningPrompt) => void;
  /** Called when a toggle settles; the page uses it to dismiss the evidence prompt. */
  onToggleSettled: () => void;
  /** Re-fetch page-owned lot state after a failure is recorded (desktop "mark failed"). */
  refreshLotAfterFailure: () => Promise<void>;
  /** Re-fetch page-owned NCR state after a failure is recorded. */
  refreshNcrsAfterFailure: () => Promise<void>;
}

export function useItpInstance({
  projectId,
  lotId,
  currentTab,
  isOnline,
  refetchReadiness,
  refetchConformStatus,
  onRequestWitness,
  onRequestEvidenceWarning,
  onToggleSettled,
  refreshLotAfterFailure,
  refreshNcrsAfterFailure,
}: UseItpInstanceParams) {
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null);
  const [loadingItp, setLoadingItp] = useState(false);
  const [itpLoadError, setItpLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ITPTemplate[]>([]);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  // Per-item in-flight id (disables the row) + a synchronous double-submit guard.
  const [updatingCompletion, setUpdatingCompletion] = useState<string | null>(null);
  const updatingCompletionRef = useRef<string | null>(null);

  const fetchItpInstance = useCallback(async () => {
    if (!projectId || !lotId || currentTab !== 'itp') return;

    setLoadingItp(true);
    setItpLoadError(null);
    setIsOfflineData(false);

    const encodedProjectId = encodeURIComponent(projectId);
    const encodedLotId = encodeURIComponent(lotId);

    // Check offline pending count
    const pendingCount = await getPendingSyncCount();
    setOfflinePendingCount(pendingCount);

    const loadAvailableTemplates = async () => {
      setItpInstance(null);
      try {
        const templatesData = await apiFetch<{ templates: ITPTemplate[] }>(
          `/api/itp/templates?projectId=${encodedProjectId}&includeGlobal=true&activeOnly=true`,
        );
        setTemplates(
          (templatesData.templates || []).filter((template) => template.isActive !== false),
        );
      } catch (templateErr) {
        logError('Failed to fetch ITP templates for lot:', templateErr);
        setTemplates([]);
        setItpLoadError(
          extractErrorMessage(
            templateErr,
            'No ITP is assigned, and available templates could not be loaded.',
          ),
        );
      }
    };

    try {
      // Try to fetch from server first
      const data = await apiFetch<{ instance: ITPInstance | null }>(
        `/api/itp/instances/lot/${encodedLotId}`,
      );
      if (!data.instance) {
        await loadAvailableTemplates();
        return;
      }

      const instance = data.instance;
      setItpInstance(instance);
      setIsOfflineData(false);

      // Cache the ITP data for offline use
      if (instance.template) {
        const items = mapInstanceToOfflineItems(instance);
        await cacheITPChecklist(lotId, instance.template.id, instance.template.name, items);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Backwards-compatible handling for older deployments that still used 404 for no ITP.
        await loadAvailableTemplates();
      } else {
        logError('Failed to fetch ITP instance, trying offline cache:', err);

        // Try to load from offline cache
        const cachedData = await getCachedITPChecklist(lotId);
        if (cachedData) {
          // Convert cached data to ITPInstance format
          const offlineInstance = mapCachedToItpInstance(cachedData);
          setItpInstance(offlineInstance);
          setIsOfflineData(true);
          toast({
            title: 'Offline Mode',
            description: `Showing cached data from ${new Date(cachedData.cachedAt).toLocaleDateString('en-AU')}`,
            variant: 'default',
          });
        } else {
          setItpInstance(null);
          setItpLoadError(extractErrorMessage(err, 'Failed to load ITP checklist.'));
        }
      }
    } finally {
      setLoadingItp(false);
    }
  }, [projectId, lotId, currentTab]);

  // Fetch ITP instance when ITP tab is selected (with offline support)
  useEffect(() => {
    void fetchItpInstance();
  }, [fetchItpInstance, isOnline]);

  // Feature #734: Real-time HP release notification polling
  // Poll for ITP updates every 20 seconds to catch holdpoint releases quickly.
  useItpReleasePolling({ lotId, currentTab, isOnline, setItpInstance });

  const { assigningTemplate, assignTemplate, unassignTemplate } = useItpTemplateAssignment({
    lotId,
    setItpInstance,
    setItpLoadError,
    refetchReadiness,
    refetchConformStatus,
  });

  const { mobileMarkNA, mobileMarkFailed } = useItpMobileActions({
    lotId,
    itpInstance,
    setItpInstance,
    updatingCompletionRef,
    setUpdatingCompletion,
    refetchReadiness,
    refetchConformStatus,
    refreshNcrsAfterFailure,
  });

  // Returns true when the toggle is handled (saved, queued offline, or a
  // witness/evidence gate modal was opened to continue the completion) and false
  // only when a save was attempted and definitively failed. M57: the mobile PASS
  // sheet awaits this and closes only on a truthy result.
  const toggleCompletion = async (
    checklistItemId: string,
    currentlyCompleted: boolean,
    existingNotes: string | null,
    forceComplete = false,
    witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string },
  ): Promise<boolean> => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return false;

    const item = itpInstance.template.checklistItems.find((i) => i.id === checklistItemId);
    const completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

    // Check if this is a witness point and we're completing (not uncompleting)
    if (!currentlyCompleted && !forceComplete && item?.pointType === 'witness' && !witnessData) {
      // Show witness modal to collect witness details. The gate modal takes over,
      // so the originating sheet may close (true) — the save continues there.
      onRequestWitness({
        checklistItemId,
        itemDescription: item.description,
        existingNotes,
      });
      return true;
    }

    // Check if this item requires evidence and doesn't have any yet
    if (!currentlyCompleted && !forceComplete) {
      const hasAttachments = completion?.attachments && completion.attachments.length > 0;

      if (item && item.evidenceRequired !== 'none' && !hasAttachments) {
        // Show evidence warning modal
        const evidenceTypeLabel =
          item.evidenceRequired === 'photo'
            ? 'Photo'
            : item.evidenceRequired === 'test'
              ? 'Test Result'
              : item.evidenceRequired === 'document'
                ? 'Document'
                : 'Evidence';
        onRequestEvidenceWarning({
          checklistItemId,
          itemDescription: item.description,
          evidenceType: evidenceTypeLabel,
          currentNotes: existingNotes,
        });
        return true;
      }
    }

    updatingCompletionRef.current = checklistItemId;
    setUpdatingCompletion(checklistItemId);

    try {
      // Shared online-then-offline write primitive (itpCompletionWrite.ts), used
      // identically by the foreman shell run screen.
      const result = await writeItpCompletionToggle({
        itpInstanceId: itpInstance.id,
        lotId,
        checklistItemId,
        currentlyCompleted,
        existingNotes,
        witnessData,
      });

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, result.completion));
      refetchReadiness();
      refetchConformStatus();

      if (result.status === 'queued') {
        // Update offline pending count, then surface the honest offline toast.
        const pendingCount = await getPendingSyncCount();
        setOfflinePendingCount(pendingCount);
        toast({
          title: 'Saved Offline',
          description: 'Your change is saved on this device and will sync automatically.',
          variant: 'default',
        });
      }
      return true;
    } catch (err) {
      // Definitive rejections (4xx, e.g. the hold-point guard) reach here.
      logError('Failed to update completion:', err);
      toast({
        title: 'Error',
        description: 'Failed to update checklist item. Please try again.',
        variant: 'error',
      });
      return false;
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
      onToggleSettled();
    }
  };

  const updateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return;

    const existingCompletion = itpInstance.completions.find(
      (c) => c.checklistItemId === checklistItemId,
    );

    try {
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: existingCompletion?.isCompleted || false,
          notes,
        }),
      });

      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
    } catch (err) {
      logError('Failed to update notes:', err);
    }
  };

  // Mark an ITP item as Not Applicable. Returns true on success so the page can
  // close its modal; the page owns the modal state and submitting flag.
  const markAsNA = async (checklistItemId: string, reason: string): Promise<boolean> => {
    if (!itpInstance || !reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for marking this item as N/A.',
        variant: 'error',
      });
      return false;
    }

    try {
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim(),
        }),
      });

      // Update the completions in state
      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
      refetchReadiness();
      refetchConformStatus();
      toast({
        title: 'Item marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
      return false;
    }
  };

  // Mark an ITP item as Failed (triggers NCR creation). Returns true on success.
  const markAsFailed = async (input: {
    checklistItemId: string;
    description: string;
    category: string;
    severity: string;
  }): Promise<boolean> => {
    if (!itpInstance) {
      return false;
    }

    try {
      const data = await apiFetch<{ completion: ITPCompletion; ncr?: { ncrNumber: string } }>(
        '/api/itp/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId: input.checklistItemId,
            status: 'failed',
            notes: `Failed: ${input.description}`,
            ncrDescription: input.description,
            ncrCategory: input.category,
            ncrSeverity: input.severity,
          }),
        },
      );

      // Update the completions in state
      setItpInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));

      // Refresh page-owned lot + NCR state to reflect the status change.
      await refreshLotAfterFailure();
      await refreshNcrsAfterFailure();

      toast({
        title: 'Item marked as Failed - NCR created',
        description: data.ncr
          ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
          : 'The item has been marked as failed.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to mark item');
      return false;
    }
  };

  // H4: head-contractor verifies a subcontractor completion that is awaiting
  // verification. Re-fetches the instance afterwards so the derived verification
  // flags (isVerified/isPendingVerification/isRejected from the M15 transform)
  // refresh correctly. Returns true on success.
  const verifyCompletion = async (completionId: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/itp/completions/${encodeURIComponent(completionId)}/verify`, {
        method: 'POST',
      });
      await fetchItpInstance();
      refetchReadiness();
      refetchConformStatus();
      toast({
        title: 'Item verified',
        description: 'The ITP item has been verified.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to verify item');
      return false;
    }
  };

  // H4: head-contractor rejects a completion awaiting verification with a
  // mandatory reason; the subcontractor is notified to resubmit (which clears
  // the rejection via the H6 backend path). Returns true on success.
  const rejectCompletion = async (completionId: string, reason: string): Promise<boolean> => {
    if (!reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for rejecting this item.',
        variant: 'error',
      });
      return false;
    }

    try {
      await apiFetch(`/api/itp/completions/${encodeURIComponent(completionId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await fetchItpInstance();
      refetchReadiness();
      refetchConformStatus();
      toast({
        title: 'Item rejected',
        description: 'The subcontractor has been notified to correct and resubmit it.',
      });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to reject item');
      return false;
    }
  };

  // Complete a witness point: force-complete the toggle with witness details,
  // then toast. The page owns the witness modal state / submitting flag and the
  // (effectively unreachable) error path, since toggleCompletion never throws.
  const completeWitnessPoint = async (input: CompleteWitnessPointInput) => {
    if (!itpInstance) {
      return;
    }

    // Call toggleCompletion with witness data, forceComplete to skip the gate.
    await toggleCompletion(input.checklistItemId, false, input.existingNotes, true, {
      witnessPresent: input.witnessPresent,
      witnessName: input.witnessName,
      witnessCompany: input.witnessCompany,
    });

    toast({
      title: 'Witness point completed',
      description: input.witnessPresent
        ? `Witness details recorded: ${input.witnessName}${input.witnessCompany ? ` (${input.witnessCompany})` : ''}`
        : 'Noted that notification was given but witness not present.',
    });
  };

  return {
    itpInstance,
    setItpInstance,
    loadingItp,
    itpLoadError,
    templates,
    isOfflineData,
    offlinePendingCount,
    assigningTemplate,
    updatingCompletion,
    // Exposed for the still-in-page photo/evidence handlers (PR-D); they share
    // this double-submit guard until they too move into the hook.
    setUpdatingCompletion,
    updatingCompletionRef,
    refetchItp: fetchItpInstance,
    assignTemplate,
    unassignTemplate,
    toggleCompletion,
    updateNotes,
    markAsNA,
    markAsFailed,
    mobileMarkNA,
    mobileMarkFailed,
    completeWitnessPoint,
    verifyCompletion,
    rejectCompletion,
  };
}
