import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createAuditLog, AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { TIER_PROJECT_LIMITS } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ROLES } from '../lib/roles.js';
import { PROJECT_ADMIN_ROLES } from '../lib/projectAdminInvariant.js';

export const projectsRouter = Router();

// Apply authentication middleware to all project routes
projectsRouter.use(requireAuth);

type AuthenticatedUser = NonNullable<Request['user']>;

const PROJECT_COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager'];
const PROJECT_CREATOR_ROLES = new Set<string>([ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER]);
const PROJECT_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const BLOCKED_SUBCONTRACTOR_STATUSES = new Set(['suspended', 'removed']);
const PROJECT_TEAM_ROLES = new Set<string>([
  ROLES.ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.QUALITY_MANAGER,
  ROLES.SITE_MANAGER,
  ROLES.FOREMAN,
  ROLES.SITE_ENGINEER,
  ROLES.VIEWER,
]);
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROJECT_NAME_MAX_LENGTH = 120;
const PROJECT_NUMBER_MAX_LENGTH = 64;
const PROJECT_CLIENT_MAX_LENGTH = 160;
const PROJECT_STATE_MAX_LENGTH = 64;
const PROJECT_SPECIFICATION_SET_MAX_LENGTH = 64;
const PROJECT_PREFIX_MAX_LENGTH = 50;
const PROJECT_AREA_NAME_MAX_LENGTH = 120;
const PROJECT_ROUTE_PARAM_MAX_LENGTH = 128;
const PROJECT_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const PROJECT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PROJECT_WORKING_DAYS_PATTERN = /^[0-6](,[0-6])*$/;
const DECIMAL_NUMBER_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const INTEGER_NUMBER_PATTERN = /^\d+$/;
const PROJECT_SETTINGS_MAX_LENGTH = 20000;
const PROJECT_STATUSES = new Set(['active', 'archived', 'completed', 'on_hold']);

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

function isProjectAdminRole(role: string | null | undefined): boolean {
  return PROJECT_ADMIN_ROLES.includes(role || '');
}

function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return PROJECT_SUBCONTRACTOR_ROLES.has(user.roleInCompany);
}

function canCreateProjectForCompany(user: AuthenticatedUser): boolean {
  return PROJECT_CREATOR_ROLES.has(user.roleInCompany);
}

function isBlockedSubcontractorStatus(status: string | null | undefined): boolean {
  return Boolean(status && BLOCKED_SUBCONTRACTOR_STATUSES.has(status));
}

function normalizeProjectUserEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest('Email is required');
  }
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest('Invalid email address');
  }
  return email;
}

function parseProjectTeamRole(value: unknown): string {
  if (typeof value !== 'string' || !PROJECT_TEAM_ROLES.has(value)) {
    throw AppError.badRequest('Invalid project role');
  }
  return value;
}

function parseProjectRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > PROJECT_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function parseRequiredTrimmedString(value: unknown, fieldName: string, maxLength: number): string {
  if (value === undefined || value === null) {
    throw AppError.badRequest(`${fieldName} is required`);
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

function parseOptionalTrimmedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

const DATE_COMPONENT_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

function assertValidDateComponent(value: string, errorMessage: string) {
  const match = DATE_COMPONENT_INPUT_PATTERN.exec(value);
  if (!match) {
    throw AppError.badRequest(errorMessage);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.badRequest(errorMessage);
  }
}

function parseOptionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a date string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  assertValidDateComponent(trimmed, `${fieldName} must be a valid date`);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }
  return parsed;
}

function parseOptionalNonNegativeNumber(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!DECIMAL_NUMBER_PATTERN.test(trimmed)) {
      throw AppError.badRequest(`${fieldName} must be a non-negative number`);
    }
    parsed = Number(trimmed);
  } else {
    parsed = Number.NaN;
  }
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw AppError.badRequest(`${fieldName} must be a non-negative number`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!INTEGER_NUMBER_PATTERN.test(trimmed)) {
      throw AppError.badRequest(`${fieldName} must be a positive integer`);
    }
    parsed = Number(trimmed);
  } else {
    parsed = Number.NaN;
  }
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalWorkingTime(value: unknown, fieldName: string): string | null | undefined {
  const parsed = parseOptionalTrimmedString(value, fieldName, 5);
  if (parsed === undefined || parsed === null) return parsed;
  if (!PROJECT_TIME_PATTERN.test(parsed)) {
    throw AppError.badRequest(`${fieldName} must be in HH:mm format`);
  }
  return parsed;
}

function parseOptionalWorkingDays(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const parsed = Array.isArray(value)
    ? value.map((day) => String(day).trim()).join(',')
    : typeof value === 'string'
      ? value.trim()
      : '';

  if (!parsed || !PROJECT_WORKING_DAYS_PATTERN.test(parsed)) {
    throw AppError.badRequest('Working days must contain comma-separated day numbers from 0 to 6');
  }

  return parsed;
}

