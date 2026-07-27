import crypto from 'crypto';
import type { NotificationAlert as NotificationAlertRecord, Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { logWarn } from '../../lib/serverLogger.js';
import { MAX_NOTIFICATION_FILTER_LENGTH, parseOptionalString } from './validation.js';

/**
 * Notification alert parsing/mapping helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * Covers the alert value objects (AlertType/AlertSeverity/Alert), the allowed-
 * value constants, the request parsers (type, optional type, status filter,
 * severity), the escalatedTo JSON coercion, the record→Alert mapper, and the
 * alert-id generator. Behaviour — the exact defaults, allowed values, AppError
 * messages/codes, escalatedTo parsing, generated id format, and the toAlert
 * output shape — is preserved exactly as it was inline in the route file. The
 * pure helpers are unit-tested in alertMappers.test.ts. The alert
 * creation/update DB helpers stay in notifications.ts and import toAlert back.
 */

// Alert types that can be escalated
export type AlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval';

// Alert severity levels
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// Alert interface
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityId: string; // ID of the related entity (NCR, hold point, etc.)
  entityType: string;
  projectId?: string;
  assignedTo: string; // User ID who should resolve this
  createdAt: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
  escalationLevel: number; // 0 = not escalated, 1 = first escalation, 2 = second, etc.
  escalatedTo?: string[]; // User IDs of escalation recipients
}

const ALERT_TYPES: AlertType[] = ['overdue_ncr', 'stale_hold_point', 'pending_approval'];
const ALERT_SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
const ALERT_STATUS_FILTERS = ['active', 'resolved', 'escalated'] as const;
type AlertStatusFilter = (typeof ALERT_STATUS_FILTERS)[number];

function isAlertType(value: unknown): value is AlertType {
  return typeof value === 'string' && ALERT_TYPES.includes(value as AlertType);
}

export function parseAlertType(value: unknown): AlertType {
  if (isAlertType(value)) {
    return value;
  }
  throw AppError.badRequest('Invalid alert type');
}

export function parseOptionalAlertType(value: unknown): AlertType | undefined {
  const parsed = parseOptionalString(value, 'type', MAX_NOTIFICATION_FILTER_LENGTH);
  if (!parsed) {
    return undefined;
  }

  return parseAlertType(parsed);
}

export function parseAlertStatusFilter(value: unknown): AlertStatusFilter | undefined {
  const parsed = parseOptionalString(value, 'status', 20);
  if (!parsed) {
    return undefined;
  }

  if (!ALERT_STATUS_FILTERS.includes(parsed as AlertStatusFilter)) {
    throw AppError.badRequest('Invalid alert status');
  }

  return parsed as AlertStatusFilter;
}

export function parseAlertSeverity(value: unknown): AlertSeverity {
  if (value === undefined || value === null || value === '') {
    return 'medium';
  }
  if (typeof value === 'string' && ALERT_SEVERITIES.includes(value as AlertSeverity)) {
    return value as AlertSeverity;
  }
  throw AppError.badRequest('Invalid alert severity');
}

export function parseEscalatedTo(value: Prisma.JsonValue | null): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const userIds = value.filter((item): item is string => typeof item === 'string');
  return userIds.length > 0 ? userIds : undefined;
}

/**
 * Maps a stored alert row to an Alert, or returns `null` when the row's `type`
 * is no longer a known AlertType (a retired/legacy type left behind in the DB).
 *
 * Skip-and-log, not throw: toAlert is mapped over whole alert lists, so a
 * throwing mapper turns one stale row into a 400 for the entire list. Callers
 * in list context drop the row; single-record callers treat it as not found.
 * `severity` stays strict — no severity value has ever been retired.
 */
export function toAlert(record: NotificationAlertRecord): Alert | null {
  if (!isAlertType(record.type)) {
    logWarn('Skipping notification alert with unknown type', {
      alertId: record.id,
      type: record.type,
    });
    return null;
  }

  return {
    id: record.id,
    type: record.type,
    severity: parseAlertSeverity(record.severity),
    title: record.title,
    message: record.message,
    entityId: record.entityId,
    entityType: record.entityType,
    projectId: record.projectId ?? undefined,
    assignedTo: record.assignedToId,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt ?? undefined,
    escalatedAt: record.escalatedAt ?? undefined,
    escalationLevel: record.escalationLevel,
    escalatedTo: parseEscalatedTo(record.escalatedTo),
  };
}

// Generate unique alert ID
export function generateAlertId(): string {
  return `alert-${crypto.randomUUID()}`;
}
