import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { sendSubcontractorInvitationEmail } from '../lib/email.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import { logError } from '../lib/serverLogger.js';

// Feature #483: ABN (Australian Business Number) validation
// ABN is an 11-digit number with a specific checksum algorithm
function validateABN(abn: string): { valid: boolean; error?: string } {
  if (!abn) {
    return { valid: true }; // ABN is optional
  }

  // Remove spaces and dashes
  const cleanABN = abn.replace(/[\s-]/g, '');

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(cleanABN)) {
    return { valid: false, error: 'ABN must be exactly 11 digits' };
  }

  // ABN validation algorithm (ATO specification)
  // 1. Subtract 1 from the first digit
  // 2. Multiply each digit by its weighting factor
  // 3. Sum the results
  // 4. If divisible by 89, ABN is valid
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanABN.split('').map(Number);

  // Subtract 1 from first digit
  digits[0] = digits[0] - 1;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN - checksum failed' };
  }

  return { valid: true };
}

export const subcontractorsRouter = Router();

type AuthenticatedUser = NonNullable<Request['user']>;

const HEAD_CONTRACTOR_PROJECT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager'];
const SUBCONTRACTOR_PORTAL_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const BLOCKED_SUBCONTRACTOR_STATUSES = new Set(['suspended', 'removed']);
const PRESERVED_HEAD_CONTRACTOR_ROLES = new Set([
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

function assertInvitationPending(status: string): void {
  if (status !== 'pending_approval') {
    throw AppError.forbidden('This invitation is no longer active');
  }
}

async function requireSubcontractorProjectAccess(
  projectId: string,
  user: AuthenticatedUser,
  manage = false,
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

  return { project, projectUser };
}

async function hasLinkedSubcontractorAccess(
  subcontractorCompanyId: string,
  userId: string,
): Promise<boolean> {
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: { subcontractorCompanyId, userId },
    select: { id: true },
  });

  return Boolean(subcontractorUser);
}

// ================================================================================
// PUBLIC ENDPOINTS (no auth required) - Must be defined BEFORE requireAuth
// ================================================================================

// Feature #484: GET /api/subcontractors/invitation/:id - Get invitation details (no auth required)
// This allows the frontend to display invitation info before user creates account
subcontractorsRouter.get(
  '/invitation/:id',
  asyncHandler(async (req, res) => {
    const id = normalizeIdParam(req.params.id, 'Invitation ID');

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, companyId: true } },
      },
    });

    if (!subcontractor) {
      throw AppError.notFound('Invitation');
    }

    if (BLOCKED_SUBCONTRACTOR_STATUSES.has(subcontractor.status)) {
      throw AppError.notFound('Invitation');
    }

    // Get the head contractor company name
    const headContractor = await prisma.company.findUnique({
      where: { id: subcontractor.project.companyId },
      select: { name: true },
    });

    res.json({
      invitation: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectName: subcontractor.project.name,
        headContractorName: headContractor?.name || 'Unknown',
        primaryContactEmail: subcontractor.primaryContactEmail,
        primaryContactName: subcontractor.primaryContactName,
        status: subcontractor.status,
      },
    });
  }),
);

// ================================================================================
// PROTECTED ENDPOINTS (auth required)
// ================================================================================

// Apply authentication middleware to all subsequent routes
subcontractorsRouter.use(requireAuth);

// GET /api/subcontractors/directory - Get global subcontractors for the user's organization
// This allows selecting existing subcontractors when inviting to a new project
subcontractorsRouter.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // User must belong to a company
    if (!user.companyId) {
      throw AppError.badRequest(
        'User must belong to an organization to access the subcontractor directory',
      );
    }

    if (!isHeadContractorRole(user)) {
      throw AppError.forbidden('Only head contractor users can access the subcontractor directory');
    }

    // Get all global subcontractors for this organization
    const globalSubcontractors = await prisma.globalSubcontractor.findMany({
      where: {
        organizationId: user.companyId,
        status: 'active',
      },
      orderBy: { companyName: 'asc' },
    });

    res.json({
      subcontractors: globalSubcontractors.map((gs) => ({
        id: gs.id,
        companyName: gs.companyName,
        abn: gs.abn || '',
        primaryContactName: gs.primaryContactName || '',
        primaryContactEmail: gs.primaryContactEmail || '',
        primaryContactPhone: gs.primaryContactPhone || '',
      })),
    });
  }),
);

