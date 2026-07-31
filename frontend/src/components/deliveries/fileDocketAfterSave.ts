/**
 * Wave C5-a — queue a captured docket once the delivery it belongs to exists.
 *
 * Shared by both create mounts (the shell DeliveryFormScreen and the diary
 * AddDeliverySheet) so the failure behaviour cannot differ between them.
 *
 * The rule both mounts obey: a docket problem NEVER fails the delivery. The
 * entry the foreman typed is recorded either way and the row honestly reads
 * "Not filed in CIVOS" — but he is told, because a docket photo that silently
 * evaporates is the exact failure this feature exists to prevent.
 */

import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import { queueDeliveryDocket } from './queueDeliveryDocket';

export interface FileDocketAfterSaveParams {
  file: File | null;
  /** The id the save resolved with — absent if the save could not report one. */
  deliveryId: string | null | undefined | void;
  projectId: string | null | undefined;
  lotId?: string;
  capturedBy: string;
}

export async function fileDocketAfterSave({
  file,
  deliveryId,
  projectId,
  lotId,
  capturedBy,
}: FileDocketAfterSaveParams): Promise<void> {
  if (!file) return;

  if (!deliveryId || !projectId) {
    logError('Delivery docket had nothing to file against', { deliveryId, projectId });
    toast({
      title: 'Delivery saved, docket was not',
      description: 'Open the delivery and add its docket again.',
      variant: 'warning',
    });
    return;
  }

  try {
    await queueDeliveryDocket({ projectId, deliveryId, file, lotId, capturedBy });
  } catch (error) {
    logError('Delivery docket could not be queued', error);
    toast({
      title: 'Delivery saved, docket was not',
      description: 'Open the delivery and add its docket again.',
      variant: 'warning',
    });
  }
}
