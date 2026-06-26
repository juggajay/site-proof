import { logError } from '../../lib/serverLogger.js';
import { prisma } from '../../lib/prisma.js';
import { triggerWebhooks } from '../webhooks/delivery.js';

export type NcrWebhookEventName = 'ncr.created' | 'ncr.closed';

export interface NcrWebhookPayload {
  ncrId: string;
  projectId: string;
  ncrNumber: string;
  status: string;
  severity: string;
  actorUserId: string;
  action?: string;
}

async function triggerNcrWebhookEvent(
  projectId: string,
  event: NcrWebhookEventName,
  payload: NcrWebhookPayload,
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
    logError(`[Webhook] Failed to trigger ${event} for ncr ${payload.ncrId}:`, err);
  }
}

export function emitNcrWebhookEvent(
  projectId: string,
  event: NcrWebhookEventName,
  payload: NcrWebhookPayload,
): void {
  void triggerNcrWebhookEvent(projectId, event, payload).catch((err) => {
    logError(`[Webhook] Failed to trigger ${event} for project ${projectId}:`, err);
  });
}
