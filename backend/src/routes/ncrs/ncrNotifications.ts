import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { logError } from '../../lib/serverLogger.js';
import {
  ensureSubcontractorNcrPortalAccess,
  hasPortalModuleEnabled,
} from '../../lib/projectAccess.js';

type NcrNotificationType =
  | 'ncr_assigned'
  | 'ncr_redirect'
  | 'ncr_response_accepted'
  | 'ncr_revision_requested'
  | 'ncr_rectification_rejected';

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

  await prisma.notification.createMany({
    data: subcontractorUsers.map((subUser) => ({
      userId: subUser.userId,
      projectId,
      type,
      title,
      message,
      linkUrl: `/subcontractor-portal/ncrs?ncr=${encodeURIComponent(ncrId)}`,
    })),
  });
}
