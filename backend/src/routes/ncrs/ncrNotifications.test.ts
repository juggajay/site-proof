import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createNotificationsForRecipientsMock,
  hasPortalModuleEnabledMock,
  logErrorMock,
  prismaMock,
  sendNotificationIfEnabledMock,
} = vi.hoisted(() => ({
  createNotificationsForRecipientsMock: vi.fn(),
  hasPortalModuleEnabledMock: vi.fn(),
  logErrorMock: vi.fn(),
  prismaMock: {
    subcontractorCompany: {
      findUnique: vi.fn(),
    },
    subcontractorUser: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  sendNotificationIfEnabledMock: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../../lib/auditLog.js', () => ({
  AuditAction: { SUBCONTRACTOR_PORTAL_ACCESS_CHANGED: 'SUBCONTRACTOR_PORTAL_ACCESS_CHANGED' },
  createAuditLog: vi.fn(),
}));

vi.mock('../../lib/notificationDispatch.js', () => ({
  createNotificationsForRecipients: createNotificationsForRecipientsMock,
}));

vi.mock('../../lib/projectAccess.js', () => ({
  ensureSubcontractorNcrPortalAccess: vi.fn(),
  hasPortalModuleEnabled: hasPortalModuleEnabledMock,
}));

vi.mock('../../lib/serverLogger.js', () => ({
  logError: logErrorMock,
}));

vi.mock('../notifications.js', () => ({
  sendNotificationIfEnabled: sendNotificationIfEnabledMock,
}));

const { getNcrEmailNotificationType, notifyInternalNcrUser, notifySubcontractorNcrPortalUsers } =
  await import('./ncrNotifications.js');

const baseNotification = {
  projectId: 'project-1',
  subcontractorCompanyId: 'subbie-1',
  ncrId: 'ncr-1',
  type: 'ncr_assigned' as const,
  title: 'NCR Assigned to Your Company',
  message: 'NCR-001 has been assigned to your company.',
};

describe('getNcrEmailNotificationType', () => {
  it('maps assignment notifications to the NCR assigned preference', () => {
    expect(getNcrEmailNotificationType('ncr_assigned')).toBe('ncrAssigned');
    expect(getNcrEmailNotificationType('ncr_redirect')).toBe('ncrAssigned');
  });

  it('maps workflow notifications to the NCR status-change preference', () => {
    expect(getNcrEmailNotificationType('ncr_response_accepted')).toBe('ncrStatusChange');
    expect(getNcrEmailNotificationType('ncr_revision_requested')).toBe('ncrStatusChange');
    expect(getNcrEmailNotificationType('ncr_rectification_rejected')).toBe('ncrStatusChange');
  });
});

describe('notifyInternalNcrUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' });
    sendNotificationIfEnabledMock.mockResolvedValue({ sent: true, queued: false });
  });

  it('creates a deep-linked in-app notification and sends the matching email', async () => {
    await notifyInternalNcrUser({
      userId: 'user-9',
      projectId: 'project-1',
      ncrId: 'ncr-1',
      type: 'ncr_assigned',
      title: 'NCR Assigned to You',
      message: 'NCR-001 assigned to you.',
    });

    const linkUrl = '/projects/project-1/ncr?ncr=ncr-1';
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-9',
        projectId: 'project-1',
        type: 'ncr_assigned',
        title: 'NCR Assigned to You',
        message: 'NCR-001 assigned to you.',
        linkUrl,
      },
    });
    expect(sendNotificationIfEnabledMock).toHaveBeenCalledWith('user-9', 'ncrAssigned', {
      title: 'NCR Assigned to You',
      message: 'NCR-001 assigned to you.',
      linkUrl,
    });
  });

  it('uses the status-change email preference for workflow notifications', async () => {
    await notifyInternalNcrUser({
      userId: 'user-9',
      projectId: 'project-1',
      ncrId: 'ncr-1',
      type: 'ncr_rectification_rejected',
      title: 'Rectification Rejected',
      message: 'Fix and resubmit.',
    });

    expect(sendNotificationIfEnabledMock).toHaveBeenCalledWith(
      'user-9',
      'ncrStatusChange',
      expect.objectContaining({ title: 'Rectification Rejected' }),
    );
  });

  it('keeps the in-app notification when the email attempt fails', async () => {
    sendNotificationIfEnabledMock.mockRejectedValueOnce(new Error('email down'));

    await expect(
      notifyInternalNcrUser({
        userId: 'user-9',
        projectId: 'project-1',
        ncrId: 'ncr-1',
        type: 'ncr_assigned',
        title: 'NCR Assigned to You',
        message: 'NCR-001 assigned to you.',
      }),
    ).resolves.toBeUndefined();

    expect(prismaMock.notification.create).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Failed to send internal NCR notification email:',
      expect.any(Error),
    );
  });
});

describe('notifySubcontractorNcrPortalUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNotificationsForRecipientsMock.mockResolvedValue({ count: 2 });
    hasPortalModuleEnabledMock.mockReturnValue(true);
    prismaMock.subcontractorCompany.findUnique.mockResolvedValue({ portalAccess: { ncrs: true } });
    prismaMock.subcontractorUser.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    sendNotificationIfEnabledMock.mockResolvedValue({ sent: true, queued: false });
  });

  it('does nothing when the subcontractor NCR portal module is not enabled', async () => {
    hasPortalModuleEnabledMock.mockReturnValue(false);

    await notifySubcontractorNcrPortalUsers(baseNotification);

    expect(createNotificationsForRecipientsMock).not.toHaveBeenCalled();
    expect(sendNotificationIfEnabledMock).not.toHaveBeenCalled();
  });

  it('creates dispatched in-app notifications and sends assignment emails', async () => {
    await notifySubcontractorNcrPortalUsers(baseNotification);

    const linkUrl =
      '/subcontractor-portal/ncrs?ncr=ncr-1&projectId=project-1&subcontractorCompanyId=subbie-1';

    expect(createNotificationsForRecipientsMock).toHaveBeenCalledWith(['user-1', 'user-2'], {
      projectId: 'project-1',
      type: 'ncr_assigned',
      title: 'NCR Assigned to Your Company',
      message: 'NCR-001 has been assigned to your company.',
      linkUrl,
    });
    expect(sendNotificationIfEnabledMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationIfEnabledMock).toHaveBeenNthCalledWith(1, 'user-1', 'ncrAssigned', {
      title: 'NCR Assigned to Your Company',
      message: 'NCR-001 has been assigned to your company.',
      linkUrl,
    });
    expect(sendNotificationIfEnabledMock).toHaveBeenNthCalledWith(2, 'user-2', 'ncrAssigned', {
      title: 'NCR Assigned to Your Company',
      message: 'NCR-001 has been assigned to your company.',
      linkUrl,
    });
  });

  it('uses status-change email preferences for NCR workflow follow-up notifications', async () => {
    await notifySubcontractorNcrPortalUsers({
      ...baseNotification,
      type: 'ncr_revision_requested',
      title: 'NCR Revision Requested',
    });

    expect(sendNotificationIfEnabledMock).toHaveBeenCalledWith(
      'user-1',
      'ncrStatusChange',
      expect.objectContaining({ title: 'NCR Revision Requested' }),
    );
    expect(sendNotificationIfEnabledMock).toHaveBeenCalledWith(
      'user-2',
      'ncrStatusChange',
      expect.objectContaining({ title: 'NCR Revision Requested' }),
    );
  });

  it('keeps in-app delivery when an email attempt fails', async () => {
    sendNotificationIfEnabledMock
      .mockResolvedValueOnce({ sent: true, queued: false })
      .mockRejectedValueOnce(new Error('email down'));

    await expect(notifySubcontractorNcrPortalUsers(baseNotification)).resolves.toBeUndefined();

    expect(createNotificationsForRecipientsMock).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Failed to send subcontractor NCR notification email:',
      expect.any(Error),
    );
  });
});
