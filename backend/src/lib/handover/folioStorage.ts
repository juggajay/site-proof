// Wave D `D1b` — folio object storage: the path, the write, and the read-back
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.4.2 step 2,
// §10.2, §10.3; threat model T-5, T-7). **AT-125**, **AT-142**, **AT-155**.
//
// TWO PROPERTIES THIS FILE EXISTS FOR, and neither is available by reusing
// `storeScheduledReportArtifact` unmodified:
//
//  1. **It fails CLOSED (T-7).** The shipped writer branches
//     `if (isSupabaseConfigured())` and falls THROUGH to local Railway disk
//     (`artifacts.ts:257`) with no production check. `CLAUDE.md:266` — those
//     files vanish on the next redeploy. §10.3: "a folio silently written to
//     ephemeral disk is worse than no folio: it is a legal record that reports
//     success and then disappears." A boot-time check
//     (`runtimeConfig.ts:184`) proves the credentials existed when the process
//     started, not that the object landed. So in production this refuses, and
//     an upload FAILURE is a refusal too — not only an unconfigured client.
//     The scheduled-report writer keeps its fall-through deliberately (threat
//     model §7): scheduled reports are regenerable, folios are not.
//
//  2. **It cannot escape or clobber (T-5).** All three path segments go through
//     the SHARED `assertSafeStorageId` — imported, never re-derived, because a
//     second regex is a second regex to get wrong — and the write is
//     `upsert: false` / `flag: 'wx'`. A folio row is append-only by trigger;
//     an overwritable object would leave the row immutable and the BYTES
//     replaceable, which is the worse half of the pair.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { AppError, ErrorCodes } from '../AppError.js';
import { assertSafeStorageId } from '../scheduledReports/artifacts.js';
import { logError } from '../serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStoragePath,
  getSupabaseStorageReference,
  isSupabaseConfigured,
} from '../supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../uploadPaths.js';

const FOLIO_STORAGE_ROOT = 'folios';
const FOLIO_MIME_TYPE = 'application/pdf';

export interface StoredFolioArtifact {
  readonly fileUrl: string;
  readonly sha256: string;
  readonly fileSize: number;
}

/** `folios/{projectId}/{lotId}/{folioIssueId}.pdf` — built in ONE place (T-5). */
export function getFolioStoragePath(
  projectId: string,
  lotId: string,
  folioIssueId: string,
): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(lotId, 'lotId');
  assertSafeStorageId(folioIssueId, 'folioIssueId');
  return `${FOLIO_STORAGE_ROOT}/${projectId}/${lotId}/${folioIssueId}.pdf`;
}

export function calculateFolioSha256(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
}

/**
 * The fail-closed decision, as a pure predicate so **AT-142** can assert it
 * without standing up a production process.
 *
 * Read at CALL time, not module load: `isSupabaseConfigured()` is frozen at
 * import (`supabase.ts:23-35`) and reports configuration, never reachability.
 */
export function assertDurableFolioStorage(options: {
  supabaseConfigured: boolean;
  nodeEnv: string | undefined;
}): void {
  if (options.supabaseConfigured) return;
  if (options.nodeEnv !== 'production') return;
  throw new AppError(
    503,
    'Durable file storage is not available, so this folio was not issued. ' +
      'A folio is a legal record and CIVOS will not write one to storage that does not survive a redeploy.',
    ErrorCodes.UPLOAD_FAILED,
  );
}

function localFolioFileUrl(projectId: string, lotId: string, folioIssueId: string): string {
  return `uploads/${getFolioStoragePath(projectId, lotId, folioIssueId)}`;
}

/**
 * Write the bytes, ONCE. Never overwrites: a `folio_issues` row exists only
 * once this resolves (§4.4.2, **AT-146**), so a second write for the same id is
 * a bug, not an idempotent retry — the reservation is what a retry re-uses, and
 * a failed issuance simply retires its version.
 */
