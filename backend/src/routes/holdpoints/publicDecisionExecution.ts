import type { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { AuditAction } from '../../lib/auditLog.js';
import { transitionLotStatusesWhere } from '../../lib/lotStatusTransition.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import { isProjectNotificationEnabled } from '../../lib/projectNotificationPreferences.js';
import { prisma } from '../../lib/prisma.js';
import { recordDecision } from '../../lib/readiness/recordDecision.js';
import { logError } from '../../lib/serverLogger.js';
import { buildProjectEntityLink } from '../notifications/links.js';
import { allocateNcrNumber, NCR_NUMBER_RETRY_LIMIT } from '../ncrs/ncrNumberAllocation.js';
import { isUniqueConstraintOn } from '../ncrs/ncrCoreValidation.js';
import { decisionEligible } from './roundCore.js';
import { runHoldPointReleasePostCommit } from './publicReleaseExecution.js';
import { assertHoldPointCompletionCanBeReleased } from './releaseCompletionGuard.js';
import {
  evaluateHoldPointReleaseReadiness,
  holdPointReleaseSnapshots,
  resolveHoldPointReleaseSufficiency,
} from './releaseDecision.js';
import { HP_SUPERINTENDENT_RELEASE_ROLES } from './superintendentRecipients.js';
import { holdPointReleaseTokenLookup } from './tokens.js';
import { parseHPProjectSettings, requiresSuperintendentApproval } from './validation.js';

const AUTHORITY_REJECTION_PREFIX = '[AUTHORITY-ORIGINATED HOLD POINT REJECTION]';

const publicDecisionTokenInclude = {
  holdPoint: {
    include: {
      lot: { include: { project: true } },
      itpChecklistItem: true,
    },
  },
} satisfies Prisma.HoldPointReleaseTokenInclude;

export type PublicDecisionToken = Prisma.HoldPointReleaseTokenGetPayload<{
  include: typeof publicDecisionTokenInclude;
}>;

type PublicDecisionOutcome = 'released' | 'released_with_conditions' | 'rejected';

type PublicDecisionTestHooks = {
  afterRoundDecide?: () => void | Promise<void>;
};

function tokenExpired(): AppError {
  return new AppError(
    410,
    'This secure release link has expired. Please contact the site team for a new link.',
    'TOKEN_EXPIRED',
  );
}

function tokenUsed(): AppError {
  return new AppError(410, 'This secure release link has already been used.', 'TOKEN_USED');
}

function roundUnavailable(): AppError {
  return new AppError(
    410,
    'This hold point release request has already been decided, withdrawn, or superseded.',
    'TOKEN_REVOKED',
  );
}

export async function loadPublicDecisionToken(
  rawToken: string,
): Promise<PublicDecisionToken | null> {
  return prisma.holdPointReleaseToken.findFirst({
    where: holdPointReleaseTokenLookup(rawToken),
    include: publicDecisionTokenInclude,
  });
}

export function assertPublicDecisionTokenAvailable(
  releaseToken: PublicDecisionToken | null,
): asserts releaseToken is PublicDecisionToken {
  if (!releaseToken) {
    throw AppError.notFound('Invalid or expired link');
  }
  if (releaseToken.expiresAt <= new Date()) {
    throw tokenExpired();
  }
  if (releaseToken.usedAt) {
    throw tokenUsed();
  }
}

/** Round-backed revocation for the public payload GET. Legacy null-round tokens stay readable. */
export async function assertPublicDecisionTokenGetAvailable(tokenId: string): Promise<void> {
  const token = await prisma.holdPointReleaseToken.findUnique({
    where: { id: tokenId },
    select: {
      usedAt: true,
      decisionRoundId: true,
      decisionRound: { select: { outcome: true, withdrawnAt: true } },
      holdPoint: { select: { currentRoundId: true } },
    },
  });

  if (!token) {
    throw AppError.notFound('Invalid or expired link');
  }
  if (token.usedAt) {
    throw tokenUsed();
  }
  if (
    token.decisionRoundId &&
    (token.decisionRoundId !== token.holdPoint.currentRoundId ||
      !token.decisionRound ||
      token.decisionRound.outcome !== null ||
      token.decisionRound.withdrawnAt !== null)
  ) {
    throw roundUnavailable();
  }
}

async function assertRecipientEligibleInTransaction(
  tx: Prisma.TransactionClient,
  token: {
    recipientEmail: string;
    holdPoint: { lot: { project: { id: string; companyId: string; settings: string | null } } };
  },
): Promise<void> {
  const project = token.holdPoint.lot.project;
  if (!requiresSuperintendentApproval(parseHPProjectSettings(project.settings))) {
    return;
  }

  const [projectUsers, companyAdmins] = await Promise.all([
    tx.projectUser.findMany({
      where: {
        projectId: project.id,
        status: 'active',
        role: { in: HP_SUPERINTENDENT_RELEASE_ROLES },
      },
      include: { user: { select: { email: true } } },
    }),
    tx.user.findMany({
      where: { companyId: project.companyId, roleInCompany: { in: ['owner', 'admin'] } },
      select: { email: true },
    }),
  ]);
  const recipientEmail = token.recipientEmail.trim().toLowerCase();
  const eligible = [...projectUsers.map((row) => row.user), ...companyAdmins].some(
    (user) => user.email.toLowerCase() === recipientEmail,
  );
  if (!eligible) {
    throw AppError.forbidden(
      'This project requires superintendent approval to release hold points.',
    );
  }
}

export async function claimPublicDecision(
  tx: Prisma.TransactionClient,
  input: {
    tokenId: string;
    decidedAt: Date;
    outcome: PublicDecisionOutcome;
    decidedByName: string | null;
    decidedByOrg?: string | null;
    decisionReason?: string | null;
    signatureDataUrl?: string | null;
    allowMissingRound?: boolean;
    testHooks?: PublicDecisionTestHooks;
  },
) {
  const token = await tx.holdPointReleaseToken.findUnique({
    where: { id: input.tokenId },
    include: publicDecisionTokenInclude,
  });
  if (!token) throw AppError.notFound('Invalid or expired link');
  if (token.expiresAt <= input.decidedAt) throw tokenExpired();
  if (token.usedAt) throw tokenUsed();

  await assertRecipientEligibleInTransaction(tx, token);

  let roundId = token.decisionRoundId;
  if (!roundId) {
    roundId = token.holdPoint.currentRoundId;
    if (!roundId) {
      if (input.allowMissingRound) {
        roundId = null;
      } else {
        throw roundUnavailable();
      }
    } else {
      const bind = await tx.holdPointReleaseToken.updateMany({
        where: { id: token.id, decisionRoundId: null, usedAt: null },
        data: { decisionRoundId: roundId },
      });
      if (bind.count !== 1) throw tokenUsed();
    }
  }

  let round: { id: string; requestedById: string | null } | null = null;
  if (roundId) {
    const currentRound = await tx.holdPointDecisionRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        holdPointId: true,
        outcome: true,
        withdrawnAt: true,
        requestedById: true,
      },
    });
    if (
      !currentRound ||
      currentRound.holdPointId !== token.holdPointId ||
      !decisionEligible(token.holdPoint, currentRound)
    ) {
      throw roundUnavailable();
    }

    const decided = await tx.holdPointDecisionRound.updateMany({
      where: { id: roundId, outcome: null, withdrawnAt: null },
      data: {
        outcome: input.outcome,
        decidedAt: input.decidedAt,
        decidedByName: input.decidedByName,
        decidedByOrg: input.decidedByOrg || null,
        decidedByTokenId: token.id,
        decisionReason: input.decisionReason || null,
        decisionMethod: 'public_token',
        signatureUrl: input.signatureDataUrl || null,
      },
    });
    if (decided.count !== 1) throw roundUnavailable();
    await input.testHooks?.afterRoundDecide?.();
    round = { id: currentRound.id, requestedById: currentRound.requestedById };
  }

  const claimed = await tx.holdPointReleaseToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: input.decidedAt } },
    data: {
      usedAt: input.decidedAt,
      releasedByName: input.decidedByName,
      releasedByOrg: input.decidedByOrg || null,
      releaseSignatureUrl: input.signatureDataUrl || null,
      releaseNotes: input.decisionReason || null,
    },
  });
  if (claimed.count !== 1) throw tokenUsed();

  return { token, round };
}

