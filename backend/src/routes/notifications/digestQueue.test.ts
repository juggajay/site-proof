import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationDigestItem } from '@prisma/client';

import {
  addDigestItem,
  clearDigestItems,
  getDigestItems,
  getUserDigestQueue,
  toDigestItem,
} from './digestQueue.js';

// DB-free coverage of the digest-queue helpers. `toDigestItem` is a pure mapper
// tested directly. The Prisma-backed add/get/clear/getUserDigestQueue helpers
// use the module-level prisma singleton, so we mock '../../lib/prisma.js' with
// vitest spies (created via vi.hoisted so they exist before the hoisted vi.mock
// factory runs) and assert the exact query shapes. No database is touched; the
// DB-backed behaviour is also covered by the notifications route suite in CI.

const { create, count, findMany, deleteMany } = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    notificationDigestItem: { create, count, findMany, deleteMany },
  },
}));

function makeRecord(overrides: Partial<NotificationDigestItem> = {}): NotificationDigestItem {
  return {
    id: 'digest-1',
    userId: 'user-1',
    type: 'ncr',
    title: 'NCR raised',
    message: 'A new NCR requires your attention',
    projectName: 'Bridge 27',
    linkUrl: 'https://app.example/ncrs/1',
    createdAt: new Date('2026-06-01T03:00:00.000Z'),
    ...overrides,
  } as NotificationDigestItem;
}

describe('toDigestItem', () => {
  it('maps a record to a DigestItem, passing through present fields and createdAt', () => {
    const createdAt = new Date('2026-06-01T03:00:00.000Z');
    const item = toDigestItem(makeRecord({ createdAt }));

    expect(item).toEqual({
      type: 'ncr',
      title: 'NCR raised',
      message: 'A new NCR requires your attention',
      projectName: 'Bridge 27',
      linkUrl: 'https://app.example/ncrs/1',
      timestamp: createdAt,
    });
    // timestamp is the same Date reference (no conversion).
    expect(item.timestamp).toBe(createdAt);
  });

  it('coerces null projectName and linkUrl to undefined', () => {
    const item = toDigestItem(makeRecord({ projectName: null, linkUrl: null }));

    expect(item.projectName).toBeUndefined();
    expect(item.linkUrl).toBeUndefined();
  });
});

describe('addDigestItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the row with the mapped item fields and returns the post-insert count', async () => {
    create.mockResolvedValue({});
    count.mockResolvedValue(3);

    const result = await addDigestItem('user-1', {
      type: 'ncr',
      title: 'NCR raised',
      message: 'msg',
      projectName: 'Bridge 27',
      linkUrl: 'https://app.example/ncrs/1',
      timestamp: new Date('2026-06-01T03:00:00.000Z'),
    });

    // timestamp is intentionally NOT persisted (createdAt is set by the DB).
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'ncr',
        title: 'NCR raised',
        message: 'msg',
        projectName: 'Bridge 27',
        linkUrl: 'https://app.example/ncrs/1',
      },
    });
    expect(count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result).toBe(3);
  });
});

describe('getDigestItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads rows ordered by createdAt asc and maps each through toDigestItem', async () => {
    const createdAt = new Date('2026-06-01T03:00:00.000Z');
    findMany.mockResolvedValue([makeRecord({ projectName: null, linkUrl: null, createdAt })]);

    const result = await getDigestItems('user-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBeUndefined();
    expect(result[0].linkUrl).toBeUndefined();
    expect(result[0].timestamp).toBe(createdAt);
  });
});

describe('clearDigestItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes every digest row for the user', async () => {
    deleteMany.mockResolvedValue({ count: 2 });

    await clearDigestItems('user-1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});

describe('getUserDigestQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to getDigestItems for the given user', async () => {
    const createdAt = new Date('2026-06-01T03:00:00.000Z');
    findMany.mockResolvedValue([makeRecord({ createdAt })]);

    const result = await getUserDigestQueue('user-9');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-9' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(createdAt);
  });
});
