/**
 * ITP evidence photo upload + AI-classification workflow, extracted from
 * LotDetailPage.tsx (the "PR-D" slice anticipated in useItpInstance's notes).
 *
 * Owns the shared document-upload/attachment helper, the mobile and desktop
 * add-photo handlers, and the Feature #247 AI classification modal state with
 * its save/skip actions. The page keeps rendering AIClassificationModal and
 * ITPChecklistTab; this hook returns the exact state/handlers those props
 * consumed inline.
 *
 * The ITP instance itself stays owned by useItpInstance — this hook receives
 * `itpInstance`/`setItpInstance` plus the `setUpdatingCompletion` /
 * `updatingCompletionRef` double-submit guard from it, and merges uploaded
 * attachments into the instance exactly as the inline handlers did.
 *
 * Field-write resilience (parity with useItpInstance's completion writes):
 * evidence photos are never dropped on a flaky connection. The upload is
 * attempted online first; on ANY retriable network failure — browser offline,
 * request timeout, fetch-level failure, or a 5xx — the photo is written
 * through the offline pipeline (compressed -> IndexedDB -> sync queue with
 * entityType 'itp' + the completion id) and the sync worker delivers it
 * later; the documents upload endpoint attaches it to the completion
 * server-side. Definitive 4xx rejections still surface as errors.
 */
import { useState } from 'react';
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react';
import { apiFetch, ApiError, authFetch, isRetriableNetworkFailure } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { capturePhotoOffline } from '@/lib/offlineDb';
import { handleApiError } from '@/lib/errorHandling';
import { devWarn } from '@/lib/logger';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { getGPSLocation, getItpPhotoValidationError } from '../lib/itpEvidence';
import type { ITPAttachment, ITPCompletion, ITPInstance } from '../types';
import type { ClassificationModalData } from '../components/AIClassificationModal';

const buildItpEvidenceCaption = () => `ITP Evidence Photo - ${formatDateTime(new Date())}`;

/**
 * Pure upload-then-attach for an ITP evidence photo: POST the file to
 * `/api/documents/upload`, then attach the created document to the completion.
 *
 * Standalone (no hook/component state) so BOTH the HC lot-detail path (via
 * `useLotPhotoUpload`) and the subcontractor portal page call the exact same
 * upload + attach request shape from one tested place. It captures the device
 * GPS fix (`getGPSLocation()`) and sends `gpsLatitude`/`gpsLongitude`, and it
 * `encodeURIComponent`s the completionId in the attachment URL.
 *
 * This function deliberately does NOT do AI classification (Feature #247) or
 * any offline/IndexedDB write-through — classification lives only in the
 * hook's handlers, and the offline fallback lives in
 * `uploadItpEvidencePhotoWithOfflineFallback` below so this stays the pure
 * online request shape.
 *
 * The caller owns the trust boundary and any validation/permission gate; this
 * function never reads `user.role` and only performs the upload it is asked to.
 */
export async function uploadItpEvidencePhoto({
  projectId,
  lotId,
  completionId,
  file,
}: {
  projectId: string | undefined;
  lotId: string | undefined;
  completionId: string;
  file: File;
}): Promise<ITPAttachment> {
  if (!projectId || !lotId) {
    throw new Error('Project and lot are required to upload ITP evidence.');
  }

  const gpsLocation = await getGPSLocation();
  const caption = buildItpEvidenceCaption();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  formData.append('lotId', lotId);
  formData.append('documentType', 'photo');
  formData.append('category', 'itp_evidence');
  formData.append('caption', caption);

  const uploadResponse = await authFetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new ApiError(uploadResponse.status, body);
  }

  const document = (await uploadResponse.json()) as { id: string };
  const data = await apiFetch<{ attachment: ITPAttachment }>(
    `/api/itp/completions/${encodeURIComponent(completionId)}/attachments`,
    {
      method: 'POST',
      body: JSON.stringify({
        documentId: document.id,
        caption,
        gpsLatitude: gpsLocation?.latitude ?? null,
        gpsLongitude: gpsLocation?.longitude ?? null,
      }),
    },
  );

  return data.attachment;
}

/** Outcome of an evidence upload: attached now (online) or queued on-device. */
export type ItpEvidenceUploadResult =
  | { status: 'attached'; attachment: ITPAttachment }
  | { status: 'queued'; photoId: string };

