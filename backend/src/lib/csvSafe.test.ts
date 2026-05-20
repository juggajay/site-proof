import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvFormulaValue, formatCsvCell } from './csvSafe.js';

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
