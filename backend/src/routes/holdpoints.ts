import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { z } from 'zod';
import { sendNotificationIfEnabled } from './notifications.js';
import {
  sendHPReleaseRequestEmail,
  sendHPChaseEmail,
  sendHPReleaseConfirmationEmail,
} from '../lib/email.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { parsePagination, getPaginationMeta } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  requireSubcontractorPortalModuleAccess,
} from '../lib/projectAccess.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import { logError } from '../lib/serverLogger.js';

// Type for hold point list item
interface HoldPointListItem {
  id: string;
  lotId: string;
  lotNumber: string;
  itpChecklistItemId: string;
  description: string;
  pointType: string | null;
  status: string;
  notificationSentAt: Date | null | undefined;
  scheduledDate: Date | null | undefined;
  releasedAt: Date | null | undefined;
  releasedByName: string | null | undefined;
  releaseNotes: string | null | undefined;
  sequenceNumber: number;
  isCompleted: boolean;
  isVerified: boolean;
  createdAt: Date;
}

// Type for project settings related to hold points
interface HPProjectSettings {
  hpRecipients?: Array<{ email: string }>;
  hpApprovalRequirement?: string;
  holdPointMinimumNoticeDays?: number;
}

interface HoldPointReleaseRecipient {
  email: string;
  fullName: string | null;
  secureToken: string;
  tokenExpiry: Date;
}

const emailAddressSchema = z.string().trim().email();

function isValidEmailAddress(email: string): boolean {
  return emailAddressSchema.safeParse(email).success;
}

function normalizeEmailList(emails: string[]): string[] {
  const seen = new Set<string>();

  return emails
    .map((email) => email.trim())
    .filter(Boolean)
    .filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function parseNotificationEmailList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return normalizeEmailList(value.split(/[,\n;]/));
}

function hasValidNotificationEmailList(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  const emails = parseNotificationEmailList(value);
  return emails.length > 0 && emails.every(isValidEmailAddress);
}

function parseHPDefaultRecipients(settings: HPProjectSettings): string[] {
  if (!Array.isArray(settings.hpRecipients)) {
    return [];
  }

  return normalizeEmailList(
    settings.hpRecipients.map((recipient) => recipient?.email || ''),
  ).filter(isValidEmailAddress);
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const MAX_ID_LENGTH = 120;
const MAX_NAME_LENGTH = 160;
const MAX_ORG_LENGTH = 160;
const MAX_NOTE_LENGTH = 5000;
const MAX_SIGNATURE_DATA_URL_LENGTH = 900_000;
const MAX_DATE_INPUT_LENGTH = 64;
const MAX_TIME_INPUT_LENGTH = 5;
const MAX_RELEASE_TOKEN_LENGTH = 512;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_COMPONENT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const RELEASE_METHODS = ['digital', 'email', 'paper'] as const;

const requiredIdSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(MAX_ID_LENGTH, `${fieldName} is too long`);

const requiredTrimmedStringSchema = (fieldName: string, maxLength: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

const nullableTrimmedStringSchema = (maxLength: number, fieldName: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

const optionalTrimmedStringSchema = (maxLength: number, fieldName: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(maxLength, `${fieldName} is too long`).optional(),
  );

const nullableScheduledTimeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().max(MAX_TIME_INPUT_LENGTH, 'scheduledTime must be in HH:mm format').regex(TIME_24H_RE, 'scheduledTime must be in HH:mm format').nullish());

const optionalReleaseMethodSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.enum(RELEASE_METHODS).optional());

const nullableScheduledDateSchema = nullableTrimmedStringSchema(
  MAX_DATE_INPUT_LENGTH,
  'scheduledDate',
);
const nullableReleaseDateSchema = nullableTrimmedStringSchema(MAX_DATE_INPUT_LENGTH, 'releaseDate');
const nullableReleaseTimeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().max(MAX_TIME_INPUT_LENGTH, 'releaseTime must be in HH:mm format').regex(TIME_24H_RE, 'releaseTime must be in HH:mm format').nullish());

const requestReleaseSchema = z
  .object({
    lotId: requiredIdSchema('lotId'),
    itpChecklistItemId: requiredIdSchema('itpChecklistItemId'),
    scheduledDate: nullableScheduledDateSchema,
    scheduledTime: nullableScheduledTimeSchema,
    notificationSentTo: nullableTrimmedStringSchema(MAX_NOTE_LENGTH, 'notificationSentTo').refine(
      hasValidNotificationEmailList,
      'notificationSentTo must contain one or more valid email addresses separated by commas or semicolons',
    ),
    noticePeriodOverride: z.boolean().optional(),
    noticePeriodOverrideReason: nullableTrimmedStringSchema(1000, 'noticePeriodOverrideReason'),
  })
  .superRefine((data, ctx) => {
    if (data.noticePeriodOverride && !data.noticePeriodOverrideReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['noticePeriodOverrideReason'],
        message: 'noticePeriodOverrideReason is required when noticePeriodOverride is true',
      });
    }
  });

const releaseHoldPointSchema = z.object({
  releasedByName: optionalTrimmedStringSchema(MAX_NAME_LENGTH, 'releasedByName'),
  releasedByOrg: optionalTrimmedStringSchema(MAX_ORG_LENGTH, 'releasedByOrg'),
  releaseDate: nullableReleaseDateSchema,
  releaseTime: nullableReleaseTimeSchema,
  releaseMethod: optionalReleaseMethodSchema,
  releaseNotes: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'releaseNotes'),
  signatureDataUrl: optionalTrimmedStringSchema(MAX_SIGNATURE_DATA_URL_LENGTH, 'signatureDataUrl'),
});

const escalateSchema = z.object({
  escalatedTo: optionalTrimmedStringSchema(MAX_NAME_LENGTH, 'escalatedTo'),
  escalationReason: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'escalationReason'),
});

const calculateNotificationTimeSchema = z.object({
  projectId: requiredIdSchema('projectId'),
  requestedDateTime: requiredTrimmedStringSchema('requestedDateTime', MAX_DATE_INPUT_LENGTH),
});

const previewEvidencePackageSchema = z.object({
  lotId: requiredIdSchema('lotId'),
  itpChecklistItemId: requiredIdSchema('itpChecklistItemId'),
});

const publicReleaseSchema = z.object({
  releasedByName: requiredTrimmedStringSchema('Released by name', MAX_NAME_LENGTH),
  releasedByOrg: optionalTrimmedStringSchema(MAX_ORG_LENGTH, 'releasedByOrg'),
  releaseNotes: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'releaseNotes'),
  signatureDataUrl: optionalTrimmedStringSchema(MAX_SIGNATURE_DATA_URL_LENGTH, 'signatureDataUrl'),
});

