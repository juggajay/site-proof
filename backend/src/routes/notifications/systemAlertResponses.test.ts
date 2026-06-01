import { describe, expect, it } from 'vitest';

import {
  buildSystemAlertsCheckResponse,
  buildSystemAlertsSummaryResponse,
  type SystemAlertResult,
} from './systemAlertResponses.js';

describe('system alert response helpers', () => {
  it('preserves the system-alert check response shape', () => {
    const now = new Date('2026-06-01T01:02:03.000Z');
    const alerts: SystemAlertResult[] = [
      {
        type: 'overdue_ncr',
        alertId: 'alert-1',
        entityId: 'ncr-1',
        projectName: 'Gateway Upgrade',
        severity: 'critical',
        message: 'NCR is overdue',
      },
    ];
    const summary = { overdueNCRs: 1, staleHoldPoints: 0, missingDiaries: 0 };

    expect(buildSystemAlertsCheckResponse(now, 3, alerts, summary, 4)).toEqual({
      success: true,
      timestamp: '2026-06-01T01:02:03.000Z',
      projectsChecked: 3,
      alertsGenerated: 1,
      summary,
      alerts,
      activeAlerts: 4,
    });
  });

  it('preserves the active system-alert summary buckets and critical item limit', () => {
    const criticalAlerts = Array.from({ length: 6 }, (_, index) => ({
      id: `critical-${index + 1}`,
      type: 'overdue_ncr',
      severity: 'critical',
      title: `Critical ${index + 1}`,
      createdAt: new Date(`2026-06-0${Math.min(index + 1, 9)}T00:00:00.000Z`),
      escalationLevel: index === 0 ? 1 : 0,
    }));
    const alerts = [
      ...criticalAlerts,
      {
        id: 'high-1',
        type: 'stale_hold_point',
        severity: 'high',
        title: 'High',
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
        escalationLevel: 2,
      },
      {
        id: 'medium-1',
        type: 'pending_approval',
        severity: 'medium',
        title: 'Medium',
        createdAt: new Date('2026-06-11T00:00:00.000Z'),
        escalationLevel: 0,
      },
      {
        id: 'low-1',
        type: 'overdue_test',
        severity: 'low',
        title: 'Low',
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
        escalationLevel: 0,
      },
    ];

    expect(buildSystemAlertsSummaryResponse(alerts)).toEqual({
      totalActive: 9,
      bySeverity: { critical: 6, high: 1, medium: 1, low: 1 },
      byType: { overdue_ncr: 6, stale_hold_point: 1, pending_approval: 1, overdue_test: 1 },
      escalated: 2,
      criticalItems: criticalAlerts.slice(0, 5).map((alert) => ({
        id: alert.id,
        type: alert.type,
        title: alert.title,
        createdAt: alert.createdAt,
      })),
    });
  });
});
