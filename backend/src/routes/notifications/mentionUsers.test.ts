import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
  };
});

import {
  buildMentionableProjectFilter,
  buildMentionableUserFilters,
  buildMentionableUsersResponse,
} from './mentionUsers.js';

// DB-free coverage of the mentionable-user filter builders. They contain no
// database or access-control calls, so the real isSubcontractorRole classifier
// is used (importing ./access.js is import-safe — its prisma singleton only
// constructs lazily and is never touched here). We pin the base scope fallbacks,
// the 2-character search guard with lower-cased contains, and the project
// membership / company-admin filter shape.

type ScopeUser = Parameters<typeof buildMentionableUserFilters>[0];

function makeUser(overrides: Partial<ScopeUser> = {}): ScopeUser {
  return {
    id: 'user-1',
    roleInCompany: 'project_manager',
    companyId: 'company-1',
    ...overrides,
  };
}

describe('buildMentionableUserFilters', () => {
  it('scopes a subcontractor user to themselves even when they have a company', () => {
    const filters = buildMentionableUserFilters(
      makeUser({ id: 'sub-1', roleInCompany: 'subcontractor', companyId: 'company-1' }),
      undefined,
    );

    expect(filters).toEqual([{ id: 'sub-1' }]);
  });

  it('scopes a company user to their company', () => {
    const filters = buildMentionableUserFilters(
      makeUser({ id: 'user-1', companyId: 'company-1' }),
      undefined,
    );

    expect(filters).toEqual([{ companyId: 'company-1' }]);
  });

  it('falls back to the user themselves when they have no company', () => {
    const filters = buildMentionableUserFilters(
      makeUser({ id: 'user-1', companyId: null }),
      undefined,
    );

    expect(filters).toEqual([{ id: 'user-1' }]);
  });

  it('does not add a search filter for a single-character search', () => {
    const filters = buildMentionableUserFilters(makeUser({ companyId: 'company-1' }), 'a');

    expect(filters).toEqual([{ companyId: 'company-1' }]);
  });

  it('adds a case-insensitive email/fullName contains filter for a 2+ character search', () => {
    // Postgres `contains` is case-sensitive without mode:'insensitive', so a
    // lower-cased search would never match an original-cased stored name. The
    // filter must use insensitive mode against the original search text.
    const filters = buildMentionableUserFilters(makeUser({ companyId: 'company-1' }), 'AB');

    expect(filters).toEqual([
      { companyId: 'company-1' },
      {
        OR: [
          { email: { contains: 'AB', mode: 'insensitive' } },
          { fullName: { contains: 'AB', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('returns a fresh, mutable array the route can push onto', () => {
    const filters = buildMentionableUserFilters(makeUser(), undefined);
    const lengthBefore = filters.length;

    filters.push({ id: 'extra' });

    expect(filters).toHaveLength(lengthBefore + 1);
  });
});

describe('buildMentionableProjectFilter', () => {
  it('matches active project members or owner/admin users in the project company', () => {
    const filter = buildMentionableProjectFilter('project-1', 'company-9');

    expect(filter).toEqual({
      OR: [
        { projectUsers: { some: { projectId: 'project-1', status: 'active' } } },
        { companyId: 'company-9', roleInCompany: { in: ['owner', 'admin'] } },
      ],
    });
  });
});

describe('buildMentionableUsersResponse', () => {
  it('wraps mentionable users under the existing response key', () => {
    const users = [
      { id: 'user-1', email: 'one@example.com', fullName: 'One User' },
      { id: 'user-2', email: 'two@example.com', fullName: null },
    ];

    expect(buildMentionableUsersResponse(users)).toEqual({ users });
  });

  it('serializes Supabase avatar refs as signed backend URLs', () => {
    const response = buildMentionableUsersResponse([
      {
        id: 'u1',
        email: 'one@example.com',
        fullName: 'One User',
        avatarUrl: 'supabase://documents/avatars/u1/avatar-u1.png',
      },
    ]);

    expect(response.users[0].avatarUrl).toContain('/api/auth/avatar/file/u1?token=');
    expect(response.users[0].avatarUrl).not.toContain('supabase://');
    expect(response.users[0].avatarUrl).not.toContain('/storage/v1/object/public/');
  });
});
