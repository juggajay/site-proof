import { describe, expect, it } from 'vitest';
import type { NotificationAlert as NotificationAlertRecord } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import {
  generateAlertId,
  parseAlertSeverity,
  parseAlertStatusFilter,
  parseAlertType,
  parseEscalatedTo,
  parseOptionalAlertType,
  toAlert,
} from './alertMappers.js';

// DB-free coverage of the alert parsing/mapping helpers. alertMappers.ts pulls
// in no Prisma runtime (only types) and no database, so the pure helpers are
// exercised directly. The alert creation/update DB helpers stay in
// notifications.ts and are covered by the route suite in CI.

function expectBadRequest(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`expected AppError to be thrown for: ${message}`);
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as Error).message).toBe(message);
  }
}

function makeRecord(overrides: Partial<NotificationAlertRecord> = {}): NotificationAlertRecord {
  return {
    id: 'alert-1',
    type: 'overdue_ncr',
    severity: 'high',
    title: 'NCR overdue',
    message: 'A non-conformance is overdue',
    entityId: 'ncr-1',
    entityType: 'ncr',
    projectId: 'project-1',
    assignedToId: 'user-1',
    createdAt: new Date('2026-06-01T03:00:00.000Z'),
    resolvedAt: null,
    escalatedAt: null,
    escalationLevel: 0,
    escalatedTo: null,
    ...overrides,
  } as NotificationAlertRecord;
}

describe('parseAlertType', () => {
  it('returns each allowed alert type unchanged', () => {
    for (const type of ['overdue_ncr', 'stale_hold_point', 'pending_approval', 'overdue_test']) {
      expect(parseAlertType(type)).toBe(type);
    }
  });

  it('throws Invalid alert type for unknown strings and non-strings', () => {
    expectBadRequest(() => parseAlertType('bogus'), 'Invalid alert type');
    expectBadRequest(() => parseAlertType(''), 'Invalid alert type');
    expectBadRequest(() => parseAlertType(123), 'Invalid alert type');
    expectBadRequest(() => parseAlertType(null), 'Invalid alert type');
    expectBadRequest(() => parseAlertType(undefined), 'Invalid alert type');
  });
});

describe('parseOptionalAlertType', () => {
  it('returns undefined for empty/missing values', () => {
    expect(parseOptionalAlertType(undefined)).toBeUndefined();
    expect(parseOptionalAlertType(null)).toBeUndefined();
    expect(parseOptionalAlertType('')).toBeUndefined();
  });

  it('returns the parsed alert type for valid values', () => {
    expect(parseOptionalAlertType('pending_approval')).toBe('pending_approval');
  });

  it('throws Invalid alert type for present-but-invalid values', () => {
    expectBadRequest(() => parseOptionalAlertType('bogus'), 'Invalid alert type');
  });
});

describe('parseAlertStatusFilter', () => {
  it('returns undefined for empty/missing values', () => {
    expect(parseAlertStatusFilter(undefined)).toBeUndefined();
    expect(parseAlertStatusFilter(null)).toBeUndefined();
    expect(parseAlertStatusFilter('')).toBeUndefined();
  });

  it('returns each allowed status filter unchanged', () => {
    for (const status of ['active', 'resolved', 'escalated']) {
      expect(parseAlertStatusFilter(status)).toBe(status);
    }
  });

  it('throws Invalid alert status for unknown values', () => {
    expectBadRequest(() => parseAlertStatusFilter('archived'), 'Invalid alert status');
  });
});

describe('parseAlertSeverity', () => {
  it('defaults to medium for empty/missing values', () => {
    expect(parseAlertSeverity(undefined)).toBe('medium');
    expect(parseAlertSeverity(null)).toBe('medium');
    expect(parseAlertSeverity('')).toBe('medium');
  });

  it('returns each allowed severity unchanged', () => {
    for (const severity of ['low', 'medium', 'high', 'critical']) {
      expect(parseAlertSeverity(severity)).toBe(severity);
    }
  });

  it('throws Invalid alert severity for unknown/non-string values', () => {
    expectBadRequest(() => parseAlertSeverity('urgent'), 'Invalid alert severity');
    expectBadRequest(() => parseAlertSeverity(5), 'Invalid alert severity');
  });
});

describe('parseEscalatedTo', () => {
  it('returns undefined for non-array inputs', () => {
    expect(parseEscalatedTo(null)).toBeUndefined();
    expect(parseEscalatedTo('user-1')).toBeUndefined();
    expect(parseEscalatedTo({ a: 1 })).toBeUndefined();
    expect(parseEscalatedTo(42)).toBeUndefined();
  });

  it('keeps only string members of an array', () => {
    expect(parseEscalatedTo(['user-1', 'user-2'])).toEqual(['user-1', 'user-2']);
    expect(parseEscalatedTo(['user-1', 7, null, 'user-3'])).toEqual(['user-1', 'user-3']);
  });

  it('returns undefined when an array has no string members', () => {
    expect(parseEscalatedTo([])).toBeUndefined();
    expect(parseEscalatedTo([1, 2, null])).toBeUndefined();
  });
});

describe('toAlert', () => {
  it('maps a record to an Alert, parsing type/severity/escalatedTo', () => {
    const createdAt = new Date('2026-06-01T03:00:00.000Z');
    const resolvedAt = new Date('2026-06-02T03:00:00.000Z');
    const escalatedAt = new Date('2026-06-01T07:00:00.000Z');

    const alert = toAlert(
      makeRecord({
        createdAt,
        resolvedAt,
        escalatedAt,
        escalationLevel: 2,
        escalatedTo: ['user-2', 'user-3'],
      }),
    );

    expect(alert).toEqual({
      id: 'alert-1',
      type: 'overdue_ncr',
      severity: 'high',
      title: 'NCR overdue',
      message: 'A non-conformance is overdue',
      entityId: 'ncr-1',
      entityType: 'ncr',
      projectId: 'project-1',
      assignedTo: 'user-1',
      createdAt,
      resolvedAt,
      escalatedAt,
      escalationLevel: 2,
      escalatedTo: ['user-2', 'user-3'],
    });
  });

  it('coerces null projectId/resolvedAt/escalatedAt and empty escalatedTo to undefined', () => {
    const alert = toAlert(
      makeRecord({ projectId: null, resolvedAt: null, escalatedAt: null, escalatedTo: null }),
    );

    expect(alert.projectId).toBeUndefined();
    expect(alert.resolvedAt).toBeUndefined();
    expect(alert.escalatedAt).toBeUndefined();
    expect(alert.escalatedTo).toBeUndefined();
    // assignedTo is mapped from the record's assignedToId column.
    expect(alert.assignedTo).toBe('user-1');
  });
});

describe('generateAlertId', () => {
  it('produces an "alert-"-prefixed unique id', () => {
    const id = generateAlertId();
    expect(id).toMatch(/^alert-[0-9a-f-]{36}$/);
    expect(generateAlertId()).not.toBe(id);
  });
});
