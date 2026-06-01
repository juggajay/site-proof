import { describe, expect, it } from 'vitest';

import {
  buildAlertCreatedResponse,
  buildAlertEscalationCheckResponse,
  buildAlertResolvedResponse,
  buildAlertsListResponse,
  buildAlertTestEscalatedResponse,
} from './alertResponses.js';
import type { Alert } from './alertMappers.js';

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    type: 'pending_approval',
    severity: 'high',
    title: 'Pending approval',
    message: 'A docket is waiting',
    entityId: 'docket-1',
    entityType: 'docket',
    projectId: 'project-1',
    assignedTo: 'user-1',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    escalationLevel: 0,
    ...overrides,
  };
}

describe('notification alert response helpers', () => {
  it('builds the alert-created response shape', () => {
    const alert = makeAlert();

    expect(buildAlertCreatedResponse(alert)).toEqual({
      success: true,
      alert,
      message: 'Alert created successfully',
    });
  });

  it('builds the alert list response with count derived from the filtered array', () => {
    const alerts = [makeAlert(), makeAlert({ id: 'alert-2' })];

    expect(buildAlertsListResponse(alerts)).toEqual({
      alerts,
      count: 2,
    });
  });

  it('builds the alert-resolved response shape', () => {
    const alert = makeAlert({ resolvedAt: new Date('2026-06-02T00:00:00.000Z') });

    expect(buildAlertResolvedResponse(alert)).toEqual({
      success: true,
      alert,
      message: 'Alert resolved successfully',
    });
  });

  it('builds the escalation-check response with the existing count-based message', () => {
    const escalatedAlerts = [
      makeAlert({ id: 'alert-1', escalationLevel: 1 }),
      makeAlert({ id: 'alert-2', escalationLevel: 2 }),
    ];

    expect(buildAlertEscalationCheckResponse(escalatedAlerts, 5)).toEqual({
      success: true,
      message: 'Escalation check complete. 2 alerts escalated.',
      escalatedAlerts,
      totalActiveAlerts: 5,
    });
  });

  it('builds the test-escalation response and redacts recipients to id/email/role', () => {
    const alert = makeAlert({ escalationLevel: 1 });

    expect(
      buildAlertTestEscalatedResponse(
        alert,
        [
          { id: 'user-1', email: 'pm@example.com', roleInCompany: 'project_manager' },
          { id: 'user-2', email: 'owner@example.com', roleInCompany: null },
        ],
        1,
      ),
    ).toEqual({
      success: true,
      alert,
      escalatedTo: [
        { id: 'user-1', email: 'pm@example.com', roleInCompany: 'project_manager' },
        { id: 'user-2', email: 'owner@example.com', roleInCompany: null },
      ],
      message: 'Alert escalated to level 1. Notified 2 users.',
    });
  });
});
