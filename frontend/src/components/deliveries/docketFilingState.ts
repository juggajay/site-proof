/**
 * Wave C5-a — what a delivery's docket filing HONESTLY reads as, right now.
 *
 * Filing a docket from a phone is a four-step dependent chain, not an upload:
 *
 *   1. create the delivery                POST /api/diary/:diaryId/deliveries
 *   2. relink the queued photo to the server delivery id  (syncDelivery)
 *   3. upload the file                    POST /api/documents/upload
 *   4. link it as evidence                PATCH /api/deliveries/:id/evidence
 *
 * Any of the four can be the one still outstanding, and the offline queue can
 * sit on step 1 for a day. The rule this module exists to enforce is that the
 * user is never told the docket is filed until step 4 has been answered by the
 * server — `docketDocumentId` coming back on the delivery row IS that answer,
 * and it is the ONLY input that can produce `delivery_docket_filed`.
 *
 * Everything else is derived from the local queued photo, which is why a photo
 * that is still on the phone reads "Saved on device" rather than anything that
 * implies CIVOS has it.
 */

import type { OfflinePhoto } from '@/lib/offlineDb';

/** Keys in `STATUS_LABELS`; render via `formatStatusLabel`, never inline. */
export type DocketFilingStatusKey =
  | 'delivery_docket_filed'
  | 'delivery_docket_uploading'
  | 'delivery_docket_saved_on_device'
  | 'delivery_docket_filing_failed'
  | 'delivery_docket_not_filed';

export interface DocketFilingInput {
  /** Server truth. Non-null only after the evidence PATCH returned 200. */
  docketDocumentId?: string | null;
  /** The queued docket photo for this delivery, if one is still on the device. */
  photo?: Pick<OfflinePhoto, 'syncStatus'> | null;
  isOnline: boolean;
}

export function docketFilingStatusKey({
  docketDocumentId,
  photo,
  isOnline,
}: DocketFilingInput): DocketFilingStatusKey {
  // Server truth first and unconditionally: once the evidence link exists, the
  // docket is filed even if a second capture is mid-flight behind it.
  if (docketDocumentId) return 'delivery_docket_filed';

  if (photo?.syncStatus === 'error') return 'delivery_docket_filing_failed';

  // Pending covers steps 1-4 alike. Online it is moving; offline it is not, and
  // saying "Uploading" to a foreman with no bars is the lie this whole module
  // is written to avoid.
  if (photo?.syncStatus === 'pending') {
    return isOnline ? 'delivery_docket_uploading' : 'delivery_docket_saved_on_device';
  }

  // A photo marked 'synced' with no docketDocumentId on the delivery cannot
  // claim anything: the row we were handed is simply older than the PATCH.
  return 'delivery_docket_not_filed';
}

/** True when the row still needs a docket — i.e. the "File docket" action applies. */
export function needsDocketFiling(key: DocketFilingStatusKey): boolean {
  return key === 'delivery_docket_not_filed' || key === 'delivery_docket_filing_failed';
}

/**
 * Chip tone. `not_filed` is deliberately NEUTRAL on an editable row and only
 * warns once the diary is locked: before submission it is an ordinary "not done
 * yet", after submission it is the thing that will still be missing at handover.
 */
export function docketChipTone(
  key: DocketFilingStatusKey,
): 'neutral' | 'warning' | 'danger' | 'success' | 'info' {
  switch (key) {
    case 'delivery_docket_filed':
      return 'success';
    case 'delivery_docket_uploading':
      return 'info';
    case 'delivery_docket_saved_on_device':
      return 'warning';
    case 'delivery_docket_filing_failed':
      return 'danger';
    default:
      return 'neutral';
  }
}
