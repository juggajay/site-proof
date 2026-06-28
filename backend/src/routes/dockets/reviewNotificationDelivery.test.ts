import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocketEmailNotification, DocketInAppNotification } from './notifications.js';

const { prismaMock, sendNotificationIfEnabledMock } = vi.hoisted(() => ({
  prismaMock: {
    subcontractorUser: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
  sendNotificationIfEnabledMock: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../notifications.js', () => ({
  sendNotificationIfEnabled: sendNotificationIfEnabledMock,
}));

const { notifyDocketSubcontractorUsers } = await import('./reviewNotificationDelivery.js');

const inApp: DocketInAppNotification = {
  projectId: 'project-1',
  type: 'docket_approved',
  title: 'Docket Approved',
  message: 'Approved',
  linkUrl: '/projects/project-1/dockets',
};

const email: DocketEmailNotification = {
  title: 'Docket Approved',
  message: 'Approved',
  projectName: 'Project 1',
  linkUrl: '/projects/project-1/dockets',
};

describe('notifyDocketSubcontractorUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendNotificationIfEnabledMock.mockResolvedValue(undefined);
  });

  it('does not create notifications or emails when no subcontractor users are linked', async () => {
    prismaMock.subcontractorUser.findMany.mockResolvedValue([]);

    const users = await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: 'subbie-company-1',
      inApp,
      email,
    });

    expect(users).toEqual([]);
    expect(prismaMock.subcontractorUser.findMany).toHaveBeenCalledWith({
      where: {
        subcontractorCompanyId: 'subbie-company-1',
        subcontractorCompany: { status: { notIn: ['suspended', 'removed'] } },
      },
    });
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendNotificationIfEnabledMock).not.toHaveBeenCalled();
  });

  it('creates one in-app notification and attempts one email per linked subcontractor user', async () => {
    prismaMock.subcontractorUser.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', email: 'one@example.com', fullName: 'One' },
      { id: 'user-2', email: 'two@example.com', fullName: 'Two' },
    ]);

    const users = await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: 'subbie-company-1',
      inApp,
      email,
    });

    expect(users).toEqual([
      { id: 'user-1', email: 'one@example.com', fullName: 'One' },
      { id: 'user-2', email: 'two@example.com', fullName: 'Two' },
    ]);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1', 'user-2'] } },
      select: { id: true, email: true, fullName: true },
    });
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', ...inApp },
        { userId: 'user-2', ...inApp },
      ],
    });
    expect(sendNotificationIfEnabledMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationIfEnabledMock).toHaveBeenNthCalledWith(1, 'user-1', 'enabled', email);
    expect(sendNotificationIfEnabledMock).toHaveBeenNthCalledWith(2, 'user-2', 'enabled', email);
  });

  it('filters linked users through active subcontractor company status', async () => {
    prismaMock.subcontractorUser.findMany.mockResolvedValue([]);

    await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: 'suspended-subbie-company',
      inApp,
      email,
    });

    expect(prismaMock.subcontractorUser.findMany).toHaveBeenCalledWith({
      where: {
        subcontractorCompanyId: 'suspended-subbie-company',
        subcontractorCompany: { status: { notIn: ['suspended', 'removed'] } },
      },
    });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendNotificationIfEnabledMock).not.toHaveBeenCalled();
  });

  it('swallows individual email delivery failures after creating in-app notifications', async () => {
    prismaMock.subcontractorUser.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', email: 'one@example.com', fullName: 'One' },
    ]);
    sendNotificationIfEnabledMock.mockRejectedValue(new Error('email down'));

    await expect(
      notifyDocketSubcontractorUsers({
        subcontractorCompanyId: 'subbie-company-1',
        inApp,
        email,
      }),
    ).resolves.toEqual([{ id: 'user-1', email: 'one@example.com', fullName: 'One' }]);
    expect(prismaMock.notification.createMany).toHaveBeenCalledOnce();
  });
});
