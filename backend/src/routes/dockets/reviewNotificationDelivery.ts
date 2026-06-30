import { prisma } from '../../lib/prisma.js';
import { activeSubcontractorCompanyWhere } from '../../lib/projectAccess.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import type { DocketEmailNotification, DocketInAppNotification } from './notifications.js';

type DocketNotificationUser = {
  id: string;
  email: string;
  fullName: string | null;
};

type DocketSubcontractorUser = DocketNotificationUser;
type DocketApproverUser = DocketNotificationUser;

async function createDocketNotificationsAndEmails({
  users,
  inApp,
  email,
}: {
  users: DocketNotificationUser[];
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
}): Promise<void> {
  const notificationsToCreate = users.map((user) => ({
    userId: user.id,
    ...inApp,
  }));

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate,
    });
  }

  for (const user of users) {
    try {
      await sendNotificationIfEnabled(user.id, 'enabled', email);
    } catch {
      // Non-critical: don't fail the main request if email fails
    }
  }
}

export async function notifyDocketSubcontractorUsers({
  subcontractorCompanyId,
  inApp,
  email,
}: {
  subcontractorCompanyId: string;
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
}): Promise<DocketSubcontractorUser[]> {
  const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
    where: {
      subcontractorCompanyId,
      subcontractorCompany: activeSubcontractorCompanyWhere(),
    },
  });

  const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
  const subcontractorUsers =
    subcontractorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: subcontractorUserIds } },
          select: { id: true, email: true, fullName: true },
        })
      : [];

  await createDocketNotificationsAndEmails({ users: subcontractorUsers, inApp, email });

  return subcontractorUsers;
}

export async function notifyDocketApproverUsers({
  projectId,
  roles,
  inApp,
  email,
}: {
  projectId: string;
  roles: string[];
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
}): Promise<DocketApproverUser[]> {
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: { in: roles },
      status: 'active',
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
    },
  });

  const approverUsers = Array.from(
    new Map(projectUsers.map((pu) => [pu.user.id, pu.user])).values(),
  );

  await createDocketNotificationsAndEmails({ users: approverUsers, inApp, email });

  return approverUsers;
}