// POST /api/subcontractors/invite - Invite/create a new subcontractor company for a project
// Now supports selecting from global directory via globalSubcontractorId
subcontractorsRouter.post(
  '/invite',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { companyName, abn, primaryContactName, primaryContactEmail, primaryContactPhone } =
      req.body;
    const projectId = normalizeRequiredText(req.body.projectId, 'projectId', ID_MAX_LENGTH);
    const globalSubcontractorId = normalizeOptionalText(
      req.body.globalSubcontractorId,
      'globalSubcontractorId',
      ID_MAX_LENGTH,
    );

    // Validate required fields
    if (!projectId) {
      throw AppError.badRequest('projectId is required');
    }

    // If not selecting from directory, require all fields
    const inputCompanyName = globalSubcontractorId
      ? null
      : normalizeRequiredText(companyName, 'companyName', COMPANY_NAME_MAX_LENGTH);
    const inputContactName = globalSubcontractorId
      ? null
      : normalizeRequiredText(primaryContactName, 'primaryContactName', PERSON_NAME_MAX_LENGTH);
    const inputContactEmail = globalSubcontractorId
      ? null
      : normalizeEmail(primaryContactEmail, 'primaryContactEmail');
    const inputContactPhone = globalSubcontractorId
      ? null
      : normalizeOptionalPhone(primaryContactPhone, 'primaryContactPhone');
    const inputAbn = globalSubcontractorId ? null : normalizeOptionalAbn(abn);

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    await requireSubcontractorProjectAccess(projectId, user, true);

    // Determine the company details to use
    let finalCompanyName: string;
    let finalAbn: string | null;
    let finalContactName: string;
    let finalContactEmail: string;
    let finalContactPhone: string | null;
    let globalId: string | null = null;

    if (globalSubcontractorId) {
      // Selecting from directory - fetch the global subcontractor
      const globalSub = await prisma.globalSubcontractor.findUnique({
        where: { id: globalSubcontractorId },
      });

      if (!globalSub) {
        throw AppError.notFound('Global subcontractor');
      }

      // Verify it belongs to the same organization
      if (globalSub.organizationId !== project.companyId) {
        throw AppError.forbidden('This subcontractor does not belong to your organization');
      }

      // Check if this global subcontractor is already invited to this project
      const existingLink = await prisma.subcontractorCompany.findFirst({
        where: {
          projectId,
          globalSubcontractorId,
        },
      });

      if (existingLink) {
        throw AppError.conflict('This subcontractor has already been invited to this project');
      }

      finalCompanyName = normalizeRequiredText(
        globalSub.companyName,
        'companyName',
        COMPANY_NAME_MAX_LENGTH,
      );
      finalAbn = normalizeOptionalAbn(globalSub.abn);
      finalContactName = normalizeRequiredText(
        globalSub.primaryContactName,
        'primaryContactName',
        PERSON_NAME_MAX_LENGTH,
      );
      finalContactEmail = normalizeEmail(globalSub.primaryContactEmail, 'primaryContactEmail');
      finalContactPhone = normalizeOptionalPhone(
        globalSub.primaryContactPhone,
        'primaryContactPhone',
      );
      globalId = globalSub.id;
    } else {
      // Check if a subcontractor with same name already exists for this project
      const existingSubcontractors = await prisma.subcontractorCompany.findMany({
        where: {
          projectId,
        },
        select: { companyName: true },
      });

      if (
        existingSubcontractors.some((existing) =>
          companyNameMatches(existing.companyName, inputCompanyName!),
        )
      ) {
        throw AppError.conflict(
          'A subcontractor with this company name already exists for this project',
        );
      }

      const existingGlobalSubs = await prisma.globalSubcontractor.findMany({
        where: { organizationId: project.companyId },
        select: { id: true, companyName: true },
      });
      const existingGlobalSub = existingGlobalSubs.find((existing) =>
        companyNameMatches(existing.companyName, inputCompanyName!),
      );
      globalId = existingGlobalSub?.id || null;

      if (!globalId) {
        // Create a new GlobalSubcontractor record
        const newGlobalSub = await prisma.globalSubcontractor.create({
          data: {
            organizationId: project.companyId,
            companyName: inputCompanyName!,
            abn: inputAbn,
            primaryContactName: inputContactName!,
            primaryContactEmail: inputContactEmail!,
            primaryContactPhone: inputContactPhone,
            status: 'active',
          },
        });
        globalId = newGlobalSub.id;
      }

      finalCompanyName = inputCompanyName!;
      finalAbn = inputAbn;
      finalContactName = inputContactName!;
      finalContactEmail = inputContactEmail!;
      finalContactPhone = inputContactPhone;
    }

    // Create the project-specific SubcontractorCompany linked to the global record
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        globalSubcontractorId: globalId,
        companyName: finalCompanyName,
        abn: finalAbn,
        primaryContactName: finalContactName,
        primaryContactEmail: finalContactEmail,
        primaryContactPhone: finalContactPhone,
        status: 'pending_approval',
      },
    });

    // Feature #942 - Send subcontractor invitation email with setup link
    const inviteUrl = buildFrontendUrl(
      `/subcontractor-portal/accept-invite?id=${subcontractor.id}`,
    );

    try {
      await sendSubcontractorInvitationEmail({
        to: finalContactEmail,
        contactName: finalContactName,
        companyName: finalCompanyName,
        projectName: project.name,
        inviterEmail: user.email,
        inviteUrl,
      });
    } catch (emailError) {
      logError('[Subcontractor Invite] Failed to send email:', emailError);
      // Don't fail the invite if email fails
    }

    res.status(201).json({
      message: 'Subcontractor invited successfully',
      subcontractor: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        abn: subcontractor.abn || '',
        primaryContact: subcontractor.primaryContactName || '',
        email: subcontractor.primaryContactEmail || '',
        phone: subcontractor.primaryContactPhone || '',
        status: subcontractor.status,
        employees: [],
        plant: [],
        totalApprovedDockets: 0,
        totalCost: 0,
        assignedLotCount: 0,
      },
    });
  }),
);

