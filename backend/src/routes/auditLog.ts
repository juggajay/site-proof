import { Router } from 'express';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/AppError.js';
import { parseAuditLogChanges } from '../lib/auditLog.js';

export const auditLogRouter = Router();
const AUDIT_LOG_ROLES = ['owner', 'admin', 'project_manager'];
const COMPANY_AUDIT_ROLES = new Set(['owner', 'admin']);
const AUDIT_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const AUDIT_FILTER_MAX_LENGTH = 120;
const AUDIT_SEARCH_MAX_LENGTH = 200;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

// Apply authentication middleware to all audit log routes
auditLogRouter.use(requireAuth);

async function getAuditLogAccessWhere(req: Request): Promise<Prisma.AuditLogWhereInput> {
  const user = req.user!;

  if (AUDIT_SUBCONTRACTOR_ROLES.has(user.roleInCompany || '')) {
    throw AppError.forbidden('Audit log access required');
  }

  if (COMPANY_AUDIT_ROLES.has(user.roleInCompany) && user.companyId) {
    return {
      OR: [
        { project: { companyId: user.companyId } },
        {
          AND: [{ projectId: null }, { user: { companyId: user.companyId } }],
        },
      ],
    };
  }

  const projectAccess = await prisma.projectUser.findMany({
    where: {
      userId: user.id,
      status: 'active',
      role: { in: AUDIT_LOG_ROLES },
    },
    select: { projectId: true },
  });

  const projectIds = projectAccess.map((access) => access.projectId);

  if (projectIds.length === 0) {
    throw AppError.forbidden('Audit log access required');
  }

  return {
    OR: [
      { projectId: { in: projectIds } },
      {
        AND: [{ projectId: null }, { userId: user.id }],
      },
    ],
  };
}

function combineWhere(...clauses: Prisma.AuditLogWhereInput[]): Prisma.AuditLogWhereInput {
  const activeClauses = clauses.filter((clause) => Object.keys(clause).length > 0);
  if (activeClauses.length === 0) return {};
  if (activeClauses.length === 1) return activeClauses[0];
  return { AND: activeClauses };
}

function parsePage(value: unknown): number {
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('page must be a positive integer');
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw AppError.badRequest('page must be a positive integer');
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw AppError.badRequest('page must be a positive integer');
  }

  return parsed;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 50;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('limit must be a positive integer');
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  return Math.min(parsed, 100);
}

function parseDateParam(value: unknown, field: string): Date {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(normalized);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`Invalid ${field} date`);
    }
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`Invalid ${field} date`);
  }

  return date;
}

function parseOptionalQueryString(
  value: unknown,
  field: string,
  maxLength = AUDIT_FILTER_MAX_LENGTH,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${field} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function containsInsensitive(value: string): Prisma.StringFilter {
  return {
    contains: value,
    mode: 'insensitive',
  };
}

// GET /api/audit-logs - List audit logs with filtering
auditLogRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      projectId,
      entityType,
      action,
      userId,
      search,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parsePage(page);
    const limitNum = parseLimit(limit);
    const skip = (pageNum - 1) * limitNum;
    const projectIdFilter = parseOptionalQueryString(projectId, 'projectId');
    const entityTypeFilter = parseOptionalQueryString(entityType, 'entityType');
    const actionFilter = parseOptionalQueryString(action, 'action');
    const userIdFilter = parseOptionalQueryString(userId, 'userId');
    const searchFilter = parseOptionalQueryString(search, 'search', AUDIT_SEARCH_MAX_LENGTH);

    // Build where clause
    const filters: Prisma.AuditLogWhereInput = {};

    if (projectIdFilter) {
      filters.projectId = projectIdFilter;
    }

    if (entityTypeFilter) {
      filters.entityType = entityTypeFilter;
    }

    if (actionFilter) {
      filters.action = containsInsensitive(actionFilter);
    }

    if (userIdFilter) {
      filters.userId = userIdFilter;
    }

    // Search in action, entityType, entityId
    if (searchFilter) {
      filters.OR = [
        { action: containsInsensitive(searchFilter) },
        { entityType: containsInsensitive(searchFilter) },
        { entityId: containsInsensitive(searchFilter) },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        parsedStartDate = parseDateParam(startDate, 'startDate');
        createdAt.gte = parsedStartDate;
      }
      if (endDate) {
        parsedEndDate = parseDateParam(endDate, 'endDate');
        parsedEndDate.setHours(23, 59, 59, 999);
        createdAt.lte = parsedEndDate;
      }
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        throw AppError.badRequest('startDate must be on or before endDate');
      }
      filters.createdAt = createdAt;
    }

    const accessWhere = await getAuditLogAccessWhere(req);
    const where = combineWhere(accessWhere, filters);

    // Get total count for pagination
    const total = await prisma.auditLog.count({ where });

    // Get audit logs with user info
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    // Parse changes JSON
    const parsedLogs = logs.map((log) => ({
      ...log,
      changes: parseAuditLogChanges(log.changes),
    }));

    res.json({
      logs: parsedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  }),
);

// GET /api/audit-logs/actions - Get list of distinct actions for filtering
auditLogRouter.get(
  '/actions',
  asyncHandler(async (req, res) => {
    const where = await getAuditLogAccessWhere(req);
    const actions = await prisma.auditLog.findMany({
      where,
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    res.json({
      actions: actions.map((a) => a.action).sort(),
    });
  }),
);

// GET /api/audit-logs/entity-types - Get list of distinct entity types for filtering
auditLogRouter.get(
  '/entity-types',
  asyncHandler(async (req, res) => {
    const where = await getAuditLogAccessWhere(req);
    const entityTypes = await prisma.auditLog.findMany({
      where,
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });

    res.json({
      entityTypes: entityTypes.map((e) => e.entityType).sort(),
    });
  }),
);

// GET /api/audit-logs/users - Get list of users who have audit log entries
auditLogRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const accessWhere = await getAuditLogAccessWhere(req);
    const usersWithLogs = await prisma.auditLog.findMany({
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      distinct: ['userId'],
      where: combineWhere(accessWhere, { userId: { not: null } }),
    });

    const users = usersWithLogs
      .filter((log) => log.user)
      .map((log) => ({
        id: log.user!.id,
        email: log.user!.email,
        fullName: log.user!.fullName,
      }))
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''));

    res.json({ users });
  }),
);
