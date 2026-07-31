import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_NOT_CLASSIFIED,
  ANALYTICS_LIST_LIMIT,
  buildActivityBuckets,
  buildRecurringChecklistItems,
  buildRepeatIssues,
  buildRepeatOffenders,
  foldCategoryCounts,
  foldRootCauseCounts,
  resolveChecklistItemRoot,
} from './ncrAnalyticsAggregation.js';

describe('vocabulary folding in the aggregation (AT-G27)', () => {
  it('sums off-vocabulary free text into other and keeps absent separate', () => {
    const data = foldCategoryCounts(
      [
        { value: 'workmanship', count: 5 },
        { value: 'Workmanship', count: 2 }, // legacy capitalisation
        { value: 'Concrete finish', count: 1 }, // legacy free text
        { value: null, count: 4 },
      ],
      12,
    );

    expect(data).toEqual([
      { key: 'workmanship', name: 'Workmanship', value: 5, percentage: 42 },
      { key: 'not_recorded', name: 'Not recorded', value: 4, percentage: 33 },
      { key: 'other', name: 'Other', value: 3, percentage: 25 },
    ]);
  });

  it('folds root causes the same way', () => {
    const data = foldRootCauseCounts(
      [
        { value: 'human_error', count: 2 },
        { value: 'Method', count: 1 },
      ],
      3,
    );
    expect(data.map((datum) => datum.key)).toEqual(['human_error', 'other']);
  });
});

describe('activity buckets (AT-G28)', () => {
  it('keeps unclassified lots as an explicit bucket rather than dropping them', () => {
    const data = buildActivityBuckets(
      [
        { value: 'earthworks_general', count: 3 },
        { value: null, count: 2 },
        { value: '   ', count: 1 },
      ],
      6,
    );

    const unclassified = data.find((datum) => datum.key === ACTIVITY_NOT_CLASSIFIED);
    expect(unclassified).toEqual({
      key: ACTIVITY_NOT_CLASSIFIED,
      name: 'Activity not classified',
      value: 3,
      percentage: 50,
    });
    expect(data.reduce((sum, datum) => sum + datum.value, 0)).toBe(6);
  });
});

describe('repeat issues', () => {
  it('drops singletons, sums folded collisions and caps the list', () => {
    const rows = [
      { category: 'materials', rootCauseCategory: 'process', count: 3 },
      { category: 'Materials', rootCauseCategory: 'Process', count: 1 }, // folds to other::other
      { category: 'design', rootCauseCategory: 'training', count: 1 }, // singleton, dropped
      // 12 more distinct canonical pairs. Off-vocabulary root causes would all
      // fold to `other` and collapse into ONE group, which is the point of the
      // folding — so the cap has to be exercised with real pairs.
      ...['materials', 'workmanship', 'documentation', 'process'].flatMap((category) =>
        ['human_error', 'equipment', 'training'].map((rootCauseCategory) => ({
          category,
          rootCauseCategory,
          count: 2,
        })),
      ),
    ];

    const issues = buildRepeatIssues(rows);
    expect(issues.length).toBe(ANALYTICS_LIST_LIMIT);
    expect(issues.some((issue) => issue.category === 'design')).toBe(false);
    const materials = issues.find(
      (issue) => issue.category === 'materials' && issue.rootCause === 'process',
    );
    expect(materials).toMatchObject({ count: 3, categoryLabel: 'Materials' });
  });
});

describe('repeat offenders ([GR-N4] — capped, named, counts not id arrays)', () => {
  const names = new Map(
    Array.from({ length: 30 }, (_unused, index) => [`sub-${index}`, `Sub ${index}`] as const),
  );

  it('caps the list symmetrically with repeat issues', () => {
    const counts = Array.from({ length: 30 }, (_unused, index) => ({
      subcontractorId: `sub-${index}`,
      count: 30 - index,
    }));

    const offenders = buildRepeatOffenders(counts, [], names);
    expect(offenders.length).toBe(ANALYTICS_LIST_LIMIT);
    expect(offenders[0]).toMatchObject({ subcontractorId: 'sub-0', subcontractorName: 'Sub 0' });
    // The shipped shape carried an unbounded `ncrIds: string[]` per entry.
    expect(offenders[0]).not.toHaveProperty('ncrIds');
  });

  it('drops single-NCR subcontractors and folds their categories', () => {
    const offenders = buildRepeatOffenders(
      [
        { subcontractorId: 'sub-0', count: 2 },
        { subcontractorId: 'sub-1', count: 1 },
        { subcontractorId: null, count: 9 },
      ],
      [
        { subcontractorId: 'sub-0', category: 'materials' },
        { subcontractorId: 'sub-0', category: 'Materials' },
      ],
      names,
    );

    expect(offenders).toHaveLength(1);
    expect(offenders[0].categories).toEqual(['materials', 'other']);
    expect(offenders[0].categoryCount).toBe(2);
  });

  it('names a subcontractor whose company row is gone rather than showing a bare uuid', () => {
    const offenders = buildRepeatOffenders(
      [{ subcontractorId: 'sub-gone', count: 4 }],
      [],
      new Map(),
    );
    expect(offenders[0].subcontractorName).toBe('Removed subcontractor');
  });
});

