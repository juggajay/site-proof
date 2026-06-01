import { LOW_CONFIDENCE_THRESHOLD } from './certificateExtraction.js';

type CertificateDocumentSummary = {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string | null;
  uploadedAt: Date;
} | null;

type ExtractionFieldValue = string | number | Date | { toString(): string } | null;

type CertificateExtractionSource = {
  aiExtracted: boolean;
  aiConfidence: string | null;
  certificateDoc: CertificateDocumentSummary;
  testType: ExtractionFieldValue;
  laboratoryName: ExtractionFieldValue;
  laboratoryReportNumber: ExtractionFieldValue;
  sampleDate: ExtractionFieldValue;
  testDate: ExtractionFieldValue;
  sampleLocation: ExtractionFieldValue;
  resultValue: ExtractionFieldValue;
  resultUnit: ExtractionFieldValue;
  specificationMin: ExtractionFieldValue;
  specificationMax: ExtractionFieldValue;
};

type TestFieldStatus = {
  value: ExtractionFieldValue;
  confidence: number;
  status: string;
};

const MEDIUM_CONFIDENCE_THRESHOLD = 0.9;

const EXTRACTION_FIELDS = [
  'testType',
  'laboratoryName',
  'laboratoryReportNumber',
  'sampleDate',
  'testDate',
  'sampleLocation',
  'resultValue',
  'resultUnit',
  'specificationMin',
  'specificationMax',
] as const;

export function buildCertificateExtractionResponse(testResult: CertificateExtractionSource) {
  if (!testResult.aiExtracted) {
    return {
      extraction: {
        aiExtracted: false,
        message: 'This test result was not AI-extracted',
      },
    };
  }

  const confidence = (testResult.aiConfidence ? JSON.parse(testResult.aiConfidence) : {}) as Record<
    string,
    number
  >;
  const lowConfidenceThreshold = LOW_CONFIDENCE_THRESHOLD;
  const mediumConfidenceThreshold = MEDIUM_CONFIDENCE_THRESHOLD;

  const fieldStatus: Record<string, TestFieldStatus> = {};

  for (const key of EXTRACTION_FIELDS) {
    const conf = confidence[key] || 1.0;
    let status = 'high';
    if (conf < lowConfidenceThreshold) status = 'low';
    else if (conf < mediumConfidenceThreshold) status = 'medium';

    fieldStatus[key] = { value: testResult[key], confidence: conf, status };
  }

  const lowConfidenceFields = Object.entries(fieldStatus)
    .filter(([, field]) => field.status === 'low')
    .map(([field, data]) => ({ field, confidence: data.confidence }));

  return {
    extraction: {
      aiExtracted: true,
      certificateDoc: testResult.certificateDoc,
      fields: fieldStatus,
      lowConfidenceFields,
      needsReview: lowConfidenceFields.length > 0,
      thresholds: {
        low: lowConfidenceThreshold,
        medium: mediumConfidenceThreshold,
      },
    },
  };
}
