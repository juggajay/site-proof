// The one runnable check behind the C1.1 backfill: the fold rule is the only
// part of the script that can be silently wrong, and a wrong slug silently
// changes frequency-stream membership (§16 D7).
//
// Pure — no database. The DB half (batching, idempotence on re-run) is proven
// by running the script itself against the local test DB.

import { describe, expect, it } from 'vitest';

import { planActivitySlugBatch } from './activitySlugBackfill.js';

describe('planActivitySlugBatch', () => {
  it('plans only rows whose stored slug disagrees with the fold', () => {
    const tally = new Map<string, number>();
    const plan = planActivitySlugBatch(
      [
        // exact fold, not yet stored -> written
        { id: 'a', activityType: 'Earthworks', activitySlug: null },
        // exact fold, already stored -> untouched, which is what makes a
        // re-run a no-op
        { id: 'b', activityType: 'Earthworks', activitySlug: 'earthworks_general' },
        // FAMILY fold: 'Pavement' resolves to `pavements` at family confidence,
        // which is not a Level-2 slug — so NULL, never the family slug
        { id: 'c', activityType: 'Pavement', activitySlug: null },
        // unrecognised free text -> NULL
        { id: 'd', activityType: 'Nonsense Activity', activitySlug: null },
        // a stale slug from a since-changed activityType is CORRECTED to NULL
        { id: 'e', activityType: 'Nonsense Activity', activitySlug: 'earthworks_general' },
      ],
      tally,
    );

    expect(plan).toEqual([
      { id: 'a', activitySlug: 'earthworks_general' },
      { id: 'e', activitySlug: null },
    ]);
    expect(Object.fromEntries(tally)).toEqual({ exact: 2, family: 1, none: 2 });
  });

  it('is idempotent: re-planning its own output changes nothing', () => {
    const rows = [{ id: 'a', activityType: 'Earthworks', activitySlug: null }];
    const first = planActivitySlugBatch(rows, new Map());
    const applied = rows.map((row) => ({
      ...row,
      activitySlug: first.find((entry) => entry.id === row.id)?.activitySlug ?? row.activitySlug,
    }));
    expect(planActivitySlugBatch(applied, new Map())).toEqual([]);
  });
});
