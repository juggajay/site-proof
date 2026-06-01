import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNotificationTiming, sendNotificationIfEnabled } from './delivery.js';

// DB-free coverage of the notification delivery/timing helpers. Every external
// dependency (prisma, the email sender, the digest queue, the email-preference
// accessor, and the logger) is mocked via vi.hoisted spies — so the spies exist
// before the hoisted vi.mock factories run — meaning no database, email
// provider, or queue is touched. We assert the documented { sent, queued }
// contract for each branch, and that the disabled/missing-user branches
// short-circuit before the prisma user lookup. The DB-backed wiring is also
// exercised by the notifications route suite in CI.

const { findUnique, getEmailPreferences, addDigestItem, sendNotificationEmail, logError } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    getEmailPreferences: vi.fn(),
    addDigestItem: vi.fn(),
    sendNotificationEmail: vi.fn(),
    logError: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({
  prisma: { user: { findUnique } },
}));
vi.mock('../../lib/email.js', () => ({ sendNotificationEmail }));
vi.mock('../../lib/serverLogger.js', () => ({ logError }));
vi.mock('./emailPreferences.js', () => ({ getEmailPreferences }));
vi.mock('./digestQueue.js', () => ({ addDigestItem }));

type Prefs = Record<string, unknown>;

function makePrefs(overrides: Prefs = {}): Prefs {
  return {
    enabled: true,
    dailyDigest: false,
    ncrAssigned: true,
    ...overrides,
  };
}

const data = { title: 'NCR assigned', message: 'You were assigned an NCR' };

describe('sendNotificationIfEnabled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns not sent/queued when email notifications are globally disabled', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs({ enabled: false }));

    const result = await sendNotificationIfEnabled('user-1', 'enabled', data);

    expect(result).toEqual({ sent: false, queued: false });
    expect(findUnique).not.toHaveBeenCalled();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(addDigestItem).not.toHaveBeenCalled();
  });

  it('returns not sent/queued when the specific notification type is disabled', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs({ ncrAssigned: false }));

    const result = await sendNotificationIfEnabled('user-1', 'ncrAssigned', data);

    expect(result).toEqual({ sent: false, queued: false });
    expect(findUnique).not.toHaveBeenCalled();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('returns not sent/queued when the user record is missing', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs());
    findUnique.mockResolvedValue(null);

    const result = await sendNotificationIfEnabled('user-1', 'enabled', data);

    expect(result).toEqual({ sent: false, queued: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { email: true },
    });
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('queues a digest item when timing is digest and daily digest is enabled', async () => {
    getEmailPreferences.mockResolvedValue(
      makePrefs({ dailyDigest: true, ncrAssignedTiming: 'digest' }),
    );
    findUnique.mockResolvedValue({ email: 'user@example.com' });

    const result = await sendNotificationIfEnabled('user-1', 'ncrAssigned', {
      title: 'NCR assigned',
      message: 'You were assigned an NCR',
      projectName: 'Site A',
      linkUrl: '/ncrs/1',
    });

    expect(result).toEqual({ sent: false, queued: true });
    expect(addDigestItem).toHaveBeenCalledTimes(1);
    const [userIdArg, digestItem] = addDigestItem.mock.calls[0];
    expect(userIdArg).toBe('user-1');
    expect(digestItem).toMatchObject({
      type: 'ncrAssigned',
      title: 'NCR assigned',
      message: 'You were assigned an NCR',
      projectName: 'Site A',
      linkUrl: '/ncrs/1',
    });
    expect(digestItem.timestamp).toBeInstanceOf(Date);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('sends immediately and reports sent on success', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs());
    findUnique.mockResolvedValue({ email: 'user@example.com' });
    sendNotificationEmail.mockResolvedValue({ success: true });

    const result = await sendNotificationIfEnabled('user-1', 'enabled', data);

    expect(result).toEqual({ sent: true, queued: false });
    expect(sendNotificationEmail).toHaveBeenCalledWith('user@example.com', 'enabled', data);
    expect(logError).not.toHaveBeenCalled();
    expect(addDigestItem).not.toHaveBeenCalled();
  });

  it('logs and reports not sent when immediate delivery fails', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs());
    findUnique.mockResolvedValue({ email: 'user@example.com' });
    sendNotificationEmail.mockResolvedValue({
      success: false,
      error: 'SMTP down',
      provider: 'resend',
    });

    const result = await sendNotificationIfEnabled('user-1', 'enabled', data);

    expect(result).toEqual({ sent: false, queued: false });
    expect(logError).toHaveBeenCalledWith('[Notifications] Email delivery failed', {
      userId: 'user-1',
      notificationType: 'enabled',
      error: 'SMTP down',
      provider: 'resend',
    });
  });
});

describe('getNotificationTiming', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the configured per-type timing when present', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs({ ncrAssignedTiming: 'digest' }));

    await expect(getNotificationTiming('user-1', 'ncrAssigned')).resolves.toBe('digest');
  });

  it('falls back to immediate when no per-type timing is configured', async () => {
    getEmailPreferences.mockResolvedValue(makePrefs());

    await expect(getNotificationTiming('user-1', 'ncrAssigned')).resolves.toBe('immediate');
  });
});
