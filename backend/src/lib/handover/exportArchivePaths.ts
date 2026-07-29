// Wave D `D1c.1` — archive paths and the deterministic order key
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.3, §7.5).
// Partial **AT-140** (the format and the ordering rule; the manifest half is
// `D1c.2`).
//
// WHY THIS IS IN `D1c.1` AT ALL, when §4.7.3 is a `D1c.2` section. The archive
// path is FROZEN into the ledger (§4.6.1) and the ledger carries
// `UNIQUE (export_id, archive_path)`. So the naming rule, the ordering and the
// collision resolution all have to be right at freeze time — `D1c.2` reads
// these paths, it does not get to choose them.
//
// ORDERING IS LOAD-BEARING and §4.7.3 fixes it: **sanitize, then prefix, then
// resolve collisions.** Sanitising after prefixing could mangle the prefix;
// resolving collisions before prefixing could produce two different suffixes
// for names that only collide once prefixed.
//
// No database reads, no clock, no I/O — every function here is a pure
// transformation of values the caller already holds.
//
// The sanitizer is the SHIPPED `sanitizeUploadFilename`
// (`routes/documents/fileHelpers.ts:237`), imported rather than re-derived: a
// ZIP entry name and an upload path have the same hazard — `..`, separators,
// control characters — and a second sanitizer is a second sanitizer to get
// wrong.

import { sanitizeUploadFilename } from '../../routes/documents/fileHelpers.js';

/**
 * §7.5's `sourceType` vocabulary.
 *
 * Note `folio` — the ledger's own word — against `folio_issue`, the §7.7
 * revision-token key for the same table. They are two different vocabularies in
 * the spec and are deliberately not unified here.
 */
export const EXPORT_MEMBER_SOURCE_TYPES = [
  'folio',
  'document',
  'holdpoint_signature',
  'holdpoint_evidence',
  'itp_attachment',
  'ncr_evidence',
] as const;
export type ExportMemberSourceType = (typeof EXPORT_MEMBER_SOURCE_TYPES)[number];

export const EXPORT_MEMBER_STATES = ['pending', 'verified', 'written', 'omitted'] as const;
export type ExportMemberState = (typeof EXPORT_MEMBER_STATES)[number];

/**
 * §4.7.3's "categories in a fixed declared order". THIS is the declaration, and
 * the ARRAY ORDER is the archive order — not alphabetical, not insertion order
 * at some call site.
 *
 * ponytail: the category is a function of the source type, not of
 * `Document.documentType`. `documentType` is free text a customer can extend,
 * so folder names derived from it would differ between two projects holding the
 * same evidence — and the manifest carries the document type per member anyway
 * (§4.7.2), so nothing is lost by not spending a folder on it.
 */
export const EXPORT_CATEGORY_ORDER: readonly ExportMemberSourceType[] = [
  'folio',
  'itp_attachment',
  'holdpoint_signature',
  'holdpoint_evidence',
  'ncr_evidence',
  'document',
];

const CATEGORY_FOLDERS: Readonly<Record<ExportMemberSourceType, string>> = Object.freeze({
  folio: 'folio',
  itp_attachment: 'itp',
  holdpoint_signature: 'hold-points',
  holdpoint_evidence: 'hold-points',
  ncr_evidence: 'ncr',
  document: 'documents',
});

export function categoryFolder(sourceType: ExportMemberSourceType): string {
  return CATEGORY_FOLDERS[sourceType];
}

function categoryIndex(sourceType: ExportMemberSourceType): number {
  const index = EXPORT_CATEGORY_ORDER.indexOf(sourceType);
  /* c8 ignore next 3 -- unreachable while the two tables above stay in sync */
  if (index < 0) {
    throw new Error(`Source type ${sourceType} has no declared category order`);
  }
  return index;
}

/** §4.7.3: `Decimal` metres rounded HALF-UP to the nearest whole metre, rendered
 * without separators or a decimal point — `1250`, not `1,250.00`.
 *
 * `Math.round` is half-up for positives and half-DOWN in magnitude for
 * negatives (`Math.round(-0.5) === -0`), so negatives — which a chainage can be
 * on a project whose datum starts mid-alignment — go through `Math.floor(x+0.5)`
 * instead. Half-up means "up the number line", uniformly.
 */
export function roundChainageMetres(value: number): number {
  return Math.floor(value + 0.5);
}

export interface ChainagePrefixInput {
  readonly lotNumber: string;
  readonly chainageStart: number | null;
  readonly chainageEnd: number | null;
}

/** Which of §4.7.3's three naming rules applied — recorded per member in the
 * `D1c.2` manifest, so the receiving engineer can tell a fallback from a real
 * chainage. */
export type FilenameRule = 'chainage_span' | 'chainage_point' | 'lot_number' | 'none';

export interface PrefixedFilename {
  readonly filename: string;
  readonly rule: FilenameRule;
}

