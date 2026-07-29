// Wave D `D1c.1` — scope resolution, member enumeration, and THE FREEZE
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.6.1, §4.5.4,
// §7.5, §7.7, §4.7.3, §4.7.6). **AT-130**, and the version-pinning half of
// **AT-127**.
//
// §4.6.1, which is the whole point of the phase: Rev 1's archive was
// "reproducible from immutable inputs" while selecting mutable, supersedable
// documents. So at freeze time every member row records the EXACT source id,
// its §7.7 revision token, its storage locator, its byte size where known, its
// checksum where known and its archive path. If a folio is reissued mid-archive
// the archive continues from these rows and records the cutoff. It never
// switches versions halfway through.
//
// ORDER OF OPERATIONS, and it is load-bearing for **AT-130**:
//
//   count → refuse if over the member limit
//         → enumerate → estimate → refuse if over the admission cap
//         → ONLY THEN write the export row and the ledger
//
// A refused request leaves NO export row, no ledger and no object. Counting
// before enumerating is not premature: hold-point signatures are inline
// `data:` URLs, so a scope 100× the cap would otherwise be materialised in
// memory purely to be told it is too big.

import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import {
  applyChainagePrefix,
  buildArchivePath,
  buildOrderKey,
  resolveArchivePathCollisions,
  type ExportMemberSourceType,
  type FilenameRule,
} from '../../lib/handover/exportArchivePaths.js';
import {
  assertAdmissible,
  assertMemberCountAdmissible,
  estimateExport,
  type PreflightEstimate,
} from '../../lib/handover/exportPreflight.js';
import {
  HOLD_POINT_DIGEST_FIELDS,
  pickDigestFields,
  revisionToken,
} from '../../lib/handover/revisionTokens.js';
import { prisma } from '../../lib/prisma.js';
import { sanitizeUploadFilename } from '../documents/fileHelpers.js';
import { countScopeMembers, resolveScopeLots, type ScopeLot } from './scope.js';
import type { HandoverExportScope } from './validation.js';

type PrismaClientLike = typeof prisma;

export interface FrozenMemberDraft {
  readonly sourceType: ExportMemberSourceType;
  readonly sourceId: string;
  readonly sourceRevision: string | null;
  readonly storageLocator: string;
  readonly archivePath: string;
  readonly byteSize: bigint | null;
  readonly sourceChecksum: string | null;
  readonly orderKey: string;
  /** Which §4.7.3 naming rule applied. `D1c.2`'s manifest records it per member. */
  readonly filenameRule: FilenameRule;
}

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

interface DocumentRow {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: Date;
  version: number;
}

function isPhoto(mimeType: string | null): boolean {
  return (mimeType ?? '').toLowerCase().startsWith('image/');
}

function documentMember(
  lot: ScopeLot,
  lotIndex: number,
  sourceType: ExportMemberSourceType,
  doc: DocumentRow,
): FrozenMemberDraft {
  // Sanitize, THEN prefix, THEN (later, once every member exists) resolve
  // collisions. §4.7.3 fixes this order and it is not interchangeable.
  const sanitized = sanitizeUploadFilename(doc.filename);
  const prefixed = applyChainagePrefix(sanitized, lot, isPhoto(doc.mimeType));

  return {
    sourceType,
    sourceId: doc.id,
    sourceRevision: revisionToken('document', { kind: 'version', version: doc.version }),
    storageLocator: doc.fileUrl,
    archivePath: buildArchivePath(lot.lotNumber, sourceType, prefixed.filename),
    byteSize: doc.fileSize === null ? null : BigInt(doc.fileSize),
    // `[DH-e]`: no checksum column on `Document`; `D1c.2` hashes at archive
    // time. A null here is "not yet known", not "no checksum".
    sourceChecksum: null,
    orderKey: buildOrderKey({
      lotIndex,
      lotNumber: lot.lotNumber,
      sourceType,
      uploadedAt: doc.uploadedAt,
      sourceId: doc.id,
    }),
    filenameRule: prefixed.rule,
  };
}

