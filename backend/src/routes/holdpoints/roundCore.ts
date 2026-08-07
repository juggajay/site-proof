import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { CLOSED_NCR_STATUSES } from '../../lib/readiness/predicates.js';
import { parseHPProjectSettings, requiresSuperintendentApproval } from './validation.js';

export type HoldPointAuthorityClass = 'principal' | 'contractor_internal';

type DecisionEligibleHoldPoint = {
  status: string;
  currentRoundId: string | null;
};

type DecisionEligibleRound = {
  id: string;
  outcome: string | null;
  withdrawnAt: Date | null;
};

type ReRequestableHoldPoint = {
  id: string;
  status: string;
};

type RoundRecipient = {
  email: string;
  name: string | null;
};

export const latestDecisionRoundInclude = {
  orderBy: { roundNumber: 'desc' as const },
  take: 1,
  select: {
    outcome: true,
    decidedAt: true,
    decisionReason: true,
    linkedNcr: {
      select: {
        id: true,
        ncrNumber: true,
        status: true,
      },
    },
    _count: {
      select: {
        conditions: {
          where: { recordedSatisfiedAt: null },
        },
      },
    },
  },
} as const;

export type LatestDecisionRoundSource = {
  outcome: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  linkedNcr: {
    id: string;
    ncrNumber: string;
    status: string;
  } | null;
  _count: {
    conditions: number;
  };
};

export type LatestRoundProjection = {
  outcome: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  ncrId: string | null;
  ncrNumber: string | null;
  ncrStatus: string | null;
  openConditionCount: number;
};

export function authorityClassForProjectSettings(
  projectSettings: string | null | undefined,
): HoldPointAuthorityClass {
  return requiresSuperintendentApproval(parseHPProjectSettings(projectSettings))
    ? 'principal'
    : 'contractor_internal';
}

export function decisionEligible(
  holdPoint: DecisionEligibleHoldPoint,
  round: DecisionEligibleRound | null | undefined,
): boolean {
  return Boolean(
    round &&
    holdPoint.status === 'notified' &&
    round.outcome === null &&
    round.withdrawnAt === null &&
    holdPoint.currentRoundId === round.id,
  );
}

export function isLifecycleTerminal(status: string): boolean {
  return status === 'released' || status === 'completed';
}

export async function reRequestable(
  holdPoint: ReRequestableHoldPoint,
  db: Pick<Prisma.TransactionClient, 'holdPointDecisionRound'> = prisma,
): Promise<boolean> {
  if (holdPoint.status !== 'pending') {
    return false;
  }

  const latestRound = await db.holdPointDecisionRound.findFirst({
    where: { holdPointId: holdPoint.id },
    orderBy: { roundNumber: 'desc' },
    select: {
      outcome: true,
      linkedNcr: { select: { status: true } },
    },
  });

  return Boolean(
    latestRound?.outcome === 'rejected' &&
    latestRound.linkedNcr &&
    CLOSED_NCR_STATUSES.includes(latestRound.linkedNcr.status),
  );
}

export async function releaseRequestAllowed(
  holdPoint: ReRequestableHoldPoint,
  db: Pick<Prisma.TransactionClient, 'holdPointDecisionRound'> = prisma,
): Promise<boolean> {
  if (holdPoint.status !== 'pending') {
    return true;
  }

  const latestRound = await db.holdPointDecisionRound.findFirst({
    where: { holdPointId: holdPoint.id },
    orderBy: { roundNumber: 'desc' },
    select: { withdrawnAt: true },
  });

  return !latestRound || Boolean(latestRound.withdrawnAt) || reRequestable(holdPoint, db);
}

export function projectLatestRound(
  rounds: readonly LatestDecisionRoundSource[] | null | undefined,
): LatestRoundProjection | null {
  const round = rounds?.[0];
  if (!round) {
    return null;
  }

  return {
    outcome: round.outcome,
    decidedAt: round.decidedAt,
    decisionReason: round.decisionReason,
    ncrId: round.linkedNcr?.id ?? null,
    ncrNumber: round.linkedNcr?.ncrNumber ?? null,
    ncrStatus: round.linkedNcr?.status ?? null,
    openConditionCount: round._count.conditions,
  };
}

export async function createDecisionRoundForReleaseRequest(
  tx: Prisma.TransactionClient,
  input: {
    holdPointId: string;
    projectSettings: string | null | undefined;
    requestedAt: Date;
    requestedById: string;
    recipient: RoundRecipient;
  },
) {
  await tx.$queryRaw`SELECT id FROM hold_points WHERE id = ${input.holdPointId} FOR UPDATE`;

  const priorRound = await tx.holdPointDecisionRound.findFirst({
    where: { holdPointId: input.holdPointId },
    orderBy: { roundNumber: 'desc' },
    select: { roundNumber: true },
  });
  const authorityClass = authorityClassForProjectSettings(input.projectSettings);
  const round = await tx.holdPointDecisionRound.create({
    data: {
      holdPointId: input.holdPointId,
      roundNumber: (priorRound?.roundNumber ?? 0) + 1,
      authorityClass,
      requestedAt: input.requestedAt,
      requestedById: input.requestedById,
      recipientEmail: input.recipient.email,
      recipientName: input.recipient.name,
    },
  });

  await tx.holdPoint.update({
    where: { id: input.holdPointId },
    data: {
      currentRoundId: round.id,
      authorityClass,
    },
  });

  return round;
}

export async function withdrawCurrentDecisionRound(
  tx: Prisma.TransactionClient,
  input: {
    holdPointId: string;
    roundId: string;
    withdrawnAt: Date;
    withdrawnById: string;
    reason: string;
  },
): Promise<void> {
  const roundUpdate = await tx.holdPointDecisionRound.updateMany({
    where: {
      id: input.roundId,
      outcome: null,
      withdrawnAt: null,
    },
    data: {
      withdrawnAt: input.withdrawnAt,
      withdrawnById: input.withdrawnById,
      withdrawalReason: input.reason,
    },
  });

  if (roundUpdate.count !== 1) {
    throw new Error('ROUND_NOT_OPEN');
  }

  const holdPointUpdate = await tx.holdPoint.updateMany({
    where: {
      id: input.holdPointId,
      status: 'notified',
      currentRoundId: input.roundId,
    },
    data: {
      status: 'pending',
      notificationSentAt: null,
      notificationSentTo: null,
      scheduledDate: null,
      scheduledTime: null,
      chaseCount: 0,
      lastChasedAt: null,
    },
  });

  if (holdPointUpdate.count !== 1) {
    throw new Error('ROUND_NOT_OPEN');
  }

  await tx.holdPointReleaseToken.deleteMany({
    where: {
      holdPointId: input.holdPointId,
      usedAt: null,
    },
  });
}
