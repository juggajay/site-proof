import type { Request } from 'express';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { requireEditableDiaryForWrite } from './diaryAccess.js';

type DiaryAuthUser = NonNullable<Request['user']>;
type DiaryMutationTx = Prisma.TransactionClient;

export async function withEditableDiary<T>(
  user: DiaryAuthUser,
  diaryId: string,
  mutate: (
    tx: DiaryMutationTx,
    diary: Awaited<ReturnType<typeof requireEditableDiaryForWrite>>,
  ) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    const diary = await requireEditableDiaryForWrite(tx, user, diaryId);
    return mutate(tx, diary);
  });
}
