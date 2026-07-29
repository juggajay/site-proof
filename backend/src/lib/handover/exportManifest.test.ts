// Wave D `D1c.2` — the manifest, and §4.7.3's ORDERING RULE with its
// proof-of-catch.
//
// **AT-128** (csv/json byte-identical over unchanged rows) · **AT-133**
// (aggregate-only unauthorized exclusion) · **AT-140** (sanitize → prefix →
// collisions, in that order).

import { describe, expect, it } from 'vitest';

import { sanitizeUploadFilename } from '../../routes/documents/fileHelpers.js';
import {
  applyChainagePrefix,
  buildArchivePath,
  resolveArchivePathCollisions,
} from './exportArchivePaths.js';
import {
  buildManifestCsv,
  buildManifestJson,
  buildManifestSummaryJson,
  toCsvCell,
  type ManifestRow,
} from './exportManifest.js';

const LOT = { lotNumber: 'LOT-001', chainageStart: 1250.4, chainageEnd: 1310 };

function row(overrides: Partial<ManifestRow> = {}): ManifestRow {
  return {
    archivePath: 'LOT-001/documents/CH1250-1310_a.jpg',
    sha256: 'a'.repeat(64),
    byteSize: '2048',
    sourceType: 'document',
    sourceId: 'doc-1',
    sourceRevision: 'v:1',
    lotNumber: 'LOT-001',
    documentType: 'photo',
    originalFilename: 'a.jpg',
    uploadedAt: '2026-07-01T00:00:00.000Z',
    uploadedBy: 'Jay Ryan',
    filenameRule: 'chainage_span',
    ...overrides,
  };
}

describe('§4.7.2 — csv and json carry the SAME content', () => {
  it('emits one row per member in both, with the same values', () => {
    const rows = [row(), row({ sourceId: 'doc-2', archivePath: 'LOT-001/documents/b.jpg' })];

    const csvLines = buildManifestCsv(rows).trimEnd().split('\r\n');
    const json = JSON.parse(buildManifestJson(rows)) as { members: Array<Record<string, string>> };

    expect(csvLines).toHaveLength(3); // header + 2
    expect(json.members).toHaveLength(2);
    expect(csvLines[0]).toBe(
      'archive_path,sha256,byte_size,source_type,source_id,source_revision,lot_number,document_type,original_filename,uploaded_at,uploaded_by,filename_rule',
    );
    expect(json.members[0]!.archivePath).toBe(rows[0]!.archivePath);
    expect(json.members[0]!.filenameRule).toBe('chainage_span');
    expect(csvLines[1]).toContain(rows[0]!.sha256);
  });

  it('**AT-128** — two builds over unchanged rows are byte-identical', () => {
    const rows = [row(), row({ sourceId: 'doc-2' })];
    expect(buildManifestCsv(rows)).toBe(buildManifestCsv(rows));
    expect(buildManifestJson(rows)).toBe(buildManifestJson(rows));
  });

  it('quotes commas and quotes, and defuses a formula cell', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    // A filename beginning `=` is executed by Excel on open. The manifest is
    // customer free text end to end, so it is defused rather than trusted.
    expect(toCsvCell('=cmd|calc')).toBe('"\t=cmd|calc"');
  });
});

describe('**AT-133** — unauthorized exclusions are a COUNT, never a list', () => {
  it('the summary carries the count and no per-record detail for it', () => {
    const summary = JSON.parse(
      buildManifestSummaryJson({
        exportId: 'e1',
        projectId: 'p1',
        scope: { kind: 'project' },
        generatedAt: new Date('2026-07-29T00:00:00.000Z'),
        generatedBy: 'u1',
        civosVersion: 'test',
        snapshotCutoffAt: new Date('2026-07-20T00:00:00.000Z'),
        lots: [
          { lotNumber: 'LOT-001', folio: 'issued' },
          { lotNumber: 'LOT-002', folio: 'none' },
        ],
        memberCount: 3,
        writtenCount: 2,
        omissions: [
          {
            archivePath: 'LOT-001/documents/x.jpg',
            sourceType: 'document',
            sourceId: 'd9',
            reason: 'The stored object is missing',
          },
        ],
        unauthorizedExclusionCount: 4,
      }),
    ) as Record<string, unknown>;

    expect(summary.unauthorizedExclusionCount).toBe(4);
    // The only per-record detail present is the MISSING-OBJECT omission, which
    // §10.5 explicitly says is not a disclosure.
    expect(JSON.stringify(summary.omissions)).not.toContain('not_permitted');
    expect(summary.lotsWithoutFolio).toBe(1);
    // `[DH-B2]` / **AT-126**: a lot with no folio is a FACT, not a gap the
    // worker fills by rendering one.
    expect(summary.lots).toContainEqual({ lotNumber: 'LOT-002', folio: 'none' });
    // `[DH-B8]` / **AT-136**: no submission, lodgement or certification claim.
    expect(String(summary.disclaimer)).toContain('does not certify, submit or lodge');
  });
});