function parseOptionalProjectSettings(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest('Settings must be an object');
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > PROJECT_SETTINGS_MAX_LENGTH) {
    throw AppError.badRequest('Settings payload is too large');
  }

  return value as Record<string, unknown>;
}

function parseOptionalProjectColour(value: unknown): string | null | undefined {
  const parsed = parseOptionalTrimmedString(value, 'Area colour', 7);
  if (parsed === undefined || parsed === null) return parsed;
  if (!PROJECT_COLOUR_PATTERN.test(parsed)) {
    throw AppError.badRequest('Area colour must be a 6-digit hex colour');
  }
  return parsed.toUpperCase();
}

async function getProjectAccessContext(projectId: string, user: AuthenticatedUser) {
  const shouldUseProjectTeamAccess = !isSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    }),
    shouldUseProjectTeamAccess
      ? prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { id: true, role: true },
        })
      : null,
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  const hasCompanyAdminAccess = isCompanyAdmin(user) && project.companyId === user.companyId;
  const isProjectAdmin = isProjectAdminRole(projectUser?.role) || hasCompanyAdminAccess;

  return {
    project,
    projectUser,
    hasProjectAccess: Boolean(projectUser) || hasCompanyAdminAccess,
    isProjectAdmin,
  };
}

async function assertCanReduceProjectAdmin(
  projectId: string,
  targetProjectUser: { role: string; status: string },
): Promise<void> {
  if (targetProjectUser.status !== 'active' || !isProjectAdminRole(targetProjectUser.role)) {
    return;
  }

  const activeAdminCount = await prisma.projectUser.count({
    where: {
      projectId,
      status: 'active',
      role: { in: PROJECT_ADMIN_ROLES },
    },
  });

  if (activeAdminCount <= 1) {
    throw AppError.badRequest('Project must have at least one active admin or project manager');
  }
}

// GET /api/projects - List all projects accessible to the user
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const isSubcontractor = isSubcontractorUser(user);

    // Get projects the user has access to via ProjectUser table
    const projectUsers = isSubcontractor
      ? []
      : await prisma.projectUser.findMany({
          where: { userId: user.id, status: 'active' },
          select: { projectId: true },
        });
    const projectIds = projectUsers.map((pu) => pu.projectId);

    // Also include projects from user's company for company admins/owners
    const hasCompanyAdminRole = isCompanyAdmin(user);

    // For subcontractor users, get projects via SubcontractorUser -> SubcontractorCompany
    let subcontractorProjectIds: string[] = [];

    if (isSubcontractor) {
      // Get linked subcontractor companies, excluding suspended/removed project links.
      const subcontractorUsers = await prisma.subcontractorUser.findMany({
        where: { userId: user.id },
        include: {
          subcontractorCompany: {
            select: { projectId: true, status: true },
          },
        },
      });

      subcontractorProjectIds = Array.from(
        new Set(
          subcontractorUsers
            .map((link) => link.subcontractorCompany)
            .filter((company) => company && !isBlockedSubcontractorStatus(company.status))
            .map((company) => company!.projectId),
        ),
      );
    }

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { id: { in: projectIds } },
          { id: { in: subcontractorProjectIds } },
          ...(hasCompanyAdminRole && user.companyId ? [{ companyId: user.companyId }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        startDate: true,
        targetCompletion: true,
        contractValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hide contract values from subcontractors (commercial isolation)
    const sanitizedProjects = isSubcontractor
      ? projects.map((p) => ({ ...p, contractValue: null }))
      : projects;

    res.json({ projects: sanitizedProjects });
  }),
);

// GET /api/projects/:id - Get a single project
projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;
    const isSubcontractor = isSubcontractorUser(user);

    // Check access - user must have access to the project
    const projectUser = isSubcontractor
      ? null
      : await prisma.projectUser.findFirst({
          where: {
            projectId: id,
            userId: user.id,
            status: 'active',
          },
        });

    // Check subcontractor access
    let hasSubcontractorAccess = false;
    let subcontractorSuspended = false;

    if (isSubcontractor) {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: {
          subcontractorCompany: {
            select: { projectId: true, status: true },
          },
        },
      });

      // Check if subcontractor has access to this project
      const companyProjectMatch = subcontractorUser?.subcontractorCompany?.projectId === id;

      // Check if subcontractor is suspended or removed
      const companyStatus = subcontractorUser?.subcontractorCompany?.status;
      subcontractorSuspended = isBlockedSubcontractorStatus(companyStatus);

      // Only grant access if project matches AND company is not suspended/removed
      hasSubcontractorAccess = companyProjectMatch && !subcontractorSuspended;
    }

    // Also allow company admins/owners to access company projects
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        clientName: true,
        status: true,
        state: true,
        specificationSet: true,
        startDate: true,
        targetCompletion: true,
        contractValue: true,
        companyId: true,
        lotPrefix: true,
        lotStartingNumber: true,
        ncrPrefix: true,
        ncrStartingNumber: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
        chainageStart: true,
        chainageEnd: true,
        settings: true, // Feature #697 - HP recipients stored in JSON settings
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    // Check if user has access via ProjectUser, subcontractor, or is company admin/owner
    const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
    const isCompanyProject = project.companyId === user.companyId;

    // Provide specific error message for suspended subcontractors
    if (isSubcontractor && subcontractorSuspended) {
      throw AppError.forbidden(
        'Your company has been suspended from this project. Please contact the project manager.',
      );
    }

    if (!projectUser && !hasSubcontractorAccess && !(isCompanyAdmin && isCompanyProject)) {
      throw AppError.forbidden('Access denied to this project');
    }

    // Hide contract value from subcontractors (commercial isolation)
    if (isSubcontractor) {
      project.contractValue = null;
      project.settings = null;
      project.workingHoursStart = null;
      project.workingHoursEnd = null;
      project.workingDays = null;
    }

    // Map projectNumber to code for frontend consistency
    res.json({
      project: {
        ...project,
        code: project.projectNumber,
        chainageStart: project.chainageStart ? Number(project.chainageStart) : null,
        chainageEnd: project.chainageEnd ? Number(project.chainageEnd) : null,
      },
    });
  }),
);