/**
 * §4.7.3, verbatim:
 *
 *     CH{start}-{end}_{sanitized}   e.g. CH1250-1310_pipe-bedding-north.jpg
 *     CH{start}_{sanitized}         when chainageStart == chainageEnd
 *     {lotNumber}_{sanitized}       when either chainage is null
 *
 * Applies to PHOTO members only (§2.2 item (f)(iii): Logan requires "a chainage
 * or exact location reference in the filename" for photographs). Everything
 * else keeps its sanitized name — the lot folder already carries the lot.
 *
 * `sanitizedFilename` is the input: sanitising happens BEFORE this, per the
 * ordering rule above.
 */
export function applyChainagePrefix(
  sanitizedFilename: string,
  lot: ChainagePrefixInput,
  isPhoto: boolean,
): PrefixedFilename {
  if (!isPhoto) return { filename: sanitizedFilename, rule: 'none' };

  if (lot.chainageStart === null || lot.chainageEnd === null) {
    return {
      filename: `${sanitizeUploadFilename(lot.lotNumber)}_${sanitizedFilename}`,
      rule: 'lot_number',
    };
  }

  const start = roundChainageMetres(lot.chainageStart);
  const end = roundChainageMetres(lot.chainageEnd);
  if (start === end) {
    return { filename: `CH${start}_${sanitizedFilename}`, rule: 'chainage_point' };
  }
  // Real lots are entered both ways round; the low value leads so two lots over
  // the same span produce the same prefix.
  const [low, high] = start <= end ? [start, end] : [end, start];
  return { filename: `CH${low}-${high}_${sanitizedFilename}`, rule: 'chainage_span' };
}

/**
 * `{lotNumber}/{category}/{filename}` — §4.7.3.
 *
 * The lot number is sanitized as a PATH SEGMENT: it is customer free text and
 * lands in a ZIP entry name, where a `../` would be a path-traversal write on
 * whatever the receiving engineer extracts with.
 */
export function buildArchivePath(
  lotNumber: string,
  sourceType: ExportMemberSourceType,
  filename: string,
): string {
  return `${sanitizeUploadFilename(lotNumber)}/${categoryFolder(sourceType)}/${filename}`;
}

/**
 * The deterministic order key (§4.7.3): lots by `lotNumber` ascending with the
 * comparator the reports already use, categories in the declared order, files
 * within a category by `uploadedAt` then id.
 *
 * `lotIndex` — not the lot number itself — carries the lot ordering, and that is
 * the point: the comparator is Postgres's `ORDER BY lot_number ASC` under the
 * database's collation, and a JavaScript string sort does NOT reproduce it for
 * mixed-case or punctuated lot numbers. Freezing the DB's own position removes
 * the disagreement rather than trying to re-implement the collation. The lot
 * number is kept in the key after it, for legibility when someone reads a
 * ledger row.
 */
export function buildOrderKey(params: {
  lotIndex: number;
  lotNumber: string;
  sourceType: ExportMemberSourceType;
  uploadedAt: Date | null;
  sourceId: string;
}): string {
  const lot = String(params.lotIndex).padStart(8, '0');
  const category = String(categoryIndex(params.sourceType)).padStart(2, '0');
  // A null timestamp sorts FIRST and deterministically. Hold-point file
  // pointers carry no upload time at all (`schema.prisma:777-779`), and
  // "unknown" must not mean "wherever the driver felt like".
  const uploaded = params.uploadedAt ? params.uploadedAt.toISOString() : '0000-00-00T00:00:00.000Z';
  return `${lot}|${params.lotNumber}|${category}|${uploaded}|${params.sourceId}`;
}

/**
 * Collision resolution, LAST (§4.7.3): duplicates are suffixed ` (2)`, ` (3)`
 * … in order key order.
 *
 * The suffix goes BEFORE the extension — `photo (2).jpg`, not `photo.jpg (2)`.
 * §4.7.3 says "suffixed ` (2)`" without fixing the position, and an entry whose
 * extension has been displaced does not open by double-click on any of the
 * three readers §4.5.1 fixture 5 tests against.
 *
 * Call with members ALREADY in order-key order; the returned array preserves it.
 */
export function resolveArchivePathCollisions<T extends { archivePath: string }>(
  members: readonly T[],
): T[] {
  const seen = new Map<string, number>();

  return members.map((member) => {
    const taken = seen.get(member.archivePath);
    if (taken === undefined) {
      seen.set(member.archivePath, 1);
      return member;
    }

    // Loop rather than a single suffix: `a.jpg`, `a (2).jpg` and a genuine
    // `a (2).jpg` in the source data all want distinct paths.
    let next = taken + 1;
    let candidate = suffixBeforeExtension(member.archivePath, next);
    while (seen.has(candidate)) {
      next += 1;
      candidate = suffixBeforeExtension(member.archivePath, next);
    }
    seen.set(member.archivePath, next);
    seen.set(candidate, 1);
    return { ...member, archivePath: candidate };
  });
}

function suffixBeforeExtension(path: string, n: number): string {
  const lastSlash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  if (dot <= lastSlash + 1) return `${path} (${n})`;
  return `${path.slice(0, dot)} (${n})${path.slice(dot)}`;
}