// GET /api/subcontractors/for-project/:projectId - Get subcontractors for a project
subcontractorsRouter.get(
  '/for-project/:projectId',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeIdParam(req.params.projectId, 'Project ID');

    await requireSubcontractorProjectAccess(projectId, user);

    // Get all subcontractor companies associated with this project
    const subcontractors = await prisma.subcontractorCompany.findMany({
      where: {
        projectId: projectId,
      },
      select: {
        id: true,
        companyName: true,
        status: true,
      },
      orderBy: { companyName: 'asc' },
    });

    res.json({ subcontractors });
  }),
);

// Feature #484: POST /api/subcontractors/invitation/:id/accept - Accept invitation and link user
subcontractorsRouter.post(
  '/invitation/:id/accept',
  asyncHandler(async (req, res) => {
    const id = normalizeIdParam(req.params.id, 'Invitation ID');
    const user = req.user!;

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    if (!subcontractor) {
      throw AppError.notFound('Invitation');
    }

    if (BLOCKED_SUBCONTRACTOR_STATUSES.has(subcontractor.status)) {
      throw AppError.notFound('Invitation');
    }

    const invitedEmail = subcontractor.primaryContactEmail?.trim().toLowerCase();
    if (invitedEmail && invitedEmail !== user.email.trim().toLowerCase()) {
      throw AppError.forbidden('This invitation was sent to a different email address');
    }

    await prisma.$transaction(async (tx) => {
      const existingLinks = await tx.subcontractorUser.findMany({
        where: { subcontractorCompanyId: id },
        select: { userId: true },
      });
      const existingLink = existingLinks.find((link) => link.userId === user.id);

      if (existingLink) {
        throw AppError.badRequest('Your account is already linked to this subcontractor company');
      }

      if (existingLinks.length > 0) {
        throw AppError.badRequest('This invitation has already been accepted by another user');
      }

      assertInvitationPending(subcontractor.status);

      const statusUpdate = await tx.subcontractorCompany.updateMany({
        where: { id: subcontractor.id, status: 'pending_approval' },
        data: { status: 'approved' },
      });

      if (statusUpdate.count !== 1) {
        throw AppError.badRequest('This invitation has already been accepted by another user');
      }

      await tx.subcontractorUser.create({
        data: {
          userId: user.id,
          subcontractorCompanyId: subcontractor.id,
          role: 'admin', // First user is admin
        },
      });

      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { roleInCompany: true },
      });
      if (!PRESERVED_HEAD_CONTRACTOR_ROLES.has(currentUser?.roleInCompany || '')) {
        await tx.user.update({
          where: { id: user.id },
          data: { roleInCompany: 'subcontractor_admin' },
        });
      }
    });

    // Audit log for subcontractor invitation acceptance
    await createAuditLog({
      projectId: subcontractor.project.id,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_INVITATION_ACCEPTED,
      changes: { companyName: subcontractor.companyName },
      req,
    });

    res.json({
      message: 'Invitation accepted successfully',
      subcontractor: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectName: subcontractor.project.name,
        status: 'approved',
      },
    });
  }),
);