// GET /api/projects/:id/dashboard - Get project dashboard data with stats
projectsRouter.get(
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

    res.json({
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber,
        status: project.status,
        client: project.clientName,
        state: project.state,
      },
      stats: {
        lots: {
          total: lotsTotal,
          completed: lotsCompleted,
          inProgress: lotsInProgress,
          notStarted: lotsNotStarted,
          onHold: lotsOnHold,
          progressPct: lotsProgressPct,
        },
        ncrs: {
          open: ncrStats[0],
          total: ncrStats[1],
          overdue: ncrStats[2],
          major: ncrByCategory[0],
          minor: ncrByCategory[1],
          observation: ncrByCategory[2],
        },
        holdPoints: {
          pending: holdPointStats[0],
          released: holdPointStats[1],
        },
        itps: {
          pending: itpStats[0],
          completed: itpStats[1],
        },
        dockets: {
          pendingApproval: docketStats,
        },
        tests: {
          total: testCount,
        },
        documents: {
          total: documentCount,
        },
        diary: {
          todayStatus: todayDiary?.status || null,
        },
      },
      attentionItems,
      recentActivity: formattedActivity.slice(0, 10),
    });
  }),
);

// GET /api/projects/:id/costs - Get project cost breakdown
// Returns summary, by-subcontractor, and by-lot cost data
projectsRouter.get(
  '/:id/costs',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Get the project to check ownership and get budget
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true, contractValue: true },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id, status: 'active' },
    });
    const companyAdmin = isCompanyAdmin(user);
    const isCompanyProject = project.companyId === user.companyId;

    // Check subcontractor access - they should not see cost details
    const isSubcontractor =
      user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin';
    if (isSubcontractor) {
      throw AppError.forbidden('Access denied. Subcontractors cannot view project costs.');
    }

    if (!projectUser && !(companyAdmin && isCompanyProject)) {
      throw AppError.forbidden('Access denied to this project');
    }

    const effectiveRole = companyAdmin && isCompanyProject ? user.roleInCompany : projectUser?.role;
    if (!effectiveRole || !PROJECT_COMMERCIAL_ROLES.includes(effectiveRole)) {
      throw AppError.forbidden('You do not have permission to view project costs');
    }

    // Get all approved dockets with their subcontractor info
    const dockets = await prisma.dailyDocket.findMany({
      where: {
        projectId,
        status: 'approved',
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    // Get pending docket count
    const pendingDocketCount = await prisma.dailyDocket.count({
      where: {
        projectId,
        status: 'pending_approval',
      },
    });

    // Calculate totals
    let totalLabourCost = 0;
    let totalPlantCost = 0;

    // Track by subcontractor
    const subcontractorMap = new Map<
      string,
      {
        id: string;
        companyName: string;
        labourCost: number;
        plantCost: number;
        totalCost: number;
        approvedDockets: number;
      }
    >();

    for (const docket of dockets) {
      const labour = Number(docket.totalLabourSubmitted || 0);
      const plant = Number(docket.totalPlantSubmitted || 0);

      totalLabourCost += labour;
      totalPlantCost += plant;

      // Aggregate by subcontractor
      const subId = docket.subcontractorCompanyId;
      const existing = subcontractorMap.get(subId) || {
        id: subId,
        companyName: docket.subcontractorCompany?.companyName || 'Unknown',
        labourCost: 0,
        plantCost: 0,
        totalCost: 0,
        approvedDockets: 0,
      };
      existing.labourCost += labour;
      existing.plantCost += plant;
      existing.totalCost += labour + plant;
      existing.approvedDockets += 1;
      subcontractorMap.set(subId, existing);
    }

    const totalCost = totalLabourCost + totalPlantCost;
    const budgetTotal = Number(project.contractValue || 0);
    const budgetVariance = budgetTotal - totalCost; // Positive = under budget

    // Get lots with their budget amounts
    const lots = await prisma.lot.findMany({
      where: { projectId },
      select: {
        id: true,
        lotNumber: true,
        activityType: true,
        budgetAmount: true,
      },
      orderBy: { lotNumber: 'asc' },
    });

    // Get cost allocations per lot from docket entries
    // Labour allocations
    const labourLotAllocations = await prisma.docketLabourLot.findMany({
      where: {
        docketLabour: {
          docket: {
            projectId,
            status: 'approved',
          },
        },
      },
      include: {
        docketLabour: {
          select: { submittedCost: true },
        },
      },
    });

    // Plant allocations
    const plantLotAllocations = await prisma.docketPlantLot.findMany({
      where: {
        docketPlant: {
          docket: {
            projectId,
            status: 'approved',
          },
        },
      },
      include: {
        docketPlant: {
          select: { submittedCost: true },
        },
      },
    });

    // Calculate cost per lot
    const lotCostMap = new Map<string, number>();

    // Add labour costs
    for (const alloc of labourLotAllocations) {
      const cost = Number(alloc.docketLabour?.submittedCost || 0);
      const existing = lotCostMap.get(alloc.lotId) || 0;
      lotCostMap.set(alloc.lotId, existing + cost);
    }

    // Add plant costs
    for (const alloc of plantLotAllocations) {
      const cost = Number(alloc.docketPlant?.submittedCost || 0);
      const existing = lotCostMap.get(alloc.lotId) || 0;
      lotCostMap.set(alloc.lotId, existing + cost);
    }

    // Build lot costs array
    const lotCosts = lots.map((lot) => {
      const budgetAmount = Number(lot.budgetAmount || 0);
      const actualCost = lotCostMap.get(lot.id) || 0;
      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        activity: lot.activityType,
        budgetAmount,
        actualCost,
        variance: budgetAmount - actualCost, // Positive = under budget
      };
    });

    // Build subcontractor costs array
    const subcontractorCosts = Array.from(subcontractorMap.values()).sort(
      (a, b) => b.totalCost - a.totalCost,
    ); // Sort by total cost descending

    res.json({
      summary: {
        totalLabourCost,
        totalPlantCost,
        totalCost,
        budgetTotal,
        budgetVariance,
        approvedDockets: dockets.length,
        pendingDockets: pendingDocketCount,
      },
      subcontractorCosts,
      lotCosts,
    });
  }),
);

