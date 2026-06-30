/**
 * Data + pure helpers for the company webhooks section (finding H22, part 2).
 *
 * The list (GET /api/webhooks) masks the secret; the raw secret is only ever
 * returned once on create and on regenerate, and is revealed to the admin in a
 * one-time modal (never stored client-side).
 */
import { apiFetch } from '@/lib/api';

export interface CompanyWebhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface WebhooksListResponse {
  webhooks: CompanyWebhook[];
}

export interface WebhookCreatedResponse {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  message: string;
}

export interface WebhookSecretResponse {
  id: string;
  secret: string;
  message: string;
}

export interface WebhookTestResponse {
  success: boolean;
  deliveryId: string;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
}

export function formatWebhookEvents(events: string[] | undefined): string {
  if (!events || events.length === 0) {
    return 'No events';
  }
  if (events.includes('*')) {
    return 'All supported events';
  }
  return events.join(', ');
}

export function describeWebhookStatus(enabled: boolean): 'Enabled' | 'Disabled' {
  return enabled ? 'Enabled' : 'Disabled';
}

export function summarizeWebhookTest(result: WebhookTestResponse): string {
  if (result.success) {
    return `Test delivered${result.responseStatus ? ` (HTTP ${result.responseStatus})` : ''}`;
  }
  return `Test failed: ${result.error || `HTTP ${result.responseStatus ?? 'error'}`}`;
}

export function fetchWebhooks() {
  return apiFetch<WebhooksListResponse>('/api/webhooks');
}

export function createWebhook(body: { url: string; events: string[] }) {
  return apiFetch<WebhookCreatedResponse>('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function setWebhookEnabled(id: string, enabled: boolean) {
  return apiFetch<CompanyWebhook>(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteWebhook(id: string) {
  return apiFetch<{ message?: string }>(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function regenerateWebhookSecret(id: string) {
  return apiFetch<WebhookSecretResponse>(
    `/api/webhooks/${encodeURIComponent(id)}/regenerate-secret`,
    { method: 'POST' },
  );
}

export function testWebhook(id: string) {
  return apiFetch<WebhookTestResponse>(`/api/webhooks/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
}
