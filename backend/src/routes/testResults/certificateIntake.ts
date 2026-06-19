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
import { buildTestResultData, suggestLotsFromLocation } from './testResultMapping.js';
import { MAX_UPLOAD_PROJECT_ID_LENGTH } from './validation.js';

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
      };
      extraction: {
        extractedFields: ExtractedCertificateFields;
        confidence: Record<string, number>;
        lowConfidenceFields: Array<{ field: string; confidence: number }>;
        needsReview: boolean;
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

      return tx.testResult.create({
        data: buildTestResultData(projectId, document.id, extractedData),
        include: {
          certificateDoc: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
            },
          },
        },
      });
    });
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

      const testResult = await prisma.$transaction(async (tx) => {
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

        return tx.testResult.create({
          data: buildTestResultData(projectId, document.id, extractedData),
          include: {
            certificateDoc: {
              select: {
                id: true,
                filename: true,
                mimeType: true,
              },
            },
          },
        });
      });

      // Identify low confidence fields
      const lowConfidenceFields = getLowConfidenceFields(confidenceObj);

      results.push({
        success: true,
        filename: displayFilename,
        testResult: {
          id: testResult.id,
          testType: testResult.testType,
          status: testResult.status,
          aiExtracted: testResult.aiExtracted,
          certificateDoc: buildCertificateDocumentResponse(testResult.certificateDoc),
        },
        extraction: {
          extractedFields: extractedData,
          confidence: confidenceObj,
          lowConfidenceFields,
          needsReview: lowConfidenceFields.length > 0,
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
