import { describe, expect, it } from 'vitest';

import type { CopilotProposal } from './copilotData';
import { deriveStageStatus } from './copilotStageStatus';

function proposal(status: CopilotProposal['status']): CopilotProposal {
  return {
    id: 'p1',
    projectId: 'proj1',
    stage: 'project_facts',
    status,
    model: 'claude-sonnet-5',
    sourceRefs: [],
    payload: {},
    warnings: [],
    editedPayload: null,
    decidedAt: null,
    createdAt: '2026-07-15T00:00:00.000Z',
  };
}

describe('deriveStageStatus', () => {
  it('is Not started with no proposal and no data', () => {
    expect(deriveStageStatus(null, false)).toBe('not_started');
  });

  it('is Review ready when a proposed proposal exists — even if data already exists', () => {
    expect(deriveStageStatus(proposal('proposed'), false)).toBe('review_ready');
    expect(deriveStageStatus(proposal('proposed'), true)).toBe('review_ready');
  });

  it('is Done when the underlying data exists', () => {
    expect(deriveStageStatus(null, true)).toBe('done');
  });

  it('is Done when the proposal was applied (accepted or edited)', () => {
    expect(deriveStageStatus(proposal('accepted'), false)).toBe('done');
    expect(deriveStageStatus(proposal('edited'), false)).toBe('done');
  });

  it('falls back to Not started for a rejected/rolled-back proposal with no data', () => {
    expect(deriveStageStatus(proposal('rejected'), false)).toBe('not_started');
    expect(deriveStageStatus(proposal('rolled_back'), false)).toBe('not_started');
  });
});
