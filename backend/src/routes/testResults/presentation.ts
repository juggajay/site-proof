import type { Prisma } from '@prisma/client';
import { LOW_CONFIDENCE_THRESHOLD } from './certificateExtraction.js';
import {
  buildCertificateDocumentResponse,
  type CertificateDocumentResponseSource,
} from './certificateDocumentResponse.js';
import { testTypeSpecifications } from './specifications.js';

export { escapeHtml } from './presentationHtml.js';
export {
  buildTestRequestFormMetadata,
  renderTestRequestFormHtml,
  type RequestFormSource,
} from './requestFormPresentation.js';

/**
 * Pure presentation builders for the test-result request-form and
 * verification-view routes, extracted verbatim from
 * backend/src/routes/testResults.ts (testResults refactor map, PR-C).
 *
 * These functions own only string/object construction — no auth, DB access,
 * status codes, or res.send/res.json. The route handlers still fetch the data,
 * enforce access, and own the HTTP response; they just delegate rendering here.
 * Output (HTML text, escaping, and JSON shape) is byte-for-byte identical to the
 * previous inline implementation.
 */

type DecimalLike = Prisma.Decimal | number | string | null;

export interface VerificationViewSource {
  id: string;
  testType: string;
  testRequestNumber: string | null;
  laboratoryName: string | null;
  laboratoryReportNumber: string | null;
  sampleDate: Date | null;
  sampleLocation: string | null;
  testDate: Date | null;
  resultDate: Date | null;
  resultValue: DecimalLike;
  resultUnit: string | null;
  specificationMin: DecimalLike;
  specificationMax: DecimalLike;
  passFail: string;
  status: string;
  aiExtracted: boolean;
  aiConfidence: string | null;
  enteredAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    specificationSet: string | null;
  };
  lot: {
    id: string;
    lotNumber: string;
    description: string | null;
    activityType: string;
    chainageStart: DecimalLike;
    chainageEnd: DecimalLike;
    layer: string | null;
  } | null;
  enteredBy: { id: string; fullName: string | null; email: string } | null;
  verifiedBy: { id: string; fullName: string | null; email: string } | null;
  certificateDoc: CertificateDocumentResponseSource;
}

export function buildVerificationViewData(
  testResult: VerificationViewSource,
  { canVerify }: { canVerify: boolean },
) {
  // Determine if result passes or fails specification
  let specificationStatus = 'unknown';
  if (testResult.resultValue !== null) {
    const value = Number(testResult.resultValue);
    const min = testResult.specificationMin !== null ? Number(testResult.specificationMin) : null;
    const max = testResult.specificationMax !== null ? Number(testResult.specificationMax) : null;

    if (min !== null && max !== null) {
      specificationStatus = value >= min && value <= max ? 'pass' : 'fail';
    } else if (min !== null) {
      specificationStatus = value >= min ? 'pass' : 'fail';
    } else if (max !== null) {
      specificationStatus = value <= max ? 'pass' : 'fail';
    }
  }

  // Get specification reference for this test type if available
  const normalizedType = testResult.testType.toLowerCase().replace(/\s+/g, '_');
  const standardSpec = testTypeSpecifications[normalizedType];

  // Format the response for side-by-side view
  return {
    // Left side: Document/Certificate info
    document: testResult.certificateDoc
      ? {
          ...buildCertificateDocumentResponse(testResult.certificateDoc),
          isPdf: testResult.certificateDoc.mimeType === 'application/pdf',
        }
      : null,

    // Right side: Extracted/Entered data
    extractedData: {
      testType: testResult.testType,
      testRequestNumber: testResult.testRequestNumber,
      laboratoryName: testResult.laboratoryName,
      laboratoryReportNumber: testResult.laboratoryReportNumber,
      sampleDate: testResult.sampleDate,
      sampleLocation: testResult.sampleLocation,
      testDate: testResult.testDate,
      resultDate: testResult.resultDate,
      resultValue: testResult.resultValue,
      resultUnit: testResult.resultUnit,
      aiExtracted: testResult.aiExtracted,
      aiConfidence: testResult.aiConfidence ? JSON.parse(testResult.aiConfidence as string) : null,
    },

    // Confidence highlighting for AI-extracted fields
    confidenceHighlights: (() => {
      if (!testResult.aiExtracted || !testResult.aiConfidence) {
        return { hasLowConfidence: false, lowConfidenceFields: [], fieldStatus: {} };
      }

      const confidence = JSON.parse(testResult.aiConfidence as string);
      const MEDIUM_CONFIDENCE_THRESHOLD = 0.9; // Fields below 90% get warning

      const fieldStatus: Record<
        string,
        { confidence: number; status: 'high' | 'medium' | 'low'; needsReview: boolean }
      > = {};
      const lowConfidenceFields: string[] = [];

      for (const [field, conf] of Object.entries(confidence)) {
        const confValue = conf as number;
        let status: 'high' | 'medium' | 'low' = 'high';
        let needsReview = false;

        if (confValue < LOW_CONFIDENCE_THRESHOLD) {
          status = 'low';
          needsReview = true;
          lowConfidenceFields.push(field);
        } else if (confValue < MEDIUM_CONFIDENCE_THRESHOLD) {
          status = 'medium';
          needsReview = false;
        }

        fieldStatus[field] = { confidence: confValue, status, needsReview };
      }

      return {
        hasLowConfidence: lowConfidenceFields.length > 0,
        lowConfidenceFields,
        fieldStatus,
        thresholds: {
          low: LOW_CONFIDENCE_THRESHOLD,
          medium: MEDIUM_CONFIDENCE_THRESHOLD,
        },
        reviewMessage:
          lowConfidenceFields.length > 0
            ? `${lowConfidenceFields.length} field(s) have low AI confidence and require manual verification: ${lowConfidenceFields.join(', ')}`
            : 'All AI-extracted fields have acceptable confidence levels',
      };
    })(),

    // Specification comparison
    specification: {
      min: testResult.specificationMin,
      max: testResult.specificationMax,
      unit: testResult.resultUnit,
      currentStatus: testResult.passFail,
      calculatedStatus: specificationStatus,
      standardReference: standardSpec?.specReference || null,
    },

    // Metadata
    metadata: {
      id: testResult.id,
      status: testResult.status,
      project: testResult.project,
      lot: testResult.lot,
      enteredBy: testResult.enteredBy,
      enteredAt: testResult.enteredAt,
      verifiedBy: testResult.verifiedBy,
      verifiedAt: testResult.verifiedAt,
      createdAt: testResult.createdAt,
      updatedAt: testResult.updatedAt,
    },

    // User permissions
    canVerify,
    needsVerification: testResult.status !== 'verified',
  };
}

export function buildTestRequestFormResponse<TMetadata>(testRequestForm: TMetadata) {
  return { testRequestForm };
}

export function buildVerificationViewResponse<TVerificationView>(
  verificationView: TVerificationView,
) {
  return { verificationView };
}
