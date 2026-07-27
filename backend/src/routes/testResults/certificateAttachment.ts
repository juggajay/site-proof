import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { logWarn } from '../../lib/serverLogger.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import {
  cleanupStoredCertificateUpload,
  cleanupUploadedCertificateFile,
  deleteStoredCertificateFile,
  sanitizeUploadFilename,
  shouldUploadCertificateToSupabase,
  uploadCertificateToSupabase,
} from './certificateStorage.js';
import { buildCertificateDocumentResponse } from './certificateDocumentResponse.js';
import {
  type ExtractedCertificateFields,
  buildConfidenceObject,
  extractCertificateFields,
  getLowConfidenceFields,
} from './certificateExtraction.js';

// The route handler owns the access-control policy (which roles may attach a
// certificate). It passes that check in as `authorize`, invoked at the exact
// point the inline cert-upload handler does — so the trust-boundary helpers stay
// in the route module while the cleanup-on-error sequencing lives here.
type AuthorizeAttach = (projectId: string) => Promise<void>;

const VERIFIED_ATTACH_CONFLICT_MESSAGE =
  'Verified test result certificates cannot be replaced. Reopen or create a corrected test result before changing evidence.';

// C2 Phase 1 [C2R-B6]: shaped exactly like the create path's `extraction` block
// (certificateIntake.ts) so the shipped review UI consumes it with no new
// component. This is the ONLY thing the extraction is used for on this route —
// nothing derived from it is written to the row.
function buildAttachmentExtractionResponse(extractedData: ExtractedCertificateFields) {
  const confidence = buildConfidenceObject(extractedData);
  const lowConfidenceFields = getLowConfidenceFields(confidence);

  return {
    success: true,
    extractedFields: extractedData,
    confidence,
    lowConfidenceFields,
    needsReview: lowConfidenceFields.length > 0,
    reviewMessage:
      lowConfidenceFields.length > 0
        ? `${lowConfidenceFields.length} field(s) need manual verification due to low AI confidence`
        : 'All fields extracted with high confidence',
  };
}

// The existing test result being modified. Mirrors the select the route runs:
// projectId (for scoping + authorization), plus the currently-linked certificate
// document so we can clean up the replaced object after the swap.
export interface ExistingTestResultForAttachment {
  projectId: string;
  status: string;
  certificateDocId: string | null;
  certificateDoc: { id: string; fileUrl: string } | null;
}

export interface CertificateAttachmentInput {
  testResultId: string;
  file: Express.Multer.File | undefined;
  userId: string;
  loadTestResult: (id: string) => Promise<ExistingTestResultForAttachment | null>;
  authorize: AuthorizeAttach;
  // C2 Phase 1: opt-in AI read of the attached certificate (`?extract=true`).
  // Default false — the shipped attach behaviour is unchanged unless asked for.
  extract?: boolean;
}

