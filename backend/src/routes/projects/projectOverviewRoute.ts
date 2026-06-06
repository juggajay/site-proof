import { Router, type Request } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildProjectOverviewResponse } from './overviewResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectOverviewRouterDependencies = {
  isCompanyAdmin: (user: AuthenticatedUser) => boolean;
  isSubcontractorUser: (user: AuthenticatedUser) => boolean;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
};

export function createProjectOverviewRouter({
  isCompanyAdmin,
  isSubcontractorUser,
  parseProjectRouteParam,
}: ProjectOverviewRouterDependencies) {
  const projectOverviewRouter = Router();

  // GET /api/projects/:id/dashboard - Get project dashboard data with stats
  projectOverviewRouter.get(
    '/:id/dashboard',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      if (isSubcontractorUser(user)) {
        throw AppError.forbidden('Access denied to this project');
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          clientName: true,
          status: true,
          state: true,
          companyId: true,
        },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      const projectUser = await prisma.projectUser.findFirst({
        where: { projectId, userId: user.id, status: 'active' },
      });
      const companyAdmin = isCompanyAdmin(user);
      const isCompanyProject = project.companyId === user.companyId;

      if (!projectUser && !(companyAdmin && isCompanyProject)) {
        throw AppError.forbidden('Access denied to this project');
      }

      // Get today's date range for diary status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const staleHPThreshold = new Date(today);
      staleHPThreshold.setDate(staleHPThreshold.getDate() - 7);

      // Gather all stats in parallel
      const [
        lotsStats,
        ncrStats,
        ncrByCategory,
        holdPointStats,
        itpStats,
        docketStats,
        testCount,
        documentCount,
        todayDiary,
        recentActivity,
        overdueNCRs,
        staleHoldPoints,
      ] = await Promise.all([
        // Lots stats - full breakdown
        prisma.lot.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
        }),
        // NCR stats
        Promise.all([
          prisma.nCR.count({
            where: { projectId, status: { notIn: ['closed', 'closed_concession'] } },
          }),
          prisma.nCR.count({ where: { projectId } }),
          prisma.nCR.count({
            where: {
              projectId,
              status: { notIn: ['closed', 'closed_concession'] },
              dueDate: { lt: today },
            },
          }),
        ]),
        // NCR breakdown by category
        Promise.all([
          prisma.nCR.count({
            where: {
              projectId,
              category: 'major',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
          prisma.nCR.count({
            where: {
              projectId,
              category: 'minor',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
          prisma.nCR.count({
            where: {
              projectId,
              category: 'observation',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
        ]),
        // Hold point stats
        Promise.all([
          prisma.holdPoint.count({
            where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } },
          }),
          prisma.holdPoint.count({ where: { lot: { projectId }, status: 'released' } }),
        ]),
        // ITP stats
        Promise.all([
          prisma.iTPInstance.count({
            where: { lot: { projectId }, status: { in: ['not_started', 'in_progress'] } },
          }),
          prisma.iTPInstance.count({ where: { lot: { projectId }, status: 'completed' } }),
        ]),
        // Docket stats
        prisma.dailyDocket.count({ where: { projectId, status: 'pending_approval' } }),
        // Test results count
        prisma.testResult.count({ where: { lot: { projectId } } }),
        // Documents count
        prisma.document.count({ where: { projectId } }),
        // Today's diary
        prisma.dailyDiary.findFirst({
          where: { projectId, date: { gte: today, lt: tomorrow } },
          select: { status: true },
        }),
        // Recent activity (NCRs, lots, hold points, dockets, diary)
        Promise.all([
          prisma.nCR.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 4,
            select: { id: true, ncrNumber: true, status: true, category: true, updatedAt: true },
          }),
          prisma.lot.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 4,
            select: { id: true, lotNumber: true, status: true, updatedAt: true },
          }),
          prisma.holdPoint.findMany({
            where: { lot: { projectId } },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            select: {
              id: true,
              status: true,
              description: true,
              updatedAt: true,
              lot: { select: { lotNumber: true, id: true } },
            },
          }),
          prisma.dailyDocket.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            include: { subcontractorCompany: { select: { companyName: true } } },
          }),
        ]),
        // Attention: overdue NCRs
        prisma.nCR.findMany({
          where: {
            projectId,
            status: { notIn: ['closed', 'closed_concession'] },
            dueDate: { lt: today },
          },
          select: {
            id: true,
            ncrNumber: true,
            description: true,
            category: true,
            status: true,
            dueDate: true,
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
        // Attention: stale hold points
        prisma.holdPoint.findMany({
          where: {
            lot: { projectId },
            status: { in: ['pending', 'scheduled', 'requested'] },
            createdAt: { lt: staleHPThreshold },
          },
          select: {
            id: true,
            description: true,
            status: true,
            createdAt: true,
            lot: { select: { id: true, lotNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 5,
        }),
      ]);

      // Process lots stats - full breakdown
      let lotsTotal = 0;
      let lotsCompleted = 0;
      let lotsInProgress = 0;
      let lotsNotStarted = 0;
      let lotsOnHold = 0;
      lotsStats.forEach((stat) => {
        lotsTotal += stat._count;
        if (stat.status === 'completed' || stat.status === 'conformed') {
          lotsCompleted += stat._count;
        } else if (stat.status === 'in_progress') {
          lotsInProgress += stat._count;
        } else if (stat.status === 'not_started') {
          lotsNotStarted += stat._count;
        } else if (stat.status === 'on_hold') {
          lotsOnHold += stat._count;
        }
      });
      const lotsProgressPct = lotsTotal > 0 ? Math.round((lotsCompleted / lotsTotal) * 100) : 0;

      // Format recent activity
      const [recentNCRs, recentLots, recentHPs, recentDockets] = recentActivity;
      const formattedActivity = [
        ...recentNCRs.map((ncr) => ({
          id: `ncr-${ncr.id}`,
          type: 'ncr' as const,
          description: `NCR ${ncr.ncrNumber} — ${ncr.status.replace(/_/g, ' ')}`,
          timestamp: ncr.updatedAt.toISOString(),
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
        })),
        ...recentLots.map((lot) => ({
          id: `lot-${lot.id}`,
          type: 'lot' as const,
          description: `Lot ${lot.lotNumber} — ${lot.status.replace(/_/g, ' ')}`,
          timestamp: lot.updatedAt.toISOString(),
          link: `/projects/${projectId}/lots/${lot.id}`,
        })),
        ...recentHPs.map((hp) => ({
          id: `hp-${hp.id}`,
          type: 'holdpoint' as const,
          description: `Hold point ${hp.status.replace(/_/g, ' ')} — Lot ${hp.lot?.lotNumber || 'Unknown'}`,
          timestamp: hp.updatedAt.toISOString(),
          link: hp.lot ? `/projects/${projectId}/lots/${hp.lot.id}` : undefined,
        })),
        ...recentDockets.map((d) => ({
          id: `docket-${d.id}`,
          type: 'docket' as const,
          description: `Docket ${d.status.replace(/_/g, ' ')}${d.subcontractorCompany ? ` — ${d.subcontractorCompany.companyName}` : ''}`,
          timestamp: d.updatedAt.toISOString(),
          link: `/projects/${projectId}/dockets`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Format attention items
      const attentionItems = [
        ...overdueNCRs.map((ncr) => ({
          id: `ncr-${ncr.id}`,
          type: 'ncr' as const,
          title: `NCR ${ncr.ncrNumber} overdue`,
          description: ncr.description?.substring(0, 80) || 'No description',
          urgency: (ncr.category === 'major' ? 'critical' : 'warning') as 'critical' | 'warning',
          daysOverdue: ncr.dueDate
            ? Math.ceil((today.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
        })),
        ...staleHoldPoints.map((hp) => ({
          id: `hp-${hp.id}`,
          type: 'holdpoint' as const,
          title: `Hold point stale — Lot ${hp.lot?.lotNumber || 'Unknown'}`,
          description: hp.description?.substring(0, 80) || 'Pending for over 7 days',
          urgency: 'warning' as const,
          daysOverdue: Math.ceil(
            (today.getTime() - new Date(hp.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
          link: hp.lot
            ? `/projects/${projectId}/lots/${hp.lot.id}`
            : `/projects/${projectId}/hold-points`,
        })),
      ];

      res.json(
        buildProjectOverviewResponse({
          project,
          lotsTotal,
          lotsCompleted,
          lotsInProgress,
          lotsNotStarted,
          lotsOnHold,
          lotsProgressPct,
          ncrStats,
          ncrByCategory,
          holdPointStats,
          itpStats,
          docketStats,
          testCount,
          documentCount,
          todayDiaryStatus: todayDiary?.status || null,
          attentionItems,
          recentActivity: formattedActivity,
        }),
      );
    }),
  );

  return projectOverviewRouter;
}
