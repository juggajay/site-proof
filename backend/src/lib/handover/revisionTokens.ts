// Wave D `D1b` — per-source-model revision tokens
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.7,
// `[DR2-B3]`). **AT-146**.
//
// WHY IT EXISTS. Rev 2 specified `compiledFrom` as carrying "exact source row
// ids and versions". `[DR2-B3]` opened the schema and found several source
// models have no version to carry — `ITPCompletion` (`schema.prisma:712-743`)
// has NEITHER `version` NOR `updatedAt`, and it is the single most important
// evidence type in a folio. A uniform contract that two of six models cannot
// satisfy is not a contract.
//
// So each source type DECLARES its token kind, and the token is always prefixed
// with that kind so a reader never has to guess what `1` meant:
//
//   `v:{n}`        an integer version column
//   `t:{iso8601}`  an `updatedAt` timestamp
//   `d:{sha256}`   a canonical digest over an EXPLICITLY LISTED field subset
//
// Adding a source type without declaring its kind is a COMPILE ERROR, via the
// exhaustive `Record<FolioSourceType, RevisionTokenKind>` below and the `never`
// exhaustiveness check in `revisionToken`.
//
// PURE: no Prisma, no clock, no I/O. It is called from inside the session
// transaction with rows already read.

import { createHash } from 'node:crypto';

/**
 * Every model a folio can compile from. Extended by `D1c`'s
 * `HandoverExportMember.sourceType`, which uses the same tokens (§7.5).
 */
export type FolioSourceType =
  | 'document'
  | 'folio_issue'
  | 'ncr'
  | 'test_result'
  | 'itp_completion'
  | 'hold_point';

export type RevisionTokenKind = 'version' | 'updated_at' | 'row_digest';

/**
 * §7.7's table, as code. The choice per table is what the table ACTUALLY has —
 * a synthetic version column on six models would be a migration, a backfill and
 * six write-path changes to produce information four of them already carry.
 */
export const REVISION_TOKEN_KINDS: Readonly<Record<FolioSourceType, RevisionTokenKind>> =
  Object.freeze({
    // Real version tracking: `version`, `parentDocumentId`, `isLatestVersion`.
    document: 'version',
    // Append-only by trigger; the version IS the identity.
    folio_issue: 'version',
    // Mutable through its lifecycle; the timestamp is the available discriminator.
    ncr: 'updated_at',
    test_result: 'updated_at',
    // Has neither. Digest over the listed subset below.
    itp_completion: 'row_digest',
    // Has neither, and its file pointers are bare strings with no size or
    // checksum (`schema.prisma:777-779`).
    hold_point: 'row_digest',
  });

/**
 * The digest input set for `ITPCompletion`, verbatim from §7.7: `status`,
 * `completedAt`, `verificationStatus`, `verifiedAt`, `notes`, `signatureUrl`,
 * and the attachment id set.
 *
 * VERSIONED ALONGSIDE `payloadSchemaVersion` — a digest whose input set changes
 * silently is worse than no digest, because it reports "unchanged" for a row
 * that changed in a field the list stopped covering. Change this list, bump
 * {@link FOLIO_PAYLOAD_SCHEMA_VERSION}.
 */
export const ITP_COMPLETION_DIGEST_FIELDS = [
  'status',
  'completedAt',
  'verificationStatus',
  'verifiedAt',
  'notes',
  'signatureUrl',
  'attachmentIds',
] as const;

/**
 * The digest input set for `HoldPoint`. §7.7 names the KIND but not the fields,
 * so this list is `D1b`'s and is governed by the same rule as the one above:
 * changing it bumps {@link FOLIO_PAYLOAD_SCHEMA_VERSION}.
 *
 * The two file pointers are IN the set deliberately — a hold point whose
 * release signature is replaced is a different piece of evidence, and they are
 * the only handle on that change the row offers (they carry no size, no
 * checksum and no upload timestamp).
 */
export const HOLD_POINT_DIGEST_FIELDS = [
  'status',
  'releasedAt',
  'releasedByName',
  'releasedByOrg',
  'releaseMethod',
  'releaseSignatureUrl',
  'evidencePackageUrl',
] as const;

/**
 * `payload` shape version for `FolioSnapshot`. Bump on any change to the
 * payload shape OR to either digest field list above.
 */
export const FOLIO_PAYLOAD_SCHEMA_VERSION = 1;

export type RevisionTokenInput =
  | { readonly kind: 'version'; readonly version: number }
  | { readonly kind: 'updated_at'; readonly updatedAt: Date | string }
  | { readonly kind: 'row_digest'; readonly fields: Readonly<Record<string, unknown>> };

/** Deterministic serialisation: keys sorted, dates as ISO, `undefined` as null. */
function canonicalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = canonicalise(source[key]);
        return accumulator;
      }, {});
  }
  return value;
}

export function canonicalRowDigest(fields: Readonly<Record<string, unknown>>): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalise(fields)))
    .digest('hex');
}

/**
 * Build the prefixed token for one source row.
 *
 * The `sourceType` decides the kind, so a caller cannot pick a cheaper token
 * for a model the table says needs a digest — passing the wrong `input` shape
 * is a type error at the call site, and an unhandled source type is a compile
 * error here.
 */
export function revisionToken(sourceType: FolioSourceType, input: RevisionTokenInput): string {
  const expected = REVISION_TOKEN_KINDS[sourceType];
  if (input.kind !== expected) {
    throw new Error(
      `Revision token kind mismatch for ${sourceType}: expected ${expected}, received ${input.kind}`,
    );
  }

  switch (input.kind) {
    case 'version':
      return `v:${input.version}`;
    case 'updated_at':
      return `t:${input.updatedAt instanceof Date ? input.updatedAt.toISOString() : input.updatedAt}`;
    case 'row_digest':
      return `d:${canonicalRowDigest(input.fields)}`;
    default: {
      // Adding a `RevisionTokenKind` without handling it fails to compile here.
      const unreachable: never = input;
      throw new Error(`Unhandled revision token kind: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Pick the declared digest fields off a row, in the declared order. */
export function pickDigestFields<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[],
): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((accumulator, field) => {
    accumulator[field] = row[field] ?? null;
    return accumulator;
  }, {});
}

export interface SourceRowRef {
  readonly sourceType: FolioSourceType;
  readonly sourceId: string;
  readonly revision: string;
}

export function sourceRowRef(
  sourceType: FolioSourceType,
  sourceId: string,
  input: RevisionTokenInput,
): SourceRowRef {
  return { sourceType, sourceId, revision: revisionToken(sourceType, input) };
}