// GET /api/subcontractors/my-company - Get the current user's subcontractor company
subcontractorsRouter.get(
  '/my-company',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if user is a subcontractor
    if (!isSubcontractorPortalRole(user)) {
      throw AppError.forbidden('Only subcontractors can access this endpoint');
    }

    // Get the user's subcontractor company via SubcontractorUser
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: {
        subcontractorCompany: {
          include: {
            employeeRoster: true,
            plantRegister: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company');
    }

    const company = subcontractorUser.subcontractorCompany;
    assertSubcontractorPortalActive(company);

    res.json({
      company: {
        id: company.id,
        companyName: company.companyName,
        abn: company.abn || '',
        projectId: company.projectId,
        projectName: company.project?.name || '',
        primaryContactName: company.primaryContactName || user.fullName || '',
        primaryContactEmail: company.primaryContactEmail || user.email,
        primaryContactPhone: company.primaryContactPhone || '',
        status: company.status,
        employees: company.employeeRoster.map((e) => ({
          id: e.id,
          name: e.name,
          phone: e.phone || '',
          role: e.role || '',
          hourlyRate: e.hourlyRate?.toNumber() || 0,
          status: e.status === 'approved' ? 'approved' : 'pending',
        })),
        plant: company.plantRegister.map((p) => ({
          id: p.id,
          type: p.type,
          description: p.description || '',
          idRego: p.idRego || '',
          dryRate: p.dryRate?.toNumber() || 0,
          wetRate: p.wetRate?.toNumber() || 0,
          status: p.status === 'approved' ? 'approved' : 'pending',
        })),
        portalAccess: company.portalAccess || {
          lots: true,
          itps: false,
          holdPoints: false,
          testResults: false,
          ncrs: false,
          documents: false,
        },
      },
    });
  }),
);

// POST /api/subcontractors/my-company/employees - Add a new employee
subcontractorsRouter.post(
  '/my-company/employees',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can add employees');
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true },
    });

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company');
    }

    assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

    const { name, phone, role, hourlyRate } = req.body;

    const normalizedName = normalizeRequiredText(name, 'name', PERSON_NAME_MAX_LENGTH);
    const normalizedPhone = normalizeOptionalPhone(phone, 'phone');
    const normalizedRole = normalizeRequiredText(role, 'role', ROLE_MAX_LENGTH);
    const normalizedHourlyRate = normalizeRate(hourlyRate, 'hourlyRate');

    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
        name: normalizedName,
        phone: normalizedPhone,
        role: normalizedRole,
        hourlyRate: normalizedHourlyRate,
        status: 'pending', // Needs head contractor approval
      },
    });

    res.status(201).json({
      employee: {
        id: employee.id,
        name: employee.name,
        phone: employee.phone || '',
        role: employee.role || '',
        hourlyRate: employee.hourlyRate?.toNumber() || 0,
        status: 'pending',
      },
    });
  }),
);

// POST /api/subcontractors/my-company/plant - Add new plant
subcontractorsRouter.post(
  '/my-company/plant',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can add plant');
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true },
    });

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company');
    }

    assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

    const { type, description, idRego, dryRate, wetRate } = req.body;

    const normalizedType = normalizeRequiredText(type, 'type', EQUIPMENT_TEXT_MAX_LENGTH);
    const normalizedDescription = normalizeRequiredText(
      description,
      'description',
      EQUIPMENT_TEXT_MAX_LENGTH,
    );
    const normalizedIdRego = normalizeOptionalText(idRego, 'idRego', EQUIPMENT_TEXT_MAX_LENGTH);
    const normalizedDryRate = normalizeRate(dryRate, 'dryRate');
    const normalizedWetRate = normalizeRate(wetRate, 'wetRate', {
      required: false,
      allowZero: true,
    });

    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
        type: normalizedType,
        description: normalizedDescription,
        idRego: normalizedIdRego,
        dryRate: normalizedDryRate,
        wetRate: normalizedWetRate,
        status: 'pending', // Needs head contractor approval
      },
    });

    res.status(201).json({
      plant: {
        id: plant.id,
        type: plant.type,
        description: plant.description || '',
        idRego: plant.idRego || '',
        dryRate: plant.dryRate?.toNumber() || 0,
        wetRate: plant.wetRate?.toNumber() || 0,
        status: 'pending',
      },
    });
  }),
);

// DELETE /api/subcontractors/my-company/employees/:id - Delete an employee
subcontractorsRouter.delete(
  '/my-company/employees/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Employee ID');

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can delete employees');
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: { select: { status: true } } },
    });

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company');
    }

    assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

    // Verify the employee belongs to this company
    const employee = await prisma.employeeRoster.findUnique({
      where: { id },
    });

    if (!employee || employee.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      throw AppError.notFound('Employee');
    }

    await prisma.employeeRoster.delete({
      where: { id },
    });

    res.json({ message: 'Employee deleted successfully' });
  }),
);

