import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { activeSubcontractorCompanyWhere, assertProjectAllowsWrite } from '../lib/projectAccess.js';
import {
  buildSubcontractorsForProjectResponse,
  calculateApprovedDocketTotalCost,
} from './subcontractors/invitationResponses.js';
import { createSubcontractorAdminRouter } from './subcontractors/adminRoutes.js';
import {
  createSubcontractorAbnValidationRouter,
  validateABN,
} from './subcontractors/abnValidationRoutes.js';
import { createSubcontractorDirectoryRouter } from './subcontractors/directoryRoutes.js';
import { createSubcontractorInvitationRouters } from './subcontractors/invitationRoutes.js';
import { createSubcontractorMyCompanyRouter } from './subcontractors/myCompanyRoutes.js';
import { createSubcontractorPortalAccessRouter } from './subcontractors/portalAccessRoutes.js';
import { createSubcontractorRosterAdminRouter } from './subcontractors/rosterAdminRoutes.js';

export const subcontractorsRouter = Router();

type AuthenticatedUser = NonNullable<Request['user']>;

const HEAD_CONTRACTOR_PROJECT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager'];
const SUBCONTRACTOR_PORTAL_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const BLOCKED_SUBCONTRACTOR_STATUSES = new Set(['suspended', 'removed']);
const HEAD_CONTRACTOR_COMPANY_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'foreman',
  'site_engineer',
  'quality_manager',
]);
const ID_MAX_LENGTH = 120;
const COMPANY_NAME_MAX_LENGTH = 160;
const PERSON_NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 40;
const ROLE_MAX_LENGTH = 80;
const EQUIPMENT_TEXT_MAX_LENGTH = 160;
const ABN_MAX_LENGTH = 32;

const DEFAULT_PORTAL_ACCESS = {
  lots: true,
  itps: true,
  holdPoints: true,
  testResults: true,
  ncrs: false,
  documents: true,
};
const RATE_MAX_VALUE = 100000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]{3,40}$/;
const RATE_STRING_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

function isHeadContractorRole(user: AuthenticatedUser): boolean {
  return HEAD_CONTRACTOR_PROJECT_ROLES.includes(user.roleInCompany || '');
}

function isSubcontractorPortalRole(user: AuthenticatedUser): boolean {
  return SUBCONTRACTOR_PORTAL_ROLES.has(user.roleInCompany || '');
}

function canManageLinkedSubcontractorCompany(user: AuthenticatedUser, linkRole: string): boolean {
  return user.roleInCompany === 'subcontractor_admin' || linkRole === 'admin';
}

function assertStandaloneSubcontractorPortalUser(user: AuthenticatedUser) {
  if (user.companyId || !isSubcontractorPortalRole(user)) {
    throw AppError.forbidden('Only standalone subcontractor portal users can access this endpoint');
  }
}

function assertSubcontractorPortalActive(company: { status: string }) {
  if (BLOCKED_SUBCONTRACTOR_STATUSES.has(company.status)) {
    throw AppError.forbidden(
      'Your company has been suspended from this project. Please contact the project manager.',
    );
  }
}

function normalizeRequiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (hasControlCharacter(normalized)) {
    throw AppError.badRequest(`${field} contains invalid characters`);
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${field} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeRequiredText(value, field, maxLength);
}

function normalizeEmail(value: unknown, field: string): string {
  const email = normalizeRequiredText(value, field, EMAIL_MAX_LENGTH).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest(`${field} must be a valid email address`);
  }
  return email;
}

function normalizeOptionalPhone(value: unknown, field: string): string | null {
  const phone = normalizeOptionalText(value, field, PHONE_MAX_LENGTH);
  if (phone && !PHONE_PATTERN.test(phone)) {
    throw AppError.badRequest(`${field} must be a valid phone number`);
  }
  return phone;
}

function normalizeOptionalAbn(value: unknown): string | null {
  const abn = normalizeOptionalText(value, 'abn', ABN_MAX_LENGTH);
  if (!abn) return null;

  const validation = validateABN(abn);
  if (!validation.valid) {
    throw AppError.badRequest(validation.error || 'Invalid ABN', { code: 'INVALID_ABN' });
  }

  return abn.replace(/[\s-]/g, '');
}

