import { describe, expect, it } from 'vitest';

import { rankResults } from './globalSearchRanking';

type Row = { key: string; label: string };
const key = (r: Row) => r.key;

describe('rankResults', () => {
  it('puts an exact match ahead of prefix and substring matches', () => {
    const rows: Row[] = [
      { key: 'NCR-0012-A', label: 'substring-ish prefix' },
      { key: 'X-NCR-0012', label: 'substring' },
      { key: 'NCR-0012', label: 'exact' },
    ];
    const ranked = rankResults(rows, 'ncr-0012', key);
    expect(ranked.map((r) => r.label)).toEqual(['exact', 'substring-ish prefix', 'substring']);
  });

  it('is case-insensitive on both query and key', () => {
    const rows: Row[] = [
      { key: 'other-lot-1', label: 'substring' },
      { key: 'LOT-1', label: 'exact' },
    ];
    expect(rankResults(rows, 'lot-1', key).map((r) => r.label)).toEqual(['exact', 'substring']);
  });

  it('keeps stable order within the same tier', () => {
    const rows: Row[] = [
      { key: 'z-alpha', label: 'first' },
      { key: 'y-alpha', label: 'second' },
      { key: 'x-alpha', label: 'third' },
    ];
    // all are substring matches — original order must be preserved
    expect(rankResults(rows, 'alpha', key).map((r) => r.label)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('retains rows whose key does not match (they matched on another field)', () => {
    const rows: Row[] = [
      { key: 'no-match', label: 'other-field-hit' },
      { key: 'alpha-1', label: 'key-hit' },
    ];
    const ranked = rankResults(rows, 'alpha', key);
    expect(ranked.map((r) => r.label)).toEqual(['key-hit', 'other-field-hit']);
    expect(ranked).toHaveLength(2);
  });

  it('returns items unchanged for an empty query', () => {
    const rows: Row[] = [
      { key: 'b', label: 'one' },
      { key: 'a', label: 'two' },
    ];
    expect(rankResults(rows, '   ', key).map((r) => r.label)).toEqual(['one', 'two']);
  });

  it('tolerates null/undefined keys', () => {
    const rows = [{ k: null }, { k: 'alpha' }, { k: undefined }];
    const ranked = rankResults(rows, 'alpha', (r) => r.k);
    expect(ranked[0].k).toBe('alpha');
    expect(ranked).toHaveLength(3);
  });
});
