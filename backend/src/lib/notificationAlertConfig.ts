/**
 * Alert recipient and escalation configuration shared by manual notification
 * routes and scheduled notification automation.
 */

import type { NotificationTypeWithTiming } from './notificationAutomation/preferences.js';

export type AlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval' | 'overdue_test';

export type AlertEscalationConfig = {
  firstEscalationAfterHours: number;
  secondEscalationAfterHours: number;
  escalationRoles: string[];
};

export const STALE_HOLD_POINT_ALERT_ROLES = [
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  // Keep the legacy/project-specific superintendent role for existing data and
  // hold-point release flows, but do not rely on it exclusively.
  'superintendent',
];

export const STALE_HOLD_POINT_ESCALATION_ROLES = [...STALE_HOLD_POINT_ALERT_ROLES, 'admin'];

export const ALERT_ESCALATION_CONFIG: Record<AlertType, AlertEscalationConfig> = {
  overdue_ncr: {
    firstEscalationAfterHours: 24,
    secondEscalationAfterHours: 48,
    escalationRoles: ['project_manager', 'quality_manager', 'admin'],
  },
  stale_hold_point: {
    firstEscalationAfterHours: 4,
    secondEscalationAfterHours: 8,
    escalationRoles: STALE_HOLD_POINT_ESCALATION_ROLES,
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
};

function normalizeAlertEntityType(entityType: string | null | undefined): string {
  return (entityType ?? '').toLowerCase().replace(/[\s-]/g, '_');
}

export function getAlertEmailNotificationType(alert: {
  type: string;
  entityType?: string | null;
}): NotificationTypeWithTiming {
  const normalizedEntityType = normalizeAlertEntityType(alert.entityType);

  if (alert.type === 'overdue_ncr' || normalizedEntityType === 'ncr') {
    return 'ncrAssigned';
  }

  if (alert.type === 'stale_hold_point' || normalizedEntityType === 'hold_point') {
    return 'holdPointReminder';
  }

  if (
    normalizedEntityType === 'diary' ||
    normalizedEntityType === 'daily_diary' ||
    normalizedEntityType === 'dailydiary'
  ) {
    return 'diaryReminder';
  }

  // There is no docket/test-specific preference yet. Keep those operational
  // backlog/escalation emails under the existing field reminder bucket instead
  // of incorrectly tying them to NCR assignment preferences.
  return 'holdPointReminder';
}
