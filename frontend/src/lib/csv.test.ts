import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvCell, sanitizeCsvFilename } from './csv';

describe('csv helpers', () => {
  it('escapes cells that look like spreadsheet formulas after whitespace', () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.com")')).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
    expect(escapeCsvCell('\t@cmd')).toBe('"\'\t@cmd"');
    expect(escapeCsvCell('\n+SUM(1,1)')).toBe('"\'\n+SUM(1,1)"');
  });

  it('normalizes carriage returns before formula detection', () => {
    expect(escapeCsvCell('\r-CMD')).toBe('"\'\n-CMD"');
    expect(escapeCsvCell('\r\n=CMD')).toBe('"\'\n=CMD"');
  });

  it('quotes normal rows and sanitizes filenames', () => {
    expect(
      buildCsv([
        ['Name', 'Value'],
        ['A', 1],
      ]),
    ).toBe('"Name","Value"\n"A","1"');
    expect(sanitizeCsvFilename('bad:name?.csv')).toBe('bad-name-.csv');
    expect(sanitizeCsvFilename('')).toBe('export.csv');
  });
});
