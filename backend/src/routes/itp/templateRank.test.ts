import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

import type { MatchResult } from '../../lib/itpMatcher.js';

// Stub auth: inject a user; no JWT, no DB.
vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: (req.headers['x-test-user'] as string) || 'user-default',
      userId: 'user-default',
      email: 'u@example.com',
      fullName: 'Test User',
      roleInCompany: 'owner',
      role: 'owner',
      companyId: 'company-1',
    };
    next();
  },
}));
// Keep the handler off the DB and network — mock the matcher, access, and AI service.
vi.mock('../../lib/itpMatcher.js', () => ({ matchTemplatesForProject: vi.fn() }));
vi.mock('./templateAccess.js', () => ({ requireProjectTemplateAccess: vi.fn() }));
vi.mock('./templateRankService.js', () => ({ rankTierBCandidates: vi.fn() }));

import { AppError } from '../../lib/AppError.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { matchTemplatesForProject } from '../../lib/itpMatcher.js';
import { requireProjectTemplateAccess } from './templateAccess.js';
import { rankTierBCandidates } from './templateRankService.js';
import { templateRankRouter } from './templateRank.js';

const app = express();
app.use(express.json());
app.use('/api/itp', templateRankRouter);
app.use(errorHandler);

function matchResult(over: Partial<MatchResult>): MatchResult {
  return { tier: 'B', suggestedTemplateId: null, candidates: [], ...over };
}

const tierBCandidates = [
  {
    id: 'a',
    name: 'A',
    scope: 'global' as const,
    stateSpec: 'TfNSW',
    matchKind: 'family' as const,
    checklistItemCount: 2,
    holdPointCount: 0,
  },
  {
    id: 'b',
    name: 'B',
    scope: 'global' as const,
    stateSpec: 'TfNSW',
    matchKind: 'family' as const,
    checklistItemCount: 4,
    holdPointCount: 1,
  },
];

function post(body: Record<string, unknown>) {
  return request(app).post('/api/itp/templates/rank').send(body);
}

describe('POST /api/itp/templates/rank', () => {
  beforeEach(() => {
    vi.mocked(matchTemplatesForProject).mockReset();
    vi.mocked(requireProjectTemplateAccess).mockReset();
    vi.mocked(rankTierBCandidates).mockReset();
    vi.mocked(requireProjectTemplateAccess).mockResolvedValue({
      project: { id: 'p1', name: 'Proj', specificationSet: 'TfNSW' },
    } as Awaited<ReturnType<typeof requireProjectTemplateAccess>>);
  });

  it('ranks a Tier-B shortlist and returns the ranking block', async () => {
    vi.mocked(matchTemplatesForProject).mockResolvedValue(
      matchResult({ tier: 'B', candidates: tierBCandidates }),
    );
    vi.mocked(rankTierBCandidates).mockResolvedValue({
      candidates: [tierBCandidates[1], tierBCandidates[0]],
      reasons: { b: 'closest match' },
      note: 'two options',
    });

    const res = await post({ projectId: 'p1', activity: 'drainage' });

    expect(res.status).toBe(200);
    expect(res.body.candidates.map((c: { id: string }) => c.id)).toEqual(['b', 'a']);
    expect(res.body.ranking).toEqual({ reasons: { b: 'closest match' }, note: 'two options' });
    expect(rankTierBCandidates).toHaveBeenCalledTimes(1);
  });

  it('returns Tier A unchanged and never calls the model', async () => {
    vi.mocked(matchTemplatesForProject).mockResolvedValue(
      matchResult({ tier: 'A', suggestedTemplateId: 'a', candidates: tierBCandidates }),
    );
    const res = await post({ projectId: 'p1', activity: 'earthworks_general' });
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('A');
    expect(res.body.ranking).toBeUndefined();
    expect(rankTierBCandidates).not.toHaveBeenCalled();
  });

  it('returns Tier C unchanged and never calls the model', async () => {
    vi.mocked(matchTemplatesForProject).mockResolvedValue(
      matchResult({ tier: 'C', candidates: [] }),
    );
    const res = await post({ projectId: 'p1', activity: 'no-match' });
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('C');
    expect(rankTierBCandidates).not.toHaveBeenCalled();
  });

  it('rejects a missing activity with 400', async () => {
    const res = await post({ projectId: 'p1' });
    expect(res.status).toBe(400);
    expect(matchTemplatesForProject).not.toHaveBeenCalled();
  });

  it('propagates an access-denied error as 403', async () => {
    vi.mocked(requireProjectTemplateAccess).mockRejectedValue(AppError.forbidden('no'));
    const res = await post({ projectId: 'p1', activity: 'drainage' });
    expect(res.status).toBe(403);
    expect(matchTemplatesForProject).not.toHaveBeenCalled();
  });

  it('propagates a 503 when AI is unavailable (frontend falls back silently)', async () => {
    vi.mocked(matchTemplatesForProject).mockResolvedValue(
      matchResult({ tier: 'B', candidates: tierBCandidates }),
    );
    vi.mocked(rankTierBCandidates).mockRejectedValue(
      new AppError(503, 'AI ranking is not configured on this server.', 'AI_UNAVAILABLE'),
    );
    const res = await post({ projectId: 'p1', activity: 'drainage' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });
});
