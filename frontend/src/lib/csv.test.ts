import { describe, expect, it } from 'vitest';
import { buildCsv, buildCsvBrandingRows, escapeCsvCell, sanitizeCsvFilename } from './csv';

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

describe('buildCsvBrandingRows', () => {
  const date = new Date('2026-07-25T09:30:00.000Z');

  it('emits two single-cell rows: company (+ABN) — project, then generated line', () => {
    const rows = buildCsvBrandingRows(
      'Lot Register',
      { companyName: 'Ryox Carpentry', abn: '12 345 678 901', projectName: 'Pacific Hwy' },
      date,
    );
    expect(rows).toEqual([
      ['# Ryox Carpentry (ABN 12 345 678 901)  —  Pacific Hwy'],
      ['# Generated 2026-07-25 — Lot Register — CIVOS'],
    ]);
    // Each preamble row is a single field so ragged-aware parsers can skip them.
    expect(rows.every((r) => r.length === 1)).toBe(true);
  });

  it('keeps commas and quotes in a company name inside one escaped field', () => {
    const rows = buildCsvBrandingRows('NCR Register', {
      companyName: 'Smith, "Bob" & Co',
      projectName: 'M1, Stage 2',
    });
    const csv = buildCsv(rows);
    const firstLine = csv.split('\n')[0];
    // The whole preamble stays one quoted field — no stray unquoted comma.
    expect(firstLine).toBe('"# Smith, ""Bob"" & Co  —  M1, Stage 2"');
  });

  it('degrades to a CIVOS line when no branding is available', () => {
    expect(buildCsvBrandingRows('Cost Report', null, date)).toEqual([
      ['# CIVOS'],
      ['# Generated 2026-07-25 — Cost Report — CIVOS'],
    ]);
  });
});
