import { describe, expect, it } from 'vitest';
import {
  canonicalizeActivityValue,
  parseChainageInput,
  parseLotsCsv,
  validateLots,
  type ParsedLot,
} from './importLotsCsv';

const validLot = (overrides: Partial<ParsedLot> = {}): ParsedLot => ({
  row: 2,
  lotNumber: 'LOT-001',
  description: 'Bulk earthworks',
  chainageStart: '0',
  chainageEnd: '100',
  activityType: 'Earthworks',
  status: '',
  ...overrides,
});

describe('importLotsCsv', () => {
  it('parses supported lot CSV header aliases and quoted fields', () => {
    const lots = parseLotsCsv(
      [
        'lot,desc,start,end,activity,status',
        '"LOT-001","Bulk earthworks, stage 1",0,100,Earthworks,pending',
      ].join('\n'),
    );

    expect(lots).toEqual([
      {
        row: 2,
        lotNumber: 'LOT-001',
        description: 'Bulk earthworks, stage 1',
        chainageStart: '0',
        chainageEnd: '100',
        activityType: 'Earthworks',
        status: 'pending',
      },
    ]);
  });

  it('returns no lots when the CSV has no data rows', () => {
    expect(parseLotsCsv('lot_number,description')).toEqual([]);
  });

  it('validates required lot numbers, duplicate lots, and chainage ordering', () => {
    const result = validateLots([
      validLot({ lotNumber: '' }),
      validLot({ row: 3, lotNumber: 'AB' }),
      validLot({ row: 4, lotNumber: 'LOT-001' }),
      validLot({ row: 5, lotNumber: 'lot-001' }),
      validLot({ row: 6, lotNumber: 'LOT-006', chainageStart: '200', chainageEnd: '100' }),
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errors.map((error) => error.message)).toEqual([
      'Lot Number is required',
      'Lot Number must be at least 3 characters',
      'Duplicate lot number "lot-001" in file',
      'End chainage must be greater than start chainage',
    ]);
  });

  it('warns for empty descriptions, broad families, and unknown activity types', () => {
    const result = validateLots([
      validLot({ description: '', activityType: '' }),
      validLot({ row: 3, lotNumber: 'LOT-002', activityType: 'Tunnelling' }),
      validLot({ row: 4, lotNumber: 'LOT-003', activityType: 'Drainage' }),
    ]);

    expect(result.isValid).toBe(true);
    expect(result.warnings.map((warning) => warning.message)).toEqual([
      'Description is empty - lot will be created without description',
      'Activity Type is empty - will default to "earthworks_general"',
      'Unknown activity type "Tunnelling" - will default to "earthworks_general"',
      'Activity type "Drainage" is a broad family - kept as-is; choose the specific activity on the lot after import',
    ]);
  });

  it('an exact canonical or legacy activity value produces no warning', () => {
    const result = validateLots([
      validLot({ activityType: 'culverts' }),
      validLot({ row: 3, lotNumber: 'LOT-002', activityType: 'Earthworks' }),
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('canonicalizeActivityValue folds exact, keeps families, and defaults the rest', () => {
    expect(canonicalizeActivityValue('Earthworks')).toBe('earthworks_general');
    expect(canonicalizeActivityValue('culverts')).toBe('culverts');
    expect(canonicalizeActivityValue('Drainage')).toBe('Drainage');
    expect(canonicalizeActivityValue('Tunnelling')).toBe('earthworks_general');
    expect(canonicalizeActivityValue('')).toBe('earthworks_general');
  });

  it('parses optional non-negative chainage values without changing null semantics', () => {
    expect(parseChainageInput('')).toBeNull();
    expect(parseChainageInput('12.5')).toBe(12.5);
    expect(parseChainageInput('-1')).toBeNull();
    expect(parseChainageInput('not-a-number')).toBeNull();
  });
});