// POST /api/projects - Create a new project
projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const name = parseRequiredTrimmedString(req.body.name, 'Name', PROJECT_NAME_MAX_LENGTH);
    const projectNumber = parseOptionalTrimmedString(
      req.body.projectNumber,
      'Project number',
      PROJECT_NUMBER_MAX_LENGTH,
    );
    const clientName = parseOptionalTrimmedString(
      req.body.clientName,
      'Client name',
      PROJECT_CLIENT_MAX_LENGTH,
    );
    const startDate = parseOptionalDate(req.body.startDate, 'Start date');
    const targetCompletion = parseOptionalDate(req.body.targetCompletion, 'Target completion');
    const contractValue = parseOptionalNonNegativeNumber(req.body.contractValue, 'Contract value');
    const state = parseOptionalTrimmedString(req.body.state, 'State', PROJECT_STATE_MAX_LENGTH);
    const specificationSet = parseOptionalTrimmedString(
      req.body.specificationSet,
      'Specification set',
      PROJECT_SPECIFICATION_SET_MAX_LENGTH,
    );

    if (user.companyId && !canCreateProjectForCompany(user)) {
      throw AppError.forbidden('Only company admins and project managers can create projects');
    }

    // Check project limit if user has a company
    if (user.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { subscriptionTier: true },
      });

      if (company) {
        const tier = company.subscriptionTier || 'basic';
        const limit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic;

        // Count existing projects for this company
        const projectCount = await prisma.project.count({
          where: { companyId: user.companyId },
        });

        if (projectCount >= limit) {
          throw AppError.forbidden(
            `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
          );
        }
      }
    }

    // Create company for user if they don't have one
    let companyId = user.companyId;
    if (!companyId) {
      const company = await prisma.company.create({
        data: {
          name: `${user.fullName || user.email}'s Company`,
          abn: '',
        },
      });
      companyId = company.id;
      // Update user's company and set them as owner
      await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          roleInCompany: 'owner', // Make them owner of the new company
        },
      });
    }

    // Generate project number if not provided
    const generatedProjectNumber = projectNumber || `PRJ-${Date.now().toString(36).toUpperCase()}`;

    const project = await prisma.project.create({
      data: {
        name,
        projectNumber: generatedProjectNumber,
        clientName,
        startDate,
        targetCompletion,
        contractValue: contractValue ?? null,
        companyId: companyId,
        state: state || 'NSW',
        specificationSet: specificationSet || 'MRTS',
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        createdAt: true,
      },
    });

    // Add the creating user to the project
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      },
    });

    res.status(201).json({ project });
  }),
);