/**
 * Resilient evidence upload shared by the HC lot-detail hook and the
 * subcontractor portal page: try the online upload-then-attach first; on a
 * retriable network failure — browser offline, request timeout, fetch-level
 * failure, or a 5xx (per isRetriableNetworkFailure) — write the photo through
 * the offline pipeline instead: compressed into IndexedDB and queued with
 * entityType 'itp' + the completion id. The sync worker re-uploads it with
 * those fields and the documents upload endpoint attaches it to the same
 * completion, so the queued path converges on the data shape of the direct
 * path. Definitive rejections (4xx) are re-thrown for the caller's error UI.
 *
 * The GPS fix is re-read on the fallback; getGPSLocation caches positions for
 * up to 60s, so this does not re-prompt and usually reuses the same fix.
 */
export async function uploadItpEvidencePhotoWithOfflineFallback({
  projectId,
  lotId,
  completionId,
  file,
  capturedBy,
}: {
  projectId: string | undefined;
  lotId: string | undefined;
  completionId: string;
  file: File;
  capturedBy: string;
}): Promise<ItpEvidenceUploadResult> {
  try {
    const attachment = await uploadItpEvidencePhoto({ projectId, lotId, completionId, file });
    return { status: 'attached', attachment };
  } catch (err) {
    if (!projectId || !lotId || !isRetriableNetworkFailure(err)) throw err;

    const gpsLocation = await getGPSLocation();
    const photo = await capturePhotoOffline(projectId, file, {
      lotId,
      entityType: 'itp',
      entityId: completionId,
      documentType: 'photo',
      category: 'itp_evidence',
      caption: buildItpEvidenceCaption(),
      capturedBy,
      gpsLatitude: gpsLocation?.latitude,
      gpsLongitude: gpsLocation?.longitude,
    });
    return { status: 'queued', photoId: photo.id };
  }
}

/** Honest queued-save feedback: saved on this device, attaches after sync. */
const notifyEvidenceSavedOffline = () => {
  toast({
    title: 'Saved Offline',
    description:
      'Photo is saved on this device and will attach to this checklist item when it syncs.',
  });
};

interface UseLotPhotoUploadParams {
  projectId: string | undefined;
  lotId: string | undefined;
  /** Current ITP instance from useItpInstance; attachments are merged into it. */
  itpInstance: ITPInstance | null;
  setItpInstance: Dispatch<SetStateAction<ITPInstance | null>>;
  /** Per-item in-flight id from useItpInstance (disables the row while uploading). */
  setUpdatingCompletion: Dispatch<SetStateAction<string | null>>;
  /** Synchronous double-submit guard shared with useItpInstance's mutations. */
  updatingCompletionRef: MutableRefObject<string | null>;
}