const DOCUMENT_SELECT = {
  id: true,
  filename: true,
  fileUrl: true,
  fileSize: true,
  mimeType: true,
  uploadedAt: true,
  version: true,
} as const;

type FolioRow = {
  id: string;
  lotId: string;
  version: number;
  fileUrl: string;
  fileSize: bigint;
  sha256: string;
  issuedAt: Date;
};

type HoldPointRow = {
  id: string;
  lotId: string;
  releasedAt: Date | null;
  releaseSignatureUrl: string | null;
  evidencePackageUrl: string | null;
};

/** The per-lot lookups every member builder needs, resolved once. */
interface LotContext {
  readonly byId: ReadonlyMap<string, ScopeLot>;
  readonly indexById: ReadonlyMap<string, number>;
}

/** Read every source table for the scope, in parallel. */
function readSources(lotIds: string[], client: PrismaClientLike) {
  return Promise.all([
    client.folioIssue.findMany({
      where: { lotId: { in: lotIds } },
      select: {
        id: true,
        lotId: true,
        version: true,
        fileUrl: true,
        fileSize: true,
        sha256: true,
        issuedAt: true,
      },
      // Descending, so the FIRST row per lot is the latest version.
      orderBy: [{ lotId: 'asc' }, { version: 'desc' }],
    }),
    client.document.findMany({
      where: { lotId: { in: lotIds }, isLatestVersion: true },
      select: { ...DOCUMENT_SELECT, lotId: true },
    }),
    client.iTPCompletionAttachment.findMany({
      where: { completion: { itpInstance: { lotId: { in: lotIds } } } },
      select: {
        completion: { select: { itpInstance: { select: { lotId: true } } } },
        document: { select: DOCUMENT_SELECT },
      },
    }),
    client.nCREvidence.findMany({
      where: { ncr: { ncrLots: { some: { lotId: { in: lotIds } } } } },
      select: {
        ncr: { select: { ncrLots: { select: { lotId: true } } } },
        document: { select: DOCUMENT_SELECT },
      },
    }),
    client.holdPoint.findMany({
      where: {
        lotId: { in: lotIds },
        OR: [{ releaseSignatureUrl: { not: null } }, { evidencePackageUrl: { not: null } }],
      },
      select: {
        id: true,
        lotId: true,
        status: true,
        releasedAt: true,
        releasedByName: true,
        releasedByOrg: true,
        releaseMethod: true,
        releaseSignatureUrl: true,
        evidencePackageUrl: true,
      },
    }),
  ]);
}

/**
 * The LATEST folio per lot, pinned by its `v:{n}` token (§4.6.1). A reissue
 * after the freeze produces version n+1 and the ledger still points at n.
 *
 * Rows arrive version-descending, so the first row seen per lot is the latest.
 */
function folioMembers(folioIssues: readonly FolioRow[], lots: LotContext): FrozenMemberDraft[] {
  const seen = new Set<string>();
  const drafts: FrozenMemberDraft[] = [];

  for (const folio of folioIssues) {
    const lot = lots.byId.get(folio.lotId);
    if (!lot || seen.has(folio.lotId)) continue;
    seen.add(folio.lotId);

    drafts.push({
      sourceType: 'folio',
      sourceId: folio.id,
      sourceRevision: revisionToken('folio_issue', { kind: 'version', version: folio.version }),
      storageLocator: folio.fileUrl,
      archivePath: buildArchivePath(
        lot.lotNumber,
        'folio',
        `folio-${sanitizeUploadFilename(lot.lotNumber)}-v${folio.version}.pdf`,
      ),
      byteSize: folio.fileSize,
      // The folio is the ONE member type that arrives with a checksum already
      // computed over the bytes the server produced (**AT-127**).
      sourceChecksum: folio.sha256,
      orderKey: buildOrderKey({
        lotIndex: lots.indexById.get(folio.lotId)!,
        lotNumber: lot.lotNumber,
        sourceType: 'folio',
        uploadedAt: folio.issuedAt,
        sourceId: folio.id,
      }),
      filenameRule: 'none',
    });
  }

  return drafts;
}

