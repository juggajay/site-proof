import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { updateLotStatusFromITP } from '../itp/helpers/lotProgression.js';
import { requireProjectRole } from './access.js';
import { parseHoldPointRouteParam } from './validation.js';

const CONDITION_SATISFACTION_ROLES = ['quality_manager', 'project_manager', 'site_manager'];
const CONDITION_VERIFICATION_ATTRIBUTION =
  'verified on recorded satisfaction of release conditions';

const recordSatisfactionSchema = z
  .object({
    note: z.string().trim().max(5000).optional(),
    evidenceDocumentId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const holdPointConditionsRouter = Router();

holdPointConditionsRouter.post(
  '/:id/conditions/:conditionId/record-satisfaction',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const holdPointId = parseHoldPointRouteParam(req.params.id, 'id');
    const conditionId = parseHoldPointRouteParam(req.params.conditionId, 'conditionId');
    const parsed = recordSatisfactionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw AppError.fromZodError(parsed.error);
    }

    const condition = await prisma.holdPointReleaseCondition.findFirst({
      where: {
        id: conditionId,
        decisionRound: { holdPointId },
      },
      select: {
        sequence: true,
        decisionRound: {
          select: {
            id: true,
            outcome: true,
            decidedAt: true,
            holdPoint: {
              select: {
                id: true,
                currentRoundId: true,
                lotId: true,
                itpChecklistItemId: true,
                lot: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });

    if (!condition) {
      throw AppError.notFound('Hold point release condition');
    }

    const round = condition.decisionRound;
    if (
      round.outcome !== 'released_with_conditions' ||
      round.holdPoint.currentRoundId !== round.id
    ) {
      throw AppError.badRequest(
        'Only conditions on the current conditional-release round can be recorded satisfied.',
      );
    }

    await requireProjectRole(
      round.holdPoint.lot.projectId,
      req.user!,
      CONDITION_SATISFACTION_ROLES,
      'You do not have permission to record hold point condition satisfaction',
      { requireWritable: true },
    );

    const recordedSatisfiedAt = new Date();
    const recordedSatisfiedByName = req.user!.fullName?.trim() || 'Unknown user';
    const satisfactionNote = parsed.data.note || null;
    const evidenceDocumentId = parsed.data.evidenceDocumentId;

    const result = await prisma.$transaction(async (tx) => {
      // Serialize closures on one round. Without this lock, two different
      // conditions could both observe another open condition and neither would
      // perform the last-condition verification.
      await tx.$queryRaw`SELECT id FROM hold_point_decision_rounds WHERE id = ${round.id} FOR UPDATE`;

      if (evidenceDocumentId) {
        const evidenceDocument = await tx.document.findFirst({
          where: {
            id: evidenceDocumentId,
            projectId: round.holdPoint.lot.projectId,
          },
          select: { id: true },
        });
        if (!evidenceDocument) {
          throw AppError.badRequest('Evidence document was not found in this project.');
        }
      }

      const satisfactionUpdate = await tx.holdPointReleaseCondition.updateMany({
        where: {
          id: conditionId,
          decisionRoundId: round.id,
          recordedSatisfiedAt: null,
        },
        data: {
          recordedSatisfiedAt,
          recordedSatisfiedById: req.user!.userId,
          recordedSatisfiedByName,
          satisfactionNote,
          satisfactionEvidenceDocumentId: evidenceDocumentId ?? null,
        },
      });

      if (satisfactionUpdate.count !== 1) {
        throw AppError.badRequest('This condition satisfaction has already been recorded.');
      }

      const remainingOpenConditionCount = await tx.holdPointReleaseCondition.count({
        where: {
          decisionRoundId: round.id,
          recordedSatisfiedAt: null,
        },
      });

      let releasedItpInstanceId: string | null = null;
      if (remainingOpenConditionCount === 0) {
        const itpInstance = await tx.iTPInstance.findUnique({
          where: { lotId: round.holdPoint.lotId },
          select: { id: true },
        });
        if (itpInstance) {
          releasedItpInstanceId = itpInstance.id;
          const completionKey = {
            itpInstanceId: itpInstance.id,
            checklistItemId: round.holdPoint.itpChecklistItemId,
          };
          const verificationData = {
            verificationStatus: 'verified',
            verifiedById: null,
            verifiedAt: recordedSatisfiedAt,
            verificationNotes: CONDITION_VERIFICATION_ATTRIBUTION,
          };
          await tx.iTPCompletion.upsert({
            where: { itpInstanceId_checklistItemId: completionKey },
            update: verificationData,
            create: {
              ...completionKey,
              status: 'completed',
              completedAt: round.decidedAt ?? recordedSatisfiedAt,
              ...verificationData,
            },
          });
        }
      }

      await writeAuditLogInTransaction(tx, {
        projectId: round.holdPoint.lot.projectId,
        userId: req.user!.userId,
        entityType: 'hold_point',
        entityId: holdPointId,
        action: AuditAction.HP_CONDITION_SATISFACTION_RECORDED,
        changes: {
          decisionRoundId: round.id,
          conditionId,
          conditionSequence: condition.sequence,
          satisfactionNote,
          evidenceDocumentId: evidenceDocumentId ?? null,
          remainingOpenConditionCount,
          verificationAttribution:
            releasedItpInstanceId !== null ? CONDITION_VERIFICATION_ATTRIBUTION : null,
        },
        req,
      });

      return { remainingOpenConditionCount, releasedItpInstanceId };
    });

    if (result.releasedItpInstanceId) {
      await updateLotStatusFromITP(result.releasedItpInstanceId);
    }

    res.json({
      condition: {
        id: conditionId,
        recordedSatisfiedAt,
        recordedSatisfiedByName,
        satisfactionNote,
        satisfactionEvidenceDocumentId: evidenceDocumentId ?? null,
      },
      remainingOpenConditionCount: result.remainingOpenConditionCount,
      itpCompletionVerified: result.releasedItpInstanceId !== null,
    });
  }),
);

export { holdPointConditionsRouter };
