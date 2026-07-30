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

/** The CIVOS horizontal logo (mark + wordmark), inlined from
 * `frontend/public/brand/civos-logo-horizontal.svg` so the page renders
 * offline with zero external requests — a handover archive gets opened on
 * air-gapped council machines. */
const CIVOS_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 583 192" role="img" aria-label="CIVOS">' +
  '<g><path d="M96 28 L142 51 L96 74 L50 51 Z" fill="none" stroke="#18181B" stroke-width="11" stroke-linejoin="miter"/>' +
  '<path d="M50 86 L88 105" stroke="#18181B" stroke-width="11"/><path d="M142 86 L104 105" stroke="#18181B" stroke-width="11"/>' +
  '<path d="M50 110 L88 129" stroke="#2563EB" stroke-width="11"/><path d="M142 110 L104 129" stroke="#2563EB" stroke-width="11"/>' +
  '<path d="M50 134 L88 153" stroke="#18181B" stroke-width="11"/><path d="M142 134 L104 153" stroke="#18181B" stroke-width="11"/>' +
  '<path d="M96 90 L96 104" stroke="#18181B" stroke-width="11"/><path d="M96 114 L96 128" stroke="#18181B" stroke-width="11"/>' +
  '<path d="M96 138 L96 152" stroke="#18181B" stroke-width="11"/></g>' +
  '<g transform="translate(204,49) scale(0.8)"><path d="M70 10 L24 10 Q10 10 10 24 L10 76 Q10 90 24 90 L70 90" fill="none" stroke="#18181B" stroke-width="20" stroke-linejoin="round"/>' +
  '<path d="M116 0 L116 100" stroke="#18181B" stroke-width="20" fill="none"/>' +
  '<path d="M154 0 L188 90 L222 0" fill="none" stroke="#18181B" stroke-width="20" stroke-linejoin="round"/>' +
  '<rect x="260" y="10" width="60" height="80" rx="16" fill="none" stroke="#18181B" stroke-width="20" stroke-linejoin="round"/>' +
  '<path d="M426 10 L383 10 Q366 10 366 27 Q366 44 383 44 L409 44 Q426 44 426 61 L426 73 Q426 90 409 90 L366 90" fill="none" stroke="#18181B" stroke-width="20" stroke-linejoin="round"/></g></svg>';

/**
 * `README.html` — the first thing a receiving engineer who has never seen
 * CIVOS opens. A branded, self-contained page: every style and the logo are
 * inline, so it renders identically from the extracted folder with no network.
 * STATIC — no per-export data, so it is byte-stable and sits INSIDE the
 * determinism boundary. Anything per-export belongs in `manifest-summary.json`,
 * which is excluded from that boundary — keeping this file static is what lets
 * it be included.
 *
 * The footer repeats the `[DH-B8]` no-submission-claim disclaimer; like the
 * summary's, it is product-owned template text.
 */
