import { describe, expect, it } from 'vitest';

import { flattenPsets } from './psets';

describe('flattenPsets', () => {
  it('maps getItemsData relations to pset name -> property -> value', () => {
    const result = flattenPsets({
      Name: { value: 'Pipe PR2-001' },
      IsDefinedBy: [
        {
          Name: { value: 'CIVOS_QA' },
          HasProperties: [
            { Name: { value: 'LotRef' }, NominalValue: { value: 'LOT-014' } },
            { Name: { value: 'Chainage' }, NominalValue: { value: 1240 } },
            { Name: { value: 'HoldPoint' }, NominalValue: { value: true } },
          ],
        },
        { Name: { value: 'Pset_Empty' }, HasProperties: [] },
      ],
    });

    expect(result.name).toBe('Pipe PR2-001');
    expect(result.psets).toEqual({
      CIVOS_QA: { LotRef: 'LOT-014', Chainage: 1240, HoldPoint: true },
      Pset_Empty: {},
    });
  });

  it('survives missing names, values, and relations', () => {
    expect(flattenPsets(undefined)).toEqual({ name: null, psets: {} });
    expect(flattenPsets({})).toEqual({ name: null, psets: {} });
    expect(
      flattenPsets({
        IsDefinedBy: [{ HasProperties: [{ NominalValue: { value: { complex: true } } }] }],
      }),
    ).toEqual({ name: null, psets: { '?': { '?': null } } });
  });
});
