import { describe, expect, it } from 'vitest';

import { computeRetagPlan, type TemplateRow } from './activityRetag.js';

function row(partial: Partial<TemplateRow> & { activityType: string | null }): TemplateRow {
  return { id: 'id', name: 'name', projectId: null, ...partial };
}

describe('computeRetagPlan', () => {
  it('re-tags only exact folds that differ from the stored value', () => {
    const rows = [
      row({ id: '1', name: 'Earthworks', activityType: 'earthworks' }), // exact -> change
      row({ id: '2', name: 'Austroads Concrete', activityType: 'concrete' }), // exact -> change
      row({ id: '3', name: 'NSW Prime', activityType: 'asphalt_prep' }), // exact -> change
    ];
    const { actions, skipped } = computeRetagPlan(rows);
    expect(skipped).toBe(0);
    expect(actions).toEqual([
      {
        id: '1',
        name: 'Earthworks',
        projectId: null,
        from: 'earthworks',
        to: 'earthworks_general',
      },
      {
        id: '2',
        name: 'Austroads Concrete',
        projectId: null,
        from: 'concrete',
        to: 'structural_concrete',
      },
      { id: '3', name: 'NSW Prime', projectId: null, from: 'asphalt_prep', to: 'prime_primerseal' },
    ]);
  });

  it('never touches family-level, unclassifiable, empty, or null values', () => {
    const rows = [
      row({ activityType: 'drainage' }), // family — needs the name to disambiguate
      row({ activityType: 'structural' }), // family
      row({ activityType: 'pavements' }), // family
      row({ activityType: 'Concrete' }), // retired -> none
      row({ activityType: '' }),
      row({ activityType: null }),
      row({ activityType: 'totally unknown' }),
    ];
    const { actions, skipped } = computeRetagPlan(rows);
    expect(actions).toEqual([]);
    expect(skipped).toBe(rows.length);
  });

  it('skips rows already on a canonical slug (no no-op writes)', () => {
    const rows = [
      row({ activityType: 'culverts' }),
      row({ activityType: 'pavement_unbound' }),
      row({ activityType: 'structural_concrete' }),
    ];
    expect(computeRetagPlan(rows).actions).toEqual([]);
  });

  it('preserves projectId scope on custom (project-scoped) templates', () => {
    const rows = [
      row({ id: 'c1', name: 'Custom', projectId: 'proj-9', activityType: 'earthworks' }),
    ];
    expect(computeRetagPlan(rows).actions[0]).toMatchObject({
      projectId: 'proj-9',
      to: 'earthworks_general',
    });
  });
});