describe('checklist-item lineage resolution ([GR-A3])', () => {
  it('walks a clone chain to its root', () => {
    const pointers = new Map<string, string | null>([
      ['c', 'b'],
      ['b', 'a'],
      ['a', null],
    ]);
    expect(resolveChecklistItemRoot('c', pointers)).toBe('a');
    expect(resolveChecklistItemRoot('a', pointers)).toBe('a');
  });

  it('treats an item with no pointer as its own root', () => {
    expect(resolveChecklistItemRoot('legacy', new Map())).toBe('legacy');
  });

  it('terminates on a cycle instead of looping', () => {
    const pointers = new Map<string, string | null>([
      ['x', 'y'],
      ['y', 'x'],
    ]);
    expect(['x', 'y']).toContain(resolveChecklistItemRoot('x', pointers));
  });
});

describe('recurring checklist items (§5.3)', () => {
  const details = new Map([
    ['root-1', { description: 'Compaction test', templateId: 'tpl-1', templateName: 'Earthworks' }],
    ['copy-1', { description: 'Compaction test', templateId: 'tpl-2', templateName: 'Copy' }],
  ]);

  it('groups two project copies of one requirement onto the shared root', () => {
    const pointers = new Map<string, string | null>([
      ['copy-1', 'root-1'],
      ['root-1', null],
    ]);

    const items = buildRecurringChecklistItems(
      [
        { checklistItemId: 'root-1', subcontractorId: 'sub-a', count: 3 },
        { checklistItemId: 'copy-1', subcontractorId: 'sub-b', count: 4 },
      ],
      [
        { checklistItemId: 'root-1', activitySlug: 'earthworks_general' },
        { checklistItemId: 'copy-1', activitySlug: null },
      ],
      pointers,
      details,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      rootChecklistItemId: 'root-1',
      ncrCount: 7,
      subcontractorCount: 2,
      description: 'Compaction test',
    });
    expect(items[0].activitySlugs).toEqual(['earthworks_general', ACTIVITY_NOT_CLASSIFIED]);
    expect(items[0].checklistItemIds).toEqual(['copy-1', 'root-1']);
  });

  it('never merges two items that merely share a description', () => {
    const items = buildRecurringChecklistItems(
      [
        { checklistItemId: 'a', subcontractorId: null, count: 2 },
        { checklistItemId: 'b', subcontractorId: null, count: 2 },
      ],
      [],
      new Map([
        ['a', null],
        ['b', null],
      ]),
      new Map([
        ['a', { description: 'Same words', templateId: 't', templateName: 'T' }],
        ['b', { description: 'Same words', templateId: 't', templateName: 'T' }],
      ]),
    );

    expect(items).toHaveLength(2);
  });

  it('drops items seen only once and caps the list', () => {
    const rows = Array.from({ length: 15 }, (_unused, index) => ({
      checklistItemId: `item-${index}`,
      subcontractorId: null,
      count: 2,
    }));
    rows.push({ checklistItemId: 'lonely', subcontractorId: null, count: 1 });

    const items = buildRecurringChecklistItems(rows, [], new Map(), new Map());
    expect(items.length).toBe(ANALYTICS_LIST_LIMIT);
    expect(items.some((item) => item.rootChecklistItemId === 'lonely')).toBe(false);
  });

  it('says so when the item behind a root is not readable', () => {
    const items = buildRecurringChecklistItems(
      [{ checklistItemId: 'orphan', subcontractorId: null, count: 2 }],
      [],
      new Map(),
      new Map(),
    );
    expect(items[0].description).toBe('Checklist item no longer available');
  });
});
