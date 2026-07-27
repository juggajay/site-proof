/**
 * Wave B B1 — Excel → normalized grid.
 *
 * Hardening rules (spec §8.4), each enforced below:
 *  - streaming `WorkbookReader` ONLY. `workbook.xlsx.load()` materializes the
 *    whole workbook in memory and is never used on untrusted input.
 *  - `styles`, `hyperlinks` and `entries` are ignored, not parsed.
 *  - hard sheet, row, column, cell-length and total-character caps; a breach
 *    aborts the stream and fails the batch (never OOM, never silent truncation).
 *  - the archive passes `assertSafeOoxmlArchive` (macro part, decompression
 *    ratio, uncompressed budget) BEFORE a parser touches it.
 *
 * DEVIATION FROM SPEC §8.4, deliberate and verified: the spec asks for
 * `sharedStrings` to be ignored alongside `styles`. With exceljs that is
 * functionally impossible — with `sharedStrings: 'ignore'` every text cell comes
 * back as `{ sharedString: n }` rather than its text, and an ITP workbook is
 * almost entirely shared strings. `sharedStrings: 'cache'` is therefore
 * mandatory to read the file at all. The security intent (bounded memory, no
 * style parsing) is preserved by the zip byte budget plus the caps below.
 */
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'node:stream';

import { AppError } from '../../../lib/AppError.js';
import {
  assertSafeOoxmlArchive,
  readZipEntry,
  type ZipEntrySummary,
} from '../../../lib/zipSafety.js';
import { deriveFieldMapFromHeaders } from './mappingProfiles.js';

export const MAX_IMPORT_SHEETS = 50;
export const MAX_IMPORT_ROWS_PER_SHEET = 5_000;
export const MAX_IMPORT_COLUMNS = 60;
/** Excel's own hard cell limit. A longer cell is not a real spreadsheet. */
export const MAX_IMPORT_CELL_LENGTH = 32_767;
/** Whole-workbook character budget — the memory bound that does not depend on
 *  attacker-declared zip sizes. */
export const MAX_IMPORT_TOTAL_CHARACTERS = 8_000_000;
/** Inflate budget for the shared-string table. */
export const MAX_SHARED_STRINGS_BYTES = 16 * 1024 * 1024;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ParsedGrid {
  sheets: ParsedSheet[];
}

function parseFailure(message: string): never {
  throw AppError.badRequest(message, { code: 'IMPORT_PARSE_FAILED' });
}

function primitiveCellToText(value: unknown): string | null {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

// Object-shaped cell values, in the order exceljs nests them. A formula
// contributes its cached RESULT, never its expression, so `=cmd|...` can never
// travel as a live formula.
const NESTED_CELL_KEYS = ['result', 'text', 'hyperlink'] as const;

/** exceljs cell values are unions (rich text, formula, date, hyperlink, ...).
 *  Everything becomes inert text. */
function cellToText(value: unknown): string {
  const primitive = primitiveCellToText(value);
  if (primitive !== null) return primitive;

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.richText)) {
    return record.richText.map((part) => String((part as { text?: unknown }).text ?? '')).join('');
  }
  // A shared-string handle would mean sharedStrings were not cached — a
  // programming error here, not a user error.
  if ('sharedString' in record) {
    parseFailure('That workbook could not be read (shared strings were not resolved).');
  }

  const nested = NESTED_CELL_KEYS.find((key) => key in record);
  return nested ? cellToText(record[nested]) : '';
}

function normalizeCell(value: unknown, sheetName: string): string {
  const text = cellToText(value);
  if (text.length > MAX_IMPORT_CELL_LENGTH) {
    parseFailure(
      `A cell on sheet "${sheetName}" is ${text.length} characters long, beyond what a spreadsheet cell can hold. That file cannot be read.`,
    );
  }
  return text.trim();
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => cell === '');
}

/** How many non-empty rows may sit above the header row before we stop looking. */
const HEADER_SCAN_ROWS = 5;

/**
 * Which of the first few non-empty rows is the real header band.
 *
 * Real exports lead with a title banner — CivilPro prints "ITP 04-01 - Clear and
 * Grub - Revision 2" in row 1 and the column names in row 2 — and taking row 1
 * blindly binds every column to garbage. So each candidate is scored by how many
 * of its cells the alias table recognises as ITP columns, and a later row is
 * only preferred when it scores STRICTLY better: a sheet whose headers really do
 * sit in row 1, and a sheet with no recognisable headers at all, both keep
 * today's behaviour (the latter then fails loudly downstream as unmapped
 * columns, which is the correct outcome — never a silent partial import).
 */