// PATCH /api/projects/:id - Update project settings
projectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;
    if (isSubcontractorUser(user)) {
      throw AppError.forbidden('Access denied. Only project admins can update settings.');
    }

    const name =
      req.body.name === undefined
        ? undefined
        : parseRequiredTrimmedString(req.body.name, 'Project name', PROJECT_NAME_MAX_LENGTH);
    const code =
      req.body.code === undefined
        ? undefined
        : parseRequiredTrimmedString(req.body.code, 'Project code', PROJECT_NUMBER_MAX_LENGTH);
    const lotPrefix =
      req.body.lotPrefix === undefined
        ? undefined
        : parseRequiredTrimmedString(req.body.lotPrefix, 'Lot prefix', PROJECT_PREFIX_MAX_LENGTH);
    const ncrPrefix =
      req.body.ncrPrefix === undefined
        ? undefined
        : parseRequiredTrimmedString(req.body.ncrPrefix, 'NCR prefix', PROJECT_PREFIX_MAX_LENGTH);
    const lotStartingNumber = parseOptionalPositiveInteger(
      req.body.lotStartingNumber,
      'Lot starting number',
    );
    const ncrStartingNumber = parseOptionalPositiveInteger(
      req.body.ncrStartingNumber,
      'NCR starting number',
    );
    const workingHoursStart = parseOptionalWorkingTime(
      req.body.workingHoursStart,
      'Working hours start',
    );
    const workingHoursEnd = parseOptionalWorkingTime(req.body.workingHoursEnd, 'Working hours end');
    const workingDays = parseOptionalWorkingDays(req.body.workingDays);
    const chainageStart = parseOptionalNonNegativeNumber(req.body.chainageStart, 'Chainage start');
    const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
    const settings = parseOptionalProjectSettings(req.body.settings);
    const status = req.body.status;
    if (status !== undefined && (typeof status !== 'string' || !PROJECT_STATUSES.has(status))) {
      throw AppError.badRequest('Invalid status value');
    }

    // Check access - user must be admin or project admin
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: id,
        userId: user.id,
        status: 'active',
      },
    });

    const isProjectAdmin = projectUser?.role === 'admin' || projectUser?.role === 'project_manager';
    const companyAdmin = isCompanyAdmin(user);

    // Get the project to check company ownership
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        chainageStart: true,
        chainageEnd: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        settings: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    const isCompanyProject = project.companyId === user.companyId;

    if (!isProjectAdmin && !(companyAdmin && isCompanyProject)) {
      throw AppError.forbidden('Access denied. Only project admins can update settings.');
    }

    const effectiveChainageStart =
      chainageStart !== undefined
        ? chainageStart
        : project.chainageStart === null
          ? null
          : Number(project.chainageStart);
    const effectiveChainageEnd =
      chainageEnd !== undefined
        ? chainageEnd
        : project.chainageEnd === null
          ? null
          : Number(project.chainageEnd);
    if (
      effectiveChainageStart !== null &&
      effectiveChainageEnd !== null &&
      effectiveChainageStart >= effectiveChainageEnd
    ) {
      throw AppError.badRequest('Chainage end must be greater than chainage start');
    }

    const effectiveWorkingHoursStart =
      workingHoursStart !== undefined ? workingHoursStart : project.workingHoursStart;
    const effectiveWorkingHoursEnd =
      workingHoursEnd !== undefined ? workingHoursEnd : project.workingHoursEnd;
    if (
      effectiveWorkingHoursStart &&
      effectiveWorkingHoursEnd &&
      effectiveWorkingHoursStart >= effectiveWorkingHoursEnd
    ) {
      throw AppError.badRequest('Working hours end must be later than working hours start');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.projectNumber = code;
    if (lotPrefix !== undefined) updateData.lotPrefix = lotPrefix;
    if (lotStartingNumber !== undefined) updateData.lotStartingNumber = lotStartingNumber;
    if (ncrPrefix !== undefined) updateData.ncrPrefix = ncrPrefix;
    if (ncrStartingNumber !== undefined) updateData.ncrStartingNumber = ncrStartingNumber;
    if (workingHoursStart !== undefined) updateData.workingHoursStart = workingHoursStart;
    if (workingHoursEnd !== undefined) updateData.workingHoursEnd = workingHoursEnd;
    if (workingDays !== undefined) updateData.workingDays = workingDays;
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
    if (status !== undefined) updateData.status = status;
    // Feature #697 - Store HP recipients and other notification settings in JSON settings field
    if (settings !== undefined) {
      let existingSettings: Record<string, unknown> = {};
      if (project.settings) {
        try {
          existingSettings = JSON.parse(project.settings);
        } catch {
          // Invalid JSON, start fresh
        }
      }
      const mergedSettings = { ...existingSettings, ...settings };
      updateData.settings = JSON.stringify(mergedSettings);
    }

    // Update the project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        projectNumber: true,
        lotPrefix: true,
        lotStartingNumber: true,
        ncrPrefix: true,
        ncrStartingNumber: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
        chainageStart: true,
        chainageEnd: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Map projectNumber to code for frontend consistency
    res.json({
      project: {
        ...updatedProject,
        code: updatedProject.projectNumber,
        chainageStart: updatedProject.chainageStart ? Number(updatedProject.chainageStart) : null,
        chainageEnd: updatedProject.chainageEnd ? Number(updatedProject.chainageEnd) : null,
      },
    });
  }),
);