export async function storeFolioArtifact(params: {
  projectId: string;
  lotId: string;
  folioIssueId: string;
  pdfBuffer: Buffer;
}): Promise<StoredFolioArtifact> {
  const storagePath = getFolioStoragePath(params.projectId, params.lotId, params.folioIssueId);
  const supabaseConfigured = isSupabaseConfigured();
  assertDurableFolioStorage({ supabaseConfigured, nodeEnv: process.env.NODE_ENV });

  const metadata = {
    sha256: calculateFolioSha256(params.pdfBuffer),
    fileSize: params.pdfBuffer.length,
  };

  if (supabaseConfigured) {
    const { error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .upload(storagePath, params.pdfBuffer, {
        contentType: FOLIO_MIME_TYPE,
        upsert: false,
      });

    if (error) {
      // No existing-object read-back and no fall-through. An upload failure is
      // a refusal (T-7); the caller has written no `FolioIssue` row yet, so the
      // safe end state is "expired reservation, no row".
      logError('[Folio] Artifact upload failed:', error);
      throw new AppError(
        503,
        'The folio could not be written to durable storage and was not issued. Please try again.',
        ErrorCodes.UPLOAD_FAILED,
      );
    }

    return {
      ...metadata,
      fileUrl: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
    };
  }

  // Development and test only — `assertDurableFolioStorage` refused already if
  // this process were production.
  const directory = await ensureUploadSubdirectoryAsync(
    `${FOLIO_STORAGE_ROOT}/${params.projectId}/${params.lotId}`,
  );
  await fs.promises.writeFile(
    path.join(directory, `${params.folioIssueId}.pdf`),
    params.pdfBuffer,
    {
      flag: 'wx',
    },
  );

  return {
    ...metadata,
    fileUrl: localFolioFileUrl(params.projectId, params.lotId, params.folioIssueId),
  };
}

/**
 * Read the bytes back and VERIFY them against the row's `sha256` (**AT-125**).
 *
 * An object mutated out of band errors rather than serving: the folio's whole
 * claim is that its bytes are the ones the server produced, and serving
 * unverified bytes under an issued folio's identity would make that claim false
 * exactly when it matters.
 */
export async function loadFolioArtifactBuffer(issue: {
  id: string;
  projectId: string;
  lotId: string;
  fileUrl: string;
  sha256: string;
}): Promise<Buffer> {
  const expectedPath = getFolioStoragePath(issue.projectId, issue.lotId, issue.id);
  const buffer = await readFolioObject(issue, expectedPath);

  if (calculateFolioSha256(buffer) !== issue.sha256) {
    logError('[Folio] Stored artifact failed checksum verification', { folioIssueId: issue.id });
    throw new AppError(
      500,
      'The stored folio does not match its recorded checksum and was not served.',
      ErrorCodes.INTERNAL_ERROR,
    );
  }

  return buffer;
}

async function readFolioObject(
  issue: { fileUrl: string; projectId: string; lotId: string },
  expectedPath: string,
): Promise<Buffer> {
  const supabasePath = getSupabaseStoragePath(issue.fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: `${FOLIO_STORAGE_ROOT}/${issue.projectId}/${issue.lotId}/`,
  });

  if (supabasePath) {
    // Ownership is checked at the STORAGE PATH level (§10.2): the path is
    // recomputed from the row's own ids, so a tampered `fileUrl` cannot point
    // the download at another project's object.
    if (supabasePath !== expectedPath || !isSupabaseConfigured()) {
      throw AppError.notFound('Folio');
    }
    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(supabasePath);
    if (error || !data) {
      throw AppError.notFound('Folio');
    }
    return Buffer.from(await data.arrayBuffer());
  }

  const resolved = resolveUploadPath(issue.fileUrl, FOLIO_STORAGE_ROOT);
  const expected = resolveUploadPath(`uploads/${expectedPath}`, FOLIO_STORAGE_ROOT);
  if (resolved !== expected || !fs.existsSync(resolved)) {
    throw AppError.notFound('Folio');
  }
  return fs.promises.readFile(resolved);
}
