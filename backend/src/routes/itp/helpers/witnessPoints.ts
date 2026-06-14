// Feature #175 - Auto-notification before witness point
import { prisma } from '../../../lib/prisma.js';
import { logError } from '../../../lib/serverLogger.js';
import { getChecklistItemsForInstance, type ChecklistItem } from './templateSnapshot.js';

// Nested witness point notification settings as saved by the project settings UI
// (frontend/src/pages/projects/settings). This is the shape the frontend writes.
export interface NestedWitnessPointNotificationSettings {
  enabled?: boolean;
  trigger?: string;
  clientEmail?: string | null;
  clientName?: string;
}

// Type for project settings
export interface ProjectSettings {
  // Current (nested) shape written by the settings UI.
  witnessPointNotifications?: NestedWitnessPointNotificationSettings;
  // Legacy flat keys (kept for backwards compatibility with older saved settings).
  witnessPointNotificationTrigger?: string;
  witnessPointNotificationEnabled?: boolean;
  witnessPointClientEmail?: string | null;
  witnessPointClientName?: string;
  requireSubcontractorVerification?: boolean;
  hpRecipients?: Array<{ email: string }>;
  hpApprovalRequirement?: string;
}

// Resolved witness point notification config used by the sender.
export interface ResolvedWitnessPointNotificationSettings {
  enabled: boolean;
  trigger: string;
  clientEmail: string | null;
  clientName: string;
}

/**
 * Resolve witness point notification settings from a project's saved settings.
 *
 * The settings UI writes a nested `witnessPointNotifications` object, while older
 * saved settings used flat keys. This prefers the nested values and falls back to
 * the legacy flat keys, preserving the historical defaults (missing config =>
 * enabled, no client email, "previous_item" trigger).
 */
export function resolveWitnessPointNotificationSettings(
  settings: ProjectSettings,
): ResolvedWitnessPointNotificationSettings {
  const nested = settings.witnessPointNotifications;

  // enabled: default true; only disabled when explicitly set to false.
  const enabled =
    nested?.enabled !== undefined
      ? nested.enabled !== false
      : settings.witnessPointNotificationEnabled !== false;

  const trigger = nested?.trigger || settings.witnessPointNotificationTrigger || 'previous_item';

  // Treat empty-string email (UI default) the same as "not configured".
  const clientEmail = nested?.clientEmail || settings.witnessPointClientEmail || null;

  const clientName =
    nested?.clientName || settings.witnessPointClientName || 'Client Representative';

  return { enabled, trigger, clientEmail, clientName };
}

/**
 * Check for upcoming witness points and send notifications
 * Called after an ITP item is completed to check if the next item is a witness point
 */
export async function checkAndNotifyWitnessPoint(
  itpInstanceId: string,
  completedItemId: string,
  userId: string,
) {
  try {
    // Get the ITP instance with template and lot info
    const instance = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
        template: {
          include: {
            checklistItems: {
              orderBy: { sequenceNumber: 'asc' },
            },
          },
        },
        completions: true,
      },
    });

    if (!instance || !instance.lot || !instance.lot.project) {
      return null;
    }

    // Get checklist items from snapshot or template.
    const checklistItems: ChecklistItem[] = getChecklistItemsForInstance(instance);

    // Find the completed item's sequence number
    const completedItem = checklistItems.find((item) => item.id === completedItemId);
    if (!completedItem) {
      return null;
    }

    const completedSequence = completedItem.sequenceNumber;
    if (typeof completedSequence !== 'number') {
      return null;
    }

    // Check project settings for witness point notification configuration
    const project = instance.lot.project;
    let settings: ProjectSettings = {};
    if (project.settings) {
      try {
        settings = JSON.parse(project.settings) as ProjectSettings;
      } catch (_e) {
        // Invalid JSON, use defaults
      }
    }

    // Resolve config from nested (settings UI) shape with legacy flat-key fallback.
    // Default: notify when previous item is completed.
    const {
      enabled: witnessNotificationEnabled,
      trigger: notificationTrigger,
      clientEmail,
      clientName,
    } = resolveWitnessPointNotificationSettings(settings);

    if (!witnessNotificationEnabled) {
      return null;
    }

    // Determine the sequence number to check for witness point
    let targetSequence: number;
    if (notificationTrigger === '2_items_before') {
      targetSequence = completedSequence + 2;
    } else {
      // previous_item (default)
      targetSequence = completedSequence + 1;
    }

    // Find the target item
    const nextItem = checklistItems.find((item) => item.sequenceNumber === targetSequence);
    if (!nextItem) {
      return null;
    }

    // Check if it's a witness point (pointType can be 'witness' or 'witness_point')
    if (nextItem.pointType !== 'witness' && nextItem.pointType !== 'witness_point') {
      return null;
    }

    // Check if the witness point is already completed (no need to notify)
    const witnessPointCompletion = instance.completions.find(
      (c) =>
        c.checklistItemId === nextItem.id &&
        (c.status === 'completed' || c.status === 'not_applicable'),
    );
    if (witnessPointCompletion) {
      return null; // Witness point already passed
    }

    // Check if notification was already sent for this witness point
    const existingNotification = await prisma.notification.findFirst({
      where: {
        projectId: project.id,
        type: 'witness_point_approaching',
        linkUrl: { contains: nextItem.id },
      },
    });

    if (existingNotification) {
      return null; // Already notified
    }

    // Get the user who completed the item to attribute the notification
    const completingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    const userName = completingUser?.fullName || completingUser?.email || 'A team member';

    // Create notifications for project managers and superintendents
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: project.id,
        role: { in: ['project_manager', 'admin', 'superintendent'] },
        status: 'active',
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    const notificationsCreated = [];

    for (const pu of projectUsers) {
      const notification = await prisma.notification.create({
        data: {
          userId: pu.user.id,
          projectId: project.id,
          type: 'witness_point_approaching',
          title: `Witness Point Approaching: ${nextItem.description ?? 'ITP item'}`,
          message: `${userName} completed "${completedItem.description ?? 'ITP item'}" on lot ${instance.lot.lotNumber}. The next item is a witness point that requires client notification.`,
          linkUrl: `/projects/${project.id}/lots/${instance.lot.id}?tab=itp&highlight=${nextItem.id}`,
        },
      });
      notificationsCreated.push(notification);
    }

    return {
      witnessPoint: nextItem,
      notificationsSent: notificationsCreated.length,
      clientEmail,
      clientName,
    };
  } catch (error) {
    // Note: This helper intentionally catches errors since notification is non-critical
    logError('Error checking witness point notification:', error);
    return null;
  }
}
