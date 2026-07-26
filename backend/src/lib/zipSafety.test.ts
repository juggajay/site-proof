import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import { AppError } from './AppError.js';
import { assertSafeOoxmlArchive, hasMacroPart, readZipCentralDirectory } from './zipSafety.js';

async function realWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['Activity', 'Description']);
  sheet.addRow(['Earthworks', 'Proof roll']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * A minimal zip whose central directory declares the given sizes. Enough to
 * exercise the ratio maths without shipping a real bomb into the repo.
 */
function zipWithDeclaredSizes(
  entries: { name: string; compressed: number; uncompressed: number }[],
): Buffer {
  const headers = entries.map((entry) => {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const header = Buffer.alloc(46 + nameBytes.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt32LE(entry.compressed, 20);
    header.writeUInt32LE(entry.uncompressed, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    nameBytes.copy(header, 46);
    return header;
  });
  const directory = Buffer.concat(headers);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(0, 16);

  return Buffer.concat([directory, eocd]);
}

describe('zipSafety', () => {
  it('reads the central directory of a real workbook', async () => {
    const entries = readZipCentralDirectory(await realWorkbook());
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.name.endsWith('.xml'))).toBe(true);
  });

  it('accepts a real workbook (ratio well under the threshold)', async () => {
    await expect(
      realWorkbook().then((buffer) => assertSafeOoxmlArchive(buffer)),
    ).resolves.toBeDefined();
  });

  it('rejects a file with no zip directory', () => {
    expect(() => readZipCentralDirectory(Buffer.from('%PDF-1.7 not a zip at all'))).toThrow(
      AppError,
    );
  });

  it('rejects a decompression bomb above the ~100:1 ratio', () => {
    const bomb = zipWithDeclaredSizes([
      { name: 'xl/worksheets/sheet1.xml', compressed: 1_000, uncompressed: 50_000_000 },
    ]);
    expect(() => assertSafeOoxmlArchive(bomb)).toThrow(/decompresses far beyond its size/);
  });

  it('rejects an archive over the total uncompressed budget even at a sane ratio', () => {
    const huge = zipWithDeclaredSizes([
      { name: 'xl/worksheets/sheet1.xml', compressed: 40_000_000, uncompressed: 400_000_000 },
    ]);
    expect(() => assertSafeOoxmlArchive(huge)).toThrow(/too large to import/);
  });

  it('rejects a zip64-sentinel size rather than resolving it', () => {
    const zip64 = zipWithDeclaredSizes([
      { name: 'xl/worksheets/sheet1.xml', compressed: 0xffffffff, uncompressed: 0xffffffff },
    ]);
    expect(() => assertSafeOoxmlArchive(zip64)).toThrow(/too large to import/);
  });

  it('detects and refuses a macro-carrying archive', () => {
    const macro = zipWithDeclaredSizes([
      { name: 'xl/worksheets/sheet1.xml', compressed: 100, uncompressed: 400 },
      { name: 'xl/vbaProject.bin', compressed: 200, uncompressed: 800 },
    ]);
    expect(hasMacroPart(readZipCentralDirectory(macro))).toBe(true);
    expect(() => assertSafeOoxmlArchive(macro)).toThrow(/Macro-enabled workbooks are not accepted/);
  });

  it('treats zero declared compressed bytes with real content as a bomb', () => {
    const lying = zipWithDeclaredSizes([
      { name: 'xl/worksheets/sheet1.xml', compressed: 0, uncompressed: 10_000 },
    ]);
    expect(() => assertSafeOoxmlArchive(lying)).toThrow(AppError);
  });
});
