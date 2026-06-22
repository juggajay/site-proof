import { logError } from '../../lib/serverLogger.js';
import { prisma } from '../../lib/prisma.js';
import { triggerWebhooks } from '../webhooks/delivery.js';

export type LotWebhookEventName = 'lot.created' | 'lot.updated' | 'lot.deleted';

export interface LotWebhookPayload {
  lotId: string;
  projectId: string;
  lotNumber: string;
  status: string | null;
  actorUserId: string;
  action?: string;
  bulk?: boolean;
  changedFields?: string[];
  previousStatus?: string | null;
  sourceLotId?: string;
  previousSubcontractorId?: string | null;
  assignedSubcontractorId?: string | null;
}

export interface PendingLotWebhookEvent {
  event: LotWebhookEventName;
  payload: LotWebhookPayload;
}

async function triggerLotWebhookEvents(
  projectId: string,
  events: PendingLotWebhookEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  if (!project?.companyId) {
    return;
  }

  for (const { event, payload } of events) {
    try {
      await triggerWebhooks(project.companyId, event, payload);
    } catch (err) {
      logError(`[Webhook] Failed to trigger ${event} for lot ${payload.lotId}:`, err);
    }
  }
}

export function emitLotWebhookEvents(projectId: string, events: PendingLotWebhookEvent[]): void {
  if (events.length === 0) {
    return;
  }

  void triggerLotWebhookEvents(projectId, events).catch((err) => {
    logError(`[Webhook] Failed to trigger lot webhook event(s) for project ${projectId}:`, err);
  });
}

export function emitLotWebhookEvent(
  projectId: string,
  event: LotWebhookEventName,
  payload: LotWebhookPayload,
): void {
  emitLotWebhookEvents(projectId, [{ event, payload }]);
}
