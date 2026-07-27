/**
 * A Word ITP document, built in memory for tests.
 *
 * There is no zip WRITER in this repo's dependencies and Wave B is allowed
 * exactly one new one (`mammoth`, spec §9-D6), so the fixture writes the
 * archive itself. A zip is a documented fixed-layout format and only the
 * writing half is needed here — `zipSafety.ts` already owns the reading half.
 */
import zlib from 'node:zlib';

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const METHOD_DEFLATE = 8;

interface ZipEntry {
  name: string;
  content: Buffer;
}

/** A minimal deflate-method zip. Enough for `assertSafeOoxmlArchive`, `mammoth`
 *  and the decompression-ratio checks to all see a real archive. */
export function buildZip(files: Record<string, string | Buffer>): Buffer {
  const entries: ZipEntry[] = Object.entries(files).map(([name, content]) => ({
    name,
    content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
  }));

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const deflated = zlib.deflateRawSync(entry.content);
    const crc = zlib.crc32(entry.content);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(METHOD_DEFLATE, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, deflated);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(CENTRAL_FILE_HEADER_SIGNATURE, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(METHOD_DEFLATE, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);

    offset += local.length + deflated.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDirectory, eocd]);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function tableXml(rows: string[][]): string {
  const trs = rows
    .map(
      (cells) => `<w:tr>${cells.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join('')}</w:tr>`,
    )
    .join('');
  return `<w:tbl>${trs}</w:tbl>`;
}

export interface FixtureDocxBlock {
  /** A heading paragraph printed above the table — the ITP's own title. */
  heading?: string;
  rows: string[][];
}

/** Wrap body XML in a document part and package it as a `.docx`. */
export function buildDocxFromBody(
  bodyXml: string,
  extraParts: Record<string, string> = {},
): Buffer {
  return buildZip({
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': PACKAGE_RELS,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
    ...extraParts,
  });
}

/** A Word ITP: a heading then a table, repeated — the near-universal layout. */
export function buildItpDocx(blocks: FixtureDocxBlock[]): Buffer {
  const body = blocks
    .map((block) => `${block.heading ? paragraph(block.heading) : ''}${tableXml(block.rows)}`)
    .join('');
  return buildDocxFromBody(body);
}
