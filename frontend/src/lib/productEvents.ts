// Privacy-conscious client telemetry transport.
//
// trackEvent() queues events in memory; they flush batched to
// POST /api/product-events on an interval and on pagehide. Fire-and-forget:
// failures are swallowed and never surfaced, and there are no retries beyond
// the single keepalive attempt on page unload. Only office surfaces call
// trackEvent, and the flusher is mounted only in the office shell
// (ProtectedAppShell) — field shells (/m/*, /p/*) never emit.
//
// We use fetch({ keepalive }) rather than navigator.sendBeacon because the API
// authenticates via an Authorization: Bearer header, which sendBeacon cannot
// set. keepalive gives the same survives-page-unload behaviour while carrying
// the auth header. We deliberately do NOT use apiFetch here: its 401 handling
// bounces the user to the login screen, which telemetry must never trigger.

import { getAuthToken } from './api';
import { apiUrl } from './config';

export type ProductEventMetadata = {
  activityType?: string;
  usedSuggestedTemplate?: boolean;
};

type QueuedEvent = {
  event: string;
  step?: string;
  metadata?: ProductEventMetadata;
  clientTs: string;
};

const MAX_BATCH = 20;
const queue: QueuedEvent[] = [];

/** Queue a product event. Flushes eagerly once a full batch has accumulated. */
export function trackEvent(event: string, step?: string, metadata?: ProductEventMetadata): void {
  queue.push({ event, step, metadata, clientTs: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) {
    void flushProductEvents();
  }
}

async function postBatch(events: QueuedEvent[], keepalive: boolean): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    await fetch(apiUrl('/api/product-events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
      keepalive,
    });
  } catch {
    // Silent: telemetry must never surface to the user. Dropped events are
    // acceptable — this is best-effort UX instrumentation, not a ledger.
  }
}

/** Flush up to one batch. `keepalive` for the pagehide path. */
export async function flushProductEvents(keepalive = false): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  await postBatch(batch, keepalive);
}

/** Test-only: drain the queue without sending. */
export function __resetProductEventsQueueForTest(): void {
  queue.length = 0;
}
