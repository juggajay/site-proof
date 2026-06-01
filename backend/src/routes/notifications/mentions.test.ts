import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMentionNotifications } from './mentions.js';

// DB-free coverage of the mention notification helper. The prisma client and the
// link builder are mocked via vi.hoisted spies — so the spies exist before the
// hoisted vi.mock factories run — meaning no database is touched. We pin the
// @mention parsing/de-duplication, the project-membership / company-admin filter
// shape, the self-notification skip, the 100-char truncation, and the created
// notification shape. The DB-backed wiring is also exercised by the comments
// route suite in CI.

const { projectFindUnique, userFindFirst, userFindUnique, notificationCreate, buildLink } =
  vi.hoisted(() => ({
    projectFindUnique: vi.fn(),
    userFindFirst: vi.fn(),
    userFindUnique: vi.fn(),
    notificationCreate: vi.fn(),
    buildLink: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    notification: { create: notificationCreate },
  },
}));
vi.mock('./links.js', () => ({ buildProjectEntityLink: buildLink }));

beforeEach(() => {
  vi.clearAllMocks();
  projectFindUnique.mockResolvedValue({ companyId: 'company-1' });
  userFindFirst.mockResolvedValue({ id: 'user-alice' });
  userFindUnique.mockResolvedValue({ fullName: 'Author Name', email: 'author@example.com' });
  notificationCreate.mockResolvedValue({});
  buildLink.mockReturnValue('/built-link');
});

describe('createMentionNotifications', () => {
  it('returns without any prisma access when there are no mentions', async () => {
    await createMentionNotifications(
      'plain comment with no mentions',
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    expect(projectFindUnique).not.toHaveBeenCalled();
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('notifies once when the same mention appears multiple times', async () => {
    await createMentionNotifications(
      'hey @alice and @alice again',
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    expect(userFindFirst).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it('does not notify the author when they mention themselves', async () => {
    userFindFirst.mockResolvedValue({ id: 'author-1' });

    await createMentionNotifications(
      '@author',
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('scopes the user lookup to active project membership or company admins', async () => {
    await createMentionNotifications(
      '@alice',
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    expect(projectFindUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: { companyId: true },
    });
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { OR: [{ email: 'alice' }, { fullName: 'alice' }] },
          {
            OR: [
              { projectUsers: { some: { projectId: 'project-1', status: 'active' } } },
              { companyId: 'company-1', roleInCompany: { in: ['owner', 'admin'] } },
            ],
          },
        ],
      },
    });
  });

  it('omits the project scope when no projectId is supplied', async () => {
    await createMentionNotifications('@alice', 'author-1', 'ncr', 'ncr-1', 'comment-9');

    expect(projectFindUnique).not.toHaveBeenCalled();
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        AND: [{ OR: [{ email: 'alice' }, { fullName: 'alice' }] }, {}],
      },
    });
  });

  it('creates the mention notification with the documented shape', async () => {
    await createMentionNotifications(
      '@alice',
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    expect(buildLink).toHaveBeenCalledWith('ncr', 'ncr-1', 'project-1', {
      tab: 'comments',
      commentId: 'comment-9',
    });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-alice',
        projectId: 'project-1',
        type: 'mention',
        title: 'Author Name mentioned you in a comment',
        message: '@alice',
        linkUrl: '/built-link',
      },
    });
  });

  it('truncates messages longer than 100 characters to 100 chars plus an ellipsis', async () => {
    const longContent = '@alice ' + 'x'.repeat(200);

    await createMentionNotifications(
      longContent,
      'author-1',
      'ncr',
      'ncr-1',
      'comment-9',
      'project-1',
    );

    const message = notificationCreate.mock.calls[0][0].data.message;
    expect(message).toBe(longContent.substring(0, 100) + '...');
    expect(message).toHaveLength(103);
  });
});
