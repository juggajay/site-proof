/**
 * CSV → the SAME normalized grid Excel produces (M10).
 *
 * WHY THIS EXISTS: SiteProof's only lot-register export is CSV
 * (`ExportLotsModal`), and Wave B's importer accepts `.xlsx/.pdf/.docx` only —
 * so the app could not re-import its own export. A PM who sends a register to a
 * subcontractor and gets the marked-up file back had to open it in Excel and
 * Save-As first. Everything after this module — mapping, dry run, review,
 * proposal, apply, reconciliation, rollback — is byte-for-byte the Excel path.
 *
 * The retired client-side importer (`frontend/src/components/lots/
 * importLotsCsv.ts`, deleted in #1631) is the ancestor of the `#` provenance
 * strip below. Its PARSER is deliberately not resurrected: it split on newlines
 * before it knew about quotes, so an exported description containing a line
 * break became two broken rows, and it toggled `inQuotes` on every `"` so the
 * `""` escape SiteProof's own writer emits was deleted rather than unescaped.
 * This is RFC-4180, in about as many lines, and correct on both.
 *
 * Zero dependencies (the repo has no CSV library, and this does not justify
 * one), and the same caps the spreadsheet parser enforces.
 */
import { AppError } from '../../../lib/AppError.js';
import {
  MAX_IMPORT_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS_PER_SHEET,
  MAX_IMPORT_TOTAL_CHARACTERS,
  pickHeaderRow,
  sheetNameFromFilename,
  type ParsedGrid,
} from './excelParser.js';

/** How many leading non-empty rows may be scanned for the header band. Matches
 *  the spreadsheet and Word readers. */
const HEADER_SCAN_ROWS = 5;

function parseFailure(message: string): never {
  throw AppError.badRequest(message, { code: 'IMPORT_PARSE_FAILED' });
}

/**
 * RFC 4180 records. Quoted fields may hold commas, CR, LF and `""`-escaped
 * quotes; CRLF, CR and LF all terminate a record outside quotes.
 */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  record.push(field);
  records.push(record);
  return records;
}

/**
 * The `#` provenance band a branded export writes above the header: two
 * single-cell rows naming the company, project and generation date. Only
 * CONTIGUOUS leading rows count, and only rows whose other cells are empty — so
 * a lot really numbered `#LOT-9` is data, not provenance.
 */
function isProvenanceRow(cells: string[]): boolean {
  return cells[0].trimStart().startsWith('#') && cells.slice(1).every((cell) => !cell.trim());
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => !cell.trim());
}

/**
 * Undo the CSV-injection guard the writer applies (`csvSafe.escapeCsvFormulaValue`
 * prefixes an apostrophe to anything starting `= + - @`). Without this a
 * chainage of `-50` re-imports as the literal text `'-50`. The lookahead is the
 * writer's own pattern, so an apostrophe that was really in the data survives.
 */
const FORMULA_GUARD = /^'(?=[\t\r\n ]*[=+\-@])/;

function normalizeCell(raw: string, sheetName: string): string {
  if (raw.length > MAX_IMPORT_CELL_LENGTH) {
    parseFailure(
      `A cell in "${sheetName}" is ${raw.length} characters long, beyond what a spreadsheet cell can hold. That file cannot be read.`,
    );
  }
  return raw.replace(FORMULA_GUARD, '').trim();
}

/**
 * Parse a CSV buffer into the normalized grid: one sheet, named after the file,
 * with the best of its first few rows as the header band.
 */
export function parseCsvSource(buffer: Buffer, filename: string, kind: string): ParsedGrid {
  // Bound the tokenizer before it runs, not after — the same memory bound the
  // workbook parser applies, applied to a format that is all one string.
  if (buffer.length > MAX_IMPORT_TOTAL_CHARACTERS) {
    parseFailure('That file holds too much text to import. Split it into smaller files.');
  }

  const decoded = buffer.toString('utf8');
  // Excel writes a UTF-8 BOM; it is not part of the first header name.
  const text = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
  const sheetName = sheetNameFromFilename(filename);
  const records = parseCsvRecords(text);

  let start = 0;
  while (
    start < records.length &&
    (isBlankRow(records[start]) || isProvenanceRow(records[start]))
  ) {
    start += 1;
  }

  const rows = records
    .slice(start)
    .map((cells) =>
      cells.slice(0, MAX_IMPORT_COLUMNS).map((cell) => normalizeCell(cell, sheetName)),
    )
    .filter((cells) => !isBlankRow(cells));

  if (rows.length > MAX_IMPORT_ROWS_PER_SHEET + 1) {
    parseFailure(
      `That file has more than ${MAX_IMPORT_ROWS_PER_SHEET} rows. Split it into smaller files.`,
    );
  }
  if (rows.length === 0) {
    parseFailure('That file has no readable rows.');
  }

  const pick = pickHeaderRow(rows.slice(0, HEADER_SCAN_ROWS), kind);
  const headers = rows[pick].map((cell, index) => cell || `Column ${index + 1}`);
  return {
    sheets: [
      {
        name: sheetName,
        headers,
        // Padded/clipped to the header width, so downstream code can index by
        // column position without bounds checks — the ParsedSheet contract.
        rows: rows.slice(pick + 1).map((cells) => headers.map((_, index) => cells[index] ?? '')),
      },
    ],
  };
}
