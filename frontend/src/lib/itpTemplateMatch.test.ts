import { describe, expect, it } from 'vitest';
import {
  resolveRankedMatch,
  splitSuggestedTemplates,
  type TemplateMatchResult,
  type TemplateRankResult,
} from './itpTemplateMatch';

const options = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

function result(over: Partial<TemplateMatchResult>): TemplateMatchResult {
  return { tier: 'B', suggestedTemplateId: null, candidates: [], ...over };
}

describe('splitSuggestedTemplates', () => {
  it('promotes candidates in matcher order and keeps the rest', () => {
    const match = result({
      candidates: [
        {
          id: 'c',
          name: 'Charlie',
          scope: 'project',
          stateSpec: null,
          matchKind: 'exact',
          checklistItemCount: 0,
          holdPointCount: 0,
        },
        {
          id: 'a',
          name: 'Alpha',
          scope: 'global',
          stateSpec: null,
          matchKind: 'family',
          checklistItemCount: 0,
          holdPointCount: 0,
        },
      ],
    });
    const { suggested, rest } = splitSuggestedTemplates(options, match);
    expect(suggested.map((o) => o.id)).toEqual(['c', 'a']);
    expect(rest.map((o) => o.id)).toEqual(['b']);
  });

  it('suggests nothing for Tier C (empty candidates)', () => {
    const { suggested, rest } = splitSuggestedTemplates(
      options,
      result({ tier: 'C', candidates: [] }),
    );
    expect(suggested).toHaveLength(0);
    expect(rest).toEqual(options);
  });

  it('suggests nothing when the match is still loading (undefined)', () => {
    const { suggested, rest } = splitSuggestedTemplates(options, undefined);
    expect(suggested).toHaveLength(0);
    expect(rest).toEqual(options);
  });
});

describe('resolveRankedMatch', () => {
  const deterministic = result({
    candidates: [
      {
        id: 'a',
        name: 'Alpha',
        scope: 'global',
        stateSpec: null,
        matchKind: 'family',
        checklistItemCount: 0,
        holdPointCount: 0,
      },
    ],
  });

  it('uses the AI-ranked result and its reasons when the rank query loaded', () => {
    const rank: TemplateRankResult = {
      ...deterministic,
      candidates: [
        {
          id: 'b',
          name: 'Bravo',
          scope: 'project',
          stateSpec: null,
          matchKind: 'family',
          checklistItemCount: 0,
          holdPointCount: 0,
        },
      ],
      ranking: { reasons: { b: 'closest match' }, note: 'two options' },
    };
    const resolved = resolveRankedMatch(deterministic, rank);
    expect(resolved.match).toBe(rank);
    expect(resolved.reasons).toEqual({ b: 'closest match' });
    expect(resolved.note).toBe('two options');
  });

  it('falls back to the deterministic match with no reasons when the rank query is absent', () => {
    const resolved = resolveRankedMatch(deterministic, undefined);
    expect(resolved.match).toBe(deterministic);
    expect(resolved.reasons).toEqual({});
    expect(resolved.note).toBeNull();
  });

  it('tolerates a ranked result that omitted the ranking block', () => {
    const rank: TemplateRankResult = { ...deterministic };
    const resolved = resolveRankedMatch(deterministic, rank);
    expect(resolved.match).toBe(rank);
    expect(resolved.reasons).toEqual({});
    expect(resolved.note).toBeNull();
  });
});
