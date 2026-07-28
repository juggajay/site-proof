import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import {
  cleanupStoredCertificateUpload,
  cleanupUploadedCertificateFile,
  sanitizeUploadFilename,
  shouldUploadCertificateToSupabase,
  uploadCertificateToSupabase,
} from './certificateStorage.js';
import {
  type ExtractedCertificateFields,
  buildConfidenceObject,
  extractCertificateFields,
  getLowConfidenceFields,
} from './certificateExtraction.js';
import { buildCertificateDocumentResponse } from './certificateDocumentResponse.js';
import {
  buildTestResultData,
  findWaitingTestResultForCertificate,
  suggestLotsFromLocation,
} from './testResultMapping.js';
import { MAX_UPLOAD_PROJECT_ID_LENGTH } from './validation.js';

const CERTIFICATE_DOC_INCLUDE = {
  certificateDoc: {
    select: {
      id: true,
      filename: true,
      mimeType: true,
    },
  },
} as const;

/**
 * Review M6: attach this certificate to the planned test that was waiting for
 * it, or create a row when nothing unambiguously matches.
 *
 * Landing writes exactly two facts, both true the moment the file arrives: the
 * certificate is attached, and the results have been received. It writes NO
 * extracted VALUE onto a row a human already owns — [C2R-B6], the rule #1634
 * shipped: reviewed values reach the row through PATCH /:id/confirm-extraction
 * and nowhere else. The create branch is untouched, so a certificate with no
 * waiting row behaves exactly as it always has.
 */
async function landOrCreateTestResult(
  tx: Prisma.TransactionClient,
  projectId: string,
  documentId: string,
  extractedData: ExtractedCertificateFields,
) {
  const waiting = await findWaitingTestResultForCertificate(tx, projectId, extractedData);

  if (waiting) {
    // ponytail: the `certificateDocId: null` filter re-checks inside the
    // transaction what the candidate query saw outside it, so a concurrent
    // attach cannot have its evidence overwritten. If it ever loses that race
    // the transaction rolls back, the upload is cleaned up, and a retry creates
    // a row — refusing beats swapping a certificate under a result.
    const landed = await tx.testResult.update({
      where: { id: waiting.id, certificateDocId: null },
      data: { certificateDocId: documentId, status: 'results_received' },
      include: CERTIFICATE_DOC_INCLUDE,
    });

    return { testResult: landed, landedOnExistingTest: true };
  }

  const created = await tx.testResult.create({
    data: buildTestResultData(projectId, documentId, extractedData),
    include: CERTIFICATE_DOC_INCLUDE,
  });

  return { testResult: created, landedOnExistingTest: false };
}

type BatchUploadResult =
  | {
      success: true;
      filename: string;
      testResult: {
        id: string;
        testType: string;
        status: string;
        aiExtracted: boolean;
        certificateDoc: {
          id: string;
          filename: string;
          mimeType: string | null;
        } | null;
        landedOnExistingTest: boolean;
      };
      extraction: {
        extractedFields: ExtractedCertificateFields;
        confidence: Record<string, number>;
        lowConfidenceFields: Array<{ field: string; confidence: number }>;
        needsReview: boolean;
      };
      lotSuggestion: {
        extractedLocation: string;
        extractedChainage: number | null;
        suggestedLots: Array<{
          id: string;
          lotNumber: string;
          chainageStart: number;
          chainageEnd: number;
          matchScore: number;
        }>;
        hasSuggestion: boolean;
        message: string;
      };
    }
  | { success: false; filename: string; error: string };

// The route handler owns the access-control policy (which roles may upload). It
// passes that check in as `authorize`, and the intake service invokes it at the
// exact point the inline handler used to — so the trust-boundary helpers stay in
// the route module while the cleanup-on-error sequencing is preserved here.
type AuthorizeUpload = (projectId: string) => Promise<void>;

export interface CertificateUploadInput {
  file: Express.Multer.File | undefined;
  body: Record<string, unknown>;
  userId: string;
  authorize: AuthorizeUpload;
}

export interface BatchCertificateUploadInput {
  files: Express.Multer.File[] | undefined;
  body: Record<string, unknown>;
  userId: string;
  authorize: AuthorizeUpload;
}

export function cleanupUploadedCertificateFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    cleanupUploadedCertificateFile(file);
  }
}

export function getRequiredUploadProjectId(body: Record<string, unknown>): string {
  const projectId = body.projectId;

  if (typeof projectId !== 'string') {
    throw AppError.badRequest('projectId is required');
  }

  const trimmed = projectId.trim();
  if (!trimmed) {
    throw AppError.badRequest('projectId is required');
  }

  if (trimmed.length > MAX_UPLOAD_PROJECT_ID_LENGTH) {
    throw AppError.badRequest('projectId is too long');
  }

  return trimmed;
}

