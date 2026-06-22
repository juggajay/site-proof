import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  projectUserFindFirst: vi.fn(),
  projectUserFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    project: {
      findUnique: mocks.projectFindUnique,
      findMany: mocks.projectFindMany,
    },
    projectUser: {
      findFirst: mocks.projectUserFindFirst,
      findMany: mocks.projectUserFindMany,
    },
  },
}));

import type { Request } from 'express';
import { getReadableProjects, requireProjectTemplateAccess } from './templateAccess.js';

type AuthenticatedUser = NonNullable<Request['user']>;

const staleCompanyLinkedSubcontractor = {
  id: 'user-1',
  userId: 'user-1',
  email: 'user@example.com',
  fullName: 'Stale Subcontractor Role',
  roleInCompany: 'subcontractor',
  role: 'subcontractor',
  companyId: 'company-1',
} as AuthenticatedUser;

beforeEach(() => {
  vi.clearAllMocks();

  mocks.projectFindUnique.mockResolvedValue({
    id: 'project-1',
    companyId: 'company-1',
    name: 'Project One',
    projectNumber: 'P-001',
  });
  mocks.projectUserFindFirst.mockResolvedValue({
    id: 'project-user-1',
    role: 'site_engineer',
  });
  mocks.projectUserFindMany.mockResolvedValue([
    {
      project: {
        id: 'project-1',
        name: 'Project One',
        projectNumber: 'P-001',
      },
    },
  ]);
  mocks.projectFindMany.mockResolvedValue([]);
});

describe('requireProjectTemplateAccess', () => {
  it('uses project membership for company-linked users with stale subcontractor roles', async () => {
    await expect(
      requireProjectTemplateAccess('project-1', staleCompanyLinkedSubcontractor),
    ).resolves.toMatchObject({
      project: { id: 'project-1' },
      projectUser: { role: 'site_engineer' },
    });

    expect(mocks.projectUserFindFirst).toHaveBeenCalledWith({
      where: { projectId: 'project-1', userId: 'user-1', status: 'active' },
      select: { id: true, role: true },
    });
  });

  it('does not treat company-linked users with stale subcontractor roles as template managers', async () => {
    await expect(
      requireProjectTemplateAccess('project-1', staleCompanyLinkedSubcontractor, true),
    ).rejects.toThrow('Only project managers or quality managers can manage ITP templates');
  });
});

describe('getReadableProjects', () => {
  it('lists project memberships for company-linked users with stale subcontractor roles', async () => {
    await expect(getReadableProjects(staleCompanyLinkedSubcontractor)).resolves.toEqual([
      {
        id: 'project-1',
        name: 'Project One',
        projectNumber: 'P-001',
      },
    ]);

    expect(mocks.projectUserFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'active' },
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true },
        },
      },
    });
  });
});
