import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { extractErrorDetails, extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { ConformStatus, Lot, LotTab } from '../types';

interface UseLotConformanceActionsParams {
  lotId: string | undefined;
  projectId: string | undefined;
  currentTab: LotTab;
  setLot: Dispatch<SetStateAction<Lot | null>>;
  setConformStatus: Dispatch<SetStateAction<ConformStatus | null>>;
  refetchReadiness: () => Promise<unknown>;
  refreshActivityHistory: () => Promise<void>;
}

export function useLotConformanceActions({
  lotId,
  projectId,
  currentTab,
  setLot,
  setConformStatus,
  refetchReadiness,
  refreshActivityHistory,
}: UseLotConformanceActionsParams) {
  const queryClient = useQueryClient();
  const [conforming, setConforming] = useState(false);
  const [showConformConfirm, setShowConformConfirm] = useState(false);
  const [showForceConformConfirm, setShowForceConformConfirm] = useState(false);
  const [forceConformReason, setForceConformReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overriding, setOverriding] = useState(false);

  const handleConformLot = async (force = false, reason?: string) => {
    if (conforming || !lotId) return;

    const trimmedReason = reason?.trim() ?? '';
    if (force && trimmedReason.length < 5) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason before force conforming this lot.',
        variant: 'error',
      });
      return;
    }

    setConforming(true);
    try {
      await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/conform`, {
        method: 'POST',
        ...(force ? { body: JSON.stringify({ force: true, reason: trimmedReason }) } : {}),
      });
      setShowConformConfirm(false);
      setShowForceConformConfirm(false);
      setForceConformReason('');
      setLot((prev) => (prev ? { ...prev, status: 'conformed' } : null));
      setConformStatus(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lotReadiness(lotId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lot(lotId) }),
        ...(projectId
          ? [
              queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
              queryClient.invalidateQueries({ queryKey: queryKeys.claimReadiness(projectId) }),
            ]
          : []),
      ]);
      await refetchReadiness();
      toast({
        title: 'Lot conformed',
        description: force
          ? 'The lot has been force conformed and marked as quality-approved.'
          : 'The lot has been marked as quality-approved.',
        variant: 'success',
      });
    } catch (err) {
      const details = extractErrorDetails(err);
      const blockingReasons = Array.isArray(details?.blockingReasons)
        ? details.blockingReasons.filter((blockingReason): blockingReason is string => {
            return typeof blockingReason === 'string';
          })
        : [];
      if (blockingReasons.length > 0) {
        toast({
          title: 'Cannot conform lot',
          description: blockingReasons.join('\n'),
          variant: 'error',
        });
      } else {
        toast({
          title: 'Failed to conform lot',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
      }
    } finally {
      setConforming(false);
    }
  };

  const handleOverrideStatus = async (newStatus: string, reason: string) => {
    if (!newStatus || !reason.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please select a status and provide a reason.',
        variant: 'error',
      });
      return;
    }

    if (reason.trim().length < 5) {
      toast({
        title: 'Reason too short',
        description: 'Please provide a more detailed reason (at least 5 characters).',
        variant: 'error',
      });
      return;
    }

    setOverriding(true);

    try {
      const data = await apiFetch<{ lot: Lot; previousStatus: string }>(
        `/api/lots/${encodeURIComponent(lotId || '')}/override-status`,
        {
          method: 'POST',
          body: JSON.stringify({
            status: newStatus,
            reason: reason.trim(),
          }),
        },
      );

      setLot((prev) => (prev ? { ...prev, status: data.lot.status } : null));
      setShowOverrideModal(false);
      toast({
        title: 'Status overridden',
        description: `Status changed from "${formatStatusLabel(data.previousStatus)}" to "${formatStatusLabel(data.lot.status)}".`,
      });
      // Refresh history if we're on that tab.
      if (currentTab === 'history') {
        await refreshActivityHistory();
      }
    } catch (err) {
      handleApiError(err, 'Failed to override status');
    } finally {
      setOverriding(false);
    }
  };

  return {
    conforming,
    showConformConfirm,
    setShowConformConfirm,
    showForceConformConfirm,
    setShowForceConformConfirm,
    forceConformReason,
    setForceConformReason,
    showOverrideModal,
    setShowOverrideModal,
    overriding,
    handleConformLot,
    handleOverrideStatus,
  };
}