// Secure link expiry time (48 hours)
const SECURE_LINK_EXPIRY_HOURS = 48;
const HOLD_POINT_TOKEN_HASH_PREFIX = 'sha256:';

function hashHoldPointReleaseToken(token: string): string {
  return `${HOLD_POINT_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function holdPointReleaseTokenLookup(rawToken: string): Prisma.HoldPointReleaseTokenWhereInput {
  const conditions: Prisma.HoldPointReleaseTokenWhereInput[] = [
    { token: hashHoldPointReleaseToken(rawToken) },
  ];

  // Legacy plaintext release tokens remain valid until their normal expiry.
  // Prefixed hashes are never accepted directly as bearer tokens.
  if (!rawToken.startsWith(HOLD_POINT_TOKEN_HASH_PREFIX)) {
    conditions.push({ token: rawToken });
  }

  return { OR: conditions };
}

function parseScheduledDateInput(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  assertValidDateComponent(value, 'scheduledDate must be a valid date');

  const dateOnlyMatch = DATE_ONLY_RE.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw AppError.badRequest('scheduledDate must be a valid date');
    }

    return date;
  }

  const parsedDate = new Date(value);
  if (!Number.isFinite(parsedDate.getTime())) {
    throw AppError.badRequest('scheduledDate must be a valid date');
  }

  return parsedDate;
}

function parseReleaseDateTimeInput(
  releaseDate: string | null | undefined,
  releaseTime: string | null | undefined,
): Date {
  if (!releaseDate) {
    const parsedDate = new Date();
    if (releaseTime) {
      const [hours, minutes] = releaseTime.split(':').map(Number);
      parsedDate.setHours(hours, minutes, 0, 0);
    }
    return parsedDate;
  }

  assertValidDateComponent(releaseDate, 'releaseDate must be a valid date');

  const dateOnlyMatch = DATE_ONLY_RE.exec(releaseDate);
  if (!dateOnlyMatch) {
    const parsedDate = new Date(releaseDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      throw AppError.badRequest('releaseDate must be a valid date');
    }

    if (releaseTime) {
      const [hours, minutes] = releaseTime.split(':').map(Number);
      parsedDate.setHours(hours, minutes, 0, 0);
    }

    return parsedDate;
  }

  const year = Number(dateOnlyMatch[1]);
  const month = Number(dateOnlyMatch[2]);
  const day = Number(dateOnlyMatch[3]);
  const [hours, minutes] = releaseTime ? releaseTime.split(':').map(Number) : [0, 0];
  const parsedDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw AppError.badRequest('releaseDate must be a valid date');
  }

  return parsedDate;
}

function parseRequiredDateTimeInput(value: string, fieldName: string): Date {
  assertValidDateComponent(value, `${fieldName} must be a valid date and time`);

  const parsedDate = new Date(value);
  if (!Number.isFinite(parsedDate.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date and time`);
  }

  return parsedDate;
}

function assertValidDateComponent(value: string, errorMessage: string): void {
  const match = DATE_COMPONENT_RE.exec(value);
  if (!match) {
    return;
  }

  const [, year, month, day] = match;
  const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    dateComponent.getUTCFullYear() !== Number(year) ||
    dateComponent.getUTCMonth() !== Number(month) - 1 ||
    dateComponent.getUTCDate() !== Number(day)
  ) {
    throw AppError.badRequest(errorMessage);
  }
}

const holdpointsRouter = Router();

type AuthenticatedUser = NonNullable<Request['user']>;
type LotAccessTarget = { id: string; projectId: string };
type HoldPointAccessTarget = { lot: LotAccessTarget };

const HP_REQUEST_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'foreman',
  'quality_manager',
];
const HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent'];
const HP_SUPERINTENDENT_RELEASE_ROLES = ['owner', 'admin', 'project_manager', 'superintendent'];
const HP_ESCALATION_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'superintendent',
];
const HP_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

function parseHoldPointRouteParam(
  value: unknown,
  fieldName: string,
  maxLength = MAX_ID_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return HP_SUBCONTRACTOR_ROLES.has(user.roleInCompany);
}

async function getEffectiveProjectRole(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string | null> {
  const isSubcontractor = isSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  if (!isSubcontractor && isCompanyAdmin(user) && project.companyId === user.companyId) {
    return user.roleInCompany;
  }

  if (projectUser) {
    return projectUser.role;
  }

  return null;
}

async function requireProjectReadAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
) {
  const hasAccess = await checkProjectAccess(user.id, projectId);
  if (!hasAccess) {
    throw AppError.forbidden(message);
  }
}

async function requireHoldPointsPortalAccess(projectId: string, user: AuthenticatedUser) {
  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: 'holdPoints',
  });
}

async function requireInternalProjectReadAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
) {
  if (isSubcontractorUser(user)) {
    throw AppError.forbidden(message);
  }

  const role = await getEffectiveProjectRole(projectId, user);
  if (!role || HP_SUBCONTRACTOR_ROLES.has(role)) {
    throw AppError.forbidden(message);
  }
}

async function canRequestHoldPointRelease(
  projectId: string,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (isSubcontractorUser(user)) {
    return false;
  }

  const role = await getEffectiveProjectRole(projectId, user);
  return Boolean(role && HP_REQUEST_ROLES.includes(role));
}

