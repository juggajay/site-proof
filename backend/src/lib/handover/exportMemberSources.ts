// Wave D `D1c.2` — reading the frozen ledger, and reading the bytes it points at
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.6.1, §4.6.3,
// §4.7.2, §4.7.3). **AT-127**, **AT-129**, **AT-140**.
//
// THE LEDGER IS THE INPUT, and that is the whole restart story (§4.6.3): the
// worker never re-enumerates. It reads `HandoverExportMember` in `orderKey`
// order and writes exactly those members, so a job that restarts after a
// process kill rebuilds the SAME archive from the SAME rows — a folio reissued
// in between produces version n+1 and this ledger still points at n.
//
// WHAT THE LEDGER DOES NOT CARRY, and where it comes from instead. §4.7.2's
// manifest wants document type, original filename, uploaded-at and uploaded-by
// per member, and §7.5 does not store them — the ledger froze IDENTITY (id +
// revision token) rather than a copy of every column. So the manifest joins
// back to the source rows by `sourceId`. That is not a hole in the freeze: the
// frozen `sourceRevision` is what proves the row did not change underneath, and
// duplicating six columns into the ledger would have been a second copy to keep
// in sync for no assertion it makes possible.
//
// MEMBER BYTES ARE BUFFERED, one at a time, and the ceiling is declared: every
// member is bounded by `DOCUMENT_UPLOAD_MAX_BYTES` (50 MiB) or, for a
// hold-point signature, by the 1 MiB JSON body limit that carried it
// (`exportPreflight.ts:84`). Peak working set is therefore one member plus
// `archiver`'s ~39 MiB plus the 32 MiB multipart queue — inside §4.5.1 fixture
// 1's 256 MiB bar with room. *ponytail: streaming each member would save 50 MiB
// of a 256 MiB budget and cost a second read path; if a future D1d CCTV run
// raises the per-file ceiling, this is the line that has to change first.*

import fs from 'node:fs';

import { AppError } from '../AppError.js';
import { prisma } from '../prisma.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../supabase.js';
import { resolveUploadPath } from '../uploadPaths.js';
import { resolveScopeLots } from '../../routes/handoverExports/scope.js';
import type { HandoverExportScope } from '../../routes/handoverExports/validation.js';
import { applyChainagePrefix, type FilenameRule } from './exportArchivePaths.js';

type PrismaClientLike = typeof prisma;

/** One frozen ledger row, as the worker reads it. */
export interface LedgerMember {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceRevision: string | null;
  readonly storageLocator: string;
  readonly archivePath: string;
  readonly byteSize: bigint | null;
  readonly sourceChecksum: string | null;
  readonly state: string;
  readonly omissionReason: string | null;
  readonly orderKey: string;
}

/** The per-member facts §4.7.2 requires the manifest to carry. */
export interface MemberMetadata {
  readonly lotNumber: string;
  readonly documentType: string;
  readonly originalFilename: string;
  readonly uploadedAt: string | null;
  readonly uploadedBy: string | null;
  readonly filenameRule: FilenameRule;
}

const LEDGER_SELECT = {
  id: true,
  sourceType: true,
  sourceId: true,
  sourceRevision: true,
  storageLocator: true,
  archivePath: true,
  byteSize: true,
  sourceChecksum: true,
  state: true,
  omissionReason: true,
  orderKey: true,
} as const;

/**
 * The ledger, in archive order.
 *
 * `orderKey` ASC is the only ordering — §4.7.3's lot/category/uploadedAt/id
 * order was resolved at freeze time and baked into the key, so nothing here can
 * reorder an archive by re-deriving it differently.
 */
