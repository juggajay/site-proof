import { describe, expect, it } from 'vitest';
import { buildCsv, buildCsvBrandingRows, escapeCsvFormulaValue, formatCsvCell } from './csvSafe.js';

describe('csvSafe', () => {
  it.each([
    ['=HYPERLINK("https://example.invalid","click")'],
    ['+cmd'],
    ['-1+2'],
    ['@SUM(1,1)'],
    [' \t=SUM(1,1)'],
  ])('escapes formula-like values before spreadsheet export: %s', (value) => {
    expect(escapeCsvFormulaValue(value)).toBe(`'${value}`);
  });

  it('normalizes CRLF before checking for formula prefixes', () => {
    expect(escapeCsvFormulaValue('\r=SUM(1,1)')).toBe("'\n=SUM(1,1)");
  });

  it('quotes and doubles CSV field quotes after formula escaping', () => {
    expect(formatCsvCell('=HYPERLINK("https://example.invalid","click")')).toBe(
      `"'=HYPERLINK(""https://example.invalid"",""click"")"`,
    );
  });

  it('builds CSV rows with formula-safe cells', () => {
    expect(
      buildCsv([
        ['Name', 'Value'],
        ['Normal', '@SUM(1,1)'],
      ]),
    ).toBe(`"Name","Value"\n"Normal","'@SUM(1,1)"`);
  });
});

describe('buildCsvBrandingRows', () => {
  it('emits two single-cell provenance rows above the header', () => {
    const rows = buildCsvBrandingRows(
      'Delay Register',
      { companyName: 'Ryox Carpentry', abn: '12 345', projectName: 'Pacific Hwy' },
      new Date('2026-07-25T00:00:00.000Z'),
    );
    expect(rows).toEqual([
      ['# Ryox Carpentry (ABN 12 345)  —  Pacific Hwy'],
      ['# Generated 2026-07-25 — Delay Register — CIVOS'],
    ]);
  });

  it('escapes commas/quotes in the company name into one field', () => {
    const csv = buildCsv(
      buildCsvBrandingRows('Delay Register', { companyName: 'Smith, "Bob" & Co' }),
    );
    expect(csv.split('\n')[0]).toBe('"# Smith, ""Bob"" & Co"');
  });
});
