import { describe, expect, it } from 'vitest';

import { buildMentionableProjectFilter, buildMentionableUserFilters } from './mentionUsers.js';

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

  it('adds a lower-cased email/fullName contains filter for a 2+ character search', () => {
    const filters = buildMentionableUserFilters(makeUser({ companyId: 'company-1' }), 'AB');

    expect(filters).toEqual([
      { companyId: 'company-1' },
      { OR: [{ email: { contains: 'ab' } }, { fullName: { contains: 'ab' } }] },
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