export function useLotPhotoUpload({
  projectId,
  lotId,
  itpInstance,
  setItpInstance,
  setUpdatingCompletion,
  updatingCompletionRef,
}: UseLotPhotoUploadParams) {
  const { user } = useAuth();

  // AI Photo Classification modal state (Feature #247)
  const [classificationModal, setClassificationModal] = useState<ClassificationModalData | null>(
    null,
  );
  const [savingClassification, setSavingClassification] = useState(false);
  const [_classifying, setClassifying] = useState(false);

  // The resilient upload (online upload-then-attach with the offline-queue
  // fallback) lives in the standalone `uploadItpEvidencePhotoWithOfflineFallback`
  // (module scope, also used by the subcontractor portal page). The hook
  // handlers below call it with this page's projectId/lotId.
  const uploadEvidencePhoto = (
    completionId: string,
    file: File,
  ): Promise<ItpEvidenceUploadResult> =>
    uploadItpEvidencePhotoWithOfflineFallback({
      projectId,
      lotId,
      completionId,
      file,
      capturedBy: user?.id ?? 'unknown',
    });

  const handleMobileAddPhoto = async (checklistItemId: string, file: File) => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return;

    const validationError = getItpPhotoValidationError(file);
    if (validationError) {
      toast({
        title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
        description: validationError,
        variant: 'error',
      });
      return;
    }

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);

      // First ensure there's a completion for this item
      let completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

      if (!completion?.id) {
        // Create completion first
        try {
          const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
            method: 'POST',
            body: JSON.stringify({
              itpInstanceId: itpInstance.id,
              checklistItemId,
              status: 'pending',
              notes: '',
            }),
          });
          completion = data.completion;
          // Update local state
          setItpInstance((prev) => {
            if (!prev) return prev;
            return { ...prev, completions: [...prev.completions, data.completion] };
          });
        } catch {
          // creation failed
        }
      }

      if (!completion?.id) {
        toast({
          title: 'Cannot add photo',
          description: 'Unable to create completion record.',
          variant: 'error',
        });
        return;
      }

      const result = await uploadEvidencePhoto(completion.id, file);

      if (result.status === 'queued') {
        notifyEvidenceSavedOffline();
        return;
      }

      const attachment = result.attachment;

      // Update local state with new attachment
      setItpInstance((prev) => {
        if (!prev) return prev;
        const newCompletions = prev.completions.map((c) => {
          if (c.checklistItemId === checklistItemId) {
            return {
              ...c,
              attachments: c.attachments?.some((existing) => existing.id === attachment.id)
                ? c.attachments
                : [...(c.attachments || []), attachment],
            };
          }
          return c;
        });
        return { ...prev, completions: newCompletions };
      });
      toast({
        title: 'Photo uploaded',
        description: 'Photo has been attached to the checklist item.',
      });
    } catch (err) {
      handleApiError(err, 'Failed to upload photo');
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  // Handle adding a photo to an ITP completion
  const handleAddPhoto = async (
    completionId: string,
    checklistItemId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !itpInstance || updatingCompletionRef.current === checklistItemId) return;

    const validationError = getItpPhotoValidationError(file);
    if (validationError) {
      toast({
        title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
        description: validationError,
        variant: 'error',
      });
      event.target.value = ''; // Reset input
      return;
    }

    // Shared in-flight guard (same as useItpInstance's mutations): disables the
    // row while the upload runs and blocks double submits.
    updatingCompletionRef.current = checklistItemId;
    setUpdatingCompletion(checklistItemId);

    try {
      const result = await uploadEvidencePhoto(completionId, file);

      if (result.status === 'queued') {
        notifyEvidenceSavedOffline();
        return;
      }

      const attachment = result.attachment;

      // Update the ITP instance with the new attachment
      setItpInstance((prev) => {
        if (!prev) return prev;
        const completionIndex = prev.completions.findIndex((c) => c.id === completionId);
        if (completionIndex >= 0) {
          const newCompletions = [...prev.completions];
          const completion = newCompletions[completionIndex];
          newCompletions[completionIndex] = {
            ...completion,
            attachments: completion.attachments?.some((existing) => existing.id === attachment.id)
              ? completion.attachments
              : [...(completion.attachments || []), attachment],
          };
          return { ...prev, completions: newCompletions };
        }
        return prev;
      });

      // Feature #247: AI Photo Classification
      // Call the AI classification endpoint after successful upload
      setClassifying(true);
      try {
        const classificationData = await apiFetch<ClassificationModalData>(
          `/api/documents/${encodeURIComponent(attachment.documentId)}/classify`,
          {
            method: 'POST',
          },
        );

        // Show the classification modal
        setClassificationModal({
          documentId: classificationData.documentId,
          filename: file.name,
          suggestedClassification: classificationData.suggestedClassification,
          confidence: classificationData.confidence,
          categories: classificationData.categories,
        });
      } catch (classifyErr) {
        devWarn('AI classification error:', classifyErr);
        toast({
          title: 'Photo uploaded',
          description: 'Photo was uploaded but AI classification failed.',
        });
      } finally {
        setClassifying(false);
      }
    } catch (err) {
      handleApiError(err, 'Failed to upload photo');
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
      event.target.value = '';
    }
  };

  // Feature #247: Handle saving the photo classification
  const handleSaveClassification = async (classification: string) => {
    if (!classificationModal) return;

    setSavingClassification(true);

    try {
      await apiFetch(
        `/api/documents/${encodeURIComponent(classificationModal.documentId)}/save-classification`,
        {
          method: 'POST',
          body: JSON.stringify({
            classification,
          }),
        },
      );

      toast({
        title: 'Classification saved',
        description: `Photo classified as "${classification}"`,
      });
      setClassificationModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to save classification');
    } finally {
      setSavingClassification(false);
    }
  };

  // Skip classification and just close the modal
  const handleSkipClassification = () => {
    setClassificationModal(null);
    toast({
      title: 'Photo uploaded',
      description: 'Photo was uploaded without classification.',
    });
  };

  return {
    classificationModal,
    savingClassification,
    handleMobileAddPhoto,
    handleAddPhoto,
    handleSaveClassification,
    handleSkipClassification,
  };
}