async function hasAssignedSubcontractorLotAccess(
  projectId: string,
  lotId: string,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (!isSubcontractorUser(user)) {
    return true;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  if (!subcontractorUser) {
    return false;
  }

  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findFirst({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
      },
      select: { id: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: subcontractorUser.subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(assignment || legacyLot);
}

async function requireLotReadAccess(
  lot: LotAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this lot',
) {
  await requireProjectReadAccess(lot.projectId, user, message);
  await requireHoldPointsPortalAccess(lot.projectId, user);

  if (!(await hasAssignedSubcontractorLotAccess(lot.projectId, lot.id, user))) {
    throw AppError.forbidden(message);
  }
}

async function requireHoldPointReadAccess(
  holdPoint: HoldPointAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this hold point',
) {
  await requireLotReadAccess(holdPoint.lot, user, message);
}

async function requireProjectRole(
  projectId: string,
  user: AuthenticatedUser,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  const role = await getEffectiveProjectRole(projectId, user);
  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden(message);
  }

  return role;
}

// Utility function to calculate appropriate notification time based on working hours
function calculateNotificationTime(
  requestedDate: Date,
  workingHoursStart: string = '07:00',
  workingHoursEnd: string = '17:00',
  workingDays: string = '1,2,3,4,5', // Mon-Fri by default
): { scheduledTime: Date; adjustedForWorkingHours: boolean; reason?: string } {
  const [startHour, startMin] = workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number);
  const workingDaysList = workingDays.split(',').map(Number); // 0=Sun, 1=Mon, etc.

  const notificationTime = new Date(requestedDate);
  let adjustedForWorkingHours = false;
  let reason: string | undefined;

  // Check if requested time is within working hours
  const requestedHour = notificationTime.getHours();
  const requestedMin = notificationTime.getMinutes();
  const requestedDay = notificationTime.getDay();

  const requestedTimeMinutes = requestedHour * 60 + requestedMin;
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;

  // Check if it's a working day
  if (!workingDaysList.includes(requestedDay)) {
    adjustedForWorkingHours = true;
    reason = 'Scheduled for non-working day';

    // Find next working day
    let daysToAdd = 1;
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++;
      if (daysToAdd > 7) break; // Safety to prevent infinite loop
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd);
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`;
  }
  // Check if before working hours start
  else if (requestedTimeMinutes < startTimeMinutes) {
    adjustedForWorkingHours = true;
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to start of working hours (${workingHoursStart})`;
  }
  // Check if after working hours end
  else if (requestedTimeMinutes >= endTimeMinutes) {
    adjustedForWorkingHours = true;

    // Schedule for next working day
    let daysToAdd = 1;
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++;
      if (daysToAdd > 7) break;
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd);
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Scheduled after hours - moved to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`;
  }

  return { scheduledTime: notificationTime, adjustedForWorkingHours, reason };
}

// Get all hold points for a project
holdpointsRouter.get(
  '/project/:projectId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseHoldPointRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    await requireProjectReadAccess(projectId, user);
    await requireHoldPointsPortalAccess(projectId, user);

    // Build where clause for lots
    const lotsWhere: Prisma.LotWhereInput = { projectId };

    // Subcontractors can only see hold points on their assigned lots
    if (isSubcontractorUser(user)) {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
        },
        include: { subcontractorCompany: true },
      });

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId;

        // Get lots assigned via LotSubcontractorAssignment
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
            projectId,
          },
          select: { lotId: true },
        });
        const assignedLotIds = lotAssignments.map((a) => a.lotId);

        // Include lots from both legacy field AND new assignment model
        lotsWhere.OR = [
          { assignedSubcontractorId: subCompanyId },
          ...(assignedLotIds.length > 0 ? [{ id: { in: assignedLotIds } }] : []),
        ];
      } else {
        // No subcontractor company - return empty
        return res.json({ holdPoints: [] });
      }
    }

    // Get all lots for the project that have ITP instances with hold points
    const lots = await prisma.lot.findMany({
      where: lotsWhere,
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: true,
          },
        },
        holdPoints: {
          include: {
            itpChecklistItem: true,
          },
        },
      },
    });

    // Transform to hold point list
    const holdPoints: HoldPointListItem[] = [];

    for (const lot of lots) {
      if (!lot.itpInstance?.template?.checklistItems) continue;

      for (const item of lot.itpInstance.template.checklistItems) {
        // Find existing hold point record or create virtual one
        const existingHP = lot.holdPoints.find((hp) => hp.itpChecklistItemId === item.id);

        // Find the completion status for this item
        const completion = lot.itpInstance.completions.find((c) => c.checklistItemId === item.id);

        holdPoints.push({
          id: existingHP?.id || `virtual-${lot.id}-${item.id}`,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          itpChecklistItemId: item.id,
          description: item.description,
          pointType: item.pointType,
          status: existingHP?.status || 'pending',
          notificationSentAt: existingHP?.notificationSentAt,
          scheduledDate: existingHP?.scheduledDate,
          releasedAt: existingHP?.releasedAt,
          releasedByName: existingHP?.releasedByName,
          releaseNotes: existingHP?.releaseNotes,
          sequenceNumber: item.sequenceNumber,
          isCompleted: completion?.status === 'completed',
          isVerified: completion?.verificationStatus === 'verified',
          createdAt: existingHP?.createdAt || lot.createdAt,
        });
      }
    }

    // Sort by lot number, then sequence number
    holdPoints.sort((a, b) => {
      if (a.lotNumber !== b.lotNumber) return a.lotNumber.localeCompare(b.lotNumber);
      return a.sequenceNumber - b.sequenceNumber;
    });

    // Apply pagination
    const { page, limit } = parsePagination(req.query);
    const total = holdPoints.length;
    const start = (page - 1) * limit;
    const paginatedHoldPoints = holdPoints.slice(start, start + limit);

    res.json({
      holdPoints: paginatedHoldPoints,
      pagination: getPaginationMeta(total, page, limit),
    });
  }),
);

// Get hold point details with prerequisite status
holdpointsRouter.get(
  '/lot/:lotId/item/:itemId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseHoldPointRouteParam(req.params.lotId, 'lotId');
    const itemId = parseHoldPointRouteParam(req.params.itemId, 'itemId');

    // Get the lot with ITP instance and all checklist items
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true, // Include project to get HP recipients from settings
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: true,
          },
        },
        holdPoints: {
          where: { itpChecklistItemId: itemId },
          include: { itpChecklistItem: true },
        },
      },
    });

    if (!lot || !lot.itpInstance) {
      throw AppError.notFound('Lot or ITP instance');
    }

    const user = req.user!;
    await requireLotReadAccess(lot, user);
    const hasRequestPermission = await canRequestHoldPointRelease(lot.projectId, user);

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find((i) => i.id === itemId);
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      throw AppError.notFound('Hold point item');
    }

    // Get all preceding items (items with lower sequence number)
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      (i) => i.sequenceNumber < holdPointItem.sequenceNumber,
    );

    // Check completion status of each preceding item
    const prerequisites = precedingItems.map((item) => {
      const completion = lot.itpInstance!.completions.find((c) => c.checklistItemId === item.id);
      return {
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        isHoldPoint: item.pointType === 'hold_point',
        isCompleted: completion?.status === 'completed',
        isVerified: completion?.verificationStatus === 'verified',
        completedAt: completion?.completedAt,
      };
    });

    // Check if all prerequisites are completed
    const incompletePrerequisites = prerequisites.filter((p) => !p.isCompleted);
    const canRequestRelease = hasRequestPermission && incompletePrerequisites.length === 0;

    // Get existing hold point record
    const existingHP = lot.holdPoints[0];

    // Get HP default recipients from project settings (Feature #697)
    // Get HP approval requirement from project settings (Feature #698)
    let defaultRecipients: string[] = [];
    let approvalRequirement = 'any';
    if (hasRequestPermission && lot.project.settings) {
      try {
        const settings = JSON.parse(lot.project.settings);
        if (settings.hpRecipients && Array.isArray(settings.hpRecipients)) {
          defaultRecipients = parseHPDefaultRecipients(settings as HPProjectSettings);
        }
        if (settings.hpApprovalRequirement) {
          approvalRequirement = settings.hpApprovalRequirement;
        }
      } catch (_e) {
        // Invalid JSON, use defaults
      }
    }

    res.json({
      holdPoint: {
        id: existingHP?.id || null,
        lotId,
        lotNumber: lot.lotNumber,
        itpChecklistItemId: itemId,
        description: holdPointItem.description,
        sequenceNumber: holdPointItem.sequenceNumber,
        status: existingHP?.status || 'pending',
        notificationSentAt: existingHP?.notificationSentAt,
        scheduledDate: existingHP?.scheduledDate,
        releasedAt: existingHP?.releasedAt,
        releasedByName: existingHP?.releasedByName,
        releaseNotes: existingHP?.releaseNotes,
      },
      prerequisites,
      incompletePrerequisites,
      canRequestRelease,
      defaultRecipients, // Feature #697 - HP default recipients from project settings
      approvalRequirement, // Feature #698 - HP approval requirement from project settings
    });
  }),
);

// Utility function to calculate working days between two dates
function calculateWorkingDays(
  fromDate: Date,
  toDate: Date,
  workingDays: string = '1,2,3,4,5', // Mon-Fri by default
): number {
  const workingDaysList = workingDays.split(',').map(Number); // 0=Sun, 1=Mon, etc.
  let count = 0;
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const target = new Date(toDate);
  target.setHours(0, 0, 0, 0);

  while (current < target) {
    if (workingDaysList.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Request hold point release - checks prerequisites first
holdpointsRouter.post(
  '/request-release',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = requestReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const {
      lotId,
      itpChecklistItemId,
      scheduledDate,
      scheduledTime,
      notificationSentTo,
      noticePeriodOverride,
      noticePeriodOverrideReason,
    } = parseResult.data;
    const scheduledDateValue = parseScheduledDateInput(scheduledDate);
    const notificationEmails = parseNotificationEmailList(notificationSentTo);
    const normalizedNotificationSentTo =
      notificationEmails.length > 0 ? notificationEmails.join(', ') : null;

    // Get the lot with ITP instance and project
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: true,
          },
        },
        holdPoints: {
          where: { itpChecklistItemId },
        },
      },
    });

    if (!lot || !lot.itpInstance) {
      throw AppError.notFound('Lot or ITP instance');
    }

    await requireLotReadAccess(lot, req.user!);
    await requireProjectRole(
      lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to request hold point release',
    );

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(
      (i) => i.id === itpChecklistItemId,
    );
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      throw AppError.badRequest('Item is not a hold point');
    }

    // Get all preceding items
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      (i) => i.sequenceNumber < holdPointItem.sequenceNumber,
    );

    // Check completion status of preceding items
    const incompleteItems = precedingItems.filter((item) => {
      const completion = lot.itpInstance!.completions.find((c) => c.checklistItemId === item.id);
      return !completion || completion.status !== 'completed';
    });

    // If there are incomplete prerequisites, return error with list
    if (incompleteItems.length > 0) {
      throw AppError.badRequest(
        'Cannot request hold point release until all preceding checklist items are completed.',
        {
          incompleteItems: incompleteItems.map((item) => ({
            id: item.id,
            description: item.description,
            sequenceNumber: item.sequenceNumber,
            isHoldPoint: item.pointType === 'hold_point',
          })) as unknown as Record<string, unknown>,
        },
      );
    }

    // Check minimum notice period (Feature #180)
    let projectSettings: HPProjectSettings = {};
    if (lot.project.settings) {
      try {
        projectSettings = JSON.parse(lot.project.settings) as HPProjectSettings;
      } catch (_e) {
        // Invalid JSON, use defaults
      }
    }

    // Default minimum notice period is 1 working day
    const minimumNoticeDays = projectSettings.holdPointMinimumNoticeDays ?? 1;

    if (scheduledDateValue && minimumNoticeDays > 0 && !noticePeriodOverride) {
      const today = new Date();
      const workingDays = calculateWorkingDays(
        today,
        scheduledDateValue,
        lot.project.workingDays || '1,2,3,4,5',
      );

      if (workingDays < minimumNoticeDays) {
        throw new AppError(
          400,
          `The scheduled date is less than the minimum ${minimumNoticeDays} working day${minimumNoticeDays > 1 ? 's' : ''} notice period.`,
          'NOTICE_PERIOD_WARNING',
          {
            scheduledDate,
            workingDaysNotice: workingDays,
            minimumNoticeDays,
            requiresOverride: true,
          },
        );
      }
    }

    // All prerequisites completed - create or update hold point request
    // If override was used, include the reason in notes
    const overrideNote =
      noticePeriodOverride && noticePeriodOverrideReason
        ? `[Notice period override: ${noticePeriodOverrideReason}]`
        : null;

    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { fullName: true, email: true },
    });

    let recipientsToNotify = notificationEmails.map((email) => ({
      email,
      fullName: null as string | null,
    }));

    if (recipientsToNotify.length === 0) {
      const defaultRecipientEmails = parseHPDefaultRecipients(projectSettings);
      recipientsToNotify = defaultRecipientEmails.map((email) => ({
        email,
        fullName: null as string | null,
      }));
    }

    if (recipientsToNotify.length === 0) {
      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: lot.project.id,
          role: 'superintendent',
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      // If no superintendents, also check for project managers
      const projectUserRecipients =
        superintendents.length > 0
          ? superintendents
          : await prisma.projectUser.findMany({
              where: {
                projectId: lot.project.id,
                role: 'project_manager',
                status: 'active',
              },
              include: {
                user: { select: { id: true, email: true, fullName: true } },
              },
            });

      recipientsToNotify = projectUserRecipients.map((recipient) => ({
        email: recipient.user.email,
        fullName: recipient.user.fullName,
      }));
    }

    const uniqueRecipients = new Map<string, HoldPointReleaseRecipient>();
    for (const recipient of recipientsToNotify) {
      const email = recipient.email.trim();
      if (!email || !isValidEmailAddress(email)) {
        continue;
      }

      const key = email.toLowerCase();
      if (!uniqueRecipients.has(key)) {
        const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
        uniqueRecipients.set(key, {
          email,
          fullName: recipient.fullName,
          secureToken: crypto.randomBytes(32).toString('hex'),
          tokenExpiry,
        });
      }
    }

    const releaseTokenEntries = Array.from(uniqueRecipients.values());

    const notificationSentAt = new Date();

    const holdPoint = await prisma.$transaction(async (tx) => {
      const data = {
        status: 'notified',
        notificationSentAt,
        notificationSentTo: normalizedNotificationSentTo,
        scheduledDate: scheduledDateValue,
        scheduledTime: scheduledTime || null,
        ...(overrideNote && { releaseNotes: overrideNote }),
      };

      const savedHoldPoint =
        lot.holdPoints.length > 0
          ? await tx.holdPoint.update({
              where: { id: lot.holdPoints[0].id },
              data,
              include: { itpChecklistItem: true },
            })
          : await tx.holdPoint.create({
              data: {
                lotId,
                itpChecklistItemId,
                pointType: 'hold_point',
                description: holdPointItem.description,
                ...data,
              },
              include: { itpChecklistItem: true },
            });

      await tx.holdPointReleaseToken.deleteMany({
        where: {
          holdPointId: savedHoldPoint.id,
          usedAt: null,
        },
      });

      if (releaseTokenEntries.length > 0) {
        await tx.holdPointReleaseToken.createMany({
          data: releaseTokenEntries.map((recipient) => ({
            holdPointId: savedHoldPoint.id,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
            token: hashHoldPointReleaseToken(recipient.secureToken),
            expiresAt: recipient.tokenExpiry,
          })),
        });
      }

      return savedHoldPoint;
    });

    // Feature #946 - Send HP release request email to superintendent
    try {
      const requestedBy = requestingUser?.fullName || requestingUser?.email || 'Unknown';
      const releaseUrl = buildFrontendUrl(`/projects/${lot.project.id}/lots/${lot.id}?tab=itp`);
      const evidencePackageUrl = buildFrontendUrl(
        `/projects/${lot.project.id}/lots/${lot.id}/evidence-preview?holdPointId=${holdPoint.id}`,
      );

      // Format scheduled date for display
      const formattedScheduledDate = scheduledDateValue
        ? scheduledDateValue.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      for (const recipient of releaseTokenEntries) {
        // Generate secure release URL
        const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);

        await sendHPReleaseRequestEmail({
          to: recipient.email,
          superintendentName: recipient.fullName || 'Reviewer',
          projectName: lot.project.name,
          lotNumber: lot.lotNumber,
          holdPointDescription: holdPointItem.description,
          scheduledDate: formattedScheduledDate,
          scheduledTime: scheduledTime || undefined,
          evidencePackageUrl,
          releaseUrl,
          secureReleaseUrl, // Feature #23 - Include secure release link
          requestedBy,
          noticeOverrideReason: noticePeriodOverrideReason || undefined,
        });
      }
    } catch (emailError) {
      logError('[HP Release Request] Failed to send superintendent email:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP release request
    await createAuditLog({
      projectId: lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_RELEASE_REQUESTED,
      changes: {
        lotId,
        itpChecklistItemId,
        scheduledDate,
        scheduledTime,
        notificationSentTo: normalizedNotificationSentTo,
        noticePeriodOverride,
      },
      req,
    });

    res.json({
      success: true,
      message: 'Hold point release requested successfully',
      holdPoint,
    });
  }),
);

// Release a hold point
holdpointsRouter.post(
  '/:id/release',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');
    const parseResult = releaseHoldPointSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const {
      releasedByName,
      releasedByOrg,
      releaseDate,
      releaseTime,
      releaseMethod,
      releaseNotes,
      signatureDataUrl,
    } = parseResult.data;

    // Feature #698 - Check HP approval requirements from project settings
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    const user = req.user!;
    await requireHoldPointReadAccess(existingHP, user);
    await requireProjectRole(
      existingHP.lot.projectId,
      user,
      HP_RELEASE_ROLES,
      'You do not have permission to release hold points',
    );

    // Check if project requires superintendent-only release
    let approvalRequirement = 'any';
    if (existingHP.lot.project.settings) {
      try {
        const settings = JSON.parse(existingHP.lot.project.settings);
        if (settings.hpApprovalRequirement) {
          approvalRequirement = settings.hpApprovalRequirement;
        }
      } catch (_e) {
        // Invalid JSON, use default
      }
    }

    // If superintendent-only, check user's role in the project
    if (approvalRequirement === 'superintendent') {
      await requireProjectRole(
        existingHP.lot.projectId,
        user,
        HP_SUPERINTENDENT_RELEASE_ROLES,
        'This project requires superintendent approval to release hold points.',
      );
    }

    if (existingHP.status === 'released') {
      throw AppError.badRequest('This hold point has already been released.');
    }

    const releasedAt = parseReleaseDateTimeInput(releaseDate, releaseTime);
    const holdPoint = await prisma.$transaction(async (tx) => {
      const updatedHoldPoint = await tx.holdPoint.update({
        where: { id },
        data: {
          status: 'released',
          releasedAt,
          releasedByName: releasedByName || null,
          releasedByOrg: releasedByOrg || null,
          releaseMethod: releaseMethod || null,
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
        include: {
          itpChecklistItem: true,
          lot: true,
        },
      });

      // Also mark the ITP completion as verified in the same transaction.
      const itpInstance = await tx.iTPInstance.findUnique({
        where: { lotId: updatedHoldPoint.lotId },
        select: { id: true },
      });

      if (itpInstance) {
        await tx.iTPCompletion.updateMany({
          where: {
            itpInstanceId: itpInstance.id,
            checklistItemId: updatedHoldPoint.itpChecklistItemId,
          },
          data: {
            verificationStatus: 'verified',
            verifiedById: req.user!.userId,
            verifiedAt: releasedAt,
          },
        });
      }

      return updatedHoldPoint;
    });

    // Feature #925 - HP release notification to team
    // Get project team members to notify about HP release
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Create in-app notifications for all project team members
    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_release',
      title: 'Hold Point Released',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName || 'Unknown'}.`,
      linkUrl: `/projects/${existingHP.lot.projectId}/hold-points`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to team members (if configured)
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'holdPointRelease', {
          title: 'Hold Point Released',
          message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName || 'Unknown'}.\n\nProject: ${existingHP.lot.project.name}\nRelease Method: ${releaseMethod || 'Digital'}\nNotes: ${releaseNotes || 'None'}`,
          projectName: existingHP.lot.project.name,
          linkUrl: `/projects/${existingHP.lot.projectId}/hold-points`,
        });
      } catch (emailError) {
        logError(`[HP Release] Failed to send email to user ${pu.userId}:`, emailError);
        // Continue with other notifications even if one fails
      }
    }

    // Feature #948 - Send HP release confirmation emails to contractor and superintendent
    try {
      const lotUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.projectId}/lots/${existingHP.lot.id}`,
      );
      const releasedAtDisplay = releasedAt.toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Send to contractors (site_engineer, foreman roles)
      const contractorRoles = ['site_engineer', 'foreman', 'engineer'];
      const contractors = projectUsers.filter((pu) => contractorRoles.includes(pu.role));

      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail({
          to: contractor.user.email,
          recipientName: contractor.user.fullName || 'Site Team',
          recipientRole: 'contractor',
          projectName: existingHP.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: releasedByName || 'Unknown',
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: releaseMethod || undefined,
          releaseNotes: releaseNotes || undefined,
          releasedAt: releasedAtDisplay,
          lotUrl,
        });
      }

      // Send to superintendents
      const superintendentRoles = ['superintendent', 'project_manager'];
      const superintendents = projectUsers.filter((pu) => superintendentRoles.includes(pu.role));

      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail({
          to: superintendent.user.email,
          recipientName: superintendent.user.fullName || 'Superintendent',
          recipientRole: 'superintendent',
          projectName: existingHP.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: releasedByName || 'Unknown',
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: releaseMethod || undefined,
          releaseNotes: releaseNotes || undefined,
          releasedAt: releasedAtDisplay,
          lotUrl,
        });
      }
    } catch (emailError) {
      logError('[HP Release] Failed to send confirmation emails:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP release
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_RELEASED,
      changes: {
        releasedByName,
        releasedByOrg,
        releaseDate,
        releaseTime,
        releaseMethod,
        releaseNotes,
        signatureDataUrl: signatureDataUrl ? '[captured]' : null,
      },
      req,
    });

    res.json({
      success: true,
      message: 'Hold point released successfully',
      holdPoint,
      notifiedUsers: projectUsers.map((pu) => ({
        email: pu.user.email,
        fullName: pu.user.fullName,
      })),
    });
  }),
);