// DELETE /api/subcontractors/my-company/plant/:id - Delete plant
subcontractorsRouter.delete(
  '/my-company/plant/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Plant ID');

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can delete plant');
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: { select: { status: true } } },
    });

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company');
    }

    assertSubcontractorPortalActive(subcontractorUser.subcontractorCompany);

    // Verify the plant belongs to this company
    const plant = await prisma.plantRegister.findUnique({
      where: { id },
    });

    if (!plant || plant.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      throw AppError.notFound('Plant');
    }

    await prisma.plantRegister.delete({
      where: { id },
    });

    res.json({ message: 'Plant deleted successfully' });
  }),
);

// PATCH /api/subcontractors/:id/status - Update subcontractor status (suspend/remove)
// Only project managers, admins, or owners can suspend subcontractors
subcontractorsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending_approval', 'approved', 'suspended', 'removed'];
    if (!status || !validStatuses.includes(status)) {
      throw AppError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    // Update the status
    const updatedSubcontractor = await prisma.subcontractorCompany.update({
      where: { id },
      data: {
        status,
        // If approving, record who approved
        ...(status === 'approved' && {
          approvedById: user.id,
          approvedAt: new Date(),
        }),
      },
      select: {
        id: true,
        companyName: true,
        status: true,
        approvedAt: true,
      },
    });

    // Audit log for subcontractor status change
    await createAuditLog({
      projectId: subcontractor.projectId,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_STATUS_CHANGED,
      changes: {
        previousStatus: subcontractor.status,
        newStatus: status,
        companyName: subcontractor.companyName,
      },
      req,
    });

    res.json({
      message: `Subcontractor status updated to ${status}`,
      subcontractor: updatedSubcontractor,
    });
  }),
);

// DELETE /api/subcontractors/:id - Permanently delete a subcontractor and all associated records
subcontractorsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');

    // Find the subcontractor company with counts
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: true,
        employeeRoster: { select: { id: true } },
        plantRegister: { select: { id: true } },
        dailyDockets: { select: { id: true } },
        users: { select: { id: true } },
      },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    const deletedCounts = {
      dockets: subcontractor.dailyDockets.length,
      employees: subcontractor.employeeRoster.length,
      plant: subcontractor.plantRegister.length,
    };

    await prisma.$transaction(async (tx) => {
      // Nullify foreign keys in Lot and NCR before deleting
      await tx.lot.updateMany({
        where: { assignedSubcontractorId: id, projectId: subcontractor.projectId },
        data: { assignedSubcontractorId: null },
      });

      await tx.nCR.updateMany({
        where: { responsibleSubcontractorId: id, projectId: subcontractor.projectId },
        data: { responsibleSubcontractorId: null },
      });

      // Delete the subcontractor company (Prisma cascade handles SubcontractorUser, EmployeeRoster, PlantRegister, DailyDocket)
      await tx.subcontractorCompany.delete({
        where: { id },
      });
    });

    res.json({
      message: `Subcontractor ${subcontractor.companyName} permanently deleted`,
      deletedCounts,
    });
  }),
);

// Default portal access settings
const DEFAULT_PORTAL_ACCESS = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
};

// PATCH /api/subcontractors/:id/portal-access - Update portal access settings
subcontractorsRouter.patch(
  '/:id/portal-access',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const { portalAccess } = req.body;

    // Validate portal access object
    if (!portalAccess || typeof portalAccess !== 'object' || Array.isArray(portalAccess)) {
      throw AppError.badRequest('portalAccess object is required');
    }

    // Validate the structure - ensure all keys are valid booleans
    const validKeys = ['lots', 'itps', 'holdPoints', 'testResults', 'ncrs', 'documents'];
    for (const key of Object.keys(portalAccess)) {
      if (!validKeys.includes(key)) {
        throw AppError.badRequest(`Invalid portal access setting: ${key}`);
      }
    }
    for (const key of validKeys) {
      if (portalAccess[key] !== undefined && typeof portalAccess[key] !== 'boolean') {
        throw AppError.badRequest(`Invalid value for ${key} - must be a boolean`);
      }
    }

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    // Merge with defaults to ensure all keys exist
    const mergedAccess = {
      ...DEFAULT_PORTAL_ACCESS,
      ...portalAccess,
    };

    // Update the portal access
    const updatedSubcontractor = await prisma.subcontractorCompany.update({
      where: { id },
      data: {
        portalAccess: mergedAccess,
      },
      select: {
        id: true,
        companyName: true,
        portalAccess: true,
      },
    });

    // Audit log for portal access update
    await createAuditLog({
      projectId: subcontractor.projectId,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_PORTAL_ACCESS_UPDATED,
      changes: { portalAccess: mergedAccess, companyName: subcontractor.companyName },
      req,
    });

    res.json({
      message: 'Portal access updated successfully',
      portalAccess: updatedSubcontractor.portalAccess,
    });
  }),
);

