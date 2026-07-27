/**
 * Wave B B3 — Word (`.docx`) → the SAME normalized grid Excel produces.
 *
 * A Word ITP is a table, so a table is what is read: `mammoth` converts the
 * document to HTML (the one new dependency Wave B is allowed, spec §9-D6), each
 * `<table>` becomes a sheet named after the heading printed above it, and every
 * step after this point — mapping, dry run, source-beside-proposal review, the
 * one proposal, apply, reconciliation, rollback — is byte-for-byte the Excel
 * path. Spec §6-B3: "Word tables parse to the same normalized grid as Excel."
 *
 * WHY NOT the B2 model-reads-it path: a PDF has no structure to read, which is
 * why B2 hands it to Anthropic. A `.docx` table IS a grid, and §2.4/§8.4 class
 * Word with Excel as a PARSED format ("binary Office formats must be parsed
 * first"), not with PDF. Parsing costs no model call, no API key and no latency,
 * and is deterministic. A document with no tables at all is refused with a
 * message pointing at PDF import, which does read prose.
 *
 * Hardening (spec §8.4), each enforced below:
 *  - `mammoth` runs in a `node:worker_threads` worker with a WALL-CLOCK timeout.
 *    A parser that hangs on a malformed document must not wedge the API process;
 *    on timeout the worker is terminated and the request fails cleanly.
 *  - the archive passes `assertSafeOoxmlArchive` (macro part, decompression
 *    ratio, uncompressed budget) BEFORE the worker is started.
 *  - the HTML the worker returns is length-capped, and the same table/row/
 *    column/cell/total-character caps the spreadsheet parser uses apply here.
 *  - images are dropped rather than inlined as base64 data URIs.
 */
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';

import { XMLParser } from 'fast-xml-parser';

import { AppError } from '../../../lib/AppError.js';
import { assertSafeOoxmlArchive } from '../../../lib/zipSafety.js';
import {
  MAX_IMPORT_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS_PER_SHEET,
  MAX_IMPORT_SHEETS,
  MAX_IMPORT_TOTAL_CHARACTERS,
  pickHeaderRow,
  type ParsedGrid,
  type ParsedSheet,
} from './excelParser.js';

/** Wall clock for the whole conversion. Past this the worker is terminated. */
export const MAX_WORD_PARSE_MS = 20_000;

/** The worker refuses to hand back more HTML than this — the memory bound that
 *  does not depend on what the document claims about itself. */
export const MAX_WORD_HTML_CHARACTERS = 12_000_000;

/**
 * The worker body, inline rather than a separate file.
 *
 * A worker file would have to resolve to `.ts` under tsx and vitest and to `.js`
 * under `node dist/index.js`, from a directory layout that differs between the
 * two. An `eval` worker has one resolution rule in all three, and `mammoth`
 * itself is resolved HERE, in the parent, where the specifier is definitely
 * resolvable — so the worker never guesses at a module path.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const mammoth = require(workerData.mammothPath);
mammoth
  .convertToHtml(
    { buffer: Buffer.from(workerData.bytes) },
    // Images would otherwise be inlined as base64 data URIs, turning a
    // photo-heavy ITP into tens of MB of HTML for content we never read.
    { convertImage: mammoth.images.imgElement(() => ({ src: '' })) },
  )
  .then((result) => {
    const html = String(result.value || '');
    parentPort.postMessage(
      html.length > workerData.maxHtmlLength ? { tooLarge: true } : { html },
    );
  })
  .catch((error) => parentPort.postMessage({ failed: String((error && error.message) || error) }));
`;

interface WorkerReply {
  html?: string;
  tooLarge?: boolean;
  failed?: string;
}

function parseFailure(message: string): never {
  throw AppError.badRequest(message, { code: 'IMPORT_PARSE_FAILED' });
}

/**
 * Convert a `.docx` buffer to HTML in a worker, terminating it on timeout.
 *
 * Exported so the isolation boundary itself is testable: a pathological
 * document must fail fast and leave the process able to parse the next one.
 */
