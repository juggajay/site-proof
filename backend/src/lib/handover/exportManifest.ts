// Wave D `D1c.2` — the manifest: `manifest.csv`, `manifest.json` and
// `manifest-summary.json`
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.2, §4.7.3,
// §10.5). **AT-128**, **AT-129**, **AT-133**, **AT-140**.
//
// CSV *AND* JSON, SAME CONTENT, and neither is decoration. §4.7.2: "`manifest.csv`
// (opens in Excel — that is what 'searchable' means to the person who receives
// it) and `manifest.json`, same content". One row per member, produced from ONE
// row model so the two can never disagree.
//
// `manifest-summary.json` IS EXCLUDED FROM THE DETERMINISM ASSERTION (§4.7.2,
// `[DR-A9]`) because it carries generated-at. That exclusion is enforced in the
// assembler, not here — see `exportAssembly.ts`'s `contentDigest`.
//
// `[DH-B6]` / **AT-133**: unauthorized exclusions are an AGGREGATE COUNT ONLY.
// No ids, no filenames, no lot numbers, no document types. Rev 1's
// `omissions[] { reason: 'not_permitted' }` with per-file detail WAS the
// disclosure. Non-permission omissions — a missing object, a broken locator —
// keep their per-file detail, because those are not disclosures.
//
// PURE: no Prisma, no clock, no I/O. Every timestamp arrives as a parameter, so
// two runs under one injected clock produce byte-identical bytes.

export interface ManifestRow {
  readonly archivePath: string;
  readonly sha256: string;
  readonly byteSize: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceRevision: string;
  readonly lotNumber: string;
  readonly documentType: string;
  readonly originalFilename: string;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
  /** Which of §4.7.3's three naming rules applied — **AT-140** requires this
   * per member, so a receiving engineer can tell a chainage from a fallback. */
  readonly filenameRule: string;
}

export interface ManifestOmission {
  readonly archivePath: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reason: string;
}

export interface ManifestSummaryInput {
  readonly exportId: string;
  readonly projectId: string;
  readonly scope: unknown;
  readonly generatedAt: Date;
  readonly generatedBy: string | null;
  readonly civosVersion: string;
  readonly snapshotCutoffAt: Date | null;
  readonly lots: ReadonlyArray<{ lotNumber: string; folio: 'issued' | 'none' }>;
  readonly memberCount: number;
  readonly writtenCount: number;
  readonly omissions: readonly ManifestOmission[];
  /** **AT-133**: a COUNT, never a list. */
  readonly unauthorizedExclusionCount: number;
}

/** Column order is the file format. Changing it changes every archive already
 * shipped to a receiving engineer's spreadsheet, so it is declared once. */
export const MANIFEST_COLUMNS: ReadonlyArray<keyof ManifestRow> = [
  'archivePath',
  'sha256',
  'byteSize',
  'sourceType',
  'sourceId',
  'sourceRevision',
  'lotNumber',
  'documentType',
  'originalFilename',
  'uploadedAt',
  'uploadedBy',
  'filenameRule',
];

const CSV_HEADERS: Readonly<Record<keyof ManifestRow, string>> = Object.freeze({
  archivePath: 'archive_path',
  sha256: 'sha256',
  byteSize: 'byte_size',
  sourceType: 'source_type',
  sourceId: 'source_id',
  sourceRevision: 'source_revision',
  lotNumber: 'lot_number',
  documentType: 'document_type',
  originalFilename: 'original_filename',
  uploadedAt: 'uploaded_at',
  uploadedBy: 'uploaded_by',
  filenameRule: 'filename_rule',
});

/**
 * RFC 4180 quoting, and the leading-formula guard.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula by Excel when
 * the file is opened, and every string in this manifest is customer free text
 * (filenames, lot numbers, user names). A manifest that runs code on the
 * receiving engineer's machine is not a searchable index, so those cells are
 * prefixed with a tab — the shipped convention for CSV injection defence, and
 * invisible in the cell.
 */
export function toCsvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return /[",\r\n\t]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CRLF line endings — the format Excel expects, and RFC 4180's. */
export function buildManifestCsv(rows: readonly ManifestRow[]): string {
  const lines = [MANIFEST_COLUMNS.map((column) => CSV_HEADERS[column]).join(',')];
  for (const row of rows) {
    lines.push(MANIFEST_COLUMNS.map((column) => toCsvCell(row[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** Same content, same order, two spaces of indent — stable across runs because
 * the key order is `MANIFEST_COLUMNS` and nothing here reads a clock. */
export function buildManifestJson(rows: readonly ManifestRow[]): string {
  const ordered = rows.map((row) =>
    Object.fromEntries(MANIFEST_COLUMNS.map((column) => [column, row[column]])),
  );
  return `${JSON.stringify({ members: ordered }, null, 2)}\n`;
}

export function buildManifestSummaryJson(input: ManifestSummaryInput): string {
  const summary = {
    exportId: input.exportId,
    projectId: input.projectId,
    scope: input.scope,
    generatedAt: input.generatedAt.toISOString(),
    generatedBy: input.generatedBy,
    civosVersion: input.civosVersion,
    // §4.6.1: everything after this instant is out of this archive BY DESIGN,
    // and the manifest says so rather than leaving the receiver to wonder.
    snapshotCutoffAt: input.snapshotCutoffAt?.toISOString() ?? null,
    memberCount: input.memberCount,
    writtenCount: input.writtenCount,
    lots: input.lots,
    lotsWithoutFolio: input.lots.filter((lot) => lot.folio === 'none').length,
    omissions: input.omissions,
    // **AT-133**: the count and nothing else. Adding a single id here would
    // reintroduce the disclosure `[DH-B6]` forbids.
    unauthorizedExclusionCount: input.unauthorizedExclusionCount,
    // No `outputBytes` and no archive `sha256` here, and the omission is
    // structural rather than an oversight: this file is INSIDE the archive, so
    // a hash of the archive would have to hash itself. Both live on the
    // `HandoverExport` row, where the download route verifies against them.
    // `[DH-B8]` / **AT-136**: CIVOS compiles, it does not submit, lodge or
    // certify. This string is product-owned template text and is asserted
    // against the no-submission-claim guard.
    disclaimer:
      'This archive is a compilation of records held in CIVOS at the cutoff above. ' +
      'CIVOS does not certify, submit or lodge it, and makes no claim that any authority has accepted it.',
  };

  return `${JSON.stringify(summary, null, 2)}\n`;
}