describe('**AT-140** — sanitize, THEN prefix, THEN collisions', () => {
  it('the shipped order keeps the prefix; the wrong order DESTROYS it', () => {
    // `sanitizeUploadFilename` takes `path.basename`, so anything before the
    // last separator is discarded — including a prefix applied too early.
    const raw = 'north-approach/pipe bedding.jpg';

    const shipped = applyChainagePrefix(sanitizeUploadFilename(raw), LOT, true).filename;
    expect(shipped).toBe('CH1250-1310_pipe bedding.jpg');

    // PROOF OF CATCH: prefix first, sanitize second — the implementation
    // §4.7.3 forbids. The chainage reference Logan requires in the filename is
    // silently gone, and the archive would ship without it.
    const wrongOrder = sanitizeUploadFilename(applyChainagePrefix(raw, LOT, true).filename);
    expect(wrongOrder).toBe('pipe bedding.jpg');
    expect(wrongOrder).not.toContain('CH1250-1310');
    expect(wrongOrder).not.toBe(shipped);
  });

  it('rounds half-up to whole metres with no separators, and pins all three rules', () => {
    expect(applyChainagePrefix('a.jpg', LOT, true)).toEqual({
      filename: 'CH1250-1310_a.jpg',
      rule: 'chainage_span',
    });
    expect(
      applyChainagePrefix('a.jpg', { ...LOT, chainageStart: 980.5, chainageEnd: 980.5 }, true),
    ).toEqual({ filename: 'CH981_a.jpg', rule: 'chainage_point' });
    expect(
      applyChainagePrefix('a.jpg', { ...LOT, chainageStart: null, chainageEnd: null }, true),
    ).toEqual({ filename: 'LOT-001_a.jpg', rule: 'lot_number' });
    // Not a photo — the lot folder already carries the lot.
    expect(applyChainagePrefix('a.pdf', LOT, false)).toEqual({
      filename: 'a.pdf',
      rule: 'none',
    });
  });

  it('resolves collisions AFTER prefixing, on names that only collide once prefixed', () => {
    // A PDF already named with the chainage (not a photo, so not prefixed) and
    // a photo whose sanitized name becomes the same thing once prefixed. They
    // do NOT collide before the prefix and they DO collide after it — which is
    // precisely why §4.7.3 fixes collisions last.
    const pdf = buildArchivePath(
      LOT.lotNumber,
      'document',
      applyChainagePrefix(sanitizeUploadFilename('CH1250-1310_report.pdf'), LOT, false).filename,
    );
    const photo = buildArchivePath(
      LOT.lotNumber,
      'document',
      applyChainagePrefix(sanitizeUploadFilename('report.pdf'), LOT, true).filename,
    );
    expect(pdf).toBe(photo);

    const resolved = resolveArchivePathCollisions([{ archivePath: pdf }, { archivePath: photo }]);
    expect(resolved.map((entry) => entry.archivePath)).toEqual([
      'LOT-001/documents/CH1250-1310_report.pdf',
      'LOT-001/documents/CH1250-1310_report (2).pdf',
    ]);

    // PROOF OF CATCH: collisions resolved BEFORE prefixing. The two names do
    // not collide yet, so nothing is suffixed — and prefixing then produces two
    // IDENTICAL archive paths, which `UNIQUE (export_id, archive_path)` rejects
    // and a ZIP would carry as a duplicate entry.
    const preResolved = resolveArchivePathCollisions([
      { archivePath: buildArchivePath(LOT.lotNumber, 'document', 'CH1250-1310_report.pdf') },
      { archivePath: buildArchivePath(LOT.lotNumber, 'document', 'report.pdf') },
    ]);
    const thenPrefixed = preResolved.map((entry) =>
      entry.archivePath.endsWith('/report.pdf')
        ? buildArchivePath(LOT.lotNumber, 'document', 'CH1250-1310_report.pdf')
        : entry.archivePath,
    );
    expect(new Set(thenPrefixed).size).toBe(1);
  });
});