// Chase a hold point (send reminder)
holdpointsRouter.post(
  '/:id/chase',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    // Get the hold point with lot and project details before updating
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(existingHP, req.user!);
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to chase hold points',
    );

    if (existingHP.status === 'released') {
      throw AppError.badRequest('Released hold points cannot be chased.');
    }

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        chaseCount: { increment: 1 },
        lastChasedAt: new Date(),
      },
    });

    // Feature #947 - Send HP chase email to superintendent
    try {
      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: existingHP.lot.project.id,
          role: 'superintendent',
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      // If no superintendents, also check for project managers
      const recipientsToNotify =
        superintendents.length > 0
          ? superintendents
          : await prisma.projectUser.findMany({
              where: {
                projectId: existingHP.lot.project.id,
                role: 'project_manager',
                status: 'active',
              },
              include: {
                user: { select: { id: true, email: true, fullName: true } },
              },
            });

      // Get the original requester info (from who created the HP request)
      const requestedBy = existingHP.notificationSentTo || 'Site Team';

      const releaseUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}?tab=itp`,
      );
      const evidencePackageUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}/evidence-preview?holdPointId=${existingHP.id}`,
      );

      // Calculate days since original request
      const originalRequestDate = existingHP.notificationSentAt || existingHP.createdAt;
      const daysSinceRequest = Math.floor(
        (Date.now() - originalRequestDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const formattedRequestDate = originalRequestDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      for (const recipient of recipientsToNotify) {
        await sendHPChaseEmail({
          to: recipient.user.email,
          superintendentName: recipient.user.fullName || 'Superintendent',
          projectName: existingHP.lot.project.name,
          lotNumber: existingHP.lot.lotNumber,
          holdPointDescription: existingHP.description || 'Hold Point',
          originalRequestDate: formattedRequestDate,
          chaseCount: holdPoint.chaseCount || 1,
          daysSinceRequest,
          evidencePackageUrl,
          releaseUrl,
          requestedBy,
        });
      }
    } catch (emailError) {
      logError('[HP Chase] Failed to send chase email:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP chase
    await createAuditLog({
      projectId: existingHP.lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_CHASED,
      changes: { chaseCount: holdPoint.chaseCount },
      req,
    });

    res.json({
      success: true,
      message: 'Chase notification sent',
      holdPoint,
    });
  }),
);

