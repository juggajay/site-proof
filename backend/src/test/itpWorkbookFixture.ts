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

// ---------------------------------------------------------------------------
// Lot register fixture (Wave B B2)
// ---------------------------------------------------------------------------

/** The column set a real AU lot register arrives with, in the spellings the
 *  retiring CSV importer's alias table already proved. */
export const LOT_REGISTER_HEADERS = [
  'Lot Number',
  'Description',
  'Activity',
  'Chainage Start',
  'Chainage End',
  'Layer',
  'ITP',
] as const;

/**
 * A register mixing the outcomes a real one mixes:
 *  - a clean chainage lot that folds EXACT
 *  - a lot whose activity folds FAMILY ("Drainage") — needs review, appliable
 *  - a lot with NO activity — BLOCKED (the shipped CSV importer wrote
 *    `earthworks_general` here behind a warning; B2 refuses)
 *  - a trailing blank row, which is not an error
 */
export const LOT_REGISTER_ROWS: string[][] = [
  ['L-001', 'Subgrade CH 0-100', 'Earthworks', '0', '100', 'Subgrade', 'ITP-01 Subgrade'],
  ['L-002', 'Pipe run north', 'Drainage', '100', '250', '', ''],
  ['L-003', 'Unknown work', '', '250', '300', '', ''],
  ['', '', '', '', '', '', ''],
];

export function buildLotRegisterWorkbook(rows: string[][] = LOT_REGISTER_ROWS): Promise<Buffer> {
  return buildWorkbook([{ name: 'Lot Register', headers: LOT_REGISTER_HEADERS, rows }]);
}

// ---------------------------------------------------------------------------
// CivilPro calibration fixture
// ---------------------------------------------------------------------------

/**
 * CivilPro's ITP item grid, reconstructed from the vendor's own published
 * layout: the verbatim column list in civilpro.zendesk.com article
 * 16952308349071 plus the grid screenshots in 4407191198351 / 4406603407375.
 * Row values are transcribed from those screenshots (a TMR MRTS04 clear-and-grub
 * ITP), not invented, so the vocabularies below ("Check Item", "QVC/ATP",
 * "Visual/Test") are the real ones a customer's export carries.
 *
 * SYNTHETIC, and knowingly so: this is the vendor's documented layout, not a
 * customer file. It cannot prove sheet naming or header-band quirks of a live
 * export — only calibrate against what CivilPro publishes.
 */
export const CIVILPRO_SHEET_NAME = 'ITP Items';

export const CIVILPRO_GRID_HEADERS = [
  'Item Type',
  'HpWpC',
  'Reference Text',
  'Description',
  'AltQvcText',
  'Has Tests',
  'Responsibility',
  'Records',
  'Insp Meth',
  'Included on ITP',
  'Clause',
] as const;

/** The same fields as CivilPro's register CSV export spells them. */
export const CIVILPRO_CSV_HEADERS = [
  'Reference Text',
  'Description',
  'Clause',
  'Responsibility',
  'Records',
  'Inspection Method',
  'Check Type',
  'Item Type',
  'Inspection Reqd',
  'Verify Reqd',
  'Approve Reqd',
] as const;

export const CIVILPRO_GRID_ROWS: string[][] = [
  [
    'Quality',
    'Check Item',
    '',
    'Limits of clearing identified and set out completed by survey.',
    '',
    'FALSE',
    'Engineer and Supervisor',
    'QVC',
    'Visual',
    'TRUE',
    'MRTS04 Cl. 7.2.1',
  ],
  [
    'Quality',
    'Hold Point',
    '',
    'Any trees, shrubs and overhanging branches to be left undisturbed shall be clearly marked prior to clearing operations reaching the area concerned.',
    '',
    'FALSE',
    'Engineer and Supervisor',
    'QVC/ATP',
    'Visual',
    'TRUE',
    'MRTS04 Cl. 7.2.2',
  ],
  [
    'Quality',
    'Check Item',
    '',
    'Ground surface shall be scarified and recompacted to a depth >= 150mm in accordance with MRTS04 Cl. 15',
    '',
    'TRUE',
    'Engineer and Supervisor',
    'QVC/Test records',
    'Visual/Test',
    'TRUE',
    'MRTS04 Cl.12.2.1.3',
  ],
];

/** The grid above as a real .xlsx, optionally behind a title banner row. */
/** A CivilPro Milestone row — the approval-bearing fourth point type that must
 *  route to the reviewer, never fold silently. */
export const CIVILPRO_MILESTONE_ROW: string[] = [
  'Quality',
  'Milestone',
  '',
  'Clearing and grubbing complete — stage approval prior to topsoil strip.',
  '',
  'FALSE',
  'Engineer and Supervisor',
  'QVC',
  'Visual',
  'TRUE',
  'MRTS04 Cl. 7.2.6',
];

export async function buildCivilProWorkbook(
  options: { banner?: string; extraRows?: string[][] } = {},
): Promise<Buffer> {
  const rows = [...CIVILPRO_GRID_ROWS, ...(options.extraRows ?? [])];
  if (!options.banner) {
    return buildWorkbook([
      {
        name: CIVILPRO_SHEET_NAME,
        headers: CIVILPRO_GRID_HEADERS,
        rows,
      },
    ]);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(CIVILPRO_SHEET_NAME);
  worksheet.addRow([options.banner]);
  worksheet.mergeCells(1, 1, 1, CIVILPRO_GRID_HEADERS.length);
  worksheet.addRow([...CIVILPRO_GRID_HEADERS]);
  for (const row of rows) worksheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
