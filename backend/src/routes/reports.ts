import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { assertProjectAllowsWrite, getEffectiveProjectRole } from '../lib/projectAccess.js';
import { createClaimReportRouter } from './reports/claimRoutes.js';
import { createDiaryReportRouter } from './reports/diaryRoutes.js';
import { createLotStatusReportRouter } from './reports/lotStatusRoutes.js';
import { createNcrReportRouter } from './reports/ncrRoutes.js';
import { createScheduledReportRouter } from './reports/scheduleRoutes.js';
import { createSummaryReportRouter } from './reports/summaryRoutes.js';
import { createTestReportRouter } from './reports/testRoutes.js';

export const reportsRouter = Router();

// Apply authentication middleware to all report routes
reportsRouter.use(requireAuth);

const SUBCONTRACTOR_REPORT_ROLES = ['subcontractor', 'subcontractor_admin'];
const CLAIM_REPORT_ROLES = ['owner', 'admin', 'project_manager'];
const SCHEDULED_REPORT_MANAGER_ROLES = CLAIM_REPORT_ROLES;
const SCHEDULED_REPORT_TIERS = new Set(['professional', 'enterprise', 'unlimited']);
const DEFAULT_REPORT_PAGE_SIZE = 100;
const MAX_REPORT_PAGE_SIZE = 500;
const MAX_REPORT_ID_LENGTH = 128;
const MAX_REPORT_QUERY_LENGTH = 2000;
const MAX_REPORT_DATE_QUERY_LENGTH = 64;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type AuthUser = NonNullable<Express.Request['user']>;

async function requireReportProjectAccess(
  user: AuthUser | undefined,
  projectId: string,
): Promise<string> {
  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  if (SUBCONTRACTOR_REPORT_ROLES.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Internal report access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || SUBCONTRACTOR_REPORT_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

async function requireClaimsReportAccess(
  user: AuthUser | undefined,
  projectId: string,
): Promise<void> {
  const effectiveRole = await requireReportProjectAccess(user, projectId);

  if (!CLAIM_REPORT_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Commercial report access required');
  }
}

async function requireScheduledReportAccess(
  user: AuthUser | undefined,
  projectId: string,
  options: { requireWritable?: boolean } = {},
): Promise<void> {
  const effectiveRole = await requireReportProjectAccess(user, projectId);

  if (!SCHEDULED_REPORT_MANAGER_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Report schedule management access required');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      company: {
        select: { subscriptionTier: true },
      },
    },
  });
  const tier = project?.company.subscriptionTier || 'basic';

  if (!SCHEDULED_REPORT_TIERS.has(tier)) {
    throw AppError.forbidden('Scheduled reports require a Professional or Enterprise subscription');
  }

  if (options.requireWritable) {
    await assertProjectAllowsWrite(projectId);
  }
}

function groupedCountsToRecord<T extends { _count: number }, K extends keyof T>(
  groups: T[],
  key: K,
  fallback: string,
): Record<string, number> {
  return groups.reduce((acc: Record<string, number>, group) => {
    const value = group[key];
    const name = typeof value === 'string' && value.length > 0 ? value : fallback;
    acc[name] = group._count;
    return acc;
  }, {});
}

function parsePositiveIntegerQuery(
  value: unknown,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  const rawValue =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(rawValue)) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function parseReportPagination(
  page: unknown,
  limit: unknown,
): { pageNum: number; limitNum: number; skip: number } {
  const pageNum = parsePositiveIntegerQuery(page, 'page', 1);
  const requestedLimit = parsePositiveIntegerQuery(limit, 'limit', DEFAULT_REPORT_PAGE_SIZE);
  const limitNum = Math.min(requestedLimit, MAX_REPORT_PAGE_SIZE);
  const skip = (pageNum - 1) * limitNum;

  if (!Number.isSafeInteger(skip)) {
    throw AppError.badRequest('page is too large');
  }

  return { pageNum, limitNum, skip };
}

function parseOptionalStringQuery(
  value: unknown,
  fieldName: string,
  maxLength = MAX_REPORT_QUERY_LENGTH,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalCommaSeparatedQuery(value: unknown, fieldName: string): string[] {
  const rawValue = parseOptionalStringQuery(value, fieldName);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalDateQuery(
  value: unknown,
  fieldName: string,
  endOfDay = false,
): ParsedDateQuery | undefined {
  const rawValue = parseOptionalStringQuery(value, fieldName, MAX_REPORT_DATE_QUERY_LENGTH);
  if (!rawValue) {
    return undefined;
  }

  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(rawValue);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`${fieldName} must be a valid date`);
    }
  }

  const date = new Date(rawValue);
  if (!Number.isFinite(date.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return { raw: rawValue, date };
}

function validateDateRange(
  startDate: ParsedDateQuery | undefined,
  endDate: ParsedDateQuery | undefined,
): void {
  if (startDate && endDate && startDate.date > endDate.date) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }
}

reportsRouter.use(
  createLotStatusReportRouter({
    parseRequiredString,
    parseReportPagination,
    requireReportProjectAccess,
    groupedCountsToRecord,
  }),
);

reportsRouter.use(
  createNcrReportRouter({
    parseRequiredString,
    parseReportPagination,
    requireReportProjectAccess,
    groupedCountsToRecord,
  }),
);

reportsRouter.use(
  createTestReportRouter({
    parseRequiredString,
    parseReportPagination,
    parseOptionalDateQuery,
    parseOptionalCommaSeparatedQuery,
    validateDateRange,
    requireReportProjectAccess,
    groupedCountsToRecord,
  }),
);

reportsRouter.use(
  createDiaryReportRouter({
    parseRequiredString,
    parseReportPagination,
    parseOptionalDateQuery,
    parseOptionalCommaSeparatedQuery,
    validateDateRange,
    requireReportProjectAccess,
  }),
);

reportsRouter.use(
  createSummaryReportRouter({
    parseRequiredString,
    requireReportProjectAccess,
  }),
);

reportsRouter.use(
  createClaimReportRouter({
    parseRequiredString,
    parseOptionalDateQuery,
    parseOptionalCommaSeparatedQuery,
    validateDateRange,
    requireClaimsReportAccess,
  }),
);

// ============================================================================
// Scheduled Reports API
// ============================================================================

function parseRequiredString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_REPORT_ID_LENGTH,
): string {
  const parsedValue = parseOptionalStringQuery(value, fieldName, maxLength);
  if (!parsedValue) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  return parsedValue;
}

reportsRouter.use(
  createScheduledReportRouter({
    parseRequiredString,
    requireScheduledReportAccess,
  }),
);
