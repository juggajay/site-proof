import { test, expect } from '@playwright/test';
import { buildCsv, escapeCsvCell, sanitizeCsvFilename } from '../src/lib/csv';

test.describe('CSV export utilities', () => {
  test('quotes delimiters, quotes, and newlines', () => {
    expect(
      buildCsv([
        ['Name', 'Notes'],
        ['Lot 1', 'Line "one",\nLine two'],
      ]),
    ).toBe('"Name","Notes"\n"Lot 1","Line ""one"",\nLine two"');
  });

  test('guards spreadsheet formula prefixes', () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.com")')).toBe(
      `"'=HYPERLINK(""https://example.com"")"`,
    );
    expect(escapeCsvCell(' +SUM(1,1)')).toBe(`"' +SUM(1,1)"`);
    expect(escapeCsvCell('@cmd')).toBe(`"'@cmd"`);
  });

  test('sanitizes downloaded filenames', () => {
    expect(sanitizeCsvFilename('claim:../bad?.csv')).toBe('claim-..-bad-.csv');
    expect(sanitizeCsvFilename('report')).toBe('report.csv');
    expect(sanitizeCsvFilename('')).toBe('export.csv');
  });
});
