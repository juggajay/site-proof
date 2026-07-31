/**
 * Wave C5-a — hand a captured docket to the offline photo queue.
 *
 * Deliberately ONE path, online or offline. `capturePhotoOffline` stores the
 * compressed image in Dexie and enqueues a `photo_upload` item; the sync worker
 * then runs upload -> PATCH evidence, immediately when there is signal and
 * whenever it returns when there is not. A separate "just upload it now" branch
 * for the online case would be a second implementation of the dependent chain
 * and the first thing to rot.
 *
 * `entityId` may be a LOCAL delivery id (`delivery-<uuid>`) when the delivery
 * itself is still queued. The worker refuses to file against one and
 * `syncDelivery` relinks it the moment the delivery reaches the server.
 */

import { capturePhotoOffline, type OfflinePhoto } from '@/lib/offlineDb';

export interface QueueDeliveryDocketParams {
  projectId: string;
  /** Server delivery id, or the local placeholder when it has not synced yet. */
  deliveryId: string;
  file: File;
  lotId?: string;
  capturedBy: string;
}

export async function queueDeliveryDocket({
  projectId,
  deliveryId,
  file,
  lotId,
  capturedBy,
}: QueueDeliveryDocketParams): Promise<OfflinePhoto> {
  return capturePhotoOffline(projectId, file, {
    entityType: 'delivery',
    entityId: deliveryId,
    attachAs: 'delivery_evidence',
    documentType: 'delivery_docket',
    category: 'delivery_docket',
    lotId,
    capturedBy,
  });
}
