/**
 * useShellItpRun — data + mutations for the foreman shell ITP run (/m/lots/:id/itp).
 *
 * NEW PRESENTATION over EXISTING LOGIC. This hook owns the shell run's local
 * state (the ITP instance, the current item index, the pass-flash) but reuses —
 * never duplicates — the existing completion machinery:
 *
 *   - PASS / complete toggle → `writeItpCompletionToggle` (the online+offline
 *     write primitive extracted from `useItpInstance.toggleCompletion`).
 *   - N/A + FAIL → `useItpMobileActions` (mobileMarkNA / mobileMarkFailed) — the
 *     same reason-capture + server-side NCR-link behavior the mobile checklist
 *     uses today. FAIL reuses the existing flow exactly; no new NCR flow here.
 *   - Evidence photo → `uploadItpEvidencePhotoWithOfflineFallback` (the one
 *     upload linkage that works end-to-end, entityType 'itp').
 *   - Offline cache + mappers → `cacheITPChecklist` / `getCachedITPChecklist` and
 *     `mapInstanceToOfflineItems` / `mapCachedToItpInstance`.
 *
 * Hold-point gating is enforced by the screen via `holdPointGateDecision`; this
 * hook never offers a complete write for an un-released hold point because the
 * screen does not call `pass()` for those items.
 *
 * The run deliberately does NOT reuse `useItpInstance` itself: that hook is bound
 * to LotDetailPage's tab + modal callbacks (witness modal, evidence-warning
 * modal, page NCR/lot refresh). The shell run is a one-item-per-screen flow with
 * its own honest hold-point state, so it composes the shared primitives directly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { cacheITPChecklist, getCachedITPChecklist, getPendingSyncCount } from '@/lib/offlineDb';
import type { ITPCompletion, ITPInstance } from '@/pages/lots/types';
import { mergeCompletionIntoInstance } from '@/pages/lots/lib/itpCompletionState';
import { writeItpCompletionToggle } from '@/pages/lots/lib/itpCompletionWrite';
import {
  mapCachedToItpInstance,
  mapInstanceToOfflineItems,
} from '@/pages/lots/lib/itpOfflineMapping';
import { useItpMobileActions } from '@/pages/lots/hooks/useItpMobileActions';
import { uploadItpEvidencePhotoWithOfflineFallback } from '@/pages/lots/hooks/useLotPhotoUpload';
import { getItpPhotoValidationError } from '@/pages/lots/lib/itpEvidence';

export interface ShellItpRun {
  instance: ITPInstance | null;
  loading: boolean;
  loadError: string | null;
  isOfflineData: boolean;
  pendingCount: number;
  /** Per-item in-flight id (disables the tri-state while a write is settling). */
  updatingItemId: string | null;
  /** Completion lookup for the screen. */
  completionFor: (checklistItemId: string) => ITPCompletion | undefined;
  /** PASS / mark complete. Caller must NOT invoke for un-released hold points. */
  pass: (checklistItemId: string, notes: string | null) => Promise<boolean>;
  /** N/A with reason — reuses the existing mobile reason-capture semantics. */
  markNA: (checklistItemId: string, reason: string) => Promise<boolean>;
  /** FAIL with reason — reuses the existing mobile flow (server-side NCR link). */
  markFailed: (checklistItemId: string, reason: string) => Promise<boolean>;
  /** Attach an evidence photo (online upload-then-attach, offline-queued fallback). */
  addPhoto: (checklistItemId: string, file: File) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useShellItpRun(
  projectId: string | undefined,
  lotId: string | undefined,
): ShellItpRun {
  const { user } = useAuth();
  const [instance, setInstance] = useState<ITPInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const updatingRef = useRef<string | null>(null);

  // N/A + FAIL reuse the exact mobile actions; the shell owns no page NCR state,
  // so the post-failure refresh is a no-op (the NCR is created server-side and
  // the run simply advances).
  const noopRefresh = useCallback(async () => {}, []);
  const { mobileMarkNA, mobileMarkFailed } = useItpMobileActions({
    itpInstance: instance,
    setItpInstance: setInstance,
    updatingCompletionRef: updatingRef,
    setUpdatingCompletion: setUpdatingItemId,
    refreshNcrsAfterFailure: noopRefresh,
  });

  const fetchInstance = useCallback(async () => {
    if (!lotId) return;
    setLoading(true);
    setLoadError(null);
    setIsOfflineData(false);

    const pending = await getPendingSyncCount();
    setPendingCount(pending);

    const encodedLotId = encodeURIComponent(lotId);
    try {
      const data = await apiFetch<{ instance: ITPInstance | null }>(
        `/api/itp/instances/lot/${encodedLotId}`,
      );
      if (!data.instance) {
        setInstance(null);
        return;
      }
      setInstance(data.instance);
      // Cache for offline use (same write-through the page does).
      if (data.instance.template) {
        const items = mapInstanceToOfflineItems(data.instance);
        await cacheITPChecklist(
          lotId,
          data.instance.template.id,
          data.instance.template.name,
          items,
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setInstance(null);
        return;
      }
      logError('Shell ITP run: instance fetch failed, trying offline cache', err);
      const cached = await getCachedITPChecklist(lotId);
      if (cached) {
        setInstance(mapCachedToItpInstance(cached));
        setIsOfflineData(true);
      } else {
        setInstance(null);
        setLoadError('Could not load this lot’s inspection checklist.');
      }
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    void fetchInstance();
  }, [fetchInstance]);

  const completionFor = useCallback(
    (checklistItemId: string): ITPCompletion | undefined =>
      instance?.completions.find((c) => c.checklistItemId === checklistItemId),
    [instance],
  );

  const pass = useCallback(
    async (checklistItemId: string, notes: string | null): Promise<boolean> => {
      if (!instance || updatingRef.current === checklistItemId) return false;
      const existing = instance.completions.find((c) => c.checklistItemId === checklistItemId);
      // Already completed → nothing to do (idempotent advance).
      if (existing?.isCompleted) return true;

      updatingRef.current = checklistItemId;
      setUpdatingItemId(checklistItemId);
      try {
        const result = await writeItpCompletionToggle({
          itpInstanceId: instance.id,
          lotId,
          checklistItemId,
          currentlyCompleted: false,
          existingNotes: notes,
        });
        setInstance((prev) => mergeCompletionIntoInstance(prev, result.completion));
        if (result.status === 'queued') {
          setPendingCount(await getPendingSyncCount());
          toast({
            title: 'Saved Offline',
            description: 'Saved on this device — it will sync automatically.',
          });
        }
        return true;
      } catch (err) {
        logError('Shell ITP run: pass write failed', err);
        toast({
          title: 'Could not save',
          description: 'That check did not save. Please try again.',
          variant: 'error',
        });
        return false;
      } finally {
        updatingRef.current = null;
        setUpdatingItemId(null);
      }
    },
    [instance, lotId],
  );

  const markNA = useCallback(
    (checklistItemId: string, reason: string) => mobileMarkNA(checklistItemId, reason),
    [mobileMarkNA],
  );

  const markFailed = useCallback(
    (checklistItemId: string, reason: string) => mobileMarkFailed(checklistItemId, reason),
    [mobileMarkFailed],
  );

  const addPhoto = useCallback(
    async (checklistItemId: string, file: File): Promise<void> => {
      if (!instance || updatingRef.current === checklistItemId) return;

      const validationError = getItpPhotoValidationError(file);
      if (validationError) {
        toast({
          title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
          description: validationError,
          variant: 'error',
        });
        return;
      }

      updatingRef.current = checklistItemId;
      setUpdatingItemId(checklistItemId);
      try {
        // Ensure a completion exists so the photo has something to attach to —
        // same pre-step the mobile add-photo handler performs.
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
          setInstance((prev) => mergeCompletionIntoInstance(prev, data.completion));
        }
        if (!completion?.id) {
          toast({
            title: 'Cannot add photo',
            description: 'Unable to create the inspection record.',
            variant: 'error',
          });
          return;
        }

        const result = await uploadItpEvidencePhotoWithOfflineFallback({
          projectId,
          lotId,
          completionId: completion.id,
          checklistItemId,
          file,
          capturedBy: user?.id ?? 'unknown',
        });

        if (result.status === 'queued') {
          setPendingCount(await getPendingSyncCount());
          toast({
            title: 'Saved Offline',
            description: 'Photo saved on this device — it will attach when it syncs.',
          });
          return;
        }

        const attachment = result.attachment;
        setInstance((prev) => {
          if (!prev) return prev;
          const completions = prev.completions.map((c) =>
            c.checklistItemId === checklistItemId
              ? {
                  ...c,
                  attachments: c.attachments?.some((a) => a.id === attachment.id)
                    ? c.attachments
                    : [...(c.attachments || []), attachment],
                }
              : c,
          );
          return { ...prev, completions };
        });
        toast({ title: 'Photo added', description: 'Attached to this check.' });
      } catch (err) {
        logError('Shell ITP run: photo upload failed', err);
        toast({
          title: 'Photo failed',
          description: 'The photo could not be added. Please try again.',
          variant: 'error',
        });
      } finally {
        updatingRef.current = null;
        setUpdatingItemId(null);
      }
    },
    [instance, projectId, lotId, user?.id],
  );

  return {
    instance,
    loading,
    loadError,
    isOfflineData,
    pendingCount,
    updatingItemId,
    completionFor,
    pass,
    markNA,
    markFailed,
    addPhoto,
    refetch: fetchInstance,
  };
}
