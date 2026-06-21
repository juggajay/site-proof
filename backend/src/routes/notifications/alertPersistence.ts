import { prisma } from '../../lib/prisma.js';
import { ALERT_ESCALATION_CONFIG } from '../../lib/notificationAlertConfig.js';
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

// Escalation configuration (in hours).
export const ESCALATION_CONFIG = ALERT_ESCALATION_CONFIG;

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