export function convertDocxToHtml(
  buffer: Buffer,
  timeoutMs: number = MAX_WORD_PARSE_MS,
): Promise<string> {
  const mammothPath = createRequire(import.meta.url).resolve('mammoth');

  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { mammothPath, bytes: buffer, maxHtmlLength: MAX_WORD_HTML_CHARACTERS },
    });

    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      run();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          AppError.badRequest(
            'That Word document took too long to read and was stopped. Re-save it in Word, or import a spreadsheet instead.',
            { code: 'IMPORT_PARSE_TIMEOUT' },
          ),
        ),
      );
    }, timeoutMs);
    // Never hold the process open on the timer alone.
    timer.unref?.();

    worker.once('message', (reply: WorkerReply) => {
      finish(() => {
        if (reply.tooLarge) {
          reject(
            AppError.badRequest(
              'That Word document holds too much content to import. Split it into smaller files.',
              { code: 'IMPORT_PARSE_RESULT_TOO_LARGE' },
            ),
          );
          return;
        }
        if (typeof reply.html !== 'string') {
          reject(
            AppError.badRequest(
              'That file could not be read as a Word document. Re-save it as .docx and try again.',
              { code: 'IMPORT_PARSE_FAILED' },
            ),
          );
          return;
        }
        resolve(reply.html);
      });
    });

    worker.once('error', () => {
      finish(() =>
        reject(
          AppError.badRequest(
            'That file could not be read as a Word document. Re-save it as .docx and try again.',
            { code: 'IMPORT_PARSE_FAILED' },
          ),
        ),
      );
    });
  });
}

// ---------------------------------------------------------------------------
// HTML -> grid
// ---------------------------------------------------------------------------

// fast-xml-parser is already a backend dependency; no new one is added here.
// `preserveOrder` keeps a cell's paragraphs in printed order, which a keyed
// object would not. mammoth emits well-formed markup with the three XML
// entities, so the standard entity handling is enough.
const htmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  trimValues: false,
  unpairedTags: ['br', 'img', 'hr'],
});

/** A `preserveOrder` node: exactly one tag key, plus `:@` for attributes. */
type OrderedNode = Record<string, unknown>;

function childrenOf(node: OrderedNode, tag: string): OrderedNode[] {
  const value = node[tag];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

function tagOf(node: OrderedNode): string {
  return Object.keys(node).find((key) => key !== ':@') ?? '';
}

/** Every text node under this element, in printed order. */
function textOf(nodes: OrderedNode[]): string {
  let text = '';
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === '#text') {
      text += String(node['#text'] ?? '');
    } else if (tag === 'br') {
      text += ' ';
    } else {
      // Paragraphs inside one table cell are separate lines of the same cell.
      const inner = textOf(childrenOf(node, tag));
      if (!inner) continue;
      text += text && (tag === 'p' || tag.startsWith('h')) ? `\n${inner}` : inner;
    }
  }
  return text;
}

function normalizeCell(raw: string, tableName: string): string {
  if (raw.length > MAX_IMPORT_CELL_LENGTH) {
    parseFailure(
      `A cell in "${tableName}" is ${raw.length} characters long, beyond what an imported cell can hold. That file cannot be read.`,
    );
  }
  return raw.trim();
}

/** Horizontally merged cells carry `colspan`; the columns they cover still have
 *  to exist or every column to their right shifts left. */
function colspanOf(node: OrderedNode): number {
  const attributes = node[':@'] as Record<string, unknown> | undefined;
  const raw = Number(attributes?.['@colspan']);
  return Number.isFinite(raw) && raw > 1 ? Math.min(Math.floor(raw), MAX_IMPORT_COLUMNS) : 1;
}

interface RawTable {
  name: string;
  rows: string[][];
}

/** One `<tr>` as cells, with merged cells expanded to the columns they cover. */
function readRowCells(rowNode: OrderedNode, tableName: string): string[] {
  const cells: string[] = [];
  for (const cellNode of findCells(rowNode)) {
    if (cells.length >= MAX_IMPORT_COLUMNS) break;
    cells.push(normalizeCell(textOf(childrenOf(cellNode, tagOf(cellNode))), tableName));
    for (let extra = 1; extra < colspanOf(cellNode); extra += 1) {
      if (cells.length >= MAX_IMPORT_COLUMNS) break;
      cells.push('');
    }
  }
  return cells;
}

function readTable(tableNode: OrderedNode, name: string): RawTable {
  const rows: string[][] = [];
  // <tbody>/<thead> are not emitted by mammoth, so rows sit directly under the
  // table; the recursive search keeps this true if that ever changes.
  for (const rowNode of findAll(childrenOf(tableNode, 'table'), 'tr')) {
    if (rows.length >= MAX_IMPORT_ROWS_PER_SHEET) {
      parseFailure(
        `Table "${name}" has more than ${MAX_IMPORT_ROWS_PER_SHEET} rows. Split it into smaller files.`,
      );
    }
    rows.push(readRowCells(rowNode, name));
  }
  return { name, rows };
}

