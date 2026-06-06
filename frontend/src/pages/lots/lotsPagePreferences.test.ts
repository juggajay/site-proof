import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMN_ORDER } from './components/lotFilterConfig';
import { parseColumnOrderPreference, parseColumnPreference } from './lotsPagePreferences';

describe('lotsPagePreferences', () => {
  describe('parseColumnPreference', () => {
    it('drops invalid values, de-duplicates valid values, and restores the required lot number column', () => {
      expect(
        parseColumnPreference(
          JSON.stringify(['status', 'invalid-column', 'status', 'budget', 123]),
        ),
      ).toEqual(['lotNumber', 'status', 'budget']);
    });

    it('falls back to the default column order for invalid JSON or non-array values', () => {
      expect(parseColumnPreference('not json')).toEqual(DEFAULT_COLUMN_ORDER);
      expect(parseColumnPreference('{"column":"status"}')).toEqual(DEFAULT_COLUMN_ORDER);
      expect(parseColumnPreference(null)).toEqual(DEFAULT_COLUMN_ORDER);
    });
  });

  describe('parseColumnOrderPreference', () => {
    it('forces lot number first, de-duplicates valid values, and appends missing columns', () => {
      expect(parseColumnOrderPreference(JSON.stringify(['budget', 'status', 'budget']))).toEqual([
        'lotNumber',
        'budget',
        'status',
        'description',
        'chainage',
        'activityType',
        'subcontractor',
      ]);
    });

    it('preserves the default order for invalid JSON or non-array values', () => {
      expect(parseColumnOrderPreference('not json')).toEqual(DEFAULT_COLUMN_ORDER);
      expect(parseColumnOrderPreference('"status"')).toEqual(DEFAULT_COLUMN_ORDER);
      expect(parseColumnOrderPreference(null)).toEqual(DEFAULT_COLUMN_ORDER);
    });
  });
});
