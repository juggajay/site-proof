import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { canRequestHoldPointRelease } from '@/lib/roles';
import { queryKeys } from '@/lib/queryKeys';
import type { HoldPoint } from '@/pages/holdpoints/types';
import type { ItpHoldPointState, Lot } from '../types';

// Benchmark T1/T2 — the hold-point affordances the lot ITP checklist puts on
// the row itself: which hold point backs each checklist item, whether this user
// may request its release, and the two sheets that action opens.

interface UseItpHoldPointActionsParams {
  lot: Lot;
  projectId: string;
  holdPoints: ItpHoldPointState[] | undefined;
  /** Re-reads the ITP instance so the row reflects the new requested state. */
  onRefreshItp: () => void;
}

export function useItpHoldPointActions({
  lot,
  projectId,
  holdPoints,
  onRefreshItp,
}: UseItpHoldPointActionsParams) {
  const queryClient = useQueryClient();
  // Derived here rather than passed in, so the hold-point affordances are
  // self-contained to the checklist. Mirrors the backend HP_REQUEST_ROLES; the
  // API enforces it regardless of what the UI offers.
  const currentProjectRole = useCurrentProjectRole(projectId);
  const canRequestRelease = canRequestHoldPointRelease(currentProjectRole);

  const [releaseRequestHoldPoint, setReleaseRequestHoldPoint] = useState<HoldPoint | null>(null);
  const [qrHoldPoint, setQrHoldPoint] = useState<{ id: string; description: string } | null>(null);

  const holdPointsByItemId = useMemo(() => {
    const map = new Map<string, ItpHoldPointState>();
    for (const holdPoint of holdPoints ?? []) {
      map.set(holdPoint.itpChecklistItemId, holdPoint);
    }
    return map;
  }, [holdPoints]);

  // The request-release sheet is shared with the hold point register, which
  // hands it a register row. From the checklist we only know the lot and the
  // checklist item — which is all `POST /api/holdpoints/request-release` keys
  // on, and all the sheet reads. A hold point that does not exist yet gets the
  // register's own `virtual-` id convention.
  const openReleaseRequest = (item: { id: string; description: string }) => {
    const existing = holdPointsByItemId.get(item.id);
    setReleaseRequestHoldPoint({
      id: existing?.id ?? `virtual-${item.id}`,
      lotId: lot.id,
      lotNumber: lot.lotNumber || '',
      itpChecklistItemId: item.id,
      description: item.description,
      pointType: 'hold_point',
      status: existing?.status ?? 'pending',
      notificationSentAt: existing?.notificationSentAt ?? null,
      scheduledDate: existing?.scheduledDate ?? null,
      releasedAt: null,
      releasedByName: null,
      releaseNotes: null,
      sequenceNumber: 0,
      isCompleted: false,
      isVerified: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handleReleaseRequested = async () => {
    onRefreshItp();
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.holdPoints(projectId) }),
      queryClient.invalidateQueries({ queryKey: ['lot'] }),
      queryClient.invalidateQueries({ queryKey: ['lot-readiness'] }),
    ]);
  };

  return {
    canRequestRelease,
    holdPointsByItemId,
    releaseRequestHoldPoint,
    qrHoldPoint,
    openReleaseRequest,
    showQrCode: (holdPoint: ItpHoldPointState, itemDescription: string) =>
      setQrHoldPoint({ id: holdPoint.id, description: itemDescription }),
    closeReleaseRequest: () => setReleaseRequestHoldPoint(null),
    closeQrCode: () => setQrHoldPoint(null),
    handleReleaseRequested,
  };
}