async function notifyDecisionAudience(input: {
  projectId: string;
  projectName: string;
  projectSettings: string | null;
  requestedById: string | null;
  holdPointId: string;
  lotNumber: string;
  description: string | null;
  type: 'hold_point_rejection' | 'hold_point_conditional_release';
  title: string;
  message: string;
}): Promise<void> {
  if (!isProjectNotificationEnabled(input.projectSettings, 'holdPointReleases')) return;

  try {
    const qualityManagers = await prisma.projectUser.findMany({
      where: { projectId: input.projectId, status: 'active', role: 'quality_manager' },
      select: { userId: true },
    });
    const candidateIds = new Set(qualityManagers.map((row) => row.userId));
    if (input.requestedById) candidateIds.add(input.requestedById);
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: [...candidateIds] } },
      select: { id: true },
    });
    if (existingUsers.length === 0) return;

    await prisma.notification.createMany({
      data: existingUsers.map((user) => ({
        userId: user.id,
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        message: input.message,
        linkUrl: buildProjectEntityLink('hold_point', input.holdPointId, input.projectId),
      })),
    });
  } catch (error) {
    logError('[HP Public Decision] Failed to notify the requester and project QMs:', error);
  }
}

export async function executePublicHoldPointRejection(input: {
  releaseToken: PublicDecisionToken;
  name?: string;
  org?: string;
  reason: string;
  signatureDataUrl?: string | null;
  req?: Request;
  testHooks?: PublicDecisionTestHooks;
}) {
  assertPublicDecisionTokenAvailable(input.releaseToken);
  await assertProjectAllowsWrite(input.releaseToken.holdPoint.lot.projectId);
  const decidedAt = new Date();
  const decidedByName = input.releaseToken.recipientName?.trim() || input.name || null;
  const releaseSufficiency = await resolveHoldPointReleaseSufficiency(
    input.releaseToken.holdPoint.lotId,
  );

  const decide = () =>
    recordDecision({
      projectId: input.releaseToken.holdPoint.lot.projectId,
      entityType: 'hold_point' as const,
      entityId: input.releaseToken.holdPoint.id,
      decisionKind: 'rejection' as const,
      auditAction: AuditAction.HP_PUBLIC_REJECTED,
      actor: {
        kind: 'external_token' as const,
        tokenId: input.releaseToken.id,
        label: input.releaseToken.recipientName ?? undefined,
      },
      auditChanges: {
        decisionRoundId: input.releaseToken.decisionRoundId,
        reason: input.reason,
        decidedByName,
        decidedByOrg: input.org,
        submittedName: input.name,
        tokenRecipient: input.releaseToken.recipientEmail,
        signatureDataUrl: input.signatureDataUrl ? '[captured]' : null,
      },
      req: input.req,
      evaluate: async (tx) => ({
        ...(await evaluateHoldPointReleaseReadiness(
          tx,
          [input.releaseToken.holdPoint.id],
          input.releaseToken.holdPoint.lotId,
          releaseSufficiency,
        )),
        released: false,
      }),
      mutate: async (tx) => {
        const { token, round } = await claimPublicDecision(tx, {
          tokenId: input.releaseToken.id,
          decidedAt,
          outcome: 'rejected',
          decidedByName,
          decidedByOrg: input.org,
          decisionReason: input.reason,
          signatureDataUrl: input.signatureDataUrl,
          testHooks: input.testHooks,
        });
        if (!round) throw roundUnavailable();

        const holdPointUpdate = await tx.holdPoint.updateMany({
          where: {
            id: token.holdPointId,
            status: 'notified',
            currentRoundId: round.id,
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
        if (holdPointUpdate.count !== 1) throw roundUnavailable();

        const ncrNumber = await allocateNcrNumber(tx, token.holdPoint.lot.projectId);
        const ncr = await tx.nCR.create({
          data: {
            projectId: token.holdPoint.lot.projectId,
            ncrNumber,
            category: 'other',
            raisedById: null,
            description: `${AUTHORITY_REJECTION_PREFIX}\n${input.reason}`,
            ncrLots: { create: [{ lotId: token.holdPoint.lotId }] },
          },
          select: { id: true, ncrNumber: true, status: true },
        });
        await transitionLotStatusesWhere(tx, {
          where: {
            id: token.holdPoint.lotId,
            projectId: token.holdPoint.lot.projectId,
            status: { notIn: ['conformed', 'claimed'] },
          },
          to: 'ncr_raised',
          event: {
            actorId: null,
            source: 'system',
            sourceEntityType: 'ncr',
            sourceEntityId: ncr.id,
          },
        });
        await tx.holdPointDecisionRound.update({
          where: { id: round.id },
          data: { linkedNcrId: ncr.id },
        });
        const holdPoint = await tx.holdPoint.findUniqueOrThrow({
          where: { id: token.holdPointId },
          include: { lot: true, itpChecklistItem: true },
        });
        return { holdPoint, ncr, requestedById: round.requestedById };
      },
      snapshots: (evaluation) =>
        holdPointReleaseSnapshots([input.releaseToken.holdPoint.id], evaluation),
    });

  let decision: Awaited<ReturnType<typeof decide>> | null = null;
  for (let attempt = 1; attempt <= NCR_NUMBER_RETRY_LIMIT; attempt += 1) {
    try {
      decision = await decide();
      break;
    } catch (error) {
      if (
        attempt < NCR_NUMBER_RETRY_LIMIT &&
        isUniqueConstraintOn(error, ['projectId', 'ncrNumber'])
      ) {
        continue;
      }
      throw error;
    }
  }
  if (!decision?.mutation) {
    throw AppError.conflict('Could not allocate an NCR number. Please try again.');
  }

  const mutation = decision.mutation;
  await notifyDecisionAudience({
    projectId: input.releaseToken.holdPoint.lot.projectId,
    projectName: input.releaseToken.holdPoint.lot.project.name,
    projectSettings: input.releaseToken.holdPoint.lot.project.settings,
    requestedById: mutation.requestedById,
    holdPointId: mutation.holdPoint.id,
    lotNumber: mutation.holdPoint.lot.lotNumber,
    description: mutation.holdPoint.description,
    type: 'hold_point_rejection',
    title: 'Hold Point Release Refused',
    message: `Release was refused for hold point "${mutation.holdPoint.description}" on lot ${mutation.holdPoint.lot.lotNumber}. ${mutation.ncr.ncrNumber} was raised and requires action.`,
  });
  return mutation;
}

export async function executePublicHoldPointConditionalRelease(input: {
  releaseToken: PublicDecisionToken;
  name?: string;
  org?: string;
  conditions: string[];
  notes?: string;
  signatureDataUrl?: string | null;
  req?: Request;
  testHooks?: PublicDecisionTestHooks;
}) {
  assertPublicDecisionTokenAvailable(input.releaseToken);
  await assertProjectAllowsWrite(input.releaseToken.holdPoint.lot.projectId);
  const decidedAt = new Date();
  const decidedByName = input.releaseToken.recipientName?.trim() || input.name || null;
  const releaseSufficiency = await resolveHoldPointReleaseSufficiency(
    input.releaseToken.holdPoint.lotId,
  );
  const decision = await recordDecision({
    projectId: input.releaseToken.holdPoint.lot.projectId,
    entityType: 'hold_point',
    entityId: input.releaseToken.holdPoint.id,
    decisionKind: 'conditional_release',
    auditAction: AuditAction.HP_PUBLIC_CONDITIONALLY_RELEASED,
    actor: {
      kind: 'external_token',
      tokenId: input.releaseToken.id,
      label: input.releaseToken.recipientName ?? undefined,
    },
    auditChanges: {
      decisionRoundId: input.releaseToken.decisionRoundId,
      conditionCount: input.conditions.length,
      notes: input.notes,
      decidedByName,
      decidedByOrg: input.org,
      submittedName: input.name,
      tokenRecipient: input.releaseToken.recipientEmail,
      signatureDataUrl: input.signatureDataUrl ? '[captured]' : null,
    },
    req: input.req,
    evaluate: (tx) =>
      evaluateHoldPointReleaseReadiness(
        tx,
        [input.releaseToken.holdPoint.id],
        input.releaseToken.holdPoint.lotId,
        releaseSufficiency,
      ),
    mutate: async (tx) => {
      const { token, round } = await claimPublicDecision(tx, {
        tokenId: input.releaseToken.id,
        decidedAt,
        outcome: 'released_with_conditions',
        decidedByName,
        decidedByOrg: input.org,
        decisionReason: input.notes,
        signatureDataUrl: input.signatureDataUrl,
        testHooks: input.testHooks,
      });
      if (!round) throw roundUnavailable();

      await tx.holdPointReleaseCondition.createMany({
        data: input.conditions.map((text, index) => ({
          decisionRoundId: round.id,
          sequence: index + 1,
          text,
        })),
      });
      const holdPointUpdate = await tx.holdPoint.updateMany({
        where: { id: token.holdPointId, status: 'notified', currentRoundId: round.id },
        data: {
          status: 'released',
          releasedAt: decidedAt,
          releasedByName: decidedByName,
          releasedByOrg: input.org || null,
          releaseMethod: 'secure_link',
          releaseSignatureUrl: input.signatureDataUrl || null,
          releaseNotes: input.notes || null,
        },
      });
      if (holdPointUpdate.count !== 1) throw roundUnavailable();

      let releasedItpInstanceId: string | null = null;
      const itpInstance = await tx.iTPInstance.findUnique({
        where: { lotId: token.holdPoint.lotId },
        select: { id: true },
      });
      if (itpInstance) {
        releasedItpInstanceId = itpInstance.id;
        const completionKey = {
          itpInstanceId: itpInstance.id,
          checklistItemId: token.holdPoint.itpChecklistItemId,
        };
        const existingCompletion = await tx.iTPCompletion.findUnique({
          where: { itpInstanceId_checklistItemId: completionKey },
          select: { status: true },
        });
        assertHoldPointCompletionCanBeReleased(existingCompletion);
        await tx.iTPCompletion.upsert({
          where: { itpInstanceId_checklistItemId: completionKey },
          update: { status: 'completed', completedAt: decidedAt },
          create: { ...completionKey, status: 'completed', completedAt: decidedAt },
        });
      }
      const holdPoint = await tx.holdPoint.findUniqueOrThrow({
        where: { id: token.holdPointId },
        include: { lot: true, itpChecklistItem: true },
      });
      return { holdPoint, releasedItpInstanceId, requestedById: round.requestedById };
    },
    snapshots: (evaluation) =>
      holdPointReleaseSnapshots([input.releaseToken.holdPoint.id], evaluation),
  });
  const mutation = decision.mutation!;
  await notifyDecisionAudience({
    projectId: input.releaseToken.holdPoint.lot.projectId,
    projectName: input.releaseToken.holdPoint.lot.project.name,
    projectSettings: input.releaseToken.holdPoint.lot.project.settings,
    requestedById: mutation.requestedById,
    holdPointId: mutation.holdPoint.id,
    lotNumber: mutation.holdPoint.lot.lotNumber,
    description: mutation.holdPoint.description,
    type: 'hold_point_conditional_release',
    title: 'Hold Point Released with Conditions',
    message: `Hold point "${mutation.holdPoint.description}" on lot ${mutation.holdPoint.lot.lotNumber} was released with ${input.conditions.length} condition${input.conditions.length === 1 ? '' : 's'} requiring action.`,
  });
  await runHoldPointReleasePostCommit({
    holdPoint: mutation.holdPoint,
    project: input.releaseToken.holdPoint.lot.project,
    releasedItpInstanceId: mutation.releasedItpInstanceId,
    releasedAt: decidedAt,
    effectiveReleasedByName: decidedByName ?? '',
    releasedByOrg: input.org,
    releaseNotes: input.notes,
    suppressTeamReleaseNotifications: true,
  });
  return { ...mutation, decidedAt, decidedByName };
}
