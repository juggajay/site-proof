import { logError } from '../../lib/serverLogger.js';
import { prisma } from '../../lib/prisma.js';
import { triggerWebhooks } from '../webhooks/delivery.js';

export type HoldPointWebhookEventName = 'hold_point.release_requested' | 'hold_point.released';

export interface HoldPointWebhookPayload {
  holdPointId: string;
  projectId: string;
  lotId: string;
  lotNumber: string;
  itpChecklistItemId: string;
  description: string | null;
  status: string | null;
  actorUserId?: string | null;
  action: 'release_requested' | 'released';
  releaseSource?: 'authenticated' | 'public_secure_link';
  releaseMethod?: string | null;
  releasedByName?: string | null;
  releasedByOrg?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  recipientCount?: number;
  emailDelivery?: {
    sent: number;
    failed: number;
  };
  noticePeriodOverride?: boolean;
  releaseEvidenceDocumentId?: string | null;
  hasReleaseNotes?: boolean;
}

async function triggerHoldPointWebhookEvent(
  projectId: string,
  event: HoldPointWebhookEventName,
  payload: HoldPointWebhookPayload,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  if (!project?.companyId) {
    return;
  }

  try {
    await triggerWebhooks(project.companyId, event, payload);
  } catch (err) {
    logError(`[Webhook] Failed to trigger ${event} for hold point ${payload.holdPointId}:`, err);
  }
}

export function emitHoldPointWebhookEvent(
  projectId: string,
  event: HoldPointWebhookEventName,
  payload: HoldPointWebhookPayload,
): void {
  void triggerHoldPointWebhookEvent(projectId, event, payload).catch((err) => {
    logError(`[Webhook] Failed to trigger hold point webhook event for project ${projectId}:`, err);
  });
}
