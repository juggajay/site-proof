import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  type ExtractedCertificateFields,
  buildConfidenceObject,
  derivePassFail,
  parseDateField,
  parseNumberField,
} from './certificateExtraction.js';

const MAX_TEST_TEXT_LENGTH = 240;

function normalizeOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function toNullableString(
  value: unknown,
  fieldName = 'value',
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null {
  return normalizeOptionalString(value, fieldName, maxLength) ?? null;
}

export function buildTestResultData(
  projectId: string,
  documentId: string,
  extractedData: ExtractedCertificateFields,
): Prisma.TestResultUncheckedCreateInput {
  const confidenceObj = buildConfidenceObject(extractedData);
  const resultValue = parseNumberField(extractedData.resultValue.value);
  const specificationMin = parseNumberField(extractedData.specificationMin.value);
  const specificationMax = parseNumberField(extractedData.specificationMax.value);

  return {
    projectId,
    testType: extractedData.testType.value || 'Certificate Review Required',
    laboratoryName: toNullableString(extractedData.laboratoryName.value),
    laboratoryReportNumber: toNullableString(extractedData.laboratoryReportNumber.value),
    sampleDate: parseDateField(extractedData.sampleDate.value),
    testDate: parseDateField(extractedData.testDate.value),
    sampleLocation: toNullableString(extractedData.sampleLocation.value),
    resultValue,
    resultUnit: toNullableString(extractedData.resultUnit.value),
    specificationMin,
    specificationMax,
    passFail: derivePassFail(resultValue, specificationMin, specificationMax),
    certificateDocId: documentId,
    aiExtracted: true,
    aiConfidence: JSON.stringify(confidenceObj),
    status: 'results_received',
  };
}

// Feature #727: Parse chainage from location string and suggest matching lots.
export async function suggestLotsFromLocation(
  projectId: string,
  locationString: string,
): Promise<{
  suggestedLots: Array<{
    id: string;
    lotNumber: string;
    chainageStart: number;
    chainageEnd: number;
    matchScore: number;
  }>;
  extractedChainage: number | null;
}> {
  // Try to extract chainage from various formats: "CH 1234+50", "1234.50", "CH1234", etc.
  const chainagePatterns = [
    /CH\s*(\d+)\+(\d+)/i, // CH 1234+50 format
    /CH\s*(\d+)\.(\d+)/i, // CH 1234.50 format
    /(\d+)\+(\d+)/, // 1234+50 format
    /(\d+)\.(\d+)/, // 1234.50 format (could be chainage or coordinates)
    /CH\s*(\d+)/i, // CH 1234 format
    /chainage\s*(\d+)/i, // "chainage 1234"
  ];

  let extractedChainage: number | null = null;

  for (const pattern of chainagePatterns) {
    const match = locationString.match(pattern);
    if (match) {
      if (match[2]) {
        // Format with decimal/offset: 1234+50 means 1234.50
        extractedChainage = parseFloat(match[1]) + parseFloat(match[2]) / 100;
      } else {
        extractedChainage = parseFloat(match[1]);
      }
      break;
    }
  }

  if (extractedChainage === null) {
    return { suggestedLots: [], extractedChainage: null };
  }

  // Find lots in the project that match this chainage range
  const lots = await prisma.lot.findMany({
    where: {
      projectId,
      chainageStart: { not: null },
      chainageEnd: { not: null },
    },
    select: {
      id: true,
      lotNumber: true,
      chainageStart: true,
      chainageEnd: true,
    },
  });

  // Score each lot based on how well it matches the extracted chainage
  const scoredLots = lots
    .map((lot) => {
      const start = Number(lot.chainageStart);
      const end = Number(lot.chainageEnd);
      let matchScore = 0;

      if (extractedChainage! >= start && extractedChainage! <= end) {
        // Perfect match - chainage is within the lot's range
        matchScore = 100;
      } else {
        // Calculate proximity score
        const distanceToStart = Math.abs(extractedChainage! - start);
        const distanceToEnd = Math.abs(extractedChainage! - end);
        const minDistance = Math.min(distanceToStart, distanceToEnd);
        // Score decreases with distance (max 50m tolerance for 50 score)
        matchScore = Math.max(0, 50 - minDistance);
      }

      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        chainageStart: start,
        chainageEnd: end,
        matchScore,
      };
    })
    .filter((lot) => lot.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5); // Top 5 suggestions

  return { suggestedLots: scoredLots, extractedChainage };
}