export function buildArchiveReadme(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CIVOS Handover Archive — read me first</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; background: #fafafa; line-height: 1.55; -webkit-text-size-adjust: 100%; }
  .page { max-width: 840px; margin: 0 auto; padding: 44px 32px 56px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 2px solid #18181b; padding-bottom: 20px; margin-bottom: 32px; }
  header svg { height: 42px; width: auto; display: block; }
  .doc-tag { font-family: ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace; font-size: 11px; letter-spacing: 0.16em; color: #2563eb; text-transform: uppercase; white-space: nowrap; padding-bottom: 6px; }
  h1 { font-size: 27px; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 10px; }
  .lede { color: #52525b; max-width: 62ch; font-size: 15.5px; }
  h2 { font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.11em; color: #71717a; margin: 40px 0 14px; }
  p { max-width: 70ch; }
  table { width: 100%; border-collapse: collapse; font-size: 14.5px; background: #ffffff; }
  th, td { text-align: left; padding: 10px 14px; border: 1px solid #e4e4e7; vertical-align: top; }
  th { background: #f4f4f5; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #52525b; }
  td:first-child { white-space: nowrap; }
  code { font-family: ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace; font-size: 13px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 4px; padding: 1px 6px; }
  .open-first td { background: #eff6ff; }
  .badge { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; background: #2563eb; border-radius: 4px; padding: 2px 7px; margin-left: 8px; vertical-align: 1px; }
  .cmd { display: block; background: #18181b; color: #fafafa; border: none; border-radius: 6px; padding: 12px 16px; margin: 12px 0 6px; font-size: 13px; overflow-x: auto; }
  .muted { color: #71717a; font-size: 13.5px; }
  footer { margin-top: 52px; border-top: 1px solid #e4e4e7; padding-top: 18px; color: #71717a; font-size: 13px; }
  footer p { max-width: none; }
  footer .site { color: #18181b; font-weight: 600; text-decoration: none; }
  @media print { body { background: #ffffff; } .page { padding: 0; } .cmd { color: #18181b; background: #f4f4f5; border: 1px solid #e4e4e7; } }
</style>
</head>
<body>
<div class="page">
  <header>
    ${CIVOS_LOGO_SVG}
    <div class="doc-tag">Handover archive</div>
  </header>

  <h1>Read me first</h1>
  <p class="lede">This archive is a compilation of the quality records held in CIVOS for the
  exported scope at the time of export. Everything in it is listed, fingerprinted and
  verifiable against the manifest.</p>

  <h2>What&rsquo;s inside</h2>
  <p>One folder per lot (e.g. <code>LOT-001/</code>), containing that lot&rsquo;s records grouped by type:</p>
  <table>
    <tr><th>Folder</th><th>Contents</th></tr>
    <tr><td><code>folio/</code></td><td>The issued lot folio PDF, if one has been issued &mdash; the compiled evidence statement for the lot.</td></tr>
    <tr><td><code>documents/</code></td><td>Lot documents.</td></tr>
    <tr><td><code>itp/</code></td><td>Inspection &amp; test plan attachments.</td></tr>
    <tr><td><code>hold-points/</code></td><td>Hold point release records and evidence.</td></tr>
    <tr><td><code>ncr/</code></td><td>Non-conformance evidence.</td></tr>
  </table>
  <p class="muted" style="margin-top:10px">File names beginning <code>CH&lt;start&gt;-&lt;end&gt;_</code> carry the chainage span the
  record relates to &mdash; e.g. <code>CH120-180_compaction.jpg</code>.</p>

  <h2>The three manifest files</h2>
  <table>
    <tr><th>File</th><th>What it is</th></tr>
    <tr class="open-first"><td><code>manifest.csv</code><span class="badge">Open this first</span></td>
      <td>THE ONE TO OPEN &mdash; a register of every file in this archive, in Excel. One row per file with its
      lot, type, original filename, who uploaded it and when, and its SHA-256 fingerprint.</td></tr>
    <tr><td><code>manifest.json</code></td>
      <td>The same register in machine-readable form, for software and integrity tooling. Not intended to be read by hand.</td></tr>
    <tr><td><code>manifest-summary.json</code></td>
      <td>What was exported: the scope, when it was generated, the software version, per-lot folio status,
      and anything that could not be included.</td></tr>
  </table>

  <h2>Verifying a file</h2>
  <p>To check a file has not been altered, compute its SHA-256 fingerprint and compare it to that
  file&rsquo;s row in the manifest. On Windows:</p>
  <code class="cmd">Get-FileHash "LOT-001\\documents\\&lt;file&gt;"</code>
  <p class="muted">The fingerprint shown must match the <code>sha256</code> column exactly.</p>

  <footer>
    <p>This archive was compiled by <a class="site" href="https://civos.com.au">CIVOS</a> &mdash; quality
    records for civil construction. CIVOS does not certify, submit or lodge this archive, and makes
    no claim that any authority has accepted it.</p>
  </footer>
</div>
</body>
</html>
`;
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
