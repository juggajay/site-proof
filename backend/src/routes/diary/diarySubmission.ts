import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, writeAuditLogInTransaction, AuditAction } from '../../lib/auditLog.js';
import { requireEffectiveProjectRole } from '../../lib/projectAccess.js';
import {
  parseDiaryRouteParam,
  requireDiaryReadAccess,
  requireDiaryWriteAccess,
  requireEditableDiaryForWrite,
  isDiaryLocked,
} from './diaryAccess.js';
import {
  buildDiaryAddendumCreatedResponse,
  buildDiaryAddendumsResponse,
  buildDiaryReopenedResponse,
  buildDiarySubmitResponse,
  buildDiaryValidationResponse,
} from './diarySubmissionResponses.js';

const router = Router();
const DIARY_ADDENDUM_MAX_LENGTH = 5000;
// M31: reopening a submitted diary is restricted to project leadership; foreman
// and site roles cannot. A reason is mandatory and audited.
const DIARY_REOPEN_ROLES = new Set(['owner', 'admin', 'project_manager']);
const DIARY_REOPEN_REASON_MAX_LENGTH = 1000;

// GET /api/diary/:diaryId/validate - Validate diary before submission
router.get(
  '/:diaryId/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        personnel: true,
        plant: true,
        activities: true,
        delays: true,
        visitors: true,
        deliveries: true,
        events: true,
      },
    });

    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDiaryReadAccess(req.user!, diary.projectId, 'Access denied');

    const warnings: Array<{ section: string; message: string; severity: 'warning' | 'info' }> = [];
    const errors: Array<{ section: string; message: string }> = [];

    // Check weather data
    if (!diary.weatherConditions && diary.temperatureMax === null) {
      warnings.push({
        section: 'weather',
        message: 'Weather information is not filled in',
        severity: 'warning',
      });
    }

    // Check personnel
    if (diary.personnel.length === 0) {
      warnings.push({
        section: 'personnel',
        message: 'No personnel entries recorded',
        severity: 'warning',
      });
    }

    // Check activities
    if (diary.activities.length === 0) {
      warnings.push({
        section: 'activities',
        message: 'No activities recorded for this day',
        severity: 'warning',
      });
    }

    // Check if late submission
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (diary.date < today) {
      warnings.push({
        section: 'submission',
        message: 'This diary is being submitted late',
        severity: 'info',
      });
    }

    // Check for incomplete personnel hours
    const personnelWithoutHours = diary.personnel.filter((p) => p.hours === null);
    if (personnelWithoutHours.length > 0) {
      warnings.push({
        section: 'personnel',
        message: `${personnelWithoutHours.length} personnel entries are missing hours`,
        severity: 'warning',
      });
    }

    // Check for incomplete delays
    const delaysWithoutDuration = diary.delays.filter((d) => d.durationHours === null);
    if (delaysWithoutDuration.length > 0) {
      warnings.push({
        section: 'delays',
        message: `${delaysWithoutDuration.length} delay entries are missing duration`,
        severity: 'warning',
      });
    }

    const isValid = errors.length === 0;
    const hasWarnings = warnings.length > 0;

    res.json(
      buildDiaryValidationResponse({
        isValid,
        hasWarnings,
        errors,
        warnings,
        summary: {
          personnel: diary.personnel.length,
          activities: diary.activities.length,
          plant: diary.plant.length,
          delays: diary.delays.length,
          visitors: diary.visitors.length,
          hasWeather: diary.weatherConditions !== null || diary.temperatureMax !== null,
        },
      }),
    );
  }),
);

// POST /api/diary/:diaryId/submit - Submit diary
router.post(
  '/:diaryId/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const { acknowledgeWarnings } = req.body;
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    if (acknowledgeWarnings !== undefined && typeof acknowledgeWarnings !== 'boolean') {
      throw AppError.badRequest('acknowledgeWarnings must be a boolean');
    }

    const { updatedDiary, previousStatus, warnings } = await prisma.$transaction(async (tx) => {
      await requireEditableDiaryForWrite(
        tx,
        req.user!,
        diaryId,
        'You do not have permission to submit this diary',
      );

      const diary = await tx.dailyDiary.findUnique({
        where: { id: diaryId },
        include: {
          personnel: true,
          plant: true,
          activities: true,
          delays: true,
          deliveries: true,
          events: true,
        },
      });
      if (!diary) {
        throw AppError.notFound('Diary not found');
      }

      // Check for warnings and require acknowledgement while the parent row is locked.
      const warnings: string[] = [];
      if (!diary.weatherConditions && diary.temperatureMax === null) {
        warnings.push('Weather information is not filled in');
      }
      if (diary.personnel.length === 0) {
        warnings.push('No personnel entries recorded');
      }
      if (diary.activities.length === 0) {
        warnings.push('No activities recorded');
      }

      // If there are warnings and user hasn't acknowledged them, return warnings
      if (warnings.length > 0 && !acknowledgeWarnings) {
        throw new AppError(
          422,
          'Diary has warnings that need acknowledgement',
          'VALIDATION_ERROR',
          {
            warnings,
            requiresAcknowledgement: true,
          },
        );
      }

      // Check if diary date is in the past (late submission)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isLate = diary.date < today;

      const updatedDiary = await tx.dailyDiary.update({
        where: { id: diaryId },
        data: {
          status: 'submitted',
          submittedById: userId,
          submittedAt: new Date(),
          isLate,
        },
        include: {
          submittedBy: { select: { id: true, fullName: true, email: true } },
          personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
          plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
          activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
          visitors: true,
          delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
          deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
          events: { include: { lot: { select: { id: true, lotNumber: true } } } },
        },
      });

      return { updatedDiary, previousStatus: diary.status, warnings };
    });

    await createAuditLog({
      projectId: updatedDiary.projectId,
      userId,
      entityType: 'daily_diary',
      entityId: updatedDiary.id,
      action: AuditAction.DIARY_SUBMITTED,
      changes: {
        date: updatedDiary.date.toISOString().split('T')[0],
        status: { from: previousStatus, to: updatedDiary.status },
        warningsAcknowledged: warnings.length > 0,
        isLate: updatedDiary.isLate,
      },
      req,
    });

    res.json(buildDiarySubmitResponse(updatedDiary, warnings.length > 0));
  }),
);

