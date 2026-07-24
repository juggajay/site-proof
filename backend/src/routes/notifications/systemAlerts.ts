/**
 * System-alert route handlers for critical notification issues.
 *
 * Mounted by alerts.ts under the same notifications router, after the parent
 * notifications router has already applied route-wide authentication.
 *
 * The check endpoint delegates to the SAME locked automation service the
 * hourly worker runs (lib/notificationAutomation), scoped to the caller's
 * manageable projects. It previously carried its own reimplementation of the
 * three checks, which drifted: it used calendar-yesterday for missing diaries
 * (false alerts after non-working days), assigned alerts to the calling admin
 * instead of the project alert owner, and ran without the advisory lock
 * (external review 2026-07-24, P1).
 */

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { processSystemAlertsWithLock } from '../../lib/notificationAutomation.js';
import { prisma } from '../../lib/prisma.js';
import { getAccessibleActiveProjectIds, getManageableActiveProjectIds } from './access.js';
import { toAlert } from './alertMappers.js';
import {
  buildSystemAlertsCheckResponse,
  buildSystemAlertsSummaryResponse,
} from './systemAlertResponses.js';
import { parseOptionalString } from './validation.js';

export const notificationSystemAlertsRouter = Router();

// POST /api/notifications/system-alerts/check - Check and generate system alerts for critical issues
// Runs the shared system-alerts automation job (overdue NCRs, stale hold
// points, missing diaries) for the caller's manageable active projects, under
// the same advisory lock as the hourly worker.
notificationSystemAlertsRouter.post(
  '/system-alerts/check',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    const specificProjectId = parseOptionalString(req.body.projectId, 'projectId');
    const accessibleProjectIds = await getManageableActiveProjectIds(user, specificProjectId);
    const now = new Date();

    const result = await processSystemAlertsWithLock({ now, projectIds: accessibleProjectIds });
    if (result === null) {
      throw AppError.conflict(
        'A system alert check is already running. Try again in a few minutes.',
      );
    }

    const summary = {
      overdueNCRs: result.overdueNcrAlerts,
      staleHoldPoints: result.staleHoldPointAlerts,
      missingDiaries: result.missingDiaryAlerts,
    };
    const activeAlerts = await prisma.notificationAlert.count({
      where: {
        resolvedAt: null,
        projectId: { in: accessibleProjectIds },
      },
    });

    res.json(
      buildSystemAlertsCheckResponse(
        now,
        result.projectsChecked,
        result.createdAlerts,
        summary,
        activeAlerts,
      ),
    );
  }),
);

// GET /api/notifications/system-alerts/summary - Get summary of all active system alerts
notificationSystemAlertsRouter.get(
  '/system-alerts/summary',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }

    const projectId = parseOptionalString(req.query.projectId, 'projectId');
    const accessibleProjectIds = new Set(await getAccessibleActiveProjectIds(user, projectId));

    const activeAlerts = (
      await prisma.notificationAlert.findMany({
        where: {
          resolvedAt: null,
          projectId: { in: [...accessibleProjectIds] },
        },
        orderBy: { createdAt: 'desc' },
      })
    ).map(toAlert);

    res.json(buildSystemAlertsSummaryResponse(activeAlerts));
  }),
);
