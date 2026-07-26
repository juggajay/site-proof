/**
 * A realistic AU ITP workbook, built in memory for tests.
 *
 * The column set is the near-universal AU one the Wave-B spec names: activity /
 * description / acceptance criteria / W-H-S point type / responsible party /
 * test type, one ITP per sheet. Tests that need a hostile variant pass overrides
 * rather than hand-rolling a second builder.
 */
import ExcelJS from 'exceljs';

export const AU_ITP_HEADERS = [
  'Activity',
  'Inspection / Test Activity',
  'Acceptance Criteria',
  'W/H/S',
  'Responsible',
  'Test Type',
] as const;

export interface FixtureSheet {
  name: string;
  headers?: readonly string[];
  rows: string[][];
}

export async function buildWorkbook(sheets: FixtureSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow([...(sheet.headers ?? AU_ITP_HEADERS)]);
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Three ITPs covering the three activity-fold outcomes a real workbook mixes:
 *  - "Earthworks"           folds EXACT   -> creates straight away
 *  - "Drainage"             folds FAMILY  -> needs review, still appliable
 *  - "Kerb & Gutter Works"  folds NONE    -> BLOCKED until the reviewer picks a
 *                                           slug (never defaulted)
 */
export function auItpSheets(): FixtureSheet[] {
  return [
    {
      name: 'ITP-01 Subgrade',
      rows: [
        [
          'Earthworks',
          'Proof roll subgrade with loaded truck',
          'No visible deflection or rutting under a loaded 3-axle truck',
          'H',
          'Contractor',
          'Proof roll',
        ],
        [
          'Earthworks',
          'Survey subgrade levels',
          'Design level +20 / -30 mm',
          'S',
          'Contractor',
          'Survey',
        ],
        [
          'Earthworks',
          'Density testing of the top 150 mm',
          'Minimum 98% standard compaction',
          'W',
          'Superintendent',
          'Nuclear densometer',
        ],
      ],
    },
    {
      name: 'ITP-02 Drainage',
      rows: [
        [
          'Drainage',
          'Inspect trench bedding before pipe laying',
          'Bedding 100 mm compacted, free of rock over 20 mm',
          'H',
          'Superintendent',
          'Visual',
        ],
        [
          'Drainage',
          'Check pipe grade and alignment',
          'Grade within 0.1% of design',
          'S',
          'Contractor',
          'Survey',
        ],
      ],
    },
    {
      name: 'ITP-03 Kerbing',
      rows: [
        [
          'Kerb & Gutter Works',
          'Check kerb line and level before pour',
          'Within 10 mm of design line, 5 mm of design level',
          'W',
          'Superintendent',
          'Survey',
        ],
      ],
    },
  ];
}

export function buildAuItpWorkbook(): Promise<Buffer> {
  return buildWorkbook(auItpSheets());
}
