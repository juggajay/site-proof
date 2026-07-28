/**
 * M10 — the CSV reader, and specifically the shapes SiteProof's OWN exporter
 * writes. `csvSafe.ts` is that exporter's server mirror, so building the
 * fixtures with it keeps this test honest if the export format ever moves.
 */
import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import { buildCsv, buildCsvBrandingRows, type CsvCell } from '../../../lib/csvSafe.js';
import { MAX_IMPORT_CELL_LENGTH, MAX_IMPORT_ROWS_PER_SHEET } from './excelParser.js';
import { parseCsvRecords, parseCsvSource } from './csvParser.js';
import { deriveFieldMapFromHeaders } from './mappingProfiles.js';

const HEADERS = ['Lot Number', 'Description', 'Chainage Start', 'Chainage End', 'Activity Type'];

function csv(rows: CsvCell[][]): Buffer {
  return Buffer.from(buildCsv(rows), 'utf8');
}

function parse(rows: CsvCell[][], filename = 'lot-register.csv') {
  return parseCsvSource(csv(rows), filename, 'lot_register');
}

describe('parseCsvRecords', () => {
  it('reads plain records', () => {
    expect(parseCsvRecords('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseCsvRecords('"Bulk earthworks, stage 1",100')).toEqual([
      ['Bulk earthworks, stage 1', '100'],
    ]);
  });

  // The retired client-side importer toggled `inQuotes` on every quote, so the
  // `""` escape SiteProof's own writer emits was DELETED rather than unescaped.
  it('unescapes a doubled quote instead of dropping it', () => {
    expect(parseCsvRecords('"He said ""go""",x')).toEqual([['He said "go"', 'x']]);
  });

  // …and it split on newlines before it knew about quotes, so one exported
  // description with a line break became two broken rows.
  it('keeps a newline inside a quoted field in one record', () => {
    expect(parseCsvRecords('"line one\nline two",x')).toEqual([['line one\nline two', 'x']]);
  });

  it('treats CRLF, CR and LF alike as record terminators', () => {
    expect(parseCsvRecords('a\r\nb\rc\nd')).toEqual([['a'], ['b'], ['c'], ['d']]);
  });

  it('keeps empty fields, including a trailing one', () => {
    expect(parseCsvRecords('a,,')).toEqual([['a', '', '']]);
  });
});

describe('parseCsvSource', () => {
  it('re-imports a branded export: provenance stripped, headers found', () => {
    const grid = parse([
      ...buildCsvBrandingRows('Lot Register', {
        companyName: 'Acme Civil',
        abn: '12 345 678 901',
        projectName: 'Pacific Hwy Upgrade',
      }),
      HEADERS,
      ['L-101', 'Subgrade', '1020', '1250', 'Earthworks'],
    ]);

    expect(grid.sheets).toHaveLength(1);
    expect(grid.sheets[0].name).toBe('lot-register');
    expect(grid.sheets[0].headers).toEqual(HEADERS);
    expect(grid.sheets[0].rows).toEqual([['L-101', 'Subgrade', '1020', '1250', 'Earthworks']]);
  });

  it('maps the export’s own column labels onto import targets', () => {
    const grid = parse([HEADERS, ['L-1', '', '', '', 'Earthworks']]);
    expect(deriveFieldMapFromHeaders(grid.sheets[0].headers, 'lot_register').map((e) => e.target)) //
      .toEqual(['lotNumber', 'description', 'activityType', 'chainageStart', 'chainageEnd']);
  });

  // The strip is for the branding band only. A lot really numbered `#LOT-9` is
  // data — the retired importer's own test asserted this and it still holds.
  it('keeps a # that is a lot number, not a comment', () => {
    const grid = parse([
      ['# Acme Civil'],
      HEADERS,
      ['#LOT-9', 'Note # in data', '0', '50', 'Earthworks'],
    ]);
    expect(grid.sheets[0].rows).toEqual([['#LOT-9', 'Note # in data', '0', '50', 'Earthworks']]);
  });

  it('only strips a LEADING provenance band, never one in the middle', () => {
    const grid = parse([['# Acme Civil'], HEADERS, ['# not a header', '', '', '', 'Earthworks']]);
    expect(grid.sheets[0].rows[0][0]).toBe('# not a header');
  });

  // The writer prefixes an apostrophe to anything starting = + - @ so a
  // spreadsheet cannot execute it. Without the matching strip a negative
  // chainage re-imports as the literal text `'-50`.
  it('undoes the CSV-injection guard the exporter applies', () => {
    const grid = parse([HEADERS, ['L-1', '=SUM(A1:A2)', '-50', '100', 'Earthworks']]);
    expect(grid.sheets[0].rows[0][1]).toBe('=SUM(A1:A2)');
    expect(grid.sheets[0].rows[0][2]).toBe('-50');
  });

  it('leaves an apostrophe that is really in the data alone', () => {
    const grid = parse([HEADERS, ['L-1', "O'Brien Street", '0', '10', 'Earthworks']]);
    expect(grid.sheets[0].rows[0][1]).toBe("O'Brien Street");
  });

  it('strips a UTF-8 BOM off the first header rather than mangling it', () => {
    const grid = parseCsvSource(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), csv([HEADERS, ['L-1', '', '', '', 'x']])]),
      'r.csv',
      'lot_register',
    );
    expect(grid.sheets[0].headers[0]).toBe('Lot Number');
  });

  it('pads short rows and clips long ones to the header width', () => {
    const grid = parse([HEADERS, ['L-1', 'only two']]);
    expect(grid.sheets[0].rows[0]).toEqual(['L-1', 'only two', '', '', '']);
  });

  it('drops blank rows rather than proposing empty lots', () => {
    const grid = parse([HEADERS, ['L-1', '', '', '', 'x'], ['', '', '', '', '']]);
    expect(grid.sheets[0].rows).toHaveLength(1);
  });

  it('refuses a file with no readable rows', () => {
    expect(() => parseCsvSource(Buffer.from('\n\n', 'utf8'), 'r.csv', 'lot_register')).toThrow(
      AppError,
    );
  });

  it('refuses a file past the row cap rather than truncating it', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS_PER_SHEET + 2 }, (_, index) => [
      `L-${index}`,
      '',
      '',
      '',
      'Earthworks',
    ]);
    expect(() => parse([HEADERS, ...rows])).toThrow(/Split it into smaller files/);
  });

  it('refuses an over-length cell rather than truncating it', () => {
    expect(() =>
      parse([HEADERS, ['L-1', 'x'.repeat(MAX_IMPORT_CELL_LENGTH + 1), '', '', 'Earthworks']]),
    ).toThrow(/beyond what a spreadsheet cell can hold/);
  });
});
