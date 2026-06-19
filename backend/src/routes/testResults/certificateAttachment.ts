import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { logWarn } from '../../lib/serverLogger.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import {
  cleanupStoredCertificateUpload,
  cleanupUploadedCertificateFile,
  deleteCertificateFromSupabase,
  isOwnedSupabaseCertificateUrl,
  sanitizeUploadFilename,
  shouldUploadCertificateToSupabase,
  uploadCertificateToSupabase,
} from './certificateStorage.js';
import { buildCertificateDocumentResponse } from './certificateDocumentResponse.js';

// The route handler owns the access-control policy (which roles may attach a
// certificate). It passes that check in as `authorize`, invoked at the exact
// point the inline cert-upload handler does — so the trust-boundary helpers stay
// in the route module while the cleanup-on-error sequencing lives here.
type AuthorizeAttach = (projectId: string) => Promise<void>;

// The existing test result being modified. Mirrors the select the route runs:
// projectId (for scoping + authorization), plus the currently-linked certificate
// document so we can clean up the replaced object after the swap.
export interface ExistingTestResultForAttachment {
  projectId: string;
  certificateDocId: string | null;
  certificateDoc: { id: string; fileUrl: string } | null;
}

export interface CertificateAttachmentInput {
  testResultId: string;
  file: Express.Multer.File | undefined;
  userId: string;
  loadTestResult: (id: string) => Promise<ExistingTestResultForAttachment | null>;
  authorize: AuthorizeAttach;
}

// Attaches (or replaces) a certificate on an EXISTING test result. Mirrors
// `processCertificateUpload` but WITHOUT AI extraction and operating on a row
// that already exists: validate → authorize → check file type → store → swap
// `certificateDocId` to a new Document, deleting the old Document row in the same
// transaction → best-effort remove the replaced Supabase object afterwards.
//
// Status and `aiExtracted` are intentionally left untouched: attaching a
// certificate to a manually-created test must keep it manual, while still making
// the verification gate satisfiable (the test can then move to 'verified').
export async function processCertificateAttachment({
  testResultId,
  file,
  userId,
  loadTestResult,
  authorize,
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

  try {
    assertUploadedFileMatchesDeclaredType(file);
  } catch (error) {
    cleanupUploadedCertificateFile(file);
    throw error;
  }

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

  // Best-effort Supabase removal of the replaced object after the DB state is
  // committed. A failure here leaves an orphan storage object but the DB is the
  // source of truth (mirrors the DELETE handler in crudRoutes.ts).
  if (
    previousCertificateDoc?.fileUrl &&
    isOwnedSupabaseCertificateUrl(previousCertificateDoc.fileUrl, projectId)
  ) {
    try {
      await deleteCertificateFromSupabase(previousCertificateDoc.fileUrl, projectId);
    } catch (error) {
      logWarn(
        'Failed to delete replaced test certificate file from Supabase after attachment:',
        error,
      );
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
  };
}
