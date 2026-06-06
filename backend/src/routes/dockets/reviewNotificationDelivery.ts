import { prisma } from '../../lib/prisma.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import type { DocketEmailNotification, DocketInAppNotification } from './notifications.js';

type DocketSubcontractorUser = {
  id: string;
  email: string;
  fullName: string | null;
};

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

  const notificationsToCreate = subcontractorUsers.map((su) => ({
    userId: su.id,
    ...inApp,
  }));

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate,
    });
  }

  for (const su of subcontractorUsers) {
    try {
      await sendNotificationIfEnabled(su.id, 'enabled', email);
    } catch {
      // Non-critical: don't fail the main request if email fails
    }
  }

  return subcontractorUsers;
}