const HOLD_POINT_FILE_FIELDS = [
  ['holdpoint_signature', 'releaseSignatureUrl', 'release-signature', 'png'],
  ['holdpoint_evidence', 'evidencePackageUrl', 'evidence-package', 'bin'],
] as const;

/**
 * Hold-point file pointers — §4.5.4's UNMEASURED SET. Bare strings with no
 * stored size and no checksum, so `byteSize` is null and the preflight
 * estimates them at a declared ceiling rather than pretending to a number.
 */
function holdPointMembers(
  holdPoints: readonly HoldPointRow[],
  lots: LotContext,
): FrozenMemberDraft[] {
  const drafts: FrozenMemberDraft[] = [];

  for (const holdPoint of holdPoints) {
    const lot = lots.byId.get(holdPoint.lotId);
    if (!lot) continue;

    // §7.7: `HoldPoint` has neither a version nor an `updatedAt`, so its token
    // is a canonical digest over the declared field list.
    const sourceRevision = revisionToken('hold_point', {
      kind: 'row_digest',
      fields: pickDigestFields(
        holdPoint as unknown as Record<string, unknown>,
        HOLD_POINT_DIGEST_FIELDS,
      ),
    });

    for (const [sourceType, field, stem, extension] of HOLD_POINT_FILE_FIELDS) {
      if (!holdPoint[field]) continue;
      drafts.push({
        sourceType,
        sourceId: holdPoint.id,
        sourceRevision,
        // NOT the value itself. A release signature is an inline `data:` URL
        // (`holdpoints/actionRoutes.ts:313`), so copying it into the ledger
        // would store the bytes twice and blow the row size out for nothing.
        // The locator names the row and the field; `D1c.2` re-reads it, and the
        // frozen digest above is what proves it did not change underneath.
        storageLocator: `holdpoint://${holdPoint.id}/${field}`,
        archivePath: buildArchivePath(
          lot.lotNumber,
          sourceType,
          `${stem}-${holdPoint.id}.${extension}`,
        ),
        byteSize: null,
        sourceChecksum: null,
        orderKey: buildOrderKey({
          lotIndex: lots.indexById.get(holdPoint.lotId)!,
          lotNumber: lot.lotNumber,
          sourceType,
          uploadedAt: holdPoint.releasedAt,
          sourceId: holdPoint.id,
        }),
        filenameRule: 'none',
      });
    }
  }

  return drafts;
}

/**
 * Every member of the archive, frozen, in deterministic order with collisions
 * resolved.
 *
 * DEDUPLICATION: one file appears ONCE per lot. A document that is both a lot
 * document and an ITP attachment is frozen under the most specific source type
 * that claims it, in the {@link EXPORT_CATEGORY_ORDER} order — folio, ITP,
 * hold point, NCR, then plain document. Without this the same bytes would be
 * written twice under two folders and the second copy would pick up a ` (2)`
 * suffix, which reads to the receiving engineer as a second, different photo.
 */