// GET /api/subcontractors/:id/portal-access - Get portal access settings
subcontractorsRouter.get(
  '/:id/portal-access',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        projectId: true,
        status: true,
        portalAccess: true,
      },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company');
    }

    const hasPortalUserAccess = await hasLinkedSubcontractorAccess(id, user.id);
    if (!hasPortalUserAccess) {
      await requireSubcontractorProjectAccess(subcontractor.projectId, user);
    } else {
      assertSubcontractorPortalActive(subcontractor);
    }

    // Return stored access or defaults
    const portalAccess = subcontractor.portalAccess || DEFAULT_PORTAL_ACCESS;

    res.json({ portalAccess });
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
            totalLabourApproved: true,
            totalPlantApproved: true,
          },
        },
        assignedLots: {
          select: { id: true },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    // Calculate totals for each subcontractor
    const formattedSubcontractors = subcontractors.map((sub) => {
      const totalApprovedDockets = sub.dailyDockets.length;
      const totalCost = sub.dailyDockets.reduce((sum, docket) => {
        return (
          sum + (Number(docket.totalLabourApproved) || 0) + (Number(docket.totalPlantApproved) || 0)
        );
      }, 0);

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
        assignedLotCount: sub.assignedLots.length,
      };
    });

    res.json({ subcontractors: formattedSubcontractors });
  }),
);

// POST /api/subcontractors/:id/employees - Add employee to a subcontractor (admin)
subcontractorsRouter.post(
  '/:id/employees',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const { name, role, hourlyRate, phone } = req.body;

    const normalizedName = normalizeRequiredText(name, 'name', PERSON_NAME_MAX_LENGTH);
    const normalizedRole = normalizeOptionalText(role, 'role', ROLE_MAX_LENGTH) || '';
    const normalizedPhone = normalizeOptionalPhone(phone, 'phone') || '';
    const normalizedHourlyRate = normalizeRate(hourlyRate, 'hourlyRate');

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: id,
        name: normalizedName,
        role: normalizedRole,
        hourlyRate: normalizedHourlyRate,
        phone: normalizedPhone,
        status: 'pending',
      },
    });

    res.status(201).json({
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role || '',
        hourlyRate: Number(employee.hourlyRate),
        status: employee.status,
      },
    });
  }),
);

// PATCH /api/subcontractors/:id/employees/:empId/status - Update employee status
subcontractorsRouter.patch(
  '/:id/employees/:empId/status',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const empId = normalizeIdParam(req.params.empId, 'Employee ID');
    const { status, counterRate } = req.body;
    const userId = user.id;

    const validStatuses = ['pending', 'approved', 'inactive', 'counter'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest('Invalid status. Must be: pending, approved, inactive, or counter');
    }

    // Counter-proposals require a counter rate
    if (status === 'counter' && (counterRate === undefined || counterRate === null)) {
      throw AppError.badRequest('Counter-proposal requires a counterRate value');
    }
    const normalizedCounterRate =
      status === 'counter' ? normalizeRate(counterRate, 'counterRate') : undefined;

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    // Verify employee belongs to this subcontractor
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: empId,
        subcontractorCompanyId: id,
      },
    });

    if (!employee) {
      throw AppError.notFound('Employee');
    }

    const updateData: Prisma.EmployeeRosterUpdateInput = { status };
    if (status === 'approved') {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.employeeRoster.update({
      where: { id: empId },
      data: updateData,
    });

    // Feature #943 - Send notification when employee rate is approved
    if (status === 'approved') {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id },
        });

        // Get user details for each subcontractor user
        const userIds = subcontractorUsers.map((su) => su.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        });

        // Create notification for each subcontractor user
        for (const u of users) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_approved',
              title: 'Employee Rate Approved',
              message: `The rate for ${updated.name} ($${Number(updated.hourlyRate).toFixed(2)}/hr) has been approved. You can now include this employee in your dockets.`,
              linkUrl: `/subcontractor-portal`,
            },
          });
        }
      } catch (notifError) {
        logError('[Rate Approval] Failed to send notification:', notifError);
        // Don't fail the main request
      }
    }

    // Feature #944 - Send notification when PM counter-proposes employee rate
    if (status === 'counter' && counterRate !== undefined) {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id },
        });

        // Get user details for each subcontractor user
        const userIds2 = subcontractorUsers.map((su) => su.userId);
        const users2 = await prisma.user.findMany({
          where: { id: { in: userIds2 } },
          select: { id: true, email: true },
        });

        const originalRate = Number(employee.hourlyRate).toFixed(2);
        const proposedRate = Number(normalizedCounterRate).toFixed(2);

        // Create notification for each subcontractor user
        for (const u of users2) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_counter',
              title: 'Rate Counter-Proposal',
              message: `A counter-proposal has been made for ${updated.name}. Original rate: $${originalRate}/hr, Proposed rate: $${proposedRate}/hr. Please review and respond.`,
              linkUrl: `/subcontractor-portal`,
            },
          });
        }
      } catch (notifError) {
        logError('[Rate Counter] Failed to send notification:', notifError);
        // Don't fail the main request
      }
    }

    // Audit log for employee rate status change
    const subForAudit = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true, companyName: true },
    });
    await createAuditLog({
      projectId: subForAudit?.projectId,
      userId,
      entityType: 'subcontractor_employee',
      entityId: empId,
      action: AuditAction.SUBCONTRACTOR_EMPLOYEE_RATE_APPROVED,
      changes: {
        status,
        employeeName: updated.name,
        hourlyRate: Number(updated.hourlyRate),
        counterRate: normalizedCounterRate,
      },
      req,
    });

    res.json({
      employee: {
        id: updated.id,
        name: updated.name,
        role: updated.role || '',
        hourlyRate: Number(updated.hourlyRate),
        status: updated.status,
        ...(status === 'counter' &&
          normalizedCounterRate !== undefined && { counterRate: normalizedCounterRate }),
      },
    });
  }),
);