function pickHeaderRow(candidates: string[][], kind: string): number {
  let bestIndex = 0;
  let bestScore = deriveFieldMapFromHeaders(candidates[0], kind).length;
  for (let index = 1; index < candidates.length; index += 1) {
    const score = deriveFieldMapFromHeaders(candidates[index], kind).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

// fast-xml-parser is already a backend dependency; no new one is added here.
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
// Shared-string text must survive verbatim: no numeric coercion, no trimming
// (trimming happens later, once, in normalizeCell).
const textXml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  trimValues: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** `<t>` may be a bare string or an element carrying xml:space. */
function tagText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  return String((node as Record<string, unknown>)['#text'] ?? '');
}

/**
 * The shared-string table, read directly from `xl/sharedStrings.xml`.
 *
 * WHY: exceljs's reader only parses worksheets inline once it already holds the
 * shared strings and workbook rels. Both parts normally sit AFTER the worksheets
 * in the archive, so the reader falls back to spooling every worksheet to a temp
 * file and re-reading it — a path that measurably DROPS worksheets and shared
 * strings on real-sized workbooks (a 40-sheet file yielded 8 sheets with every
 * string unresolved). Silently importing 8 of a contractor's 40 ITPs is not an
 * acceptable failure mode, so the two metadata parts are read up front and
 * pre-seeded, which keeps every worksheet on the inline, temp-file-free path.
 */
function readSharedStrings(buffer: Buffer, entries: ZipEntrySummary[]): string[] | null {
  const raw = readZipEntry(buffer, entries, 'xl/sharedStrings.xml', MAX_SHARED_STRINGS_BYTES);
  if (!raw) return null;

  try {
    const parsed = textXml.parse(raw.toString('utf8')) as { sst?: { si?: unknown } };
    return asArray(parsed.sst?.si).map((item) => {
      const record = item as Record<string, unknown>;
      if (record === null || typeof record !== 'object') return tagText(item);
      if ('t' in record) return tagText(record.t);
      // Rich text: concatenate the runs, dropping the formatting.
      return asArray(record.r)
        .map((run) => tagText((run as Record<string, unknown>).t))
        .join('');
    });
  } catch {
    return null;
  }
}

/** Workbook relationships in the shape exceljs's reader expects. */
function readWorkbookRels(
  buffer: Buffer,
  entries: ZipEntrySummary[],
): { Id: string; Target: string }[] | null {
  const raw = readZipEntry(buffer, entries, 'xl/_rels/workbook.xml.rels');
  if (!raw) return null;
  try {
    const parsed = xml.parse(raw.toString('utf8')) as {
      Relationships?: { Relationship?: unknown };
    };
    return (asArray(parsed.Relationships?.Relationship) as Record<string, string>[])
      .filter((rel) => rel['@Id'] && rel['@Target'])
      .map((rel) => ({ Id: rel['@Id'], Target: rel['@Target'] }));
  } catch {
    return null;
  }
}

/**
 * Sheet names, read from the workbook metadata parts directly.
 *
 * WHY not just use `worksheet.name`: exceljs's streaming reader only resolves
 * names when it happens to have parsed `xl/workbook.xml` before the worksheet
 * entries. Writers (including exceljs's own) legitimately place `workbook.xml`
 * LAST, and on that ordering the reader defers worksheets to temp files and can
 * reach them with `this.model` still unset — it throws
 * "Cannot read properties of undefined (reading 'sheets')" outright. Sheet names
 * ARE the imported template names, so they cannot be left to that race.
 *
 * Reading the two small metadata parts ourselves is deterministic, uses stdlib
 * inflate plus an already-installed XML parser, and keeps exceljs off the
 * metadata path entirely. Returns sheet-file number -> name.
 */
function readSheetNames(buffer: Buffer, entries: ZipEntrySummary[]): Map<string, string> {
  const names = new Map<string, string>();

  const relsRaw = readZipEntry(buffer, entries, 'xl/_rels/workbook.xml.rels');
  const workbookRaw = readZipEntry(buffer, entries, 'xl/workbook.xml');
  if (!relsRaw || !workbookRaw) return names;

  try {
    const rels = xml.parse(relsRaw.toString('utf8')) as {
      Relationships?: { Relationship?: unknown };
    };
    // rId -> the sheet file number in worksheets/sheetN.xml
    const sheetNoByRelId = new Map<string, string>();
    for (const rel of asArray(rels.Relationships?.Relationship) as Record<string, string>[]) {
      const match = /worksheets\/sheet(\d+)\.xml$/.exec(rel['@Target'] ?? '');
      if (match && rel['@Id']) sheetNoByRelId.set(rel['@Id'], match[1]);
    }

    const workbook = xml.parse(workbookRaw.toString('utf8')) as {
      workbook?: { sheets?: { sheet?: unknown } };
    };
    for (const sheet of asArray(workbook.workbook?.sheets?.sheet) as Record<string, string>[]) {
      const sheetNo = sheetNoByRelId.get(sheet['@r:id'] ?? '');
      const name = sheet['@name'];
      if (sheetNo && name) names.set(sheetNo, String(name));
    }
  } catch {
    // Unreadable metadata is not fatal — the caller falls back to positional
    // names and the reviewer sees "Sheet 1" rather than nothing.
    return names;
  }

  return names;
}

/**
 * Parse an .xlsx buffer to a normalized grid. Every sheet contributes one header
 * row — the best of its first few non-empty rows, see `pickHeaderRow` — and the
 * rows below it, padded/clipped to the header width so downstream code can index
 * by column position without bounds checks. Anything above the header row is a
 * title banner and is dropped.
 */
export async function parseExcelWorkbook(buffer: Buffer, kind: string): Promise<ParsedGrid> {
  const entries = assertSafeOoxmlArchive(buffer);
  const sheetNames = readSheetNames(buffer, entries);

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    worksheets: 'emit',
    // Mandatory to resolve text — see the module header.
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    entries: 'ignore',
  });

  // Pre-seed the metadata the reader would otherwise wait for. This keeps every
  // worksheet on the inline path (see readSharedStrings for why that matters),
  // and with `model.sheets` empty the reader never rewrites `worksheet.id`, so
  // the sheet FILE number is a deterministic key into `sheetNames`.
  const seeded = reader as unknown as {
    model: { sheets: unknown[] };
    sharedStrings: string[] | undefined;
    workbookRels: unknown;
  };
  seeded.model = { sheets: [] };
  seeded.sharedStrings = readSharedStrings(buffer, entries) ?? undefined;
  seeded.workbookRels = readWorkbookRels(buffer, entries) ?? undefined;

  const sheets: ParsedSheet[] = [];
  let totalCharacters = 0;
  let emittedSheets = 0;

  for await (const worksheet of reader) {
    emittedSheets += 1;
    if (emittedSheets > MAX_IMPORT_SHEETS) {
      parseFailure(
        `That workbook has more than ${MAX_IMPORT_SHEETS} sheets. Split it into smaller files.`,
      );
    }

    const sheetNo = String((worksheet as unknown as { id?: unknown }).id ?? '');
    const sheetName = (sheetNames.get(sheetNo) ?? `Sheet ${sheets.length + 1}`).slice(0, 200);
    let headers: string[] | null = null;
    const rows: string[][] = [];
    // Non-empty rows held back while the header band is still being chosen.
    const leading: string[][] = [];

    const pushRow = (cells: string[]) => rows.push(headers!.map((_, index) => cells[index] ?? ''));
    const chooseHeaders = () => {
      const pick = pickHeaderRow(leading, kind);
      headers = leading[pick].map((cell, index) => cell || `Column ${index + 1}`);
      for (const cells of leading.slice(pick + 1)) pushRow(cells);
      leading.length = 0;
    };

    for await (const row of worksheet) {
      if (rows.length >= MAX_IMPORT_ROWS_PER_SHEET) {
        parseFailure(
          `Sheet "${sheetName}" has more than ${MAX_IMPORT_ROWS_PER_SHEET} rows. Split it into smaller files.`,
        );
      }

      // row.values is 1-based with a leading hole; drop it and cap the width.
      const raw = (Array.isArray(row.values) ? row.values : []).slice(1, MAX_IMPORT_COLUMNS + 1);
      const cells = raw.map((value) => normalizeCell(value, sheetName));

      totalCharacters += cells.reduce((sum, cell) => sum + cell.length, 0);
      if (totalCharacters > MAX_IMPORT_TOTAL_CHARACTERS) {
        parseFailure('That workbook holds too much text to import. Split it into smaller files.');
      }

      if (isEmptyRow(cells)) continue;

      if (!headers) {
        leading.push(cells);
        if (leading.length >= HEADER_SCAN_ROWS) chooseHeaders();
        continue;
      }

      pushRow(cells);
    }

    // A sheet shorter than the scan window still has to pick a header row.
    if (!headers && leading.length > 0) chooseHeaders();

    if (headers) {
      sheets.push({ name: sheetName, headers, rows });
    }
  }

  if (sheets.length === 0) {
    parseFailure('That workbook has no readable sheets.');
  }

  // Integrity check against the workbook's own manifest. The streaming reader is
  // the one component here we do not control; if it ever hands back fewer sheets
  // than the archive declares, the import FAILS rather than quietly importing a
  // subset of a contractor's ITPs. (Sheets with no rows at all are legitimately
  // absent, so only a shortfall beyond those counts.)
  if (sheetNames.size > 0 && emittedSheets < sheetNames.size) {
    parseFailure(
      `Only ${emittedSheets} of ${sheetNames.size} sheets in that workbook could be read. Re-save it in Excel and try again.`,
    );
  }

  return { sheets };
}
