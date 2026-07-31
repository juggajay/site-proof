/**
 * Wave C5-a — the docket photos still sitting on THIS device, keyed by the
 * delivery they will be filed against.
 *
 * The server tells a surface whether a docket is filed (`docketDocumentId`);
 * only Dexie can tell it that a photo is queued and has not got there yet. This
 * hook supplies that second half so `docketFilingStatusKey` can distinguish
 * "nobody has filed one" from "it is on the phone and moving".
 *
 * ponytail: re-reads when the sync queue's counters move rather than
 * subscribing to Dexie. `dexie-react-hooks` is not a dependency and the queue
 * counters already poll on the shell's cadence, so the queued->filed transition
 * lands within one tick with no new dependency and no second timer. Add a live
 * subscription only if a surface needs sub-second freshness.
 */

import { useEffect, useState } from 'react';

import { getUnsyncedPhotos, type OfflinePhoto } from '@/lib/offlineDb';
import { useOfflineStatus } from '@/lib/useOfflineStatus';

export interface DeliveryDocketPhotos {
  /** deliveryId -> the queued docket photo for it. */
  byDeliveryId: Map<string, OfflinePhoto>;
  isOnline: boolean;
}

export function useDeliveryDocketPhotos(): DeliveryDocketPhotos {
  const { isOnline, pendingSyncCount, failedSyncCount } = useOfflineStatus();
  const [byDeliveryId, setByDeliveryId] = useState<Map<string, OfflinePhoto>>(() => new Map());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const photos = await getUnsyncedPhotos();
        if (cancelled) return;
        const next = new Map<string, OfflinePhoto>();
        for (const photo of photos) {
          if (photo.entityType !== 'delivery' || !photo.entityId) continue;
          // Newest capture wins: re-photographing a docket supersedes the one
          // that failed, and the row must report the state of the live attempt.
          const existing = next.get(photo.entityId);
          if (!existing || photo.capturedAt > existing.capturedAt) {
            next.set(photo.entityId, photo);
          }
        }
        setByDeliveryId(next);
      } catch {
        // Dexie unavailable (private mode, blocked storage). The surfaces fall
        // back to server truth, which is the safe direction: they will say
        // "Not filed in CIVOS" rather than invent a filed state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingSyncCount, failedSyncCount, isOnline]);

  return { byDeliveryId, isOnline };
}