// POST /api/subcontractors/:id/plant - Add plant to a subcontractor (admin)
subcontractorsRouter.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const { type, description, idRego, dryRate, wetRate } = req.body;

    const normalizedType = normalizeRequiredText(type, 'type', EQUIPMENT_TEXT_MAX_LENGTH);
    const normalizedDescription =
      normalizeOptionalText(description, 'description', EQUIPMENT_TEXT_MAX_LENGTH) || '';
    const normalizedIdRego =
      normalizeOptionalText(idRego, 'idRego', EQUIPMENT_TEXT_MAX_LENGTH) || '';
    const normalizedDryRate = normalizeRate(dryRate, 'dryRate');
    const normalizedWetRate = normalizeRate(wetRate, 'wetRate', {
      required: false,
      allowZero: true,
    });

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId: id,
        type: normalizedType,
        description: normalizedDescription,
        idRego: normalizedIdRego,
        dryRate: normalizedDryRate,
        wetRate: normalizedWetRate,
        status: 'pending',
      },
    });

    res.status(201).json({
      plant: {
        id: plant.id,
        type: plant.type,
        description: plant.description || '',
        idRego: plant.idRego || '',
        dryRate: Number(plant.dryRate),
        wetRate: Number(plant.wetRate) || 0,
        status: plant.status,
      },
    });
  }),
);

