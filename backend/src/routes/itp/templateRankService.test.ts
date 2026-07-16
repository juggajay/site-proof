import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MatchCandidate } from '../../lib/itpMatcher.js';

vi.mock('../../lib/fetchWithTimeout.js', () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { cleanRankResponse, rankTierBCandidates } from './templateRankService.js';

function candidate(id: string, over: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id,
    name: id.toUpperCase(),
    scope: 'global',
    stateSpec: 'TfNSW',
    matchKind: 'family',
    checklistItemCount: 3,
    holdPointCount: 1,
    ...over,
  };
}

const candidates = [candidate('a'), candidate('b'), candidate('c')];

function anthropicText(text: string) {
  return {
    ok: true,
    json: async () => ({ content: [{ type: 'text', text }] }),
  } as unknown as Response;
}

describe('cleanRankResponse (trust boundary)', () => {
  it('reorders by the model order, dropping unknown ids and de-duping', () => {
    const result = cleanRankResponse(
      { order: ['c', 'nope', 'a', 'c'], reasons: {}, note: '' },
      candidates,
    );
    // c, a from the model; b (omitted) appended in deterministic order.
    expect(result.candidates.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('appends every omitted candidate in the matcher order', () => {
    const result = cleanRankResponse({ order: ['b'] }, candidates);
    expect(result.candidates.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps reasons only for ids that were sent, and caps their length', () => {
    const long = 'x'.repeat(500);
    const result = cleanRankResponse(
      { order: ['a', 'b', 'c'], reasons: { a: '  best fit  ', ghost: 'ignore me', b: long } },
      candidates,
    );
    expect(result.reasons.a).toBe('best fit');
    expect(result.reasons).not.toHaveProperty('ghost');
    expect(result.reasons.b.length).toBeLessThanOrEqual(200);
    expect(result.reasons.b.endsWith('…')).toBe(true);
  });

  it('coerces and caps the note; tolerates a non-object payload', () => {
    expect(cleanRankResponse({ note: '  overall  ' }, candidates).note).toBe('overall');
    const garbage = cleanRankResponse('not json', candidates);
    expect(garbage.candidates.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(garbage.note).toBe('');
    expect(garbage.reasons).toEqual({});
  });
});

describe('rankTierBCandidates', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-realkey';
    vi.mocked(fetchWithTimeout).mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws 503 AI_UNAVAILABLE and never calls the model when AI is unconfigured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      rankTierBCandidates({
        projectName: 'P',
        specificationSet: 'TfNSW',
        activityValue: 'drainage',
        candidates,
      }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('calls Anthropic once and returns the cleaned ranking on the happy path', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      anthropicText(
        JSON.stringify({
          order: ['b', 'a', 'c'],
          reasons: { b: 'closest sub-activity' },
          note: 'ok',
        }),
      ),
    );
    const result = await rankTierBCandidates({
      projectName: 'P',
      specificationSet: 'TfNSW',
      activityValue: 'drainage',
      candidates,
    });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(result.candidates.map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(result.reasons.b).toBe('closest sub-activity');
    expect(result.note).toBe('ok');
  });

  it('throws 502 when the model reply is not JSON', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(anthropicText('sorry, no'));
    await expect(
      rankTierBCandidates({
        projectName: 'P',
        specificationSet: null,
        activityValue: 'drainage',
        candidates,
      }),
    ).rejects.toMatchObject({ statusCode: 502, code: 'AI_REQUEST_FAILED' });
  });
});
