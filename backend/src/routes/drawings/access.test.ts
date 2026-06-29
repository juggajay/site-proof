import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectAccessMocks = vi.hoisted(() => ({
  assertProjectAllowsWrite: vi.fn(),
  getEffectiveProjectRole: vi.fn(),
}));

vi.mock('../../lib/projectAccess.js', () => ({
  assertProjectAllowsWrite: projectAccessMocks.assertProjectAllowsWrite,
  getEffectiveProjectRole: projectAccessMocks.getEffectiveProjectRole,
}));

import { AppError } from '../../lib/AppError.js';
import { requireDrawingWriteAccess } from './access.js';

const user = {
  id: 'user-1',
  userId: 'user-1',
  email: 'admin@example.test',
  fullName: 'Admin User',
  roleInCompany: 'admin',
  role: 'admin',
  companyId: 'company-1',
};

describe('requireDrawingWriteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessMocks.getEffectiveProjectRole.mockResolvedValue('admin');
    projectAccessMocks.assertProjectAllowsWrite.mockResolvedValue(undefined);
  });

  it('enforces project write status for drawing mutations', async () => {
    await requireDrawingWriteAccess(user, 'project-1');

    expect(projectAccessMocks.assertProjectAllowsWrite).toHaveBeenCalledWith('project-1');
  });

  it('rejects archived projects through the shared write guard', async () => {
    projectAccessMocks.assertProjectAllowsWrite.mockRejectedValue(
      AppError.conflict('Archived projects are read-only.'),
    );

    await expect(requireDrawingWriteAccess(user, 'project-1')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
