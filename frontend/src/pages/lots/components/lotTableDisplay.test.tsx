import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  formatChainage,
  highlightSearchTerm,
  parseColumnWidthsPreference,
} from './lotTableDisplay';
import type { Lot } from '../lotsPageTypes';

function makeLot(chainageStart: number | null, chainageEnd: number | null): Lot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    description: null,
    status: 'in_progress',
    chainageStart,
    chainageEnd,
    offset: null,
    layer: null,
    areaZone: null,
  };
}

function renderHighlight(text: string, searchTerm: string) {
  return render(<>{highlightSearchTerm(text, searchTerm)}</>);
}

describe('column width constants', () => {
  it('preserves the persisted storage key and clamp bounds', () => {
    expect(COLUMN_WIDTH_STORAGE_KEY).toBe('siteproof_lot_column_widths');
    expect(MIN_COLUMN_WIDTH).toBe(60);
    expect(MAX_COLUMN_WIDTH).toBe(600);
  });

  it('keeps a default width for every table column', () => {
    expect(DEFAULT_COLUMN_WIDTHS).toEqual({
      lotNumber: 140,
      description: 200,
      chainage: 100,
      activityType: 130,
      status: 110,
      subcontractor: 140,
      budget: 100,
    });
  });
});

describe('parseColumnWidthsPreference', () => {
  it('returns the defaults when no preference is stored', () => {
    expect(parseColumnWidthsPreference(null)).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('rejects malformed JSON and falls back to the defaults', () => {
    expect(parseColumnWidthsPreference('{not json')).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(parseColumnWidthsPreference('')).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('rejects parsed values that are not plain objects', () => {
    expect(parseColumnWidthsPreference('[140, 200]')).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(parseColumnWidthsPreference('42')).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(parseColumnWidthsPreference('null')).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(parseColumnWidthsPreference('"wide"')).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('applies stored widths for known columns', () => {
    const stored = JSON.stringify({ lotNumber: 220, description: 320 });

    expect(parseColumnWidthsPreference(stored)).toEqual({
      ...DEFAULT_COLUMN_WIDTHS,
      lotNumber: 220,
      description: 320,
    });
  });

  it('clamps stored widths to the min and max bounds', () => {
    const stored = JSON.stringify({ lotNumber: 5, description: 9999 });
    const widths = parseColumnWidthsPreference(stored);

    expect(widths.lotNumber).toBe(MIN_COLUMN_WIDTH);
    expect(widths.description).toBe(MAX_COLUMN_WIDTH);
  });

  it('keeps the default when a stored width is not a finite number', () => {
    const stored = JSON.stringify({ lotNumber: 'wide', status: null, budget: true });

    expect(parseColumnWidthsPreference(stored)).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('ignores unknown column keys', () => {
    const stored = JSON.stringify({ rogue: 300 });
    const widths = parseColumnWidthsPreference(stored);

    expect(widths).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(widths).not.toHaveProperty('rogue');
  });

  it('never mutates the shared defaults', () => {
    const before = { ...DEFAULT_COLUMN_WIDTHS };

    parseColumnWidthsPreference(JSON.stringify({ lotNumber: 5 }));

    expect(DEFAULT_COLUMN_WIDTHS).toEqual(before);
  });
});

describe('formatChainage', () => {
  it('joins distinct start and end chainages with a dash', () => {
    expect(formatChainage(makeLot(100, 250))).toBe('100-250');
  });

  it('collapses equal start and end chainages to a single value', () => {
    expect(formatChainage(makeLot(150, 150))).toBe('150');
    expect(formatChainage(makeLot(0, 0))).toBe('0');
  });

  it('returns the raw value when only one endpoint is present', () => {
    expect(formatChainage(makeLot(100, null))).toBe(100);
    expect(formatChainage(makeLot(null, 250))).toBe(250);
    expect(formatChainage(makeLot(0, null))).toBe(0);
  });

  it('returns an em dash when both endpoints are missing', () => {
    expect(formatChainage(makeLot(null, null))).toBe('\u2014');
  });
});

describe('highlightSearchTerm', () => {
  it('returns the text unchanged when the search term is empty', () => {
    expect(highlightSearchTerm('Lot 100', '')).toBe('Lot 100');
  });

  it('returns the text unchanged when nothing matches', () => {
    expect(highlightSearchTerm('Lot 100', 'zzz')).toBe('Lot 100');
  });

  it('wraps case-insensitive matches in a styled mark element', () => {
    const { container } = renderHighlight('Lot 100 base', 'lot');
    const marks = container.querySelectorAll('mark');

    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('Lot');
    expect(marks[0]?.className).toBe('bg-brand/20 text-foreground px-0.5 rounded');
    expect(container.textContent).toBe('Lot 100 base');
  });

  it('highlights every occurrence of the search term', () => {
    const { container } = renderHighlight('abc then ABC', 'abc');
    const marks = container.querySelectorAll('mark');

    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe('abc');
    expect(marks[1]?.textContent).toBe('ABC');
  });

  it('escapes regex characters so terms match literally', () => {
    const { container } = renderHighlight('CH 1x5 and 1.5', '1.5');
    const marks = container.querySelectorAll('mark');

    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('1.5');
    expect(container.textContent).toBe('CH 1x5 and 1.5');
  });

  it('does not throw on terms made of regex metacharacters', () => {
    const { container } = renderHighlight('a(b)', '(');
    const marks = container.querySelectorAll('mark');

    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('(');
  });
});
