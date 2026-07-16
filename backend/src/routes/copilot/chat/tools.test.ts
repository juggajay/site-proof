import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '../../dashboard/access.js';

// Control access without a database. list_projects / list_pending_proposals
// (which hit Prisma) are covered by the route/DB tests; here we exercise the
// pure validation + access branches.
vi.mock('./projectStatus.js', () => ({
  hasInternalProjectAccess: vi.fn(),
  getProjectStageStatus: vi.fn(),
}));
vi.mock('../../dashboard/access.js', () => ({
  getDashboardProjectAccess: vi.fn(),
}));
vi.mock('../../../lib/itpMatcher.js', () => ({
  matchTemplatesForProject: vi.fn(),
}));

import { getDashboardProjectAccess } from '../../dashboard/access.js';
import { CANONICAL_ACTIVITIES } from '../../../lib/activityTaxonomy.js';
import { matchTemplatesForProject } from '../../../lib/itpMatcher.js';
import { getProjectStageStatus, hasInternalProjectAccess } from './projectStatus.js';
import { CHAT_TOOLS, createChatToolExecutor, summariseHoldPoints } from './tools.js';

const user = { id: 'u1', companyId: 'c1', roleInCompany: 'project_manager' } as AuthUser;

const ACCESS = [
  { projectId: 'p1', project: { name: 'Chandler Ave', projectNumber: '100901' } },
] as Awaited<ReturnType<typeof getDashboardProjectAccess>>;

describe('chat tool executor', () => {
  beforeEach(() => {
    vi.mocked(hasInternalProjectAccess).mockReset();
    vi.mocked(getProjectStageStatus).mockReset();
    vi.mocked(getDashboardProjectAccess).mockReset();
    vi.mocked(matchTemplatesForProject).mockReset();
    vi.mocked(getDashboardProjectAccess).mockResolvedValue(ACCESS);
  });

  it('queues a navigate action for a whitelisted path', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: '/projects/p1/lots' });
    expect(outcome.action).toEqual({ type: 'navigate', to: '/projects/p1/lots' });
    expect(outcome.result).toBe('Navigation queued.');
  });

  it('rewrites a projectNumber path segment to the project id (live-probe regression)', async () => {
    // Clancy's first prod conversation navigated to /projects/100901/lots — the
    // human project number, which the router cannot resolve.
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: '/projects/100901/lots' });
    expect(outcome.action).toEqual({ type: 'navigate', to: '/projects/p1/lots' });
  });

  it('refuses navigation into a project the user cannot open', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: '/projects/someone-elses/lots' });
    expect(outcome.action).toBeUndefined();
    expect(outcome.result).toContain('list_projects');
  });

  it('passes non-project paths through without an access lookup', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('navigate', { to: '/dashboard' });
    expect(outcome.action).toEqual({ type: 'navigate', to: '/dashboard' });
    expect(getDashboardProjectAccess).not.toHaveBeenCalled();
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

  it('returns a tool error for get_project_qa_summary on an inaccessible project', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(false);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_project_qa_summary', { projectId: 'other' });
    expect(outcome.result).toContain("don't have access");
  });

  it('requires a projectId for get_project_qa_summary', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_project_qa_summary', {});
    expect(outcome.result).toBe('A projectId is required.');
  });

  it('returns the ITP shortlist for an accessible project (get_itp_suggestion)', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(true);
    vi.mocked(matchTemplatesForProject).mockResolvedValue({
      tier: 'B',
      suggestedTemplateId: null,
      candidates: [
        {
          id: 't1',
          name: 'Pipe Drainage',
          scope: 'global',
          stateSpec: 'TfNSW',
          matchKind: 'family',
          checklistItemCount: 5,
          holdPointCount: 2,
        },
      ],
    });
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_itp_suggestion', { projectId: 'p1', activity: 'drainage' });
    expect(matchTemplatesForProject).toHaveBeenCalledWith({
      projectId: 'p1',
      activity: 'drainage',
    });
    const parsed = JSON.parse(outcome.result);
    expect(parsed.tier).toBe('B');
    expect(parsed.candidates).toEqual([
      {
        id: 't1',
        name: 'Pipe Drainage',
        scope: 'global',
        stateSpec: 'TfNSW',
        matchKind: 'family',
        baseline: false,
        checklistItemCount: 5,
        holdPointCount: 2,
      },
    ]);
  });

  it('rejects free-text activity with a retry hint instead of a fake no-match (live-probe regression)', async () => {
    // Prod probe: "box culvert" folded to nothing and Clancy narrated
    // "no library match" while a Box Culvert template existed (Tier A).
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(true);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_itp_suggestion', {
      projectId: 'p1',
      activity: 'box culvert',
    });
    expect(outcome.result).toContain('not a canonical activity slug');
    expect(outcome.result).toContain('culverts');
    expect(matchTemplatesForProject).not.toHaveBeenCalled();
  });

  it('exposes exactly the 38 canonical slugs as the activity enum', async () => {
    const tool = CHAT_TOOLS.find((t) => t.name === 'get_itp_suggestion')!;
    const activitySchema = (tool.input_schema.properties as Record<string, { enum?: string[] }>)
      .activity;
    expect(activitySchema.enum).toEqual(CANONICAL_ACTIVITIES.map((a) => a.slug));
  });

  it('refuses get_itp_suggestion on a project the user cannot access', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(false);
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_itp_suggestion', {
      projectId: 'other',
      activity: 'drainage',
    });
    expect(outcome.result).toContain("don't have access");
    expect(matchTemplatesForProject).not.toHaveBeenCalled();
  });

  it('requires both projectId and activity for get_itp_suggestion', async () => {
    const execute = createChatToolExecutor(user);
    expect((await execute('get_itp_suggestion', { projectId: 'p1' })).result).toBe(
      'A projectId and activity are required.',
    );
    expect((await execute('get_itp_suggestion', { activity: 'drainage' })).result).toBe(
      'A projectId and activity are required.',
    );
    expect(hasInternalProjectAccess).not.toHaveBeenCalled();
  });
});

describe('summariseHoldPoints', () => {
  it('counts released, awaiting, and ready-to-request hold points', () => {
    expect(
      summariseHoldPoints([
        { status: 'released', canRequestRelease: true },
        { status: 'pending', canRequestRelease: true },
        { status: 'pending', canRequestRelease: false },
        { status: 'requested', canRequestRelease: true },
      ]),
    ).toEqual({ total: 4, released: 1, awaitingRelease: 3, readyToRequest: 2 });
  });

  it('returns zeros for a project with no hold points', () => {
    expect(summariseHoldPoints([])).toEqual({
      total: 0,
      released: 0,
      awaitingRelease: 0,
      readyToRequest: 0,
    });
  });
});
