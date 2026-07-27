/**
 * Wave B `[WBR2-8]` §8.2/§8.3 — cheap, dependency-free safety checks on an OOXML
 * (.xlsx/.docx) upload BEFORE any parser touches it.
 *
 * `.xlsx` and `.docx` are zip archives, so a decompression bomb is the cheapest
 * denial-of-service against the import surface and no installed dependency
 * guards it. Reading a zip central directory is a documented, fixed-layout
 * format — a few dozen lines, no dependency.
 *
 * The declared sizes here are ATTACKER-CONTROLLED. This is a fast-fail, not the
 * only bound: the parser's own sheet/row/cell caps remain the second line of
 * defence (see `excelParser.ts`).
 */
import zlib from 'node:zlib';

import { AppError, ErrorCodes } from './AppError.js';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_FILE_HEADER_SIZE = 46;
const MAX_EOCD_COMMENT = 0xffff;
// A zip64 marker in the 32-bit size fields. Anything this large is far past the
// parse budget regardless, so it is rejected rather than resolved from the
// zip64 extra field.
const ZIP64_SENTINEL = 0xffffffff;

/** The macro payload part. Its presence means a macro-enabled workbook. */
const MACRO_PART_NAME = 'vbaproject.bin';

export interface ZipEntrySummary {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  /** Offset of this entry's local file header, for `readZipEntry`. */
  localHeaderOffset: number;
}

export interface OoxmlArchiveLimits {
  /** Total declared uncompressed bytes across all entries. */
  maxUncompressedBytes: number;
  /** Reject when total uncompressed / total compressed exceeds this. */
  maxCompressionRatio: number;
}

// ponytail: 100:1 is a starting threshold. Real ITP workbooks measure ~10-20:1;
// re-tune from a real reference corpus rather than from theory.
export const DEFAULT_OOXML_ARCHIVE_LIMITS: OoxmlArchiveLimits = {
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxCompressionRatio: 100,
};

function rejectArchive(message: string): never {
  throw new AppError(400, message, ErrorCodes.INVALID_FILE_TYPE);
}

/**
 * Locate the end-of-central-directory record. It sits at the very end of the
 * file unless a trailing comment pushes it back (up to 64 KB), so scan
 * backwards from the end over the comment window only.
 */
function findEndOfCentralDirectory(buffer: Buffer): number {
  const scanFrom = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_EOCD_COMMENT);
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= scanFrom; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

/**
 * Read every central-directory entry's name and declared sizes. Throws a 400 on
 * anything malformed — an archive we cannot read the directory of is one we
 * decline to parse, not one we hand to a parser and hope.
 */
export function readZipCentralDirectory(buffer: Buffer): ZipEntrySummary[] {
  if (buffer.length < EOCD_MIN_SIZE) {
    rejectArchive('That file is not a readable Office document (archive too small).');
  }

  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    rejectArchive('That file is not a readable Office document (no zip directory found).');
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries: ZipEntrySummary[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + CENTRAL_FILE_HEADER_SIZE > buffer.length) {
      rejectArchive('That file is not a readable Office document (truncated zip directory).');
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_HEADER_SIGNATURE) {
      rejectArchive('That file is not a readable Office document (corrupt zip directory).');
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + CENTRAL_FILE_HEADER_SIZE;
    if (nameStart + nameLength > buffer.length) {
      rejectArchive('That file is not a readable Office document (truncated entry name).');
    }

    entries.push({
      name: buffer.subarray(nameStart, nameStart + nameLength).toString('utf8'),
      compressedSize,
      uncompressedSize,
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_FILE_HEADER_SIZE = 30;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/**
 * Inflate ONE named entry. Used for the small metadata parts (`xl/workbook.xml`
 * and its rels) that the streaming spreadsheet reader cannot be relied on to
 * deliver — see `excelParser.ts`. Bounded by `maxBytes`, so this never becomes a
 * back door around the archive budget, and it uses stdlib zlib only.
 */
export function readZipEntry(
  buffer: Buffer,
  entries: ZipEntrySummary[],
  name: string,
  maxBytes = 2 * 1024 * 1024,
): Buffer | null {
  const entry = entries.find((candidate) => candidate.name === name);
  if (!entry || entry.uncompressedSize > maxBytes) return null;

  const start = entry.localHeaderOffset;
  if (start + LOCAL_FILE_HEADER_SIZE > buffer.length) return null;
  if (buffer.readUInt32LE(start) !== LOCAL_FILE_HEADER_SIGNATURE) return null;

  const method = buffer.readUInt16LE(start + 8);
  const nameLength = buffer.readUInt16LE(start + 26);
  const extraLength = buffer.readUInt16LE(start + 28);
  const dataStart = start + LOCAL_FILE_HEADER_SIZE + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (data.length < entry.compressedSize) return null;

  try {
    if (method === METHOD_STORED) return Buffer.from(data);
    if (method === METHOD_DEFLATE) {
      return zlib.inflateRawSync(data, { maxOutputLength: maxBytes });
    }
  } catch {
    return null;
  }
  return null;
}

/** True when the archive carries a VBA macro project part. */
export function hasMacroPart(entries: ZipEntrySummary[]): boolean {
  return entries.some((entry) => {
    const base = entry.name.replace(/\\/g, '/').split('/').pop() ?? '';
    return base.toLowerCase() === MACRO_PART_NAME;
  });
}

/**
 * Reject a hostile OOXML archive before parsing: macro-carrying, over the
 * uncompressed byte budget, or compressing at a ratio no real spreadsheet does.
 */
export function assertSafeOoxmlArchive(
  buffer: Buffer,
  limits: OoxmlArchiveLimits = DEFAULT_OOXML_ARCHIVE_LIMITS,
): ZipEntrySummary[] {
  const entries = readZipCentralDirectory(buffer);

  if (hasMacroPart(entries)) {
    rejectArchive(
      'Macro-enabled Office files are not accepted. Save the file as .xlsx or .docx (no macros) and try again.',
    );
  }

  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.uncompressedSize >= ZIP64_SENTINEL || entry.compressedSize >= ZIP64_SENTINEL) {
      rejectArchive('That file is too large to import. Split it into smaller files.');
    }
    totalCompressed += entry.compressedSize;
    totalUncompressed += entry.uncompressedSize;
  }

  if (totalUncompressed > limits.maxUncompressedBytes) {
    rejectArchive('That file is too large to import. Split it into smaller files.');
  }

  // Zero compressed bytes with non-zero content is itself a lie about the
  // archive; treat it as the bomb it is rather than dividing by zero.
  const ratio =
    totalCompressed === 0
      ? totalUncompressed === 0
        ? 0
        : Infinity
      : totalUncompressed / totalCompressed;
  if (ratio > limits.maxCompressionRatio) {
    rejectArchive('That file could not be read safely (it decompresses far beyond its size).');
  }

  return entries;
}