// DELETE /api/projects/:id - Delete a project (requires password confirmation)
projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseProjectRouteParam(req.params.id, 'id');
    const { password } = req.body;
    const user = req.user!;

    // Password is required for deletion
    if (typeof password !== 'string' || password.length === 0) {
      throw AppError.badRequest('Password confirmation is required to delete a project');
    }

    // Get the full user record with password hash
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
        roleInCompany: true,
        companyId: true,
      },
    });

    if (!fullUser || !fullUser.passwordHash) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Verify password
    const { verifyPassword } = await import('../lib/auth.js');
    if (!verifyPassword(password, fullUser.passwordHash)) {
      throw AppError.unauthorized('Incorrect password');
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    // Authorization: only company owners/admins may delete projects in their own company.
    const isAdmin = fullUser.roleInCompany === 'admin' || fullUser.roleInCompany === 'owner';
    const isCompanyProject = project.companyId === fullUser.companyId;

    if (!isAdmin || !isCompanyProject) {
      throw AppError.forbidden('You do not have permission to delete this project');
    }

    // Delete the project (cascading deletes will handle related records)
    await prisma.project.delete({
      where: { id },
    });

    res.json({
      message: 'Project deleted successfully',
      deletedProject: { id: project.id, name: project.name },
    });
  }),
);

// ==================== User Management Routes ====================

// GET /api/projects/:id/users - Get all users in a project
projectsRouter.get(
  '/:id/users',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;

    const access = await getProjectAccessContext(projectId, user);

    if (!access.hasProjectAccess) {
      throw AppError.forbidden('Access denied');
    }

    const projectUsers = await prisma.projectUser.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    res.json({
      users: projectUsers.map((pu) => ({
        id: pu.id,
        userId: pu.userId,
        email: pu.user.email,
        fullName: pu.user.fullName,
        role: pu.role,
        status: pu.status,
        invitedAt: pu.invitedAt,
        acceptedAt: pu.acceptedAt,
      })),
    });
  }),
);

// POST /api/projects/:id/users - Invite a user to a project
projectsRouter.post(
  '/:id/users',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const email = normalizeProjectUserEmail(req.body.email);
    const role = parseProjectTeamRole(req.body.role);
    const currentUser = req.user!;

    const access = await getProjectAccessContext(projectId, currentUser);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can invite users');
    }

    // Project team assignment links an existing company member to a project;
    // it does not create a new company seat.
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, companyId: true },
    });

    if (!invitedUser) {
      throw AppError.notFound('User');
    }

    if (invitedUser.companyId !== access.project.companyId) {
      throw AppError.forbidden(
        'User must belong to this company before they can be added to the project',
      );
    }

    // Check if already a member
    const existingMember = await prisma.projectUser.findFirst({
      where: { projectId, userId: invitedUser.id },
    });

    if (existingMember) {
      throw AppError.badRequest('User is already a member of this project');
    }

    // Create project user
    const newProjectUser = await prisma.projectUser.create({
      data: {
        projectId,
        userId: invitedUser.id,
        role,
        status: 'active',
        acceptedAt: new Date(), // Auto-accept for now
      },
    });

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: newProjectUser.id,
      action: AuditAction.USER_INVITED,
      changes: {
        invitedUserId: invitedUser.id,
        invitedUserEmail: invitedUser.email,
        role,
      },
      req,
    });

    // Feature #939 - Send team invitation notification to invited user
    try {
      // Get project details for the notification
      const projectDetails = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, projectNumber: true },
      });

      const inviterName = currentUser.fullName || currentUser.email || 'A team member';

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId: invitedUser.id,
          projectId,
          type: 'team_invitation',
          title: 'Team Invitation',
          message: `${inviterName} has invited you to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}.`,
          linkUrl: `/projects/${projectId}`,
        },
      });

      // Send email notification
      await sendNotificationIfEnabled(
        invitedUser.id,
        'mentions', // Using mentions type for team invitations
        {
          title: 'Team Invitation',
          message: `You've been invited to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}. Project: ${projectDetails?.projectNumber || 'N/A'}`,
          linkUrl: `/projects/${projectId}`,
          projectName: projectDetails?.name || undefined,
        },
      );
    } catch {
      // Don't fail the main request if notifications fail
    }

    res.status(201).json({
      message: 'User invited successfully',
      projectUser: {
        id: newProjectUser.id,
        userId: invitedUser.id,
        email: invitedUser.email,
        fullName: invitedUser.fullName,
        role,
      },
    });
  }),
);

