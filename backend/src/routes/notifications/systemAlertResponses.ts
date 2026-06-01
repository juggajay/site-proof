import type { AlertSeverity } from './alertMappers.js';

export type SystemAlertResult = {
  type: 'overdue_ncr' | 'stale_hold_point' | 'missing_diary';
  alertId: string;
  entityId?: string;
  projectName: string;
  severity: AlertSeverity;
  message: string;
};

type SystemAlertSummary = {
  overdueNCRs: number;
  staleHoldPoints: number;
  missingDiaries: number;
};

type ActiveSystemAlert = {
  id: string;
  type: string;
  severity: string;
  title: string;
  createdAt: Date;
  escalationLevel: number;
};

export function buildSystemAlertsCheckResponse(
  now: Date,
  projectsChecked: number,
  alertsGenerated: SystemAlertResult[],
  summary: SystemAlertSummary,
  activeAlerts: number,
) {
  return {
    success: true,
    timestamp: now.toISOString(),
    projectsChecked,
    alertsGenerated: alertsGenerated.length,
    summary,
    alerts: alertsGenerated,
    activeAlerts,
  };
}

export function buildSystemAlertsSummaryResponse(activeAlerts: ActiveSystemAlert[]) {
  const bySeverity = {
    critical: activeAlerts.filter((alert) => alert.severity === 'critical').length,
    high: activeAlerts.filter((alert) => alert.severity === 'high').length,
    medium: activeAlerts.filter((alert) => alert.severity === 'medium').length,
    low: activeAlerts.filter((alert) => alert.severity === 'low').length,
  };

  const byType = {
    overdue_ncr: activeAlerts.filter((alert) => alert.type === 'overdue_ncr').length,
    stale_hold_point: activeAlerts.filter((alert) => alert.type === 'stale_hold_point').length,
    pending_approval: activeAlerts.filter((alert) => alert.type === 'pending_approval').length,
    overdue_test: activeAlerts.filter((alert) => alert.type === 'overdue_test').length,
  };

  const escalated = activeAlerts.filter((alert) => alert.escalationLevel > 0).length;

  return {
    totalActive: activeAlerts.length,
    bySeverity,
    byType,
    escalated,
    criticalItems: activeAlerts
      .filter((alert) => alert.severity === 'critical')
      .slice(0, 5)
      .map((alert) => ({
        id: alert.id,
        type: alert.type,
        title: alert.title,
        createdAt: alert.createdAt,
      })),
  };
}
