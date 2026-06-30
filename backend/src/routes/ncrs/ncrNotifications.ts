import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { createNotificationsForRecipients } from '../../lib/notificationDispatch.js';
import { logError } from '../../lib/serverLogger.js';
import {
  ensureSubcontractorNcrPortalAccess,
  hasPortalModuleEnabled,
} from '../../lib/projectAccess.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { buildSubcontractorPortalEntityLink } from '../notifications/links.js';

type NcrNotificationType =
  | 'ncr_assigned'
  | 'ncr_redirect'
  | 'ncr_response_accepted'
  | 'ncr_revision_requested'
  | 'ncr_rectification_rejected';

type NcrEmailNotificationType = 'ncrAssigned' | 'ncrStatusChange';

export function getNcrEmailNotificationType(type: NcrNotificationType): NcrEmailNotificationType {
  switch (type) {
    case 'ncr_assigned':
    case 'ncr_redirect':
      return 'ncrAssigned';
    case 'ncr_response_accepted':
    case 'ncr_revision_requested':
    case 'ncr_rectification_rejected':
      return 'ncrStatusChange';
  }
}

export async function enableSubcontractorNcrPortalAccessOnAssignment(
  subcontractorCompanyId: string,
  projectId: string,
  userId: string,
  ncrNumber: string,
  req: Request,
): Promise<void> {
  try {
    const enabled = await ensureSubcontractorNcrPortalAccess(subcontractorCompanyId);
    if (enabled) {
      await createAuditLog({
        projectId,
        userId,
        entityType: 'subcontractor',
        entityId: subcontractorCompanyId,
        action: AuditAction.SUBCONTRACTOR_PORTAL_ACCESS_CHANGED,
        changes: {
          portalAccess: { ncrs: true },
          autoEnabledBy: 'ncr_assignment',
          ncrNumber,
        },
        req,
      });
    }
  } catch (err) {
    logError('Failed to auto-enable subcontractor NCR portal access:', err);
  }
}

export async function notifySubcontractorNcrPortalUsers(options: {
  projectId: string;
  subcontractorCompanyId: string;
  ncrId: string;
  type: NcrNotificationType;
  title: string;
  message: string;
}): Promise<void> {
  const { projectId, subcontractorCompanyId, ncrId, type, title, message } = options;

  const company = await prisma.subcontractorCompany.findUnique({
    where: { id: subcontractorCompanyId },
    select: { portalAccess: true },
  });
  if (!company || !hasPortalModuleEnabled(company.portalAccess, 'ncrs')) {
    return;
  }

  const subcontractorUsers = await prisma.subcontractorUser.findMany({
    where: { subcontractorCompanyId },
    select: { userId: true },
  });

  if (subcontractorUsers.length === 0) {
    return;
  }

  const linkUrl = buildSubcontractorPortalEntityLink('ncr', ncrId, projectId, {
    subcontractorCompanyId,
  });
  const recipientIds = subcontractorUsers.map((subUser) => subUser.userId);

  await createNotificationsForRecipients(recipientIds, {
    projectId,
    type,
    title,
    message,
    linkUrl,
  });

  const emailNotificationType = getNcrEmailNotificationType(type);
  await Promise.all(
    recipientIds.map(async (userId) => {
      try {
        await sendNotificationIfEnabled(userId, emailNotificationType, {
          title,
          message,
          linkUrl,
        });
      } catch (err) {
        logError('Failed to send subcontractor NCR notification email:', err);
      }
    }),
  );
}
