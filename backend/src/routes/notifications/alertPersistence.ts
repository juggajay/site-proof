import { prisma } from '../../lib/prisma.js';
import { toAlert, type Alert } from './alertMappers.js';

/**
 * Notification alert persistence/config helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * Covers the escalation timing/role configuration and the two Prisma writers
 * that create an alert and apply an escalation update, each mapping the stored
 * record back through toAlert. Behaviour — the exact escalation hours/roles, the
 * create payload (incl. the `?? null` / `?? undefined` column coercions), the
 * escalation update shape, and the returned Alert via toAlert — is preserved
 * exactly as it was inline in the route file. ESCALATION_CONFIG is frozen by a
 * DB-free unit test; the Prisma writers are covered with a narrow prisma mock
 * here and by the notifications route suite in CI.
 */

// Escalation configuration (in hours)
export const ESCALATION_CONFIG = {
  overdue_ncr: {
    firstEscalationAfterHours: 24, // Escalate after 24 hours
    secondEscalationAfterHours: 48, // Second escalation after 48 hours
    escalationRoles: ['project_manager', 'quality_manager', 'admin'],
  },
  stale_hold_point: {
    firstEscalationAfterHours: 4, // Escalate after 4 hours (critical workflow)
    secondEscalationAfterHours: 8, // Second escalation after 8 hours
    escalationRoles: ['superintendent', 'project_manager', 'admin'],
  },
  pending_approval: {
    firstEscalationAfterHours: 8, // Escalate after 8 hours
    secondEscalationAfterHours: 24, // Second escalation after 24 hours
    escalationRoles: ['project_manager', 'admin'],
  },
  overdue_test: {
    firstEscalationAfterHours: 48, // Escalate after 48 hours
    secondEscalationAfterHours: 96, // Second escalation after 96 hours
    escalationRoles: ['quality_manager', 'project_manager'],
  },
};

export async function createAlertRecord(alert: Alert): Promise<Alert> {
  const record = await prisma.notificationAlert.create({
    data: {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      entityId: alert.entityId,
      entityType: alert.entityType,
      projectId: alert.projectId ?? null,
      assignedToId: alert.assignedTo,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt ?? null,
      escalatedAt: alert.escalatedAt ?? null,
      escalationLevel: alert.escalationLevel,
      escalatedTo: alert.escalatedTo ?? undefined,
    },
  });

  return toAlert(record);
}

export async function updateAlertEscalation(
  id: string,
  escalationLevel: number,
  escalatedAt: Date,
  escalatedTo: string[],
): Promise<Alert> {
  const record = await prisma.notificationAlert.update({
    where: { id },
    data: {
      escalationLevel,
      escalatedAt,
      escalatedTo,
    },
  });

  return toAlert(record);
}
