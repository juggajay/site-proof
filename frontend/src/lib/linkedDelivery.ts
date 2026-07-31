/**
 * C5.4a — how an NCR's linked delivery reads, in the create picker, on the NCR
 * detail and in the NCR detail PDF.
 *
 * A delivery has no date of its own; the diary it was recorded in supplies it.
 * The date is pinned to `DEFAULT_APP_TIME_ZONE` rather than the reader's, so a
 * delivery recorded on the 11th never renders as the 10th for a reader in
 * another timezone — and so the PDF characterization asserts stay stable.
 */

import { DEFAULT_APP_TIME_ZONE } from './localDate';

export interface LinkedDeliverySummary {
  id: string;
  description: string;
  supplier: string | null;
  docketNumber: string | null;
  diary: { id: string; date: string };
}

export function formatDeliveryDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString('en-AU', {
    timeZone: DEFAULT_APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** e.g. `Boral — 32 MPa concrete · docket DK-1180 · 11/08/2026` */
export function formatDeliveryLabel(delivery: LinkedDeliverySummary): string {
  const parts = [
    delivery.supplier ? `${delivery.supplier} — ${delivery.description}` : delivery.description,
    delivery.docketNumber ? `docket ${delivery.docketNumber}` : null,
    formatDeliveryDate(delivery.diary.date),
  ];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}
