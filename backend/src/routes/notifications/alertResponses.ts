import type { Alert } from './alertMappers.js';

type EscalationRecipient = {
  id: string;
  email: string;
  roleInCompany: string | null;
};

export function buildAlertCreatedResponse(alert: Alert) {
  return {
    success: true,
    alert,
    message: 'Alert created successfully',
  };
}

export function buildAlertsListResponse(alerts: Alert[]) {
  return {
    alerts,
    count: alerts.length,
  };
}

export function buildAlertResolvedResponse(alert: Alert) {
  return {
    success: true,
    alert,
    message: 'Alert resolved successfully',
  };
}

export function buildAlertEscalationCheckResponse(
  escalatedAlerts: Alert[],
  totalActiveAlerts: number,
) {
  return {
    success: true,
    message: `Escalation check complete. ${escalatedAlerts.length} alerts escalated.`,
    escalatedAlerts,
    totalActiveAlerts,
  };
}

export function buildAlertTestEscalatedResponse(
  alert: Alert,
  escalationUsers: EscalationRecipient[],
  newLevel: number,
) {
  return {
    success: true,
    alert,
    escalatedTo: escalationUsers.map((user) => ({
      id: user.id,
      email: user.email,
      roleInCompany: user.roleInCompany,
    })),
    message: `Alert escalated to level ${newLevel}. Notified ${escalationUsers.length} users.`,
  };
}