function normalizeRate(
  value: unknown,
  field: string,
  options: { required?: boolean; allowZero?: boolean } = {},
): number {
  const required = options.required ?? true;
  const allowZero = options.allowZero ?? false;

  if (value === undefined || value === null || value === '') {
    if (!required) return 0;
    throw AppError.badRequest(`${field} is required`);
  }

  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      if (!required) return 0;
      throw AppError.badRequest(`${field} is required`);
    }
    if (!RATE_STRING_PATTERN.test(trimmed)) {
      throw AppError.badRequest(`${field} must be a valid number with up to 2 decimal places`);
    }
    parsed = Number(trimmed);
  } else {
    parsed = NaN;
  }

  if (!Number.isFinite(parsed)) {
    throw AppError.badRequest(`${field} must be a valid number`);
  }

  if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > Number.EPSILON * 100) {
    throw AppError.badRequest(`${field} must have no more than 2 decimal places`);
  }

  if (parsed < 0 || (!allowZero && parsed === 0)) {
    throw AppError.badRequest(`${field} must be greater than ${allowZero ? 'or equal to ' : ''}0`);
  }

  if (parsed > RATE_MAX_VALUE) {
    throw AppError.badRequest(`${field} must be ${RATE_MAX_VALUE} or less`);
  }

  return Math.round(parsed * 100) / 100;
}

function companyNameMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeIdParam(value: unknown, field = 'id'): string {
  return normalizeRequiredText(value, field, ID_MAX_LENGTH);
}

function getRequestedProjectScope(req: Request): string | null {
  const queryProjectId =
    req.query.projectId === undefined ? null : normalizeIdParam(req.query.projectId, 'projectId');
  const bodyProjectId =
    req.body && Object.prototype.hasOwnProperty.call(req.body, 'projectId')
      ? normalizeIdParam(req.body.projectId, 'projectId')
      : null;

  if (queryProjectId && bodyProjectId && queryProjectId !== bodyProjectId) {
    throw AppError.badRequest('projectId in query and body must match');
  }

  return bodyProjectId || queryProjectId;
}

function getRequestedSubcontractorCompanyScope(req: Request): string | null {
  const querySubcontractorCompanyId =
    req.query.subcontractorCompanyId === undefined
      ? null
      : normalizeIdParam(req.query.subcontractorCompanyId, 'subcontractorCompanyId');
  const bodySubcontractorCompanyId =
    req.body && Object.prototype.hasOwnProperty.call(req.body, 'subcontractorCompanyId')
      ? normalizeIdParam(req.body.subcontractorCompanyId, 'subcontractorCompanyId')
      : null;

  if (
    querySubcontractorCompanyId &&
    bodySubcontractorCompanyId &&
    querySubcontractorCompanyId !== bodySubcontractorCompanyId
  ) {
    throw AppError.badRequest('subcontractorCompanyId in query and body must match');
  }

  return bodySubcontractorCompanyId || querySubcontractorCompanyId;
}

