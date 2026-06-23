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

/**
 * Extract a chainage in metres from a free-text location string.
 *
 * AU chainage convention (M46): "CH N+M" means M whole metres past station N,
 * so `CH 1234+50` is 1284 m — NOT 1234.50. A "." separator is a plain decimal
 * (`1234.50` -> 1234.5), matching how lot chainages are stored. The earlier
 * `/100` offset conflated the two and was also wrong for single-digit decimals.
 */
export function parseChainageFromLocation(locationString: string): number | null {
  // "CH N+M" / "N+M": station plus a whole-metre offset.
  const plusMatch = locationString.match(/(?:CH\s*)?(\d+)\+(\d+)/i);
  if (plusMatch) {
    return parseFloat(plusMatch[1]!) + parseFloat(plusMatch[2]!);
  }
  // "CH N.M" / "N.M": decimal metres (could also be coordinates without CH).
  const decimalMatch = locationString.match(/(?:CH\s*)?(\d+)\.(\d+)/i);
  if (decimalMatch) {
    return parseFloat(`${decimalMatch[1]}.${decimalMatch[2]}`);
  }
  // "CH N" / "chainage N": whole metres.
  const wholeMatch = locationString.match(/(?:CH|chainage)\s*(\d+)/i);
  if (wholeMatch) {
    return parseFloat(wholeMatch[1]!);
  }
  return null;
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
  const extractedChainage = parseChainageFromLocation(locationString);

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
