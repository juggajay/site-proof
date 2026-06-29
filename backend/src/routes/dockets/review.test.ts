import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { getOrCreateDocketDiaryForSync } from './review.js';

describe('getOrCreateDocketDiaryForSync', () => {
  it('returns the existing diary when one already exists', async () => {
    const date = new Date('2026-02-02T00:00:00.000Z');
    const existingDiary = { id: 'diary-1', projectId: 'project-1', date };
    const dailyDiary = {
      findUnique: vi.fn().mockResolvedValue(existingDiary),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    };
    const tx = { dailyDiary } as unknown as Prisma.TransactionClient;

    await expect(getOrCreateDocketDiaryForSync(tx, 'project-1', date)).resolves.toBe(existingDiary);
    expect(dailyDiary.create).not.toHaveBeenCalled();
  });

  it('recovers the winning diary when a concurrent create hits the unique constraint', async () => {
    const date = new Date('2026-02-03T00:00:00.000Z');
    const recoveredDiary = { id: 'diary-2', projectId: 'project-1', date };
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`project_id`,`date`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['project_id', 'date'] },
      },
    );
    const dailyDiary = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(uniqueError),
      findUniqueOrThrow: vi.fn().mockResolvedValue(recoveredDiary),
    };
    const tx = { dailyDiary } as unknown as Prisma.TransactionClient;

    await expect(getOrCreateDocketDiaryForSync(tx, 'project-1', date)).resolves.toBe(
      recoveredDiary,
    );
    expect(dailyDiary.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { projectId_date: { projectId: 'project-1', date } },
    });
  });
});
