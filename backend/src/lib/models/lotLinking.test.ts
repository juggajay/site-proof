import { describe, expect, it } from 'vitest';

import { computeAutoLinks } from './lotLinking.js';

describe('computeAutoLinks', () => {
  it('buckets normalized exact matches, collisions, missing values, and misses', () => {
    const result = computeAutoLinks(
      [
        { id: 'element-1', ifcGuid: 'guid-1', lotNumberValue: ' lot-001 ' },
        { id: 'element-2', ifcGuid: 'guid-2', lotNumberValue: 'lot-002' },
        { id: 'element-3', ifcGuid: 'guid-3', lotNumberValue: null },
        { id: 'element-4', ifcGuid: 'guid-4', lotNumberValue: 'LOT-404' },
      ],
      [
        { id: 'lot-1', lotNumber: 'LOT-001' },
        { id: 'lot-2a', lotNumber: 'LOT-002' },
        { id: 'lot-2b', lotNumber: ' lot-002 ' },
      ],
    );

    expect(result.linked).toEqual([
      { id: 'element-1', ifcGuid: 'guid-1', lotNumberValue: ' lot-001 ', lotId: 'lot-1' },
    ]);
    expect(result.ambiguous).toEqual([
      {
        id: 'element-2',
        ifcGuid: 'guid-2',
        lotNumberValue: 'lot-002',
        candidateLotIds: ['lot-2a', 'lot-2b'],
      },
    ]);
    expect(result.unlinked.map((element) => element.id)).toEqual(['element-3', 'element-4']);
  });
});
