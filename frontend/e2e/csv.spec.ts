import { test, expect } from '@playwright/test';
import {
  buildCsv,
  buildScopedCsvFilename,
  escapeCsvCell,
  sanitizeCsvFilename,
  slugifyCsvFilenamePart,
} from '../src/lib/csv';

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

  test('builds scoped filenames from customer-facing labels', () => {
    const date = new Date('2026-05-19T12:00:00.000Z');

    expect(slugifyCsvFilenamePart('E2E Highway Upgrade')).toBe('e2e-highway-upgrade');
    expect(buildScopedCsvFilename('Lot Register', 'E2E Highway Upgrade', date)).toBe(
      'lot-register-e2e-highway-upgrade-2026-05-19.csv',
    );
    expect(buildScopedCsvFilename('Dockets', 'Pacific Hwy & M1 Upgrade', date)).toBe(
      'dockets-pacific-hwy-and-m1-upgrade-2026-05-19.csv',
    );
  });
});
