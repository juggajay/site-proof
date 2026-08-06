import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorCode, extractErrorDetails, extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { HoldPoint, HoldPointDetails, PrerequisiteItem, RequestError } from '../types';
import { RequestReleaseModal } from './RequestReleaseModal';

// The whole "request a hold point release" interaction — prerequisite lookup,
// submit, notice-period override and error shaping — in one place, so the hold
// point register and the lot ITP checklist row drive the SAME request path
// rather than two that can drift.

interface RequestReleaseFlowProps {
  holdPoint: HoldPoint;
  onClose: () => void;
  /** Awaited before the sheet closes, so callers can refresh their own caches. */
  onRequested: () => Promise<void> | void;
}

export function RequestReleaseFlow({ holdPoint, onClose, onRequested }: RequestReleaseFlowProps) {
  const [details, setDetails] = useState<HoldPointDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const requestingRef = useRef(false);

  const { lotId, itpChecklistItemId } = holdPoint;

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      setLoadingDetails(true);
      setError(null);
      setDetails(null);
      try {
        const data = await apiFetch<HoldPointDetails>(
          `/api/holdpoints/lot/${encodeURIComponent(lotId)}/item/${encodeURIComponent(itpChecklistItemId)}`,
        );
        if (!cancelled) setDetails(data);
      } catch (err) {
        logError('Failed to fetch hold point details:', err);
        if (!cancelled) {
          setError({ message: extractErrorMessage(err, 'Could not load hold point details.') });
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    }

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [lotId, itpChecklistItemId]);

  const handleSubmit = useCallback(
    async (
      scheduledDate: string,
      scheduledTime: string,
      notificationSentTo: string,
      overrideNoticePeriod?: boolean,
      overrideReason?: string,
      evidenceDocumentIds?: string[],
    ) => {
      if (requestingRef.current) return;
      requestingRef.current = true;
      setRequesting(true);
      setError(null);
      try {
        await apiFetch('/api/holdpoints/request-release', {
          method: 'POST',
          body: JSON.stringify({
            lotId,
            itpChecklistItemId,
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            notificationSentTo: notificationSentTo.trim() || null,
            evidenceDocumentIds: evidenceDocumentIds || [],
            noticePeriodOverride: overrideNoticePeriod || false,
            noticePeriodOverrideReason: overrideReason?.trim() || null,
          }),
        });
        await onRequested();
        onClose();
      } catch (err) {
        const errorDetails = extractErrorDetails(err);
        const code = extractErrorCode(err);
        const incompleteItems = Array.isArray(errorDetails?.incompleteItems)
          ? (errorDetails.incompleteItems as PrerequisiteItem[])
          : undefined;
        const message = extractErrorMessage(err, 'Failed to request release');
        if (incompleteItems) {
          setError({ message, incompleteItems });
        } else if (code === 'NOTICE_PERIOD_WARNING') {
          setError({ message, code, details: errorDetails || undefined });
        } else {
          setError({ message });
        }
      } finally {
        requestingRef.current = false;
        setRequesting(false);
      }
    },
    [lotId, itpChecklistItemId, onClose, onRequested],
  );

  return (
    <RequestReleaseModal
      holdPoint={holdPoint}
      details={details}
      loading={loadingDetails}
      requesting={requesting}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
