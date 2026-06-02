import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { TIER_PROJECT_LIMITS } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ROLES } from '../lib/roles.js';
import { PROJECT_ADMIN_ROLES } from '../lib/projectAdminInvariant.js';
import { Prisma } from '@prisma/client';
import {
  buildProjectDeletedResponse,
  buildProjectDetailResponse,
} from './projects/listDetailResponses.js';
import { buildProjectCreatedResponse } from './projects/costResponses.js';
import { buildProjectAuditLogsResponse } from './projects/auditResponses.js';
import { createProjectAreaRouter } from './projects/areaRoutes.js';
import { createProjectReadRouter } from './projects/readRoutes.js';
import { createProjectTeamRouter } from './projects/teamRoutes.js';

export const projectsRouter = Router();

// Apply authentication middleware to all project routes
projectsRouter.use(requireAuth);

type AuthenticatedUser = NonNullable<Request['user']>;
type ProjectTeamMutationClient = typeof prisma | Prisma.TransactionClient;

const PROJECT_CREATOR_ROLES = new Set<string>([ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER]);
const PROJECT_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const BLOCKED_SUBCONTRACTOR_STATUSES = ['suspended', 'removed'] as const;
const BLOCKED_SUBCONTRACTOR_STATUS_SET = new Set<string>(BLOCKED_SUBCONTRACTOR_STATUSES);
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

async function hasSubcontractorProjectIdentity(user: AuthenticatedUser): Promise<boolean> {
  if (isSubcontractorUser(user)) {
    return true;
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const now = new Date();
  const activeSubcontractorIdentity = await prisma.subcontractorCompany.findFirst({
    where: {
      status: { notIn: [...BLOCKED_SUBCONTRACTOR_STATUSES] },
      OR: [
        { users: { some: { userId: user.id } } },
        {
          AND: [
            { primaryContactEmail: { equals: normalizedEmail, mode: 'insensitive' } },
            {
              OR: [{ status: { not: 'pending_approval' } }, { invitationExpiresAt: { gt: now } }],
            },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(activeSubcontractorIdentity);
}

function isBlockedSubcontractorStatus(status: string | null | undefined): boolean {
  return Boolean(status && BLOCKED_SUBCONTRACTOR_STATUS_SET.has(status));
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
  client: ProjectTeamMutationClient,
  projectId: string,
  targetProjectUser: { role: string; status: string },
): Promise<void> {
  if (targetProjectUser.status !== 'active' || !isProjectAdminRole(targetProjectUser.role)) {
    return;
  }

  await client.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM project_users
    WHERE project_id = ${projectId}
      AND status = 'active'
      AND role IN (${Prisma.join(PROJECT_ADMIN_ROLES)})
    FOR UPDATE
  `;

  const activeAdminCount = await client.projectUser.count({
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

projectsRouter.use(
  createProjectReadRouter({
    isBlockedSubcontractorStatus,
    isCompanyAdmin,
    isSubcontractorUser,
    parseProjectRouteParam,
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

    if (await hasSubcontractorProjectIdentity(user)) {
      throw AppError.forbidden('Subcontractor portal users cannot create company projects');
    }

    if (!user.companyId) {
      throw AppError.forbidden('Users must belong to an organization before creating projects');
    }

    if (!canCreateProjectForCompany(user)) {
      throw AppError.forbidden('Only company admins and project managers can create projects');
    }

    const companyId = user.companyId;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionTier: true },
    });

    if (company) {
      const tier = company.subscriptionTier || 'basic';
      const limit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic;

      // Count existing projects for this company
      const projectCount = await prisma.project.count({
        where: { companyId },
      });

      if (projectCount >= limit) {
        throw AppError.forbidden(
          `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
        );
      }
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

    await createAuditLog({
      projectId: project.id,
      userId: user.id,
      entityType: 'project',
      entityId: project.id,
      action: AuditAction.PROJECT_CREATED,
      changes: {
        name: project.name,
        projectNumber: project.projectNumber,
        state: state || 'NSW',
        specificationSet: specificationSet || 'MRTS',
        clientName: clientName || null,
        contractValue: contractValue ?? null,
      },
      req,
    });

    res.status(201).json(buildProjectCreatedResponse(project));
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
    res.json(buildProjectDetailResponse(updatedProject));
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

    res.json(buildProjectDeletedResponse(project));
  }),
);

// ==================== User Management Routes ====================
projectsRouter.use(
  createProjectTeamRouter({
    assertCanReduceProjectAdmin,
    getProjectAccessContext,
    isProjectAdminRole,
    normalizeProjectUserEmail,
    parseProjectRouteParam,
    parseProjectTeamRole,
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

    res.json(buildProjectAuditLogsResponse(auditLogs));
  }),
);

projectsRouter.use(
  createProjectAreaRouter({
    getProjectAccessContext,
    parseOptionalNonNegativeNumber,
    parseOptionalProjectColour,
    parseProjectRouteParam,
    parseRequiredTrimmedString,
    projectAreaNameMaxLength: PROJECT_AREA_NAME_MAX_LENGTH,
  }),
);