async function getScopedSubcontractorUserLink(req: Request, user: AuthenticatedUser) {
  const requestedProjectId = getRequestedProjectScope(req);
  const requestedSubcontractorCompanyId = getRequestedSubcontractorCompanyScope(req);
  const baseWhere: Prisma.SubcontractorUserWhereInput = {
    userId: user.id,
    ...(requestedSubcontractorCompanyId
      ? { subcontractorCompanyId: requestedSubcontractorCompanyId }
      : {}),
    subcontractorCompany: requestedProjectId ? { projectId: requestedProjectId } : {},
  };

  const activeWhere: Prisma.SubcontractorUserWhereInput = {
    userId: user.id,
    ...(requestedSubcontractorCompanyId
      ? { subcontractorCompanyId: requestedSubcontractorCompanyId }
      : {}),
    subcontractorCompany: activeSubcontractorCompanyWhere(
      requestedProjectId ? { projectId: requestedProjectId } : {},
    ),
  };

  const activeLinks = await prisma.subcontractorUser.findMany({
    where: activeWhere,
    include: { subcontractorCompany: true },
    orderBy: { createdAt: 'desc' },
  });

  let subcontractorUser =
    activeLinks.length === 1 || requestedSubcontractorCompanyId || !requestedProjectId
      ? (activeLinks[0] ?? null)
      : null;

  if (!subcontractorUser && requestedProjectId && activeLinks.length > 1) {
    throw AppError.badRequest(
      'subcontractorCompanyId is required when your account is linked to multiple subcontractors for this project',
    );
  }

  if (!subcontractorUser) {
    subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: baseWhere,
      include: { subcontractorCompany: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!subcontractorUser && requestedSubcontractorCompanyId) {
    subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId: user.id,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      },
      include: { subcontractorCompany: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
    throw requestedProjectId
      ? AppError.forbidden('You do not have subcontractor portal access to this project')
      : AppError.notFound('Subcontractor company');
  }

  if (
    requestedProjectId &&
    subcontractorUser.subcontractorCompany.projectId !== requestedProjectId
  ) {
    throw AppError.badRequest('subcontractorCompanyId does not belong to the requested project');
  }

  return subcontractorUser;
}

function parseOptionalBooleanQuery(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw AppError.badRequest(`${field} must be true or false`);
}

async function requireSubcontractorProjectAccess(
  projectId: string,
  user: AuthenticatedUser,
  manage = false,
  options: { requireWritable?: boolean } = {},
) {
  const shouldUseProjectTeamAccess = !isSubcontractorPortalRole(user);
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
  const hasProjectAccess = Boolean(projectUser) || hasCompanyAdminAccess;

  if (!hasProjectAccess) {
    throw AppError.forbidden('You do not have access to this project');
  }

  if (manage) {
    const canManage =
      hasCompanyAdminAccess || HEAD_CONTRACTOR_PROJECT_ROLES.includes(projectUser?.role || '');
    if (!canManage) {
      throw AppError.forbidden('Only project managers or higher can manage subcontractors');
    }
  }

  if (options.requireWritable) {
    await assertProjectAllowsWrite(projectId);
  }

  return { project, projectUser };
}

const subcontractorInvitationRouters = createSubcontractorInvitationRouters({
  blockedSubcontractorStatuses: BLOCKED_SUBCONTRACTOR_STATUSES,
  headContractorCompanyRoles: HEAD_CONTRACTOR_COMPANY_ROLES,
  idMaxLength: ID_MAX_LENGTH,
  companyNameMaxLength: COMPANY_NAME_MAX_LENGTH,
  personNameMaxLength: PERSON_NAME_MAX_LENGTH,
  normalizeIdParam,
  normalizeRequiredText,
  normalizeOptionalText,
  normalizeEmail,
  normalizeOptionalPhone,
  normalizeOptionalAbn,
  companyNameMatches,
  isSubcontractorPortalRole,
  requireSubcontractorProjectAccess,
});

// ================================================================================
// PUBLIC ENDPOINTS (no auth required) - Must be defined BEFORE requireAuth
// ================================================================================

subcontractorsRouter.use(subcontractorInvitationRouters.publicRouter);

// ================================================================================
// PROTECTED ENDPOINTS (auth required)
// ================================================================================

// Apply authentication middleware to all subsequent routes
subcontractorsRouter.use(requireAuth);
subcontractorsRouter.use(subcontractorInvitationRouters.authenticatedRouter);

// GET /api/subcontractors/directory - Get global subcontractors for the user's organization
// This allows selecting existing subcontractors when inviting to a new project
subcontractorsRouter.use(
  createSubcontractorDirectoryRouter({
    isHeadContractorRole,
  }),
);

subcontractorsRouter.use(
  createSubcontractorMyCompanyRouter({
    defaultPortalAccess: DEFAULT_PORTAL_ACCESS,
    assertStandaloneSubcontractorPortalUser,
    assertSubcontractorPortalActive,
    canManageLinkedSubcontractorCompany,
    getScopedSubcontractorUserLink,
    normalizeIdParam,
    normalizeRequiredText,
    normalizeOptionalText,
    normalizeOptionalPhone,
    normalizeRate,
    personNameMaxLength: PERSON_NAME_MAX_LENGTH,
    roleMaxLength: ROLE_MAX_LENGTH,
    equipmentTextMaxLength: EQUIPMENT_TEXT_MAX_LENGTH,
  }),
);

subcontractorsRouter.use(
  createSubcontractorAdminRouter({
    normalizeIdParam,
    requireSubcontractorProjectAccess,
  }),
);

subcontractorsRouter.use(
  createSubcontractorPortalAccessRouter({
    defaultPortalAccess: DEFAULT_PORTAL_ACCESS,
    normalizeIdParam,
    assertSubcontractorPortalActive,
    requireSubcontractorProjectAccess,
  }),
);

// GET /api/subcontractors/project/:projectId - Get all subcontractors for a project (head contractor view)
subcontractorsRouter.get(
  '/project/:projectId',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeIdParam(req.params.projectId, 'Project ID');
    const includeRemoved =
      parseOptionalBooleanQuery(req.query.includeRemoved, 'includeRemoved') ?? false;

    await requireSubcontractorProjectAccess(projectId, user, true);

    // Get subcontractors for this project
    const whereClause: Prisma.SubcontractorCompanyWhereInput = { projectId };

    // By default, exclude removed subcontractors unless specifically requested
    if (!includeRemoved) {
      whereClause.status = { not: 'removed' };
    }

    const subcontractors = await prisma.subcontractorCompany.findMany({
      where: whereClause,
      include: {
        employeeRoster: true,
        plantRegister: true,
        dailyDockets: {
          where: { status: 'approved' },
          select: {
            id: true,
            totalLabourSubmitted: true,
            totalPlantSubmitted: true,
            labourEntries: {
              select: {
                submittedCost: true,
                approvedCost: true,
              },
            },
            plantEntries: {
              select: {
                submittedCost: true,
                approvedCost: true,
              },
            },
          },
        },
        lotAssignments: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    // Calculate totals for each subcontractor
    const formattedSubcontractors = subcontractors.map((sub) => {
      const totalApprovedDockets = sub.dailyDockets.length;
      const totalCost = calculateApprovedDocketTotalCost(sub.dailyDockets);

      return {
        id: sub.id,
        companyName: sub.companyName,
        abn: sub.abn || '',
        primaryContact: sub.primaryContactName || '',
        email: sub.primaryContactEmail || '',
        phone: sub.primaryContactPhone || '',
        status: sub.status,
        portalAccess: sub.portalAccess || DEFAULT_PORTAL_ACCESS,
        employees: sub.employeeRoster.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role || '',
          hourlyRate: Number(e.hourlyRate) || 0,
          status: e.status,
        })),
        plant: sub.plantRegister.map((p) => ({
          id: p.id,
          type: p.type,
          description: p.description || '',
          idRego: p.idRego || '',
          dryRate: Number(p.dryRate) || 0,
          wetRate: Number(p.wetRate) || 0,
          status: p.status,
        })),
        totalApprovedDockets,
        totalCost,
        assignedLotCount: sub.lotAssignments.length,
      };
    });

    res.json(buildSubcontractorsForProjectResponse(formattedSubcontractors));
  }),
);

subcontractorsRouter.use(
  createSubcontractorRosterAdminRouter({
    normalizeIdParam,
    normalizeRequiredText,
    normalizeOptionalText,
    normalizeOptionalPhone,
    normalizeRate,
    requireSubcontractorProjectAccess,
    personNameMaxLength: PERSON_NAME_MAX_LENGTH,
    roleMaxLength: ROLE_MAX_LENGTH,
    equipmentTextMaxLength: EQUIPMENT_TEXT_MAX_LENGTH,
  }),
);

subcontractorsRouter.use(
  createSubcontractorAbnValidationRouter({
    abnMaxLength: ABN_MAX_LENGTH,
  }),
);
