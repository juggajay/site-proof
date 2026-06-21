import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationAlert as NotificationAlertRecord } from '@prisma/client';

import type { Alert } from './alertMappers.js';
import { ESCALATION_CONFIG, createAlertRecord, updateAlertEscalation } from './alertPersistence.js';

// DB-free coverage of the alert persistence/config seam. ESCALATION_CONFIG is
// pure data and frozen directly. createAlertRecord/updateAlertEscalation use the
// module-level prisma singleton, so we mock '../../lib/prisma.js' with vitest
// spies (via vi.hoisted, so they exist before the hoisted vi.mock factory runs)
// and assert the exact create/update payloads. toAlert runs for real (it pulls
// in no database), so the returned Alert shape is also verified. The DB-backed
// behaviour is additionally covered by the notifications route suite in CI.

const { create, update } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    notificationAlert: { create, update },
  },
}));

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    type: 'overdue_ncr',
    severity: 'high',
    title: 'NCR overdue',
    message: 'A non-conformance is overdue',
    entityId: 'ncr-1',
    entityType: 'ncr',
    projectId: 'project-1',
    assignedTo: 'user-1',
    createdAt: new Date('2026-06-01T03:00:00.000Z'),
    resolvedAt: undefined,
    escalatedAt: undefined,
    escalationLevel: 0,
    escalatedTo: undefined,
    ...overrides,
  };
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

describe('ESCALATION_CONFIG', () => {
  it('matches the exact escalation timing and roles for every alert type', () => {
    expect(ESCALATION_CONFIG).toEqual({
      overdue_ncr: {
        firstEscalationAfterHours: 24,
        secondEscalationAfterHours: 48,
        escalationRoles: ['project_manager', 'quality_manager', 'admin'],
      },
      stale_hold_point: {
        firstEscalationAfterHours: 4,
        secondEscalationAfterHours: 8,
        escalationRoles: [
          'project_manager',
          'quality_manager',
          'site_manager',
          'site_engineer',
          'superintendent',
          'admin',
        ],
      },
      pending_approval: {
        firstEscalationAfterHours: 8,
        secondEscalationAfterHours: 24,
        escalationRoles: ['project_manager', 'admin'],
      },
      overdue_test: {
        firstEscalationAfterHours: 48,
        secondEscalationAfterHours: 96,
        escalationRoles: ['quality_manager', 'project_manager'],
      },
    });
  });
});

describe('createAlertRecord', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists a fully-populated alert and returns the mapped record', async () => {
    const createdAt = new Date('2026-06-01T03:00:00.000Z');
    const escalatedAt = new Date('2026-06-01T07:00:00.000Z');
    const record = makeRecord({
      createdAt,
      escalatedAt,
      escalationLevel: 1,
      escalatedTo: ['user-2'],
    });
    create.mockResolvedValue(record);

    const result = await createAlertRecord(
      makeAlert({ createdAt, escalatedAt, escalationLevel: 1, escalatedTo: ['user-2'] }),
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toEqual({
      data: {
        id: 'alert-1',
        type: 'overdue_ncr',
        severity: 'high',
        title: 'NCR overdue',
        message: 'A non-conformance is overdue',
        entityId: 'ncr-1',
        entityType: 'ncr',
        projectId: 'project-1',
        assignedToId: 'user-1',
        createdAt,
        resolvedAt: null,
        escalatedAt,
        escalationLevel: 1,
        escalatedTo: ['user-2'],
      },
    });
    // Returned through toAlert: assignedTo comes from assignedToId, escalatedTo parsed.
    expect(result.id).toBe('alert-1');
    expect(result.assignedTo).toBe('user-1');
    expect(result.escalatedTo).toEqual(['user-2']);
  });

  it('coerces missing optional fields to null (projectId/resolvedAt/escalatedAt) and escalatedTo to undefined', async () => {
    create.mockResolvedValue(makeRecord());

    await createAlertRecord(
      makeAlert({
        projectId: undefined,
        resolvedAt: undefined,
        escalatedAt: undefined,
        escalatedTo: undefined,
      }),
    );

    const data = create.mock.calls[0][0].data;
    expect(data.projectId).toBeNull();
    expect(data.resolvedAt).toBeNull();
    expect(data.escalatedAt).toBeNull();
    expect(data.escalatedTo).toBeUndefined();
  });
});

describe('updateAlertEscalation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates only the escalation fields by id and returns the mapped record', async () => {
    const escalatedAt = new Date('2026-06-01T07:00:00.000Z');
    update.mockResolvedValue(
      makeRecord({ escalationLevel: 2, escalatedAt, escalatedTo: ['user-2', 'user-3'] }),
    );

    const result = await updateAlertEscalation('alert-1', 2, escalatedAt, ['user-2', 'user-3']);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: {
        escalationLevel: 2,
        escalatedAt,
        escalatedTo: ['user-2', 'user-3'],
      },
    });
    expect(result.escalationLevel).toBe(2);
    expect(result.escalatedTo).toEqual(['user-2', 'user-3']);
  });
});