// PATCH /api/projects/:id/users/:userId - Update user role in project
projectsRouter.patch(
  '/:id/users/:userId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const targetUserId = parseProjectRouteParam(req.params.userId, 'userId');
    const role = parseProjectTeamRole(req.body.role);
    const currentUser = req.user!;

    const access = await getProjectAccessContext(projectId, currentUser);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can change user roles');
    }

    if (targetUserId === currentUser.id) {
      throw AppError.badRequest('You cannot change your own project role');
    }

    // Find the target project user
    const targetProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: targetUserId },
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    if (!targetProjectUser) {
      throw AppError.notFound('User in project');
    }

    const oldRole = targetProjectUser.role;

    if (!isProjectAdminRole(role)) {
      await assertCanReduceProjectAdmin(projectId, targetProjectUser);
    }

    // Update role
    const updated = await prisma.projectUser.update({
      where: { id: targetProjectUser.id },
      data: { role },
    });

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: targetProjectUser.id,
      action: AuditAction.USER_ROLE_CHANGED,
      changes: {
        targetUserId,
        targetUserEmail: targetProjectUser.user.email,
        oldRole,
        newRole: role,
      },
      req,
    });

    // Feature #940 - Send role change notification to the user
    if (oldRole !== role) {
      try {
        // Get project details for the notification
        const projectDetails = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true },
        });

        const changerName = currentUser.fullName || currentUser.email || 'An administrator';
        const formattedOldRole = oldRole.replace(/_/g, ' ');
        const formattedNewRole = role.replace(/_/g, ' ');

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            projectId,
            type: 'role_change',
            title: 'Role Changed',
            message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole} by ${changerName}.`,
            linkUrl: `/projects/${projectId}`,
          },
        });

        // Send email notification
        await sendNotificationIfEnabled(
          targetUserId,
          'mentions', // Using mentions type for role changes
          {
            title: 'Role Changed',
            message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole}.`,
            projectName: projectDetails?.name,
            linkUrl: `/projects/${projectId}`,
          },
        );
      } catch {
        // Don't fail the main request if notifications fail
      }
    }

    res.json({
      message: 'User role updated successfully',
      projectUser: {
        id: updated.id,
        userId: targetUserId,
        email: targetProjectUser.user.email,
        role: updated.role,
      },
    });
  }),
);

// DELETE /api/projects/:id/users/:userId - Remove user from project
projectsRouter.delete(
  '/:id/users/:userId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const targetUserId = parseProjectRouteParam(req.params.userId, 'userId');
    const currentUser = req.user!;

    const access = await getProjectAccessContext(projectId, currentUser);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can remove users');
    }

    // Find the target project user
    const targetProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: targetUserId },
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    if (!targetProjectUser) {
      throw AppError.notFound('User in project');
    }

    // Can't remove yourself
    if (targetUserId === currentUser.id) {
      throw AppError.badRequest('You cannot remove yourself from the project');
    }

    await assertCanReduceProjectAdmin(projectId, targetProjectUser);

    // Delete the project user
    await prisma.projectUser.delete({
      where: { id: targetProjectUser.id },
    });

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: targetProjectUser.id,
      action: AuditAction.USER_REMOVED,
      changes: {
        removedUserId: targetUserId,
        removedUserEmail: targetProjectUser.user.email,
        removedUserRole: targetProjectUser.role,
      },
      req,
    });

    // Feature #941 - Send removal notification to the removed user
    try {
      // Get project details for the notification
      const projectDetails = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, projectNumber: true },
      });

      const removerName = currentUser.fullName || currentUser.email || 'An administrator';
      const formattedRole = targetProjectUser.role.replace(/_/g, ' ');

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          projectId: null, // Project access has been removed, so we don't link to the project
          type: 'project_removal',
          title: 'Removed from Project',
          message: `You have been removed from ${projectDetails?.name || 'a project'} by ${removerName}. Your previous role was ${formattedRole}.`,
          linkUrl: '/projects', // Link to projects list since they no longer have access to this project
        },
      });

      // Send email notification
      await sendNotificationIfEnabled(
        targetUserId,
        'mentions', // Using mentions type for removal notifications
        {
          title: 'Removed from Project',
          message: `You have been removed from ${projectDetails?.name || 'a project'}. Your previous role was ${formattedRole}.`,
          projectName: projectDetails?.name,
          linkUrl: '/projects',
        },
      );
    } catch {
      // Don't fail the main request if notifications fail
    }

    res.json({
      message: 'User removed successfully',
      removedUser: {
        userId: targetUserId,
        email: targetProjectUser.user.email,
      },
    });
  }),
);

