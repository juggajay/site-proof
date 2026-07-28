/**
 * Vertically merged cells in an .xlsx worksheet (M10).
 *
 * A real ITP writes an activity once and merges it down the checklist rows it
 * governs; the same happens to an "H" that holds several checks. In the FILE
 * only the master cell carries the value — every slave cell is genuinely empty
 * (`<c r="A3"/>`) — so reading the sheet data alone drops the marking on every
 * row but the first, and a hold point becomes a plain check item.
 *
 * The ranges live in `<mergeCells>`, which sits AFTER `</sheetData>` and is
 * therefore never seen by a streaming row reader. They are read here from the
 * worksheet part directly, the same way `excelParser` already reads the workbook
 * metadata parts — with a byte budget, so this is not a back door around the
 * archive caps.
 */
import { readZipEntry, type ZipEntrySummary } from '../../../lib/zipSafety.js';

/** Inflate budget for one worksheet part, read only for its merge ranges. */
export const MAX_WORKSHEET_MERGE_SCAN_BYTES = 16 * 1024 * 1024;

/** `<mergeCell ref="A2:A4"/>`, without parsing the whole worksheet as XML. */
const MERGE_REF = /<mergeCell[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g;

interface VerticalMerge {
  /** Zero-based column, matching the cell arrays the parser emits. */
  column: number;
  top: number;
  bottom: number;
}

/** The open merges a sheet is carrying down, by the column each occupies. */
export type MergeCarry = Map<number, { value: string; bottom: number }>;

export interface SheetMerges {
  byTop: Map<number, VerticalMerge[]>;
  carried: MergeCarry;
  /** The ranges could not be read — the caller must SAY so, not assume none. */
  unchecked: boolean;
}

/** Spreadsheet column letters to a zero-based index: A -> 0, AA -> 26. */
function columnIndex(letters: string): number {
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * The VERTICAL merge ranges in a worksheet, keyed by the row they start on.
 *
 * ponytail: vertical only. A horizontally merged cell is a title banner far more
 * often than it is data, and the grid is padded to the header width anyway, so
 * nothing shifts — unlike the Word path, where a merge really does move columns.
 */
export function readVerticalMerges(
  worksheetXml: string,
  maxColumns: number,
): Map<number, VerticalMerge[]> {
  const byTop = new Map<number, VerticalMerge[]>();
  for (const match of worksheetXml.matchAll(MERGE_REF)) {
    const [, startColumn, startRow, , endRow] = match;
    const top = Number(startRow);
    const bottom = Number(endRow);
    if (bottom <= top) continue;
    const merge = { column: columnIndex(startColumn), top, bottom };
    if (merge.column < 0 || merge.column >= maxColumns) continue;
    byTop.set(top, [...(byTop.get(top) ?? []), merge]);
  }
  return byTop;
}

/**
 * One sheet's merge ranges, ready to fill rows with.
 *
 * A worksheet part past the scan budget yields `unchecked: true` rather than an
 * empty map, because "no merges" and "merges we could not look at" are different
 * facts and only one of them is safe to keep quiet about. An ABSENT part (an
 * unconventional archive layout) is the pre-existing no-merge behaviour.
 */
export function readSheetMerges(
  buffer: Buffer,
  entries: ZipEntrySummary[],
  sheetNo: string,
  maxColumns: number,
): SheetMerges {
  const empty = { byTop: new Map<number, VerticalMerge[]>(), carried: new Map() as MergeCarry };
  const name = `xl/worksheets/sheet${sheetNo}.xml`;
  const entry = entries.find((candidate) => candidate.name === name);
  if (!entry) return { ...empty, unchecked: false };

  const raw =
    entry.uncompressedSize > MAX_WORKSHEET_MERGE_SCAN_BYTES
      ? null
      : readZipEntry(buffer, entries, name, MAX_WORKSHEET_MERGE_SCAN_BYTES);
  if (!raw) return { ...empty, unchecked: true };

  return {
    byTop: readVerticalMerges(raw.toString('utf8'), maxColumns),
    carried: new Map(),
    unchecked: false,
  };
}

/**
 * Fill this row's cells from the merges covering it, in place.
 *
 * `merges.carried` is the state across rows: the value each open merge holds
 * and the row it stops at. Only an EMPTY cell inside an open range is filled, so
 * a merge can never overwrite a value the sheet really carries.
 */
export function applyVerticalMerges(cells: string[], rowNumber: number, merges: SheetMerges): void {
  for (const merge of merges.byTop.get(rowNumber) ?? []) {
    const value = cells[merge.column] ?? '';
    if (value) merges.carried.set(merge.column, { value, bottom: merge.bottom });
  }

  for (const [column, held] of merges.carried) {
    if (rowNumber > held.bottom) {
      merges.carried.delete(column);
      continue;
    }
    while (cells.length <= column) cells.push('');
    if (!cells[column]) cells[column] = held.value;
  }
}
