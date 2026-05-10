import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';

type AuthUser = NonNullable<Request['user']>;

const DIARY_WRITE_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'foreman',
  'site_engineer',
]);
const DIARY_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIARY_QUERY_TEXT_MAX_LENGTH = 120;
export const DIARY_ROUTE_PARAM_MAX_LENGTH = 128;
export const DIARY_DATE_INPUT_MAX_LENGTH = 64;

export async function requireDiaryReadAccess(
  user: AuthUser,
  projectId: string,
  message = 'Access denied to this project',
) {
  if (DIARY_SUBCONTRACTOR_ROLES.has(user.roleInCompany)) {
    throw AppError.forbidden(message);
  }

  const role = await getEffectiveProjectRole(user, projectId);
  if (!role || DIARY_SUBCONTRACTOR_ROLES.has(role)) {
    throw AppError.forbidden(message);
  }
}

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  const isSubcontractor = DIARY_SUBCONTRACTOR_ROLES.has(user.roleInCompany);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
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

  if (
    !isSubcontractor &&
    (user.roleInCompany === 'owner' || user.roleInCompany === 'admin') &&
    project.companyId === user.companyId
  ) {
    return user.roleInCompany;
  }

  return projectUser?.role ?? null;
}

export async function requireDiaryWriteAccess(
  user: AuthUser,
  projectId: string,
  message = 'You do not have permission to modify diaries for this project',
) {
  const role = await getEffectiveProjectRole(user, projectId);
  if (!role || !DIARY_WRITE_ROLES.has(role)) {
    throw AppError.forbidden(message);
  }
}

export async function requireDraftDiaryWriteAccess(
  user: AuthUser,
  diary: { projectId: string; status: string; lockedAt?: Date | null },
) {
  await requireDiaryWriteAccess(user, diary.projectId);

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary');
  }

  if (diary.lockedAt) {
    throw AppError.badRequest('Cannot modify locked diary');
  }
}

export async function requireLotInProject(lotId: string | undefined, projectId: string) {
  if (!lotId) {
    return;
  }

  const lot = await prisma.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.badRequest('Lot does not belong to this project');
  }
}

export function parseDiaryDate(value: unknown, fieldName = 'date'): Date {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  const trimmed = value.trim();
  if (trimmed.length > DIARY_DATE_INPUT_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  return date;
}

export function parseDiaryRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > DIARY_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function parseOptionalDiaryQueryString(
  value: unknown,
  fieldName: string,
  maxLength = DIARY_QUERY_TEXT_MAX_LENGTH,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function getUtcDayRange(value: string): { startOfDay: Date; endOfDay: Date } {
  const date = parseDiaryDate(value);
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}

export function normalizeDiaryDate(value: string): Date {
  const date = parseDiaryDate(value);
  return date;
}
