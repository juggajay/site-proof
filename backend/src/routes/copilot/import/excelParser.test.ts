import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import { AppError } from '../../../lib/AppError.js';
import {
  AU_ITP_HEADERS,
  buildAuItpWorkbook,
  buildCivilProWorkbook,
  buildWorkbook,
  CIVILPRO_GRID_HEADERS,
} from '../../../test/itpWorkbookFixture.js';
import { MAX_IMPORT_ROWS_PER_SHEET, MAX_IMPORT_SHEETS, parseExcelWorkbook } from './excelParser.js';
import { deriveFieldMapFromHeaders } from './mappingProfiles.js';

describe('parseExcelWorkbook', () => {
  it('parses a realistic AU ITP workbook into a normalized grid', async () => {
    const grid = await parseExcelWorkbook(await buildAuItpWorkbook(), 'itp_template');

    expect(grid.sheets.map((sheet) => sheet.name)).toEqual([
      'ITP-01 Subgrade',
      'ITP-02 Drainage',
      'ITP-03 Kerbing',
    ]);
    expect(grid.sheets[0].headers).toEqual([...AU_ITP_HEADERS]);
    expect(grid.sheets[0].rows).toHaveLength(3);
    // Text really is resolved (the sharedStrings cache is load-bearing).
    expect(grid.sheets[0].rows[0][1]).toBe('Proof roll subgrade with loaded truck');
    expect(grid.sheets[0].rows[2][4]).toBe('Superintendent');
  });

  it('pads short rows to the header width so column indexing is safe', async () => {
    const grid = await parseExcelWorkbook(
      await buildWorkbook([{ name: 'S', rows: [['Earthworks', 'Only two cells']] }]),
      'itp_template',
    );
    expect(grid.sheets[0].rows[0]).toHaveLength(AU_ITP_HEADERS.length);
    expect(grid.sheets[0].rows[0][5]).toBe('');
  });

  it('skips fully empty rows rather than proposing empty checklist items', async () => {
    const grid = await parseExcelWorkbook(
      await buildWorkbook([
        {
          name: 'S',
          rows: [
            ['', '', '', '', '', ''],
            ['Earthworks', 'Real row', '', 'H', '', ''],
          ],
        },
      ]),
      'itp_template',
    );
    expect(grid.sheets[0].rows).toHaveLength(1);
    expect(grid.sheets[0].rows[0][1]).toBe('Real row');
  });

  it('carries a formula cell through as its inert cached result, never the expression', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('S');
    sheet.addRow([...AU_ITP_HEADERS]);
    const row = sheet.addRow(['Earthworks', 'placeholder', '', 'H', '', '']);
    row.getCell(2).value = { formula: 'HYPERLINK("http://evil","=cmd|calc")', result: '=cmd|calc' };
    const grid = await parseExcelWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'itp_template',
    );

    const value = grid.sheets[0].rows[0][1];
    expect(value).toBe('=cmd|calc');
    // Inert text — the expression itself never travels.
    expect(value).not.toContain('HYPERLINK');
  });

  it('refuses a file that is not a zip at all', async () => {
    await expect(
      parseExcelWorkbook(Buffer.from('just some text'), 'itp_template'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('fails fast on a sheet past the row cap instead of running out of memory', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS_PER_SHEET + 5 }, (_, i) => [
      'Earthworks',
      `Item ${i}`,
      '',
      'S',
      '',
      '',
    ]);
    await expect(
      parseExcelWorkbook(await buildWorkbook([{ name: 'Big', rows }]), 'itp_template'),
    ).rejects.toThrow(/more than 5000 rows/);
  }, 60_000);

  it('fails fast past the sheet cap', async () => {
    const sheets = Array.from({ length: MAX_IMPORT_SHEETS + 2 }, (_, i) => ({
      name: `S${i}`,
      rows: [['Earthworks', `Item ${i}`, '', 'S', '', '']],
    }));
    await expect(parseExcelWorkbook(await buildWorkbook(sheets), 'itp_template')).rejects.toThrow(
      /more than 50 sheets/,
    );
  }, 60_000);

  // Regression: the streaming reader spools worksheets to temp files whenever
  // the shared-string table sits after them in the archive (the normal layout),
  // and on that path it measurably DROPPED sheets — a 40-sheet workbook came
  // back as 8 sheets with every string unresolved. Silently importing 8 of a
  // contractor's 40 ITPs is the failure this asserts against.
  it('reads EVERY sheet, with names and text intact, at benchmark scale', async () => {
    const sheetCount = 40;
    const sheets = Array.from({ length: sheetCount }, (_, i) => ({
      name: `ITP-${String(i).padStart(2, '0')}`,
      rows: [['Earthworks', `Inspection item ${i}`, 'Criteria', 'H', 'Contractor', 'Survey']],
    }));

    const grid = await parseExcelWorkbook(await buildWorkbook(sheets), 'itp_template');

    expect(grid.sheets).toHaveLength(sheetCount);
    grid.sheets.forEach((sheet, i) => {
      expect(sheet.name).toBe(`ITP-${String(i).padStart(2, '0')}`);
      expect(sheet.rows[0][1]).toBe(`Inspection item ${i}`);
    });
  }, 60_000);

  // The header band: real exports lead with a merged title row. Binding columns
  // to that banner imports garbage under confident-looking column names.
  it('looks past a merged title banner and takes the real header row', async () => {
    const grid = await parseExcelWorkbook(
      await buildCivilProWorkbook({ banner: 'ITP 04-01 - Clear and Grub - Revision 2' }),
      'itp_template',
    );

    expect(grid.sheets[0].headers).toEqual([...CIVILPRO_GRID_HEADERS]);
    // The banner is dropped, not imported as a checklist row.
    expect(grid.sheets[0].rows).toHaveLength(3);
    expect(grid.sheets[0].rows[1][CIVILPRO_GRID_HEADERS.indexOf('HpWpC')]).toBe('Hold Point');
  });

  it('keeps row 1 as headers when nothing below it scores better', async () => {
    const grid = await parseExcelWorkbook(await buildAuItpWorkbook(), 'itp_template');
    expect(grid.sheets[0].headers).toEqual([...AU_ITP_HEADERS]);
    expect(grid.sheets[0].rows).toHaveLength(3);
  });

  // A sheet with no recognisable headers anywhere must NOT be rescued by the
  // scan: row 1 stays the header row and the import fails loudly downstream
  // (unmapped columns / no description column), never silently half-mapped.
  it('leaves a headerless sheet exactly as loud as it was', async () => {
    const grid = await parseExcelWorkbook(
      await buildWorkbook([
        {
          name: 'Notes',
          headers: ['Some rambling note', 'and another', 'third'],
          rows: [
            ['free text', 'more free text', 'x'],
            ['second line', 'y', 'z'],
          ],
        },
      ]),
      'itp_template',
    );

    expect(grid.sheets[0].headers).toEqual(['Some rambling note', 'and another', 'third']);
    expect(grid.sheets[0].rows).toHaveLength(2);
    expect(deriveFieldMapFromHeaders(grid.sheets[0].headers, 'itp_template')).toHaveLength(0);
  });

  it('refuses a workbook with no readable sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    await expect(
      parseExcelWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), 'itp_template'),
    ).rejects.toThrow(/no readable sheets/);
  });
});