// Attaches (or replaces) a certificate on an EXISTING test result. Mirrors
// `processCertificateUpload` but operating on a row that already exists:
// validate → authorize → check file type → (optionally extract) → store → swap
// `certificateDocId` to a new Document, deleting the old Document row in the same
// transaction → best-effort remove the replaced Supabase object afterwards.
//
// Status, `aiExtracted` and every certificate-owned value field are intentionally
// left untouched — including on the `extract=true` path [C2R-B6]. Attaching a
// certificate to a manually-created test must keep it manual, while still making
// the verification gate satisfiable (the test can then move to 'verified'), and
// an extraction is only ever RETURNED for human review: the reviewed values reach
// the row through the shipped PATCH /:id/confirm-extraction and nowhere else.
export async function processCertificateAttachment({
  testResultId,
  file,
  userId,
  loadTestResult,
  authorize,
  extract = false,
}: CertificateAttachmentInput) {
  if (!file) {
    throw AppError.badRequest('No file uploaded');
  }

  let existing: ExistingTestResultForAttachment | null;
  try {
    existing = await loadTestResult(testResultId);
  } catch (error) {
    cleanupUploadedCertificateFile(file);
    throw error;
  }

  if (!existing) {
    cleanupUploadedCertificateFile(file);
    throw AppError.notFound('Test result');
  }

  const projectId = existing.projectId;

  try {
    await authorize(projectId);
  } catch (error) {
    // Delete uploaded file if permission denied
    cleanupUploadedCertificateFile(file);
    throw error;
  }

  if (existing.status === 'verified') {
    cleanupUploadedCertificateFile(file);
    throw AppError.conflict(VERIFIED_ATTACH_CONFLICT_MESSAGE, { status: existing.status });
  }

  try {
    assertUploadedFileMatchesDeclaredType(file);
  } catch (error) {
    cleanupUploadedCertificateFile(file);
    throw error;
  }

  // [C2R-A7] latency: extractCertificateFields carries the shared 120 s AI
  // timeout, so `extract=true` turns this route from a storage-time call into a
  // potentially two-minute one. It degrades rather than throws (empty fields when
  // the model or the key is unavailable), which the seeding filter treats as
  // "not read" rather than "blank".
  const extractedData = extract ? await extractCertificateFields(file) : null;

  const displayFilename = sanitizeUploadFilename(file.originalname);

  let fileUrl: string | null = null;
  try {
    if (shouldUploadCertificateToSupabase(file)) {
      const uploaded = await uploadCertificateToSupabase(file, projectId);
      fileUrl = uploaded.url;
    } else {
      fileUrl = `/uploads/certificates/${file.filename}`;
    }
  } catch (error) {
    cleanupUploadedCertificateFile(file);
    throw error;
  }

  // Capture the previously-linked certificate so we can clean it up after the
  // swap commits. The relation is `onDelete: SetNull`, but we repoint the test
  // to the NEW document first, so deleting the old Document row leaves this row
  // pointing at the replacement.
  const previousCertificateDoc = existing.certificateDoc;

  let testResult;
  try {
    testResult = await prisma.$transaction(async (tx) => {
      // [C2R-A6] Re-read the status inside the transaction. The pre-read guard
      // above still runs first so a verified row never costs an upload, but a
      // concurrent verify between that read and this commit would otherwise swap
      // the evidence under a verified result.
      const current = await tx.testResult.findUnique({
        where: { id: testResultId },
        select: { status: true },
      });

      if (!current) {
        throw AppError.notFound('Test result');
      }

      if (current.status === 'verified') {
        throw AppError.conflict(VERIFIED_ATTACH_CONFLICT_MESSAGE, { status: current.status });
      }

      const document = await tx.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename: displayFilename,
          fileUrl: fileUrl!,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedById: userId,
        },
      });

      const updated = await tx.testResult.update({
        where: { id: testResultId },
        data: { certificateDocId: document.id },
        select: {
          id: true,
          testType: true,
          status: true,
          certificateDoc: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
            },
          },
        },
      });

      if (previousCertificateDoc) {
        await tx.document.delete({ where: { id: previousCertificateDoc.id } });
      }

      return updated;
    });
  } catch (error) {
    await cleanupStoredCertificateUpload(fileUrl, file, projectId);
    throw error;
  }

  // Best-effort removal of the replaced object after the DB state is
  // committed. A failure here leaves an orphan storage object but the DB is the
  // source of truth (mirrors the DELETE handler in crudRoutes.ts).
  if (previousCertificateDoc?.fileUrl) {
    try {
      await deleteStoredCertificateFile(previousCertificateDoc.fileUrl, projectId);
    } catch (error) {
      logWarn('Failed to delete replaced test certificate file after attachment:', error);
    }
  }

  return {
    message: 'Certificate attached successfully',
    testResult: {
      id: testResult.id,
      testType: testResult.testType,
      status: testResult.status,
      certificateDoc: buildCertificateDocumentResponse(testResult.certificateDoc),
    },
    // Present only on `extract=true`. Returned for review, never persisted here.
    ...(extractedData ? { extraction: buildAttachmentExtractionResponse(extractedData) } : {}),
  };
}
