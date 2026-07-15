import { describe, expect, it } from 'vitest';
import {
  buildValidChecklistItems,
  createEmptyChecklistItem,
  formatActivityTypeLabel,
} from './itpTemplateFormData';

describe('itp template form helpers', () => {
  describe('createEmptyChecklistItem', () => {
    it('returns a blank contractor row with standard defaults', () => {
      expect(createEmptyChecklistItem()).toEqual({
        description: '',
        category: 'general',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
      });
    });

    it('returns a fresh object on each call so rows never share a reference', () => {
      const first = createEmptyChecklistItem();
      const second = createEmptyChecklistItem();
      expect(first).not.toBe(second);

      first.description = 'mutated';
      expect(second.description).toBe('');
    });
  });

  describe('buildValidChecklistItems', () => {
    it('trims descriptions and drops rows that become empty', () => {
      const items = [
        { description: '  keep me  ', order: 0 },
        { description: '   ', order: 1 },
        { description: 'second', order: 2 },
      ];

      expect(buildValidChecklistItems(items)).toEqual([
        { description: 'keep me', order: 0 },
        { description: 'second', order: 2 },
      ]);
    });

    it('preserves extra fields (such as order) without reindexing', () => {
      const items = [
        { description: 'a', order: 5, testType: 'density' },
        { description: '', order: 6 },
        { description: 'c', order: 7 },
      ];

      expect(buildValidChecklistItems(items)).toEqual([
        { description: 'a', order: 5, testType: 'density' },
        { description: 'c', order: 7 },
      ]);
    });

    it('does not mutate the input array or its rows', () => {
      const items = [{ description: '  x  ' }];
      const result = buildValidChecklistItems(items);

      expect(items[0].description).toBe('  x  ');
      expect(result[0]).not.toBe(items[0]);
    });
  });

  describe('formatActivityTypeLabel', () => {
    it('renders canonical slugs as their taxonomy display name', () => {
      expect(formatActivityTypeLabel('pavement_bound')).toBe('Bound/stabilised pavement');
      expect(formatActivityTypeLabel('culverts')).toBe('Culverts (box/pipe)');
    });

    it('keeps a curated label for legacy non-canonical codes', () => {
      expect(formatActivityTypeLabel('asphalt_prep')).toBe('Asphalt prep');
    });

    it('falls back to "Unspecified" for blank input', () => {
      expect(formatActivityTypeLabel('')).toBe('Unspecified');
      expect(formatActivityTypeLabel('   ')).toBe('Unspecified');
    });

    it('passes through labels without separators unchanged', () => {
      expect(formatActivityTypeLabel('Earthworks')).toBe('Earthworks');
    });

    it('title-cases unmapped snake_case and hyphenated codes', () => {
      expect(formatActivityTypeLabel('soil_compaction')).toBe('Soil Compaction');
      expect(formatActivityTypeLabel('proof-roll')).toBe('Proof Roll');
    });

    it('trims surrounding whitespace before formatting', () => {
      expect(formatActivityTypeLabel('  asphalt_prep  ')).toBe('Asphalt prep');
    });
  });
});
