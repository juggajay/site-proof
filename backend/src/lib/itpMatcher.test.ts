import { describe, it, expect } from 'vitest';
import { routeTemplateMatch, type TemplateForMatch } from './itpMatcher.js';

const PROJECT = 'proj-1';
const SPEC = 'TfNSW';

function tpl(overrides: Partial<TemplateForMatch> & { id: string }): TemplateForMatch {
  return {
    name: overrides.name ?? overrides.id,
    projectId: null,
    stateSpec: SPEC,
    activityType: null,
    checklistItemCount: 0,
    holdPointCount: 0,
    ...overrides,
  };
}

function match(templates: TemplateForMatch[], activityValue: string | null) {
  return routeTemplateMatch(templates, {
    projectId: PROJECT,
    specificationSet: SPEC,
    activityValue,
  });
}

describe('routeTemplateMatch — hard filter (state/spec boundary)', () => {
  it('excludes a wrong-state global even when its activity slug matches', () => {
    const result = match(
      [tpl({ id: 'wrong-state', projectId: null, stateSpec: 'MRTS', activityType: 'culverts' })],
      'culverts',
    );
    expect(result.tier).toBe('C');
    expect(result.candidates).toHaveLength(0);
  });

  it('includes a matching-state global', () => {
    const result = match(
      [tpl({ id: 'right-state', projectId: null, stateSpec: SPEC, activityType: 'culverts' })],
      'culverts',
    );
    expect(result.tier).toBe('A');
    expect(result.suggestedTemplateId).toBe('right-state');
  });

  it('includes a project-scoped template regardless of its stateSpec', () => {
    const result = match(
      [
        tpl({
          id: 'proj-tpl',
          projectId: PROJECT,
          stateSpec: 'anything',
          activityType: 'culverts',
        }),
      ],
      'culverts',
    );
    expect(result.tier).toBe('A');
    expect(result.suggestedTemplateId).toBe('proj-tpl');
  });
});

describe('routeTemplateMatch — tier routing', () => {
  it('Tier A: exactly one exact-slug candidate', () => {
    const result = match([tpl({ id: 'a', activityType: 'culverts' })], 'culverts');
    expect(result.tier).toBe('A');
    expect(result.suggestedTemplateId).toBe('a');
  });

  it('Tier B: more than one exact-slug candidate, no suggestion', () => {
    const result = match(
      [
        tpl({ id: 'a', projectId: PROJECT, activityType: 'culverts' }),
        tpl({ id: 'b', activityType: 'culverts' }),
      ],
      'culverts',
    );
    expect(result.tier).toBe('B');
    expect(result.suggestedTemplateId).toBeNull();
    expect(result.candidates).toHaveLength(2);
  });

  it('Tier C: zero candidates (honest gap)', () => {
    const result = match([tpl({ id: 'a', activityType: 'pipe_drainage' })], 'culverts');
    expect(result.tier).toBe('C');
    expect(result.candidates).toHaveLength(0);
  });
});

describe('routeTemplateMatch — family folds never Tier A', () => {
  it('a lone family-fold candidate routes to Tier B, not A', () => {
    // 'drainage' folds to the drainage family; the culverts lot is in that family.
    const result = match([tpl({ id: 'fam', activityType: 'drainage' })], 'culverts');
    expect(result.tier).toBe('B');
    expect(result.suggestedTemplateId).toBeNull();
    expect(result.candidates[0].matchKind).toBe('family');
  });

  it('an exact match wins Tier A even alongside a family fallback', () => {
    const result = match(
      [
        tpl({ id: 'exact', activityType: 'culverts' }),
        tpl({ id: 'fam', activityType: 'drainage' }),
      ],
      'culverts',
    );
    expect(result.tier).toBe('A');
    expect(result.suggestedTemplateId).toBe('exact');
    expect(result.candidates).toHaveLength(2);
  });

  it('two different exact Level-2 slugs in the same family do not match each other', () => {
    // pipe_drainage template must not surface for a culverts lot.
    const result = match([tpl({ id: 'pipe', activityType: 'pipe_drainage' })], 'culverts');
    expect(result.tier).toBe('C');
  });
});

describe('routeTemplateMatch — unclassified templates', () => {
  it("surface only for their own project's lots, never Tier A", () => {
    const result = match(
      [tpl({ id: 'custom', projectId: PROJECT, activityType: 'Bespoke Widget Install' })],
      'culverts',
    );
    expect(result.tier).toBe('B');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchKind).toBe('unclassified');
  });

  it('an unclassified GLOBAL template is never a candidate', () => {
    const result = match(
      [tpl({ id: 'g', projectId: null, stateSpec: SPEC, activityType: 'Bespoke Widget Install' })],
      'culverts',
    );
    expect(result.tier).toBe('C');
    expect(result.candidates).toHaveLength(0);
  });
});

describe('routeTemplateMatch — deterministic ordering', () => {
  it('orders project before global, then exact before family before unclassified, then name asc', () => {
    const result = match(
      [
        tpl({ id: 'g-exact', name: 'Zeta', projectId: null, activityType: 'culverts' }),
        tpl({ id: 'p-exact-b', name: 'Bravo', projectId: PROJECT, activityType: 'culverts' }),
        tpl({ id: 'p-exact-a', name: 'Alpha', projectId: PROJECT, activityType: 'culverts' }),
        tpl({ id: 'p-family', name: 'Delta', projectId: PROJECT, activityType: 'drainage' }),
        tpl({ id: 'p-unclassified', name: 'Echo', projectId: PROJECT, activityType: 'Weird' }),
      ],
      'culverts',
    );
    expect(result.tier).toBe('B');
    expect(result.candidates.map((c) => c.id)).toEqual([
      'p-exact-a',
      'p-exact-b',
      'p-family',
      'p-unclassified',
      'g-exact',
    ]);
  });
});

describe('routeTemplateMatch — candidate payload', () => {
  it('reports scope, match kind, and checklist/hold-point counts', () => {
    const result = match(
      [
        tpl({
          id: 'a',
          projectId: PROJECT,
          activityType: 'culverts',
          checklistItemCount: 7,
          holdPointCount: 2,
        }),
      ],
      'culverts',
    );
    expect(result.candidates[0]).toMatchObject({
      id: 'a',
      scope: 'project',
      matchKind: 'exact',
      checklistItemCount: 7,
      holdPointCount: 2,
    });
  });
});
