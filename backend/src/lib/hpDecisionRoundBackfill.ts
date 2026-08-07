import { Prisma, type PrismaClient } from '@prisma/client';

import { authorityClassForProjectSettings } from '../routes/holdpoints/roundCore.js';

const BACKFILL_STATUSES = new Set(['released', 'completed', 'notified']);
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_SAMPLE_SIZE = 10;

const backfillHoldPointSelect = {
  id: true,
  status: true,
  authorityClass: true,
  notificationSentAt: true,
  releasedAt: true,
  releasedByName: true,
  releasedByOrg: true,
  createdAt: true,
  updatedAt: true,
  lot: {
    select: {
      project: {
        select: { settings: true },
      },
    },
  },
  releaseTokens: {
    select: {
      id: true,
      recipientEmail: true,
      recipientName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.HoldPointSelect;

type BackfillHoldPoint = Prisma.HoldPointGetPayload<{
  select: typeof backfillHoldPointSelect;
}>;

type BackfillReadClient = Pick<Prisma.TransactionClient, 'holdPoint'>;

export type HpDecisionRoundBackfillStatusPlan = {
  status: string;
  action: 'backfill' | 'skip';
  count: number;
  sampleHoldPointIds: string[];
};

export type HpDecisionRoundBackfillPlan = {
  statusPlans: HpDecisionRoundBackfillStatusPlan[];
  totalToBackfill: number;
  classRemediationCount: number;
  classRemediationSampleHoldPointIds: string[];
  liveTokenBindingCount: number;
  holdPointIdsToBackfill: string[];
};

export type HpDecisionRoundBackfillResult = {
  plan: HpDecisionRoundBackfillPlan;
  created: number;
  classRemediated: number;
  tokensBound: number;
  skippedDuringApply: number;
};

export type RunHpDecisionRoundBackfillOptions = {
  write?: boolean;
  now?: Date;
  batchSize?: number;
  sampleSize?: number;
  holdPointIds?: string[];
};

function isBackfillStatus(status: string): boolean {
  return BACKFILL_STATUSES.has(status);
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  const integerSize = Math.max(1, Math.floor(size));
  for (let index = 0; index < values.length; index += integerSize) {
    chunks.push(values.slice(index, index + integerSize));
  }
  return chunks;
}

async function loadZeroRoundHoldPoints(
  db: BackfillReadClient,
  now: Date,
  ids?: string[],
): Promise<BackfillHoldPoint[]> {
  return db.holdPoint.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      decisionRounds: { none: {} },
    },
    select: {
      ...backfillHoldPointSelect,
      releaseTokens: {
        ...backfillHoldPointSelect.releaseTokens,
        where: {
          usedAt: null,
          expiresAt: { gt: now },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
}

function buildPlan(
  holdPoints: BackfillHoldPoint[],
  sampleSize: number,
): HpDecisionRoundBackfillPlan {
  const grouped = new Map<string, BackfillHoldPoint[]>();
  for (const holdPoint of holdPoints) {
    const rows = grouped.get(holdPoint.status) ?? [];
    rows.push(holdPoint);
    grouped.set(holdPoint.status, rows);
  }

  const preferredStatusOrder = ['released', 'completed', 'notified', 'pending'];
  const statuses = [...new Set([...preferredStatusOrder, ...grouped.keys()])].sort(
    (left, right) => {
      const leftIndex = preferredStatusOrder.indexOf(left);
      const rightIndex = preferredStatusOrder.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    },
  );
  const candidates = holdPoints.filter((holdPoint) => isBackfillStatus(holdPoint.status));
  const classRemediations = candidates.filter(
    (holdPoint) =>
      holdPoint.authorityClass !== authorityClassForProjectSettings(holdPoint.lot.project.settings),
  );

  return {
    statusPlans: statuses.map((status) => {
      const rows = grouped.get(status) ?? [];
      return {
        status,
        action: isBackfillStatus(status) ? 'backfill' : 'skip',
        count: rows.length,
        sampleHoldPointIds: rows.slice(0, sampleSize).map((row) => row.id),
      };
    }),
    totalToBackfill: candidates.length,
    classRemediationCount: classRemediations.length,
    classRemediationSampleHoldPointIds: classRemediations.slice(0, sampleSize).map((row) => row.id),
    liveTokenBindingCount: candidates
      .filter((holdPoint) => holdPoint.status === 'notified')
      .reduce((sum, holdPoint) => sum + holdPoint.releaseTokens.length, 0),
    holdPointIdsToBackfill: candidates.map((holdPoint) => holdPoint.id),
  };
}

export async function planHpDecisionRoundBackfill(
  prisma: PrismaClient,
  options: Pick<RunHpDecisionRoundBackfillOptions, 'now' | 'sampleSize' | 'holdPointIds'> = {},
): Promise<HpDecisionRoundBackfillPlan> {
  const now = options.now ?? new Date();
  const sampleSize = Math.max(0, Math.floor(options.sampleSize ?? DEFAULT_SAMPLE_SIZE));
  return buildPlan(await loadZeroRoundHoldPoints(prisma, now, options.holdPointIds), sampleSize);
}

export async function runHpDecisionRoundBackfill(
  prisma: PrismaClient,
  options: RunHpDecisionRoundBackfillOptions = {},
): Promise<HpDecisionRoundBackfillResult> {
  const now = options.now ?? new Date();
  const plan = await planHpDecisionRoundBackfill(prisma, {
    now,
    sampleSize: options.sampleSize,
    holdPointIds: options.holdPointIds,
  });
  const emptyResult = {
    plan,
    created: 0,
    classRemediated: 0,
    tokensBound: 0,
    skippedDuringApply: 0,
  };
  if (!options.write || plan.totalToBackfill === 0) {
    return emptyResult;
  }

  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  let created = 0;
  let classRemediated = 0;
  let tokensBound = 0;

  for (const holdPointIds of chunk(plan.holdPointIdsToBackfill, batchSize)) {
    const batchResult = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM hold_points WHERE id IN (${Prisma.join(holdPointIds)}) FOR UPDATE`,
        );

        const holdPoints = (await loadZeroRoundHoldPoints(tx, now, holdPointIds)).filter(
          (holdPoint) => isBackfillStatus(holdPoint.status),
        );
        let batchClassRemediated = 0;
        let batchTokensBound = 0;

        for (const holdPoint of holdPoints) {
          const authorityClass = authorityClassForProjectSettings(holdPoint.lot.project.settings);
          const isDecided = holdPoint.status === 'released' || holdPoint.status === 'completed';
          const primaryLiveToken = holdPoint.releaseTokens[0];
          const round = await tx.holdPointDecisionRound.create({
            data: {
              holdPointId: holdPoint.id,
              roundNumber: 1,
              authorityClass,
              requestedAt: holdPoint.notificationSentAt ?? holdPoint.createdAt,
              requestedById: null,
              recipientEmail:
                holdPoint.status === 'notified' ? primaryLiveToken?.recipientEmail : null,
              recipientName:
                holdPoint.status === 'notified' ? primaryLiveToken?.recipientName : null,
              outcome: isDecided ? 'released' : null,
              decidedAt: isDecided ? (holdPoint.releasedAt ?? holdPoint.updatedAt) : null,
              decidedByName: isDecided ? holdPoint.releasedByName : null,
              decidedByOrg: isDecided ? holdPoint.releasedByOrg : null,
              decisionMethod: isDecided ? 'backfill_synthetic' : null,
            },
          });

          await tx.holdPoint.update({
            where: { id: holdPoint.id },
            data: { currentRoundId: round.id, authorityClass },
          });

          if (holdPoint.authorityClass !== authorityClass) {
            batchClassRemediated += 1;
          }

          if (holdPoint.status === 'notified' && holdPoint.releaseTokens.length > 0) {
            const binding = await tx.holdPointReleaseToken.updateMany({
              where: {
                id: { in: holdPoint.releaseTokens.map((token) => token.id) },
                holdPointId: holdPoint.id,
                usedAt: null,
                expiresAt: { gt: now },
              },
              data: { decisionRoundId: round.id },
            });
            batchTokensBound += binding.count;
          }
        }

        return {
          created: holdPoints.length,
          classRemediated: batchClassRemediated,
          tokensBound: batchTokensBound,
        };
        // Remote databases (the primary target of this operator script) pay a
        // network round-trip per row write; Prisma's default 5s interactive
        // transaction timeout aborts a 100-row batch against Railway.
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    created += batchResult.created;
    classRemediated += batchResult.classRemediated;
    tokensBound += batchResult.tokensBound;
  }

  return {
    plan,
    created,
    classRemediated,
    tokensBound,
    skippedDuringApply: plan.totalToBackfill - created,
  };
}
