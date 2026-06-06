import crypto from 'crypto';
import type { AuthRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const PUSH_ENDPOINT_MAX_LENGTH = 2048;
const PUSH_KEY_MAX_LENGTH = 512;
export const PUSH_MESSAGE_TITLE_MAX_LENGTH = 120;
export const PUSH_MESSAGE_BODY_MAX_LENGTH = 500;
const PUSH_MESSAGE_URL_MAX_LENGTH = 2048;
export const PUSH_MESSAGE_TAG_MAX_LENGTH = 128;
const PUSH_USER_AGENT_MAX_LENGTH = 512;
const PUSH_DATA_MAX_BYTES = 2048;
const PUSH_DATA_MAX_DEPTH = 5;
const PUSH_SUBSCRIPTION_ID_PATTERN = /^[a-f0-9]{64}$/i;
const RESERVED_PUSH_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_PUSH_ENDPOINT_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
]);
const ALLOWED_PUSH_ENDPOINT_SUFFIXES = ['.push.apple.com'];

export function getSubscriptionId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export function getRequestUserAgent(req: AuthRequest): string | undefined {
  const userAgent = req.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, PUSH_USER_AGENT_MAX_LENGTH) : undefined;
}

export function isPrivatePushEndpointHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) {
      return true;
    }

    const [first, second] = octets as [number, number, number, number];
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }

  if (!host.includes(':')) {
    return false;
  }

  return (
    host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
  );
}

export function normalizeEndpointHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

export function isAllowedPushEndpointHost(hostname: string): boolean {
  const host = normalizeEndpointHostname(hostname);

  return (
    ALLOWED_PUSH_ENDPOINT_HOSTS.has(host) ||
    ALLOWED_PUSH_ENDPOINT_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

export function parseEndpoint(endpoint: unknown): string {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw AppError.badRequest('Endpoint is required');
  }

  const normalizedEndpoint = endpoint.trim();
  if (normalizedEndpoint.length > PUSH_ENDPOINT_MAX_LENGTH) {
    throw AppError.badRequest('Endpoint is too long');
  }

  try {
    const endpointUrl = new URL(normalizedEndpoint);
    if (endpointUrl.protocol !== 'https:') {
      throw AppError.badRequest('Endpoint must be an HTTPS URL');
    }
    if (endpointUrl.username || endpointUrl.password) {
      throw AppError.badRequest('Endpoint must not include credentials');
    }
    if (endpointUrl.hash) {
      throw AppError.badRequest('Endpoint must not include a URL fragment');
    }
    if (endpointUrl.port || isPrivatePushEndpointHost(endpointUrl.hostname)) {
      throw AppError.badRequest('Endpoint host is not allowed');
    }
    if (!isAllowedPushEndpointHost(endpointUrl.hostname)) {
      throw AppError.badRequest('Endpoint host is not allowed');
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.badRequest('Endpoint must be a valid URL');
  }

  return normalizedEndpoint;
}

export function parseRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

export function parseOptionalString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

export function parseNotificationUrl(value: unknown): string | undefined {
  const normalized = parseOptionalString(value, 'url', PUSH_MESSAGE_URL_MAX_LENGTH);
  if (!normalized) {
    return undefined;
  }

  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    containsControlCharacter(normalized)
  ) {
    throw AppError.badRequest('url must be an app-relative path');
  }

  return normalized;
}

function assertJsonCompatiblePushData(value: unknown, depth: number): void {
  if (depth > PUSH_DATA_MAX_DEPTH) {
    throw AppError.badRequest('data is too deeply nested');
  }

  if (value === null) {
    return;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') {
    return;
  }

  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw AppError.badRequest('data must contain only finite numbers');
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertJsonCompatiblePushData(entry, depth + 1);
    }
    return;
  }

  if (valueType === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (RESERVED_PUSH_DATA_KEYS.has(key)) {
        throw AppError.badRequest('data contains a reserved key');
      }
      assertJsonCompatiblePushData(entry, depth + 1);
    }
    return;
  }

  throw AppError.badRequest('data must be JSON-serializable');
}

export function parseOptionalData(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest('data must be an object');
  }

  const data = value as Record<string, unknown>;
  assertJsonCompatiblePushData(data, 0);

  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    throw AppError.badRequest('data must be JSON-serializable');
  }

  if (Buffer.byteLength(serialized, 'utf8') > PUSH_DATA_MAX_BYTES) {
    throw AppError.badRequest(`data must be ${PUSH_DATA_MAX_BYTES} bytes or fewer`);
  }

  return data;
}

export function parseOptionalSubscriptionId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw AppError.badRequest('subscriptionId must be a string');
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('subscriptionId must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!PUSH_SUBSCRIPTION_ID_PATTERN.test(normalized)) {
    throw AppError.badRequest('subscriptionId must be a valid push subscription id');
  }

  return normalized.toLowerCase();
}

export function parsePushSubscription(subscription: unknown): PushSubscriptionPayload {
  if (!subscription || typeof subscription !== 'object') {
    throw AppError.badRequest('Invalid subscription object');
  }

  const candidate = subscription as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };

  if (
    typeof candidate.endpoint !== 'string' ||
    !candidate.endpoint.trim() ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== 'string' ||
    typeof candidate.keys.auth !== 'string' ||
    !candidate.keys.p256dh.trim() ||
    !candidate.keys.auth.trim() ||
    candidate.keys.p256dh.length > PUSH_KEY_MAX_LENGTH ||
    candidate.keys.auth.length > PUSH_KEY_MAX_LENGTH
  ) {
    throw AppError.badRequest('Invalid subscription object');
  }
  const endpoint = parseEndpoint(candidate.endpoint);

  return {
    endpoint,
    keys: {
      p256dh: candidate.keys.p256dh.trim(),
      auth: candidate.keys.auth.trim(),
    },
  };
}