/**
 * Walk the document for tables, naming each after the last heading printed above
 * it. That heading is the ITP's own title, which makes it the exact analogue of
 * an Excel sheet name — and the sheet IS the template in the near-universal AU
 * layout the dry run already groups by.
 */
function collectTables(
  nodes: OrderedNode[],
  state: { heading: string; index: number },
): RawTable[] {
  const tables: RawTable[] = [];

  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === '#text') continue;

    if (tag === 'table') {
      state.index += 1;
      if (state.index > MAX_IMPORT_SHEETS) {
        parseFailure(
          `That document has more than ${MAX_IMPORT_SHEETS} tables. Split it into smaller files.`,
        );
      }
      tables.push(readTable(node, (state.heading || `Table ${state.index}`).slice(0, 200)));
      // A heading names the table that follows it, once.
      state.heading = '';
      continue;
    }

    const children = childrenOf(node, tag);
    if (tag === 'p' || /^h[1-6]$/.test(tag)) {
      const text = textOf(children).trim().replace(/\s+/g, ' ');
      if (text) state.heading = text;
      continue;
    }

    tables.push(...collectTables(children, state));
  }

  return tables;
}

function findAll(nodes: OrderedNode[], tag: string): OrderedNode[] {
  const found: OrderedNode[] = [];
  for (const node of nodes) {
    const nodeTag = tagOf(node);
    if (nodeTag === '#text') continue;
    if (nodeTag === tag) found.push(node);
    else found.push(...findAll(childrenOf(node, nodeTag), tag));
  }
  return found;
}

function findCells(rowNode: OrderedNode): OrderedNode[] {
  return childrenOf(rowNode, 'tr').filter((node) => {
    const tag = tagOf(node);
    return tag === 'td' || tag === 'th';
  });
}

/**
 * Assemble one table's rows into a sheet: the header band is the best of its
 * first few non-empty rows (a merged title row above the real column names is
 * the norm in Word ITPs), everything above it is dropped, and the rows below are
 * padded/clipped to the header width so downstream code can index by column
 * position without bounds checks — the same contract `parseExcelWorkbook` emits.
 */
function tableToSheet(table: RawTable, kind: string): ParsedSheet | null {
  const nonEmpty = table.rows.filter((cells) => cells.some((cell) => cell !== ''));
  if (nonEmpty.length === 0) return null;

  const pick = pickHeaderRow(nonEmpty.slice(0, 5), kind);
  const headers = nonEmpty[pick].map((cell, index) => cell || `Column ${index + 1}`);
  return {
    name: table.name,
    headers,
    rows: nonEmpty.slice(pick + 1).map((cells) => headers.map((_, index) => cells[index] ?? '')),
  };
}

/** Pure, so every cap and the table walk are testable without a worker. */
export function wordHtmlToGrid(html: string, kind: string): ParsedGrid {
  let parsed: OrderedNode[];
  try {
    parsed = htmlParser.parse(`<root>${html}</root>`) as OrderedNode[];
  } catch {
    parseFailure('That Word document could not be read. Re-save it in Word and try again.');
  }

  const tables = collectTables(childrenOf(parsed[0] ?? {}, 'root'), { heading: '', index: 0 });

  let totalCharacters = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      totalCharacters += row.reduce((sum, cell) => sum + cell.length, 0);
    }
  }
  if (totalCharacters > MAX_IMPORT_TOTAL_CHARACTERS) {
    parseFailure('That document holds too much text to import. Split it into smaller files.');
  }

  const sheets = tables
    .map((table) => tableToSheet(table, kind))
    .filter((sheet): sheet is ParsedSheet => sheet !== null);

  if (sheets.length === 0) {
    parseFailure(
      'No tables could be read from that Word document. An ITP has to be laid out as a table — or import it as a PDF, which is read differently.',
    );
  }

  return { sheets };
}

/** Parse a `.docx` buffer to the normalized grid. */
export async function parseWordDocument(buffer: Buffer, kind: string): Promise<ParsedGrid> {
  assertSafeOoxmlArchive(buffer);
  const html = await convertDocxToHtml(buffer);
  return wordHtmlToGrid(html, kind);
}