export function readLedger(
  exportId: string,
  client: PrismaClientLike = prisma,
): Promise<LedgerMember[]> {
  return client.handoverExportMember.findMany({
    where: { exportId },
    select: LEDGER_SELECT,
    orderBy: { orderKey: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// The metadata join
// ---------------------------------------------------------------------------

const DOCUMENT_SOURCE_TYPES = new Set(['document', 'itp_attachment', 'ncr_evidence']);
const HOLD_POINT_SOURCE_TYPES = new Set(['holdpoint_signature', 'holdpoint_evidence']);

interface LotFacts {
  readonly lotNumber: string;
  readonly chainageStart: number | null;
  readonly chainageEnd: number | null;
}

/**
 * Which of §4.7.3's three naming rules produced this member's filename.
 *
 * DERIVED BY MATCHING THE FROZEN PATH, not by recomputing from the lot's
 * CURRENT chainage. The distinction matters: a lot edited after the freeze
 * would make a recomputation disagree with the name actually in the archive,
 * and the manifest's job is to describe the archive it ships with. So the three
 * candidate prefixes are rebuilt with the SHIPPED `applyChainagePrefix` — never
 * a second copy of the format — and whichever one the frozen basename starts
 * with is the rule that applied.
 */
export function deriveFilenameRule(
  archivePath: string,
  lot: LotFacts | null,
  isPhoto: boolean,
): FilenameRule {
  if (!isPhoto || !lot) return 'none';

  const basename = archivePath.slice(archivePath.lastIndexOf('/') + 1);
  // A sentinel the sanitizer leaves alone, so each candidate is exactly
  // `{prefix}{sentinel}` and the prefix is everything before it.
  const sentinel = 'x';
  const candidates: ReadonlyArray<[FilenameRule, LotFacts]> = [
    ['chainage_span', lot],
    ['chainage_point', { ...lot, chainageEnd: lot.chainageStart }],
    ['lot_number', { ...lot, chainageStart: null, chainageEnd: null }],
  ];

  for (const [, candidateLot] of candidates) {
    const built = applyChainagePrefix(sentinel, candidateLot, true);
    const prefix = built.filename.slice(0, built.filename.length - sentinel.length);
    if (prefix.length > 0 && basename.startsWith(prefix)) return built.rule;
  }
  return 'none';
}

function isPhotoMime(mimeType: string | null | undefined): boolean {
  return (mimeType ?? '').toLowerCase().startsWith('image/');
}

function userLabel(user: { fullName: string | null } | null): string | null {
  return user?.fullName?.trim() || null;
}

type DocumentRow = {
  id: string;
  filename: string;
  documentType: string;
  mimeType: string | null;
  uploadedAt: Date;
  uploadedBy: { fullName: string | null } | null;
  lot: { lotNumber: string; chainageStart: unknown; chainageEnd: unknown } | null;
};
type FolioRow = {
  id: string;
  version: number;
  issuedAt: Date;
  issuedBy: { fullName: string | null } | null;
  lot: { lotNumber: string } | null;
};
type HoldPointRow = {
  id: string;
  releasedAt: Date | null;
  releasedByName: string | null;
  lot: { lotNumber: string } | null;
};

function toLotFacts(
  lot: { lotNumber: string; chainageStart: unknown; chainageEnd: unknown } | null | undefined,
): LotFacts | null {
  if (!lot) return null;
  return {
    lotNumber: lot.lotNumber,
    chainageStart: lot.chainageStart === null ? null : Number(lot.chainageStart),
    chainageEnd: lot.chainageEnd === null ? null : Number(lot.chainageEnd),
  };
}

function documentMetadata(member: LedgerMember, doc: DocumentRow | undefined): MemberMetadata {
  const lot = toLotFacts(doc?.lot);
  return {
    lotNumber: lot?.lotNumber ?? archiveLotSegment(member.archivePath),
    documentType: doc?.documentType ?? 'unknown',
    originalFilename: doc?.filename ?? '',
    uploadedAt: doc?.uploadedAt?.toISOString() ?? null,
    uploadedBy: userLabel(doc?.uploadedBy ?? null),
    filenameRule: deriveFilenameRule(member.archivePath, lot, isPhotoMime(doc?.mimeType)),
  };
}

function folioMetadata(member: LedgerMember, folio: FolioRow | undefined): MemberMetadata {
  return {
    lotNumber: folio?.lot?.lotNumber ?? archiveLotSegment(member.archivePath),
    documentType: 'folio',
    originalFilename: folio ? `folio v${folio.version}` : '',
    uploadedAt: folio?.issuedAt?.toISOString() ?? null,
    uploadedBy: userLabel(folio?.issuedBy ?? null),
    // A folio is never a photo, so §4.7.3's chainage rule does not reach it.
    filenameRule: 'none',
  };
}

function holdPointMetadata(
  member: LedgerMember,
  holdPoint: HoldPointRow | undefined,
): MemberMetadata {
  return {
    lotNumber: holdPoint?.lot?.lotNumber ?? archiveLotSegment(member.archivePath),
    documentType:
      member.sourceType === 'holdpoint_signature' ? 'hold_point_signature' : 'hold_point_evidence',
    originalFilename: member.archivePath.slice(member.archivePath.lastIndexOf('/') + 1),
    uploadedAt: holdPoint?.releasedAt?.toISOString() ?? null,
    uploadedBy: holdPoint?.releasedByName ?? null,
    filenameRule: 'none',
  };
}

/**
 * One batched read per source table.
 *
 * The selects are INLINE, not hoisted into shared constants: Prisma infers the
 * returned shape from an object literal at the call site, and a hoisted one
 * widens `true` to `boolean` and collapses the whole result to `any`.
 */
async function readMetadataSources(members: readonly LedgerMember[], client: PrismaClientLike) {
  const idsOf = (predicate: (sourceType: string) => boolean) =>
    members.filter((member) => predicate(member.sourceType)).map((member) => member.sourceId);

  const documentIds = idsOf((type) => DOCUMENT_SOURCE_TYPES.has(type));
  const folioIds = idsOf((type) => type === 'folio');
  const holdPointIds = idsOf((type) => HOLD_POINT_SOURCE_TYPES.has(type));

  const [documents, folios, holdPoints] = await Promise.all([
    documentIds.length
      ? client.document.findMany({
          where: { id: { in: documentIds } },
          select: {
            id: true,
            filename: true,
            documentType: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { fullName: true } },
            lot: { select: { lotNumber: true, chainageStart: true, chainageEnd: true } },
          },
        })
      : Promise.resolve([]),
    folioIds.length
      ? client.folioIssue.findMany({
          where: { id: { in: folioIds } },
          select: {
            id: true,
            version: true,
            issuedAt: true,
            issuedBy: { select: { fullName: true } },
            lot: { select: { lotNumber: true } },
          },
        })
      : Promise.resolve([]),
    holdPointIds.length
      ? client.holdPoint.findMany({
          where: { id: { in: holdPointIds } },
          select: {
            id: true,
            releasedAt: true,
            releasedByName: true,
            lot: { select: { lotNumber: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    documentById: new Map<string, DocumentRow>(documents.map((row) => [row.id, row])),
    folioById: new Map<string, FolioRow>(folios.map((row) => [row.id, row])),
    holdPointById: new Map<string, HoldPointRow>(holdPoints.map((row) => [row.id, row])),
  };
}

/**
 * The per-member facts the manifest needs, resolved in three batched reads.
 *
 * N+1 here would be one round trip per member at up to 8,334 members per
 * archive (`exportPreflight.ts:65`), which is the shape that turns a two-minute
 * job into a twenty-minute one.
 */
export async function loadMemberMetadata(
  members: readonly LedgerMember[],
  client: PrismaClientLike = prisma,
): Promise<Map<string, MemberMetadata>> {
  const { documentById, folioById, holdPointById } = await readMetadataSources(members, client);
  const metadata = new Map<string, MemberMetadata>();

  for (const member of members) {
    if (DOCUMENT_SOURCE_TYPES.has(member.sourceType)) {
      metadata.set(member.id, documentMetadata(member, documentById.get(member.sourceId)));
    } else if (member.sourceType === 'folio') {
      metadata.set(member.id, folioMetadata(member, folioById.get(member.sourceId)));
    } else {
      metadata.set(member.id, holdPointMetadata(member, holdPointById.get(member.sourceId)));
    }
  }

  return metadata;
}

/** The archive path's first segment is the sanitized lot number — the only lot
 * fact the ledger itself carries, and the fallback when a source row has been
 * hard-deleted since the freeze. */
function archiveLotSegment(archivePath: string): string {
  const slash = archivePath.indexOf('/');
  return slash > 0 ? archivePath.slice(0, slash) : archivePath;
}

// ---------------------------------------------------------------------------
// The bytes
// ---------------------------------------------------------------------------

/** A member whose object is gone is an OMISSION with a reason (**AT-129**), not
 * a failed job — `[DH-B1]` forbids the silent version, and one missing photo
 * must not cost the archive. */
export class MemberObjectMissingError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'MemberObjectMissingError';
  }
}

const HOLD_POINT_LOCATOR = /^holdpoint:\/\/([^/]+)\/(releaseSignatureUrl|evidencePackageUrl)$/;

/**
 * The member's bytes, from whatever kind of locator the freeze recorded.
 *
 * THREE LOCATOR SHAPES, and they are not interchangeable:
 *  - a Supabase reference or legacy public URL → the storage bucket;
 *  - `uploads/...` → the local development disk;
 *  - `holdpoint://{id}/{field}` → the hold-point row itself, because a release
 *    signature is an inline `data:` URL (`holdpoints/actionRoutes.ts:313`) and
 *    the freeze deliberately stored a pointer rather than a second copy of the
 *    bytes (`snapshot.ts:290`).
 */
export async function readMemberObject(
  locator: string,
  client: PrismaClientLike = prisma,
): Promise<Buffer> {
  const holdPointMatch = HOLD_POINT_LOCATOR.exec(locator);
  if (holdPointMatch) {
    return readHoldPointObject(holdPointMatch[1]!, holdPointMatch[2]!, client);
  }

  const supabasePath = getSupabaseStoragePath(locator, { bucket: DOCUMENTS_BUCKET });
  if (supabasePath) {
    if (!isSupabaseConfigured()) {
      throw new MemberObjectMissingError('Storage is not configured for this member');
    }
    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(supabasePath);
    if (error || !data) {
      throw new MemberObjectMissingError('The stored object could not be read');
    }
    return Buffer.from(await data.arrayBuffer());
  }

  let resolved: string;
  try {
    resolved = resolveUploadPath(locator);
  } catch {
    throw new MemberObjectMissingError('The stored locator is not a readable object reference');
  }
  if (!fs.existsSync(resolved)) {
    throw new MemberObjectMissingError('The stored object is missing');
  }
  return fs.promises.readFile(resolved);
}

async function readHoldPointObject(
  holdPointId: string,
  field: string,
  client: PrismaClientLike,
): Promise<Buffer> {
  const row = await client.holdPoint.findUnique({
    where: { id: holdPointId },
    select: { releaseSignatureUrl: true, evidencePackageUrl: true },
  });
  const value =
    field === 'releaseSignatureUrl' ? row?.releaseSignatureUrl : row?.evidencePackageUrl;
  if (!value) {
    throw new MemberObjectMissingError('The hold-point file pointer is no longer set');
  }

  if (value.startsWith('data:')) {
    const comma = value.indexOf(',');
    const meta = value.slice(0, comma);
    const payload = value.slice(comma + 1);
    if (comma < 0) throw new MemberObjectMissingError('The hold-point data URL is malformed');
    return Buffer.from(payload, meta.includes(';base64') ? 'base64' : 'utf8');
  }

  return readMemberObject(value, client);
}

/**
 * Every lot in the export's scope with its folio status, for the summary
 * (§4.7.2).
 *
 * Scope resolution REUSES `resolveScopeLots` — the same function the freeze
 * used — rather than re-deriving "which lots are in this area". Two definitions
 * that disagree would show up as a summary claiming a lot the archive does not
 * cover, which is exactly the silent-omission class `[DH-B1]` forbids.
 */
export async function readScopeLotFolioStatus(
  exportId: string,
  client: PrismaClientLike = prisma,
): Promise<Array<{ lotNumber: string; folio: 'issued' | 'none' }>> {
  const exportRow = await client.handoverExport.findUnique({
    where: { id: exportId },
    select: { projectId: true, scope: true },
  });
  if (!exportRow) throw AppError.notFound('Handover export');

  const lots = await resolveScopeLots(
    exportRow.projectId,
    exportRow.scope as unknown as HandoverExportScope,
    client,
  );

  // Matched on lot IDENTITY, not on the archive path's sanitized lot segment: a
  // lot number carrying a character the sanitizer replaces would otherwise
  // never match itself and every such lot would report `folio: none`.
  const folioMembers = await client.handoverExportMember.findMany({
    where: { exportId, sourceType: 'folio' },
    select: { sourceId: true },
  });
  const issues = folioMembers.length
    ? await client.folioIssue.findMany({
        where: { id: { in: folioMembers.map((member) => member.sourceId) } },
        select: { lotId: true },
      })
    : [];
  const lotIdsWithFolio = new Set(issues.map((issue) => issue.lotId));

  // `[DH-B2]` / **AT-126**: a lot with no issued folio is a FACT in the
  // manifest — `folio: none` — and contributes its originals only. The worker
  // renders nothing.
  return lots.map((lot) => ({
    lotNumber: lot.lotNumber,
    folio: lotIdsWithFolio.has(lot.id) ? ('issued' as const) : ('none' as const),
  }));
}
