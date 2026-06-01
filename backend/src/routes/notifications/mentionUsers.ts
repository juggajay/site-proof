import type { Prisma } from '@prisma/client';
import { isSubcontractorRole, type AuthUser } from './access.js';

/**
 * Pure mentionable-user filter builders for the GET /api/notifications/users
 * route, extracted from backend/src/routes/notifications.ts as a slice of the
 * notifications route split (engineering-health Workstream 1).
 *
 * These build the `Prisma.UserWhereInput[]` filters the route passes to
 * `prisma.user.findMany`. They contain no database or access-control calls — the
 * route still owns request parsing, the project lookup, `AppError.notFound`,
 * `requireProjectReadAccess`, the `findMany` (select/take/orderBy), and the
 * response shape. Behaviour is unchanged from the inline implementation.
 */

// Minimal user shape needed to scope the mentionable-user search. The route
// passes the full authenticated user; only id/role/company are read here.
type MentionableUserScope = Pick<AuthUser, 'id' | 'roleInCompany' | 'companyId'>;

/**
 * Build the base scope filters (plus an optional search filter) for the
 * mentionable-user lookup:
 * - subcontractor users may only mention themselves;
 * - company users are scoped to their company;
 * - users without a company fall back to themselves;
 * - a search term adds an email/fullName `contains` filter only when it is at
 *   least two characters long (lower-cased, matching the existing SQLite
 *   case-sensitive contains behaviour).
 *
 * Returns a fresh, mutable array so the route can push the optional
 * project-membership filter from {@link buildMentionableProjectFilter}.
 */
export function buildMentionableUserFilters(
  user: MentionableUserScope,
  search: string | undefined,
): Prisma.UserWhereInput[] {
  const filters: Prisma.UserWhereInput[] = isSubcontractorRole(user.roleInCompany)
    ? [{ id: user.id }]
    : user.companyId
      ? [{ companyId: user.companyId }]
      : [{ id: user.id }];

  // If search provided, filter by email or fullName (SQLite - case-sensitive contains)
  if (search && search.length >= 2) {
    const searchLower = search.toLowerCase();
    filters.push({
      OR: [{ email: { contains: searchLower } }, { fullName: { contains: searchLower } }],
    });
  }

  return filters;
}

/**
 * Build the project-membership filter: active members of the project, plus
 * owner/admin users in the project's company. The route resolves the project
 * (and runs `requireProjectReadAccess`) before calling this.
 */
export function buildMentionableProjectFilter(
  projectId: string,
  projectCompanyId: string,
): Prisma.UserWhereInput {
  return {
    OR: [
      {
        projectUsers: {
          some: { projectId, status: 'active' },
        },
      },
      {
        companyId: projectCompanyId,
        roleInCompany: { in: ['owner', 'admin'] },
      },
    ],
  };
}

export function buildMentionableUsersResponse<TUser>(users: TUser[]) {
  return { users };
}
