import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '../../dashboard/access.js';

// Control access without a database. list_projects / list_pending_proposals
// (which hit Prisma) are covered by the route/DB tests; here we exercise the
// pure validation + access branches.
vi.mock('./projectStatus.js', () => ({
  hasInternalProjectAccess: vi.fn(),
  getProjectStageStatus: vi.fn(),
}));

import { getProjectStageStatus, hasInternalProjectAccess } from './projectStatus.js';
import { createChatToolExecutor } from './tools.js';

const user = { id: 'u1', companyId: 'c1', roleInCompany: 'project_manager' } as AuthUser;

describe('chat tool executor', () => {
  beforeEach(() => {
    vi.mocked(hasInternalProjectAccess).mockReset();
    vi.mocked(getProjectStageStatus).mockReset();
  });

  it('queues a navigate action for a whitelisted path', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: '/projects/p1/lots' });
    expect(outcome.action).toEqual({ type: 'navigate', to: '/projects/p1/lots' });
    expect(outcome.result).toBe('Navigation queued.');
  });

  it('rejects a navigate to an external URL without queuing', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: 'https://evil.com' });
    expect(outcome.action).toBeUndefined();
    expect(outcome.result).toContain('not allowed');
  });

  it('queues open_stage when the user has access to the project', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(true);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('open_stage', { stage: 'control_line', projectId: 'p1' });
    expect(outcome.action).toEqual({ type: 'open_stage', stage: 'control_line', projectId: 'p1' });
  });

  it('does not queue open_stage for a project the user cannot access', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(false);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('open_stage', { stage: 'control_line', projectId: 'other' });
    expect(outcome.action).toBeUndefined();
    expect(outcome.result).toContain("don't have access");
  });

  it('rejects open_stage with an unknown stage', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('open_stage', { stage: 'claims', projectId: 'p1' });
    expect(outcome.action).toBeUndefined();
    expect(hasInternalProjectAccess).not.toHaveBeenCalled();
  });

  it('returns a tool error for get_project_overview on an inaccessible project', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(false);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_project_overview', { projectId: 'other' });
    expect(outcome.result).toContain("don't have access");
    expect(getProjectStageStatus).not.toHaveBeenCalled();
  });

  it('requires a projectId for get_project_overview', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_project_overview', {});
    expect(outcome.result).toBe('A projectId is required.');
  });
});