// PATCH /api/subcontractors/:id/plant/:plantId/status - Update plant status
subcontractorsRouter.patch(
  '/:id/plant/:plantId/status',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
    const plantId = normalizeIdParam(req.params.plantId, 'Plant ID');
    const { status, counterDryRate, counterWetRate } = req.body;
    const userId = user.id;

    const validStatuses = ['pending', 'approved', 'inactive', 'counter'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest('Invalid status. Must be: pending, approved, inactive, or counter');
    }

    // Counter-proposals require at least a counter dry rate
    if (status === 'counter' && (counterDryRate === undefined || counterDryRate === null)) {
      throw AppError.badRequest('Counter-proposal requires a counterDryRate value');
    }
    const normalizedCounterDryRate =
      status === 'counter' ? normalizeRate(counterDryRate, 'counterDryRate') : undefined;
    const normalizedCounterWetRate =
      status === 'counter' && counterWetRate !== undefined && counterWetRate !== null
        ? normalizeRate(counterWetRate, 'counterWetRate', { allowZero: true })
        : undefined;

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor');
    }

    await requireSubcontractorProjectAccess(subcontractor.projectId, user, true);

    // Verify plant belongs to this subcontractor
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: id,
      },
    });

    if (!plant) {
      throw AppError.notFound('Plant');
    }

    const updateData: Prisma.PlantRegisterUpdateInput = { status };
    if (status === 'approved') {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.plantRegister.update({
      where: { id: plantId },
      data: updateData,
    });

    // Feature #943 - Send notification when plant rate is approved
    if (status === 'approved') {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id },
        });

        // Get user details for each subcontractor user
        const userIds3 = subcontractorUsers.map((su) => su.userId);
        const users3 = await prisma.user.findMany({
          where: { id: { in: userIds3 } },
          select: { id: true, email: true },
        });

        // Format rates for display
        const dryRateStr = `$${Number(updated.dryRate).toFixed(2)}`;
        const wetRateStr = updated.wetRate ? `/$${Number(updated.wetRate).toFixed(2)}` : '';
        const rateDisplay = `${dryRateStr}${wetRateStr}/hr (dry${wetRateStr ? '/wet' : ''})`;

        // Create notification for each subcontractor user
        for (const u of users3) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_approved',
              title: 'Plant Rate Approved',
              message: `The rate for ${updated.type}${updated.description ? ` - ${updated.description}` : ''} (${rateDisplay}) has been approved. You can now include this plant in your dockets.`,
              linkUrl: `/subcontractor-portal`,
            },
          });
        }
      } catch (notifError) {
        logError('[Rate Approval] Failed to send notification:', notifError);
        // Don't fail the main request
      }
    }

    // Feature #944 - Send notification when PM counter-proposes plant rate
    if (status === 'counter' && counterDryRate !== undefined) {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        // Get subcontractor users to notify
        const subcontractorUsers4 = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id },
        });

        // Get user details for each subcontractor user
        const userIds4 = subcontractorUsers4.map((su) => su.userId);
        const users4 = await prisma.user.findMany({
          where: { id: { in: userIds4 } },
          select: { id: true, email: true },
        });

        // Format original rates
        const origDryRate = Number(plant.dryRate).toFixed(2);
        const origWetRate = plant.wetRate ? Number(plant.wetRate).toFixed(2) : null;
        const originalRates = origWetRate
          ? `$${origDryRate}/$${origWetRate}/hr`
          : `$${origDryRate}/hr`;

        // Format proposed rates
        const propDryRate = Number(normalizedCounterDryRate).toFixed(2);
        const propWetRate = normalizedCounterWetRate
          ? Number(normalizedCounterWetRate).toFixed(2)
          : null;
        const proposedRates = propWetRate
          ? `$${propDryRate}/$${propWetRate}/hr`
          : `$${propDryRate}/hr`;

        const plantDesc = `${updated.type}${updated.description ? ` - ${updated.description}` : ''}`;

        // Create notification for each subcontractor user
        for (const u of users4) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_counter',
              title: 'Plant Rate Counter-Proposal',
              message: `A counter-proposal has been made for ${plantDesc}. Original: ${originalRates}, Proposed: ${proposedRates}. Please review and respond.`,
              linkUrl: `/subcontractor-portal`,
            },
          });
        }
      } catch (notifError) {
        logError('[Rate Counter] Failed to send notification:', notifError);
        // Don't fail the main request
      }
    }

    // Audit log for plant rate status change
    const subForPlantAudit = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true, companyName: true },
    });
    await createAuditLog({
      projectId: subForPlantAudit?.projectId,
      userId,
      entityType: 'subcontractor_plant',
      entityId: plantId,
      action: AuditAction.SUBCONTRACTOR_PLANT_RATE_APPROVED,
      changes: {
        status,
        plantType: updated.type,
        dryRate: Number(updated.dryRate),
        wetRate: Number(updated.wetRate),
        counterDryRate: normalizedCounterDryRate,
        counterWetRate: normalizedCounterWetRate,
      },
      req,
    });

    res.json({
      plant: {
        id: updated.id,
        type: updated.type,
        description: updated.description || '',
        idRego: updated.idRego || '',
        dryRate: Number(updated.dryRate),
        wetRate: Number(updated.wetRate) || 0,
        status: updated.status,
        ...(status === 'counter' && {
          counterDryRate: normalizedCounterDryRate,
          ...(normalizedCounterWetRate !== undefined && {
            counterWetRate: normalizedCounterWetRate,
          }),
        }),
      },
    });
  }),
);

// Feature #483: POST /api/subcontractors/validate-abn - Validate an ABN
subcontractorsRouter.post(
  '/validate-abn',
  asyncHandler(async (req, res) => {
    const { abn } = req.body;

    if (typeof abn !== 'string' || !abn.trim()) {
      throw AppError.badRequest('Please provide an ABN to validate');
    }
    if (abn.length > ABN_MAX_LENGTH) {
      throw AppError.badRequest(`ABN must be ${ABN_MAX_LENGTH} characters or fewer`);
    }

    const validation = validateABN(abn);

    res.json({
      abn: abn.replace(/[\s-]/g, ''),
      valid: validation.valid,
      error: validation.error || null,
      formatted: validation.valid ? formatABN(abn.replace(/[\s-]/g, '')) : null,
    });
  }),
);

// Helper to format ABN with spaces: XX XXX XXX XXX
function formatABN(abn: string): string {
  const clean = abn.replace(/[\s-]/g, '');
  if (clean.length !== 11) return abn;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}