// Orchestrates a single certificate upload: validate → authorize → extract →
// store → persist, cleaning up the uploaded file on any failure along the way.
export async function processCertificateUpload({
  file,
  body,
  userId,
  authorize,
}: CertificateUploadInput) {
  if (!file) {
    throw AppError.badRequest('No file uploaded');
  }

  let projectId: string;
  try {
    projectId = getRequiredUploadProjectId(body);
  } catch (error) {
    cleanupUploadedCertificateFile(file);
    throw error;
  }

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

  const extractedData = await extractCertificateFields(file);
  const confidenceObj = buildConfidenceObject(extractedData);
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

  let testResult;
  let landedOnExistingTest: boolean;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
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

      return landOrCreateTestResult(tx, projectId, document.id, extractedData);
    });
    testResult = outcome.testResult;
    landedOnExistingTest = outcome.landedOnExistingTest;
  } catch (error) {
    await cleanupStoredCertificateUpload(fileUrl, file, projectId);
    throw error;
  }

  // Identify low confidence fields that need review
  const lowConfidenceFields = getLowConfidenceFields(confidenceObj);

  // Feature #727: Suggest lots based on extracted location
  const locationSuggestion = await suggestLotsFromLocation(
    projectId,
    extractedData.sampleLocation.value,
  );

  return {
    message: 'Certificate uploaded and processed successfully',
    testResult: {
      id: testResult.id,
      testType: testResult.testType,
      status: testResult.status,
      aiExtracted: testResult.aiExtracted,
      certificateDoc: buildCertificateDocumentResponse(testResult.certificateDoc),
      // Review M6: true when this certificate landed on a test a human had
      // already planned. The review form seeds differently for that row — its
      // stored values must survive a field the certificate did not speak to.
      landedOnExistingTest,
    },
    extraction: {
      success: true,
      extractedFields: extractedData,
      confidence: confidenceObj,
      lowConfidenceFields,
      needsReview: lowConfidenceFields.length > 0,
      reviewMessage:
        lowConfidenceFields.length > 0
          ? `${lowConfidenceFields.length} field(s) need manual verification due to low AI confidence`
          : 'All fields extracted with high confidence',
    },
    // Feature #727: Lot suggestion based on extracted location
    lotSuggestion: {
      extractedLocation: extractedData.sampleLocation.value,
      extractedChainage: locationSuggestion.extractedChainage,
      suggestedLots: locationSuggestion.suggestedLots,
      hasSuggestion: locationSuggestion.suggestedLots.length > 0,
      message:
        locationSuggestion.suggestedLots.length > 0
          ? `Found ${locationSuggestion.suggestedLots.length} lot(s) matching the extracted location`
          : 'No matching lots found for the extracted location',
    },
  };
}

// Orchestrates a batch upload: shared validation/authorization up front, then a
// best-effort per-file loop that records success/failure and cleans up the
// stored object when an individual file fails to process.
export async function processBatchCertificateUpload({
  files,
  body,
  userId,
  authorize,
}: BatchCertificateUploadInput) {
  if (!files || files.length === 0) {
    throw AppError.badRequest('No files uploaded');
  }

  let projectId: string;
  try {
    projectId = getRequiredUploadProjectId(body);
  } catch (error) {
    cleanupUploadedCertificateFiles(files);
    throw error;
  }

  try {
    await authorize(projectId);
  } catch (error) {
    // Delete uploaded files if permission denied
    cleanupUploadedCertificateFiles(files);
    throw error;
  }

  try {
    for (const file of files) {
      assertUploadedFileMatchesDeclaredType(file);
    }
  } catch (error) {
    cleanupUploadedCertificateFiles(files);
    throw error;
  }

  // Process each file
  const results: BatchUploadResult[] = [];

  for (const file of files) {
    let fileUrl: string | null = null;
    try {
      const extractedData = await extractCertificateFields(file);
      const confidenceObj = buildConfidenceObject(extractedData);
      const displayFilename = sanitizeUploadFilename(file.originalname);

      if (shouldUploadCertificateToSupabase(file)) {
        const uploaded = await uploadCertificateToSupabase(file, projectId);
        fileUrl = uploaded.url;
      } else {
        fileUrl = `/uploads/certificates/${file.filename}`;
      }

      const { testResult, landedOnExistingTest } = await prisma.$transaction(async (tx) => {
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

        return landOrCreateTestResult(tx, projectId, document.id, extractedData);
      });

      // Identify low confidence fields
      const lowConfidenceFields = getLowConfidenceFields(confidenceObj);
      const locationSuggestion = await suggestLotsFromLocation(
        projectId,
        extractedData.sampleLocation.value,
      );

      results.push({
        success: true,
        filename: displayFilename,
        testResult: {
          id: testResult.id,
          testType: testResult.testType,
          status: testResult.status,
          aiExtracted: testResult.aiExtracted,
          certificateDoc: buildCertificateDocumentResponse(testResult.certificateDoc),
          landedOnExistingTest,
        },
        extraction: {
          extractedFields: extractedData,
          confidence: confidenceObj,
          lowConfidenceFields,
          needsReview: lowConfidenceFields.length > 0,
        },
        lotSuggestion: {
          extractedLocation: extractedData.sampleLocation.value,
          extractedChainage: locationSuggestion.extractedChainage,
          suggestedLots: locationSuggestion.suggestedLots,
          hasSuggestion: locationSuggestion.suggestedLots.length > 0,
          message:
            locationSuggestion.suggestedLots.length > 0
              ? `Found ${locationSuggestion.suggestedLots.length} lot(s) matching the extracted location`
              : 'No matching lots found for the extracted location',
        },
      });
    } catch {
      await cleanupStoredCertificateUpload(fileUrl, file, projectId);
      results.push({
        success: false,
        filename: sanitizeUploadFilename(file.originalname),
        error: 'Failed to process file',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const needsReviewCount = results.filter((r) => r.success && r.extraction?.needsReview).length;

  return {
    message: `Processed ${successCount} of ${files.length} certificates`,
    summary: {
      total: files.length,
      success: successCount,
      failed: failCount,
      needsReview: needsReviewCount,
    },
    results,
  };
}