// Escalate a hold point to QM/PM
holdpointsRouter.post(
  '/:id/escalate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');
    const parseResult = escalateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { escalatedTo, escalationReason } = parseResult.data;
    const userId = req.user!.userId;

    // Get hold point with lot/project info
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(existingHP, req.user!);
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to escalate hold points',
    );

    if (existingHP.status === 'released') {
      throw AppError.badRequest('Released hold points cannot be escalated.');
    }

    // Update hold point with escalation info
    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedById: userId,
        escalatedTo: escalatedTo || 'QM,PM', // Default to QM and PM
        escalationReason: escalationReason || 'Stale hold point - no response received',
      },
      include: {
        lot: true,
        itpChecklistItem: true,
      },
    });

    // Get QM/PM users from the project to notify
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        role: { in: ['admin', 'project_manager', 'qm', 'quality_manager'] },
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Create notifications for QM/PM users
    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_escalation',
      title: 'Hold Point Escalated',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been escalated. Reason: ${holdPoint.escalationReason}`,
      linkUrl: `/projects/${existingHP.lot.projectId}/holdpoints/${id}`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Audit log for HP escalation
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATED,
      changes: { escalatedTo, escalationReason },
      req,
    });

    res.json({
      success: true,
      message: 'Hold point escalated successfully',
      holdPoint,
      notifiedUsers: projectUsers.map((pu) => ({
        email: pu.user.email,
        fullName: pu.user.fullName,
        role: pu.role,
      })),
    });
  }),
);

// Resolve an escalated hold point
holdpointsRouter.post(
  '/:id/resolve-escalation',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: { lot: { select: { projectId: true } } },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireProjectReadAccess(
      existingHP.lot.projectId,
      req.user!,
      'You do not have access to this hold point',
    );
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to resolve hold point escalations',
    );

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        escalationResolved: true,
        escalationResolvedAt: new Date(),
      },
      include: { lot: { select: { projectId: true } } },
    });

    // Audit log for HP escalation resolved
    await createAuditLog({
      projectId: holdPoint.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATION_RESOLVED,
      changes: { escalationResolved: true },
      req,
    });

    res.json({
      success: true,
      message: 'Escalation resolved',
      holdPoint,
    });
  }),
);

// Generate evidence package for a hold point
holdpointsRouter.get(
  '/:id/evidence-package',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    // Get the hold point with all related data
    const holdPoint = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        itpChecklistItem: true,
        lot: {
          include: {
            project: true,
            itpInstance: {
              include: {
                template: {
                  include: {
                    checklistItems: {
                      orderBy: { sequenceNumber: 'asc' },
                    },
                  },
                },
                completions: {
                  include: {
                    completedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                    attachments: {
                      include: {
                        document: true,
                      },
                    },
                  },
                },
              },
            },
            testResults: {
              include: {
                verifiedBy: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
            documents: {
              where: {
                OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
              },
            },
          },
        },
      },
    });

    if (!holdPoint) {
      throw AppError.notFound('Hold point');
    }

    await requireInternalProjectReadAccess(
      holdPoint.lot.projectId,
      req.user!,
      'You do not have access to this hold point',
    );
    await requireHoldPointReadAccess(holdPoint, req.user!);

    const lot = holdPoint.lot;
    const itpInstance = lot.itpInstance;

    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem;
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      (item) => item.sequenceNumber <= holdPointItem.sequenceNumber,
    );

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map((item) => {
      const completion = itpInstance.completions.find((c) => c.checklistItemId === item.id);
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments:
          completion?.attachments?.map((a) => ({
            id: a.id,
            filename: a.document.filename,
            fileUrl: a.document.fileUrl,
            caption: a.document.caption,
          })) || [],
      };
    });

    // Get test results
    const testResults = lot.testResults.map((t) => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt,
    }));

    // Get photos/evidence documents
    const photos = lot.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt,
    }));

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd,
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber,
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType,
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter((i) => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter((i) => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter((t) => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0),
      },
      generatedAt: new Date().toISOString(),
    };

    res.json({ evidencePackage });
  }),
);

// Get notification timing for a hold point request based on working hours
holdpointsRouter.post(
  '/calculate-notification-time',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = calculateNotificationTimeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { projectId, requestedDateTime } = parseResult.data;

    // Get project working hours configuration
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    await requireProjectRole(
      projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to calculate hold point notification times',
    );

    const requestedDate = parseRequiredDateTimeInput(requestedDateTime, 'requestedDateTime');
    const result = calculateNotificationTime(
      requestedDate,
      project.workingHoursStart || '07:00',
      project.workingHoursEnd || '17:00',
      project.workingDays || '1,2,3,4,5',
    );

    res.json({
      requestedDateTime: requestedDate.toISOString(),
      scheduledNotificationTime: result.scheduledTime.toISOString(),
      adjustedForWorkingHours: result.adjustedForWorkingHours,
      adjustmentReason: result.reason,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5',
      },
    });
  }),
);

// Get project working hours configuration
holdpointsRouter.get(
  '/project/:projectId/working-hours',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseHoldPointRouteParam(req.params.projectId, 'projectId');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    await requireInternalProjectReadAccess(projectId, req.user!);

    // Parse working days to human-readable format
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const workingDaysList = (project.workingDays || '1,2,3,4,5').split(',').map(Number);
    const workingDayNames = workingDaysList.map((d) => dayNames[d]);

    res.json({
      projectId: project.id,
      projectName: project.name,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5',
        dayNames: workingDayNames,
      },
    });
  }),
);

// Preview evidence package before submitting HP release request (Feature #179)
holdpointsRouter.post(
  '/preview-evidence-package',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = previewEvidencePackageSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { lotId, itpChecklistItemId } = parseResult.data;

    // Get the lot with all related data
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: {
              include: {
                completedBy: {
                  select: { id: true, fullName: true, email: true },
                },
                verifiedBy: {
                  select: { id: true, fullName: true, email: true },
                },
                attachments: {
                  include: {
                    document: true,
                  },
                },
              },
            },
          },
        },
        testResults: {
          include: {
            verifiedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        documents: {
          where: {
            OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
          },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, req.user!);
    await requireProjectRole(
      lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to preview hold point evidence packages',
    );

    const itpInstance = lot.itpInstance;
    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get the hold point checklist item
    const holdPointItem = itpInstance.template.checklistItems.find(
      (item) => item.id === itpChecklistItemId,
    );

    if (!holdPointItem) {
      throw AppError.notFound('Hold point checklist item');
    }

    // Get all checklist items up to and including the hold point
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      (item) => item.sequenceNumber <= holdPointItem.sequenceNumber,
    );

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map((item) => {
      const completion = itpInstance.completions.find((c) => c.checklistItemId === item.id);
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments:
          completion?.attachments?.map((a) => ({
            id: a.id,
            filename: a.document.filename,
            fileUrl: a.document.fileUrl,
            caption: a.document.caption,
          })) || [],
      };
    });

    // Get test results
    const testResults = lot.testResults.map((t) => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt,
    }));

    // Get photos/evidence documents
    const photos = lot.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt,
    }));

    // Build preview evidence package response
    const evidencePackage = {
      holdPoint: {
        id: 'preview', // Placeholder for preview
        description: holdPointItem.description,
        status: 'pending',
        notificationSentAt: null,
        scheduledDate: null,
        releasedAt: null,
        releasedByName: null,
        releaseNotes: null,
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd,
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber,
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType,
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter((i) => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter((i) => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter((t) => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0),
      },
      isPreview: true,
      generatedAt: new Date().toISOString(),
    };

    res.json({ evidencePackage });
  }),
);

// ============================================================================
// PUBLIC ENDPOINTS - No authentication required (Feature #23)
// These endpoints use secure time-limited tokens for superintendent access
// ============================================================================

// Get hold point and evidence package via secure link (no auth required)
holdpointsRouter.get(
  '/public/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findFirst({
      where: holdPointReleaseTokenLookup(token),
      include: {
        holdPoint: {
          include: {
            itpChecklistItem: true,
            lot: {
              include: {
                project: true,
                itpInstance: {
                  include: {
                    template: {
                      include: {
                        checklistItems: {
                          orderBy: { sequenceNumber: 'asc' },
                        },
                      },
                    },
                    completions: {
                      include: {
                        completedBy: {
                          select: { id: true, fullName: true, email: true },
                        },
                        verifiedBy: {
                          select: { id: true, fullName: true, email: true },
                        },
                        attachments: {
                          include: {
                            document: true,
                          },
                        },
                      },
                    },
                  },
                },
                testResults: {
                  include: {
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
                documents: {
                  where: {
                    OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!releaseToken) {
      throw AppError.notFound('Invalid or expired link');
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    // Check if token has been used (hold point already released via this token)
    if (releaseToken.usedAt) {
      throw new AppError(
        410,
        'This hold point has already been released using this link.',
        'TOKEN_USED',
        {
          releasedAt: releaseToken.usedAt as unknown as Record<string, unknown>,
          releasedByName: releaseToken.releasedByName as unknown as Record<string, unknown>,
        },
      );
    }

    const holdPoint = releaseToken.holdPoint;
    const lot = holdPoint.lot;
    const itpInstance = lot.itpInstance;

    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem;
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      (item) => item.sequenceNumber <= holdPointItem.sequenceNumber,
    );

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map((item) => {
      const completion = itpInstance.completions.find((c) => c.checklistItemId === item.id);
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments:
          completion?.attachments?.map((a) => ({
            id: a.id,
            filename: a.document.filename,
            fileUrl: a.document.fileUrl,
            caption: a.document.caption,
          })) || [],
      };
    });

    // Get test results
    const testResults = lot.testResults.map((t) => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt,
    }));

    // Get photos/evidence documents
    const photos = lot.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt,
    }));

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        scheduledTime: holdPoint.scheduledTime,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd,
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber,
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType,
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter((i) => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter((i) => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter((t) => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0),
      },
      generatedAt: new Date().toISOString(),
    };

    // Token info for the UI
    const tokenInfo = {
      recipientEmail: releaseToken.recipientEmail,
      recipientName: releaseToken.recipientName,
      expiresAt: releaseToken.expiresAt,
      canRelease: holdPoint.status !== 'released',
    };

    res.json({
      evidencePackage,
      tokenInfo,
      isPublicAccess: true,
    });
  }),
);

// Release hold point via secure link (no auth required)
holdpointsRouter.post(
  '/public/:token/release',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const parseResult = publicReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { releasedByName, releasedByOrg, releaseNotes, signatureDataUrl } = parseResult.data;

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findFirst({
      where: holdPointReleaseTokenLookup(token),
      include: {
        holdPoint: {
          include: {
            lot: {
              include: {
                project: true,
              },
            },
            itpChecklistItem: true,
          },
        },
      },
    });

    if (!releaseToken) {
      throw AppError.notFound('Invalid or expired link');
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    // Check if token has been used
    if (releaseToken.usedAt) {
      throw new AppError(
        410,
        'This hold point has already been released using this link.',
        'TOKEN_USED',
        {
          releasedAt: releaseToken.usedAt as unknown as Record<string, unknown>,
          releasedByName: releaseToken.releasedByName as unknown as Record<string, unknown>,
        },
      );
    }

    // Check if hold point is already released
    if (releaseToken.holdPoint.status === 'released') {
      throw AppError.badRequest('This hold point has already been released.');
    }

    const releasedAt = new Date();
    const holdPoint = await prisma.$transaction(async (tx) => {
      const tokenUpdate = await tx.holdPointReleaseToken.updateMany({
        where: {
          id: releaseToken.id,
          usedAt: null,
        },
        data: {
          usedAt: releasedAt,
          releasedByName,
          releasedByOrg: releasedByOrg || null,
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
      });

      if (tokenUpdate.count !== 1) {
        throw new AppError(
          410,
          'This hold point has already been released using this link.',
          'TOKEN_USED',
        );
      }

      const holdPointUpdate = await tx.holdPoint.updateMany({
        where: {
          id: releaseToken.holdPoint.id,
          status: { not: 'released' },
        },
        data: {
          status: 'released',
          releasedAt,
          releasedByName,
          releasedByOrg: releasedByOrg || null,
          releaseMethod: 'secure_link',
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
      });

      if (holdPointUpdate.count !== 1) {
        throw AppError.badRequest('This hold point has already been released.');
      }

      const updatedHoldPoint = await tx.holdPoint.findUnique({
        where: { id: releaseToken.holdPoint.id },
        include: {
          lot: true,
          itpChecklistItem: true,
        },
      });

      if (!updatedHoldPoint) {
        throw AppError.notFound('Hold point');
      }

      // Also mark the ITP completion as verified in the same transaction.
      const itpInstance = await tx.iTPInstance.findUnique({
        where: { lotId: updatedHoldPoint.lotId },
        select: { id: true },
      });

      if (itpInstance) {
        await tx.iTPCompletion.updateMany({
          where: {
            itpInstanceId: itpInstance.id,
            checklistItemId: updatedHoldPoint.itpChecklistItemId,
          },
          data: {
            verificationStatus: 'verified',
            verifiedAt: releasedAt,
          },
        });
      }

      return updatedHoldPoint;
    });

    // Create in-app notifications for project team members
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: releaseToken.holdPoint.lot.projectId,
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: releaseToken.holdPoint.lot.projectId,
      type: 'hold_point_release',
      title: 'Hold Point Released (via Secure Link)',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName} via secure link.`,
      linkUrl: `/projects/${releaseToken.holdPoint.lot.projectId}/hold-points`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send confirmation emails
    try {
      const lotUrl = buildFrontendUrl(
        `/projects/${releaseToken.holdPoint.lot.projectId}/lots/${releaseToken.holdPoint.lot.id}`,
      );
      const releasedAt = new Date().toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Send to contractors (site_engineer, foreman roles)
      const contractorRoles = ['site_engineer', 'foreman', 'engineer'];
      const contractors = projectUsers.filter((pu) => contractorRoles.includes(pu.role));

      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail({
          to: contractor.user.email,
          recipientName: contractor.user.fullName || 'Site Team',
          recipientRole: 'contractor',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl,
        });
      }

      // Send to superintendents
      const superintendentRoles = ['superintendent', 'project_manager'];
      const superintendents = projectUsers.filter((pu) => superintendentRoles.includes(pu.role));

      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail({
          to: superintendent.user.email,
          recipientName: superintendent.user.fullName || 'Superintendent',
          recipientRole: 'superintendent',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl,
        });
      }
    } catch (emailError) {
      logError('[HP Secure Release] Failed to send confirmation emails:', emailError);
      // Don't fail the main request
    }

    // Audit log for public HP release (no userId - public endpoint)
    await createAuditLog({
      projectId: releaseToken.holdPoint.lot.projectId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_PUBLIC_RELEASED,
      changes: {
        releasedByName,
        releasedByOrg,
        releaseMethod: 'secure_link',
        tokenRecipient: releaseToken.recipientEmail,
      },
      req,
    });

    res.json({
      success: true,
      message: 'Hold point released successfully via secure link',
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releasedByOrg: holdPoint.releasedByOrg,
        releaseMethod: holdPoint.releaseMethod,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot: {
        id: holdPoint.lot.id,
        lotNumber: holdPoint.lot.lotNumber,
      },
    });
  }),
);

export { holdpointsRouter };
