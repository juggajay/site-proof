import { AppError } from '../../lib/AppError.js';
import { isDisallowedWebhookHost, resolvePublicWebhookAddresses } from './destinationSafety.js';
import { isSupportedWebhookEvent, SUPPORTED_WEBHOOK_EVENTS } from './eventCatalog.js';

const MAX_WEBHOOK_URL_LENGTH = 2048;
const MAX_WEBHOOK_ID_LENGTH = 120;
const MAX_WEBHOOK_EVENTS = 50;
const MAX_WEBHOOK_EVENT_LENGTH = 100;
const WEBHOOK_EVENT_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/i;

export function parseLimit(value: unknown, defaultValue: number, maxValue = 100): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  return Math.min(parsed, maxValue);
}

export function parseWebhookRouteId(value: unknown, fieldName = 'id'): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_WEBHOOK_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} must be ${MAX_WEBHOOK_ID_LENGTH} characters or less`);
  }

  return trimmed;
}

export function parseStoredEvents(events: string): string[] {
  try {
    const parsed: unknown = JSON.parse(events);
    if (Array.isArray(parsed) && parsed.every((event) => typeof event === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to the safest subscription below.
  }
  return [];
}

export function normalizeEvents(events: unknown): string[] {
  if (events === undefined) {
    return ['*'];
  }
  if (!Array.isArray(events)) {
    throw AppError.badRequest('events must be an array of strings');
  }
  const normalized = events
    .map((event) => (typeof event === 'string' ? event.trim() : ''))
    .filter(Boolean);

  if (normalized.length === 0) {
    throw AppError.badRequest('events must include at least one event name');
  }
  if (normalized.length > MAX_WEBHOOK_EVENTS) {
    throw AppError.badRequest(`events cannot include more than ${MAX_WEBHOOK_EVENTS} entries`);
  }
  if (
    normalized.some(
      (event) =>
        event !== '*' &&
        (event.length > MAX_WEBHOOK_EVENT_LENGTH || !WEBHOOK_EVENT_PATTERN.test(event)),
    )
  ) {
    throw AppError.badRequest('events contains an invalid event name');
  }
  const unsupportedEvents = normalized.filter(
    (event) => event !== '*' && !isSupportedWebhookEvent(event),
  );
  if (unsupportedEvents.length > 0) {
    throw AppError.badRequest(
      `events contains unsupported event name(s): ${unsupportedEvents.join(', ')}. Supported events are: *, ${SUPPORTED_WEBHOOK_EVENTS.join(', ')}`,
    );
  }

  return Array.from(new Set(normalized));
}

export function normalizeWebhookUrl(value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw AppError.badRequest('URL is required');
  }

  const trimmed = value.trim();
  if (trimmed.length > MAX_WEBHOOK_URL_LENGTH) {
    throw AppError.badRequest(`URL must be ${MAX_WEBHOOK_URL_LENGTH} characters or less`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw AppError.badRequest('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw AppError.badRequest('Invalid URL protocol');
  }

  if (parsed.username || parsed.password) {
    throw AppError.badRequest('Webhook URL credentials are not allowed');
  }

  if (process.env.NODE_ENV === 'production') {
    if (parsed.protocol !== 'https:') {
      throw AppError.badRequest('Webhook URLs must use HTTPS in production');
    }
    if (isDisallowedWebhookHost(parsed.hostname)) {
      throw AppError.badRequest('Webhook URL host is not allowed');
    }
  }

  return parsed.toString();
}

export async function assertWebhookDestinationResolvesPublicly(webhookUrl: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const parsed = new URL(webhookUrl);
  await resolvePublicWebhookAddresses(parsed.hostname);
}

export function serializeEvents(events: string[]): string {
  return JSON.stringify(events);
}
