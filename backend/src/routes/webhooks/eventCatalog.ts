export const SUPPORTED_WEBHOOK_EVENTS = [
  'lot.created',
  'lot.updated',
  'lot.deleted',
  'hold_point.release_requested',
  'hold_point.released',
  'ncr.created',
  'ncr.closed',
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

const supportedWebhookEventSet = new Set<string>(SUPPORTED_WEBHOOK_EVENTS);

export function isSupportedWebhookEvent(event: string): event is SupportedWebhookEvent {
  return supportedWebhookEventSet.has(event);
}
