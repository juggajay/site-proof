import { describe, expect, it } from 'vitest';
import { splitSuggestedTemplates, type TemplateMatchResult } from './itpTemplateMatch';

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