export async function enumerateMembers(
  lots: readonly ScopeLot[],
  client: PrismaClientLike = prisma,
): Promise<FrozenMemberDraft[]> {
  if (lots.length === 0) return [];

  const context: LotContext = {
    byId: new Map(lots.map((lot) => [lot.id, lot])),
    indexById: new Map(lots.map((lot, index) => [lot.id, index])),
  };

  const [folioIssues, documents, itpAttachments, ncrEvidence, holdPoints] = await readSources(
    lots.map((lot) => lot.id),
    client,
  );

  const drafts: FrozenMemberDraft[] = folioMembers(folioIssues, context);

  // `{lotId}:{documentId}` — the dedup key. Per LOT, not per export: the same
  // NCR photo genuinely belongs in two lots' folders when the NCR spans both.
  const claimed = new Set<string>();
  const pushDocument = (lotId: string, sourceType: ExportMemberSourceType, doc: DocumentRow) => {
    const lot = context.byId.get(lotId);
    const key = `${lotId}:${doc.id}`;
    if (!lot || claimed.has(key)) return;
    claimed.add(key);
    drafts.push(documentMember(lot, context.indexById.get(lotId)!, sourceType, doc));
  };

  // ITP attachments, then NCR evidence, then plain lot documents — in the
  // declared category order, so the dedup resolves to the most specific claim.
  for (const attachment of itpAttachments) {
    pushDocument(attachment.completion.itpInstance.lotId, 'itp_attachment', attachment.document);
  }
  for (const evidence of ncrEvidence) {
    for (const link of evidence.ncr.ncrLots) {
      pushDocument(link.lotId, 'ncr_evidence', evidence.document);
    }
  }
  for (const doc of documents) {
    if (doc.lotId) pushDocument(doc.lotId, 'document', doc);
  }

  drafts.push(...holdPointMembers(holdPoints, context));

  drafts.sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));
  return resolveArchivePathCollisions(drafts);
}

// ---------------------------------------------------------------------------
// The freeze
// ---------------------------------------------------------------------------

export interface FrozenExport {
  readonly exportId: string;
  readonly estimate: PreflightEstimate;
  readonly lotCount: number;
  readonly snapshotCutoffAt: Date;
}

/**
 * Preflight and freeze, in that order, with the refusal ahead of every write.
 *
 * The export row and its ledger land in ONE transaction: an export row with a
 * half-written ledger would be a job that silently archives less than it was
 * asked to, and `UNIQUE (export_id, archive_path)` means a collision bug fails
 * the insert rather than overwriting an entry.
 */
export async function createFrozenExport(params: {
  projectId: string;
  scope: HandoverExportScope;
  requestedById: string;
  now?: Date;
  client?: PrismaClientLike;
}): Promise<FrozenExport> {
  const client = params.client ?? prisma;
  const now = params.now ?? new Date();

  const lots = await resolveScopeLots(params.projectId, params.scope, client);
  if (lots.length === 0) {
    throw AppError.badRequest('This scope selects no lots, so there is nothing to export.');
  }

  // Refuse on the cheap upper bound BEFORE anything is read into memory. Same
  // message, same code as the post-enumeration check — one function, so the two
  // paths cannot drift apart.
  const upperBound = await countScopeMembers(
    lots.map((lot) => lot.id),
    client,
  );
  assertMemberCountAdmissible(upperBound, params.scope.kind, { countIsUpperBound: true });

  const members = await enumerateMembers(lots, client);
  const estimate = estimateExport(members);
  assertAdmissible(estimate, params.scope.kind);

  const exportRow = await client.$transaction(async (tx) => {
    const created = await tx.handoverExport.create({
      data: {
        projectId: params.projectId,
        scope: params.scope as unknown as Prisma.InputJsonValue,
        status: 'queued',
        requestedById: params.requestedById,
        requestedAt: now,
        snapshotCutoffAt: now,
        totalMembers: members.length,
        totalBytes: estimate.estimatedInputBytes,
      },
      select: { id: true },
    });

    await tx.handoverExportMember.createMany({
      data: members.map((member) => ({
        exportId: created.id,
        sourceType: member.sourceType,
        sourceId: member.sourceId,
        sourceRevision: member.sourceRevision,
        storageLocator: member.storageLocator,
        archivePath: member.archivePath,
        byteSize: member.byteSize,
        sourceChecksum: member.sourceChecksum,
        state: 'pending',
        orderKey: member.orderKey,
      })),
    });

    return created;
  });

  return {
    exportId: exportRow.id,
    estimate,
    lotCount: lots.length,
    snapshotCutoffAt: now,
  };
}