// POST /api/diary/:diaryId/addendum - Add addendum to submitted diary
router.post(
  '/:diaryId/addendum',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const { content } = req.body;
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw AppError.badRequest('Addendum content is required');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > DIARY_ADDENDUM_MAX_LENGTH) {
      throw AppError.badRequest(
        `Addendum content cannot exceed ${DIARY_ADDENDUM_MAX_LENGTH} characters`,
      );
    }

    // Find the diary
    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
    });

    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDiaryWriteAccess(
      req.user!,
      diary.projectId,
      'You do not have permission to add diary addendums',
    );

    // Verify diary is submitted
    if (diary.status !== 'submitted') {
      throw AppError.badRequest('Addendums can only be added to submitted diaries');
    }

    // M32: once a submitted diary auto-locks, it is finalized — a project
    // manager must reopen it (M31) before any further changes.
    if (isDiaryLocked(diary)) {
      throw AppError.badRequest(
        'This diary is locked. Ask a project manager to reopen it before adding notes.',
      );
    }

    // Create the addendum
    const addendum = await prisma.diaryAddendum.create({
      data: {
        diaryId,
        content: trimmedContent,
        addedById: userId,
      },
      include: {
        addedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await createAuditLog({
      projectId: diary.projectId,
      userId,
      entityType: 'diary_addendum',
      entityId: addendum.id,
      action: AuditAction.DIARY_ADDENDUM_ADDED,
      changes: {
        diaryId,
        diaryDate: diary.date.toISOString().split('T')[0],
        contentLength: trimmedContent.length,
      },
      req,
    });

    res.status(201).json(buildDiaryAddendumCreatedResponse(addendum));
  }),
);

// POST /api/diary/:diaryId/reopen - Reopen a submitted diary back to draft (M31)
router.post(
  '/:diaryId/reopen',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const { reason } = req.body;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw AppError.badRequest('A reason is required to reopen a diary');
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length > DIARY_REOPEN_REASON_MAX_LENGTH) {
      throw AppError.badRequest(
        `Reason cannot exceed ${DIARY_REOPEN_REASON_MAX_LENGTH} characters`,
      );
    }

    const updatedDiary = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; projectId: string; status: string }>>`
        SELECT id, project_id AS "projectId", status
        FROM daily_diaries
        WHERE id = ${diaryId}
        FOR UPDATE
      `;
      const diary = rows[0];
      if (!diary) {
        throw AppError.notFound('Diary not found');
      }

      // M31: only owner/admin/project_manager may reopen (foreman/site roles
      // cannot). This is the override for the M32 auto-lock, so it deliberately
      // does not check the lock state.
      await requireEffectiveProjectRole(
        req.user!,
        diary.projectId,
        DIARY_REOPEN_ROLES,
        'Only project managers, admins, and owners can reopen submitted diaries',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      if (diary.status !== 'submitted') {
        throw AppError.badRequest('Only submitted diaries can be reopened');
      }

      const reopened = await tx.dailyDiary.update({
        where: { id: diaryId },
        data: { status: 'draft', submittedAt: null, submittedById: null, lockedAt: null },
      });

      // Reopening reverts a submitted record, so the audited reason must persist
      // with the change (hard-fail in-transaction).
      await writeAuditLogInTransaction(tx, {
        projectId: reopened.projectId,
        userId,
        entityType: 'daily_diary',
        entityId: reopened.id,
        action: AuditAction.DIARY_REOPENED,
        changes: {
          date: reopened.date.toISOString().split('T')[0],
          status: { from: 'submitted', to: 'draft' },
          reason: trimmedReason,
        },
        req,
      });

      return reopened;
    });

    res.json(buildDiaryReopenedResponse(updatedDiary));
  }),
);

// GET /api/diary/:diaryId/addendums - Get addendums for a diary
router.get(
  '/:diaryId/addendums',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    // Find the diary
    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
    });

    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDiaryReadAccess(req.user!, diary.projectId, 'Access denied');

    // Get addendums
    const addendums = await prisma.diaryAddendum.findMany({
      where: { diaryId },
      include: {
        addedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { addedAt: 'asc' },
    });

    res.json(buildDiaryAddendumsResponse(addendums));
  }),
);

export { router as diarySubmissionRouter };
