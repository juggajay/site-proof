import { AppError } from '../../lib/AppError.js';
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
  try {
    return await createAlertRecordUnchecked(alert);
  } catch (error) {
    // Partial unique index: one active alert per (type, entityId). A manual
    // create that collides with an existing active alert is a client error,
    // not a crash.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2002'
    ) {
      throw AppError.conflict('An active alert already exists for this item');
    }
    throw error;
  }
}

async function createAlertRecordUnchecked(alert: Alert): Promise<Alert> {
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

/**
 * Escalate an alert with an optimistic compare-and-swap. The write only lands
 * when the row is still unresolved AND still at `expectedLevel`, so two
 * concurrent check-escalations runs can't both move the same alert up a level
 * (which would double-escalate and double-notify). Returns the updated alert
 * when this caller won the race, or `null` when another run got there first.
 */
export async function updateAlertEscalation(
  id: string,
  expectedLevel: number,
  escalationLevel: number,
  escalatedAt: Date,
  escalatedTo: string[],
): Promise<Alert | null> {
  const updateResult = await prisma.notificationAlert.updateMany({
    where: { id, resolvedAt: null, escalationLevel: expectedLevel },
    data: {
      escalationLevel,
      escalatedAt,
      escalatedTo,
    },
  });

  if (updateResult.count === 0) {
    return null;
  }

  const record = await prisma.notificationAlert.findUnique({ where: { id } });
  return record ? toAlert(record) : null;
}