// GET /api/projects/:id/audit-logs - Get audit logs for a project
projectsRouter.get(
  '/:id/audit-logs',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;

    const access = await getProjectAccessContext(projectId, user);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can view audit logs');
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { projectId },
      include: {
        user: {
          select: { email: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 entries
    });

    res.json({
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        changes: parseAuditLogChanges(log.changes),
        performedBy: log.user
          ? {
              email: log.user.email,
              fullName: log.user.fullName,
            }
          : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
    });
  }),
);

// ============================================================================
// Project Areas
// ============================================================================

// GET /api/projects/:id/areas - Get all project areas
projectsRouter.get(
  '/:id/areas',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;

    const access = await getProjectAccessContext(projectId, user);

    if (!access.hasProjectAccess) {
      throw AppError.forbidden('Not a member of this project');
    }

    const areas = await prisma.projectArea.findMany({
      where: { projectId },
      orderBy: { chainageStart: 'asc' },
    });

    res.json({
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt,
      })),
    });
  }),
);

// POST /api/projects/:id/areas - Create a new project area
projectsRouter.post(
  '/:id/areas',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const user = req.user!;
    const name = parseRequiredTrimmedString(
      req.body.name,
      'Area name',
      PROJECT_AREA_NAME_MAX_LENGTH,
    );
    const chainageStart = parseOptionalNonNegativeNumber(req.body.chainageStart, 'Chainage start');
    const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
    const colour = parseOptionalProjectColour(req.body.colour);

    const access = await getProjectAccessContext(projectId, user);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can create areas');
    }

    // Feature #906: Require chainage range for areas
    if (chainageStart == null || chainageEnd == null) {
      throw AppError.badRequest(
        'Both chainage start and chainage end are required for project areas.',
      );
    }

    // Validate start is less than end
    if (chainageStart >= chainageEnd) {
      throw AppError.badRequest('Chainage start must be less than chainage end.');
    }

    const area = await prisma.projectArea.create({
      data: {
        projectId,
        name,
        chainageStart,
        chainageEnd,
        colour: colour ?? null,
      },
    });

    res.status(201).json({
      area: {
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt,
      },
    });
  }),
);

// PATCH /api/projects/:id/areas/:areaId - Update a project area
projectsRouter.patch(
  '/:id/areas/:areaId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const areaId = parseProjectRouteParam(req.params.areaId, 'areaId');
    const user = req.user!;
    const name =
      req.body.name === undefined
        ? undefined
        : parseRequiredTrimmedString(req.body.name, 'Area name', PROJECT_AREA_NAME_MAX_LENGTH);
    const chainageStart = parseOptionalNonNegativeNumber(req.body.chainageStart, 'Chainage start');
    const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
    const colour = parseOptionalProjectColour(req.body.colour);

    const access = await getProjectAccessContext(projectId, user);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can update areas');
    }

    // Check area exists and belongs to project
    const existingArea = await prisma.projectArea.findFirst({
      where: { id: areaId, projectId },
    });

    if (!existingArea) {
      throw AppError.notFound('Area');
    }

    // Feature #906: Validate chainage if being updated
    // If either chainage is being set to null, reject
    if (
      (req.body.chainageStart !== undefined && chainageStart == null) ||
      (req.body.chainageEnd !== undefined && chainageEnd == null)
    ) {
      throw AppError.badRequest(
        'Both chainage start and chainage end are required for project areas.',
      );
    }

    const newChainageStart =
      chainageStart !== undefined
        ? chainageStart
        : existingArea.chainageStart === null
          ? null
          : Number(existingArea.chainageStart);
    const newChainageEnd =
      chainageEnd !== undefined
        ? chainageEnd
        : existingArea.chainageEnd === null
          ? null
          : Number(existingArea.chainageEnd);

    if (newChainageStart != null && newChainageEnd != null && newChainageStart >= newChainageEnd) {
      throw AppError.badRequest('Chainage start must be less than chainage end.');
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
    if (colour !== undefined) updateData.colour = colour;

    const area = await prisma.projectArea.update({
      where: { id: areaId },
      data: updateData,
    });

    res.json({
      area: {
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt,
      },
    });
  }),
);

// DELETE /api/projects/:id/areas/:areaId - Delete a project area
projectsRouter.delete(
  '/:id/areas/:areaId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.id, 'id');
    const areaId = parseProjectRouteParam(req.params.areaId, 'areaId');
    const user = req.user!;

    const access = await getProjectAccessContext(projectId, user);

    if (!access.isProjectAdmin) {
      throw AppError.forbidden('Only admins can delete areas');
    }

    // Check area exists and belongs to project
    const existingArea = await prisma.projectArea.findFirst({
      where: { id: areaId, projectId },
    });

    if (!existingArea) {
      throw AppError.notFound('Area');
    }

    await prisma.projectArea.delete({
      where: { id: areaId },
    });

    res.json({ message: 'Area deleted successfully' });
  }),
);
