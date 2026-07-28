import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  type ExtractedCertificateFields,
  LOW_CONFIDENCE_THRESHOLD,
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

// Review M6: the states a row sits in while it waits for its certificate to come
// back from the laboratory. `results_received` is deliberately absent — a row
// there has already had a certificate land on it.
const CERTIFICATE_LANDING_STATUSES = ['requested', 'at_lab'];

/**
 * Review M6: find the planned test an incoming certificate belongs to, or null.
 *
 * The AI intake routes used to create a row unconditionally, so a test that was
 * planned and sent to the lab gained a SECOND row when its certificate arrived
 * — the planned one pending forever, and one extra countable test per
 * certificate on a lot with a resolved pack. #1634 fixed this for the
 * register-row action ("Read with AI" attaches to the row a human picked); this
 * is the same landing for the two routes where nobody picked a row.
 *
 * Nobody picked a row, so the match has to be earned, and a wrong match on an
 * evidence surface is worse than a duplicate. All of these must hold:
 *
 *  - same project, and the row is still WAITING (`requested` / `at_lab`);
 *  - the row holds no certificate — a stored certificate is never displaced;
 *  - the certificate's test type matches the row's exactly (case aside);
 *  - the AI actually READ that test type, at the same confidence bar the review
 *    UI uses. Without a key (or on any failure) `extractCertificateFields`
 *    degrades to a filename guess at 0.45, and guessing which planned test a
 *    file belongs to from its NAME is precisely the wrong-match hazard;
 *  - exactly ONE row qualifies. Two planned Field Density tests at different
 *    chainages are indistinguishable from here, so we refuse and fall back to
 *    creating a row, which is the shipped behaviour.
 *
 * ponytail: test type + uniqueness only. Sample date is the obvious next
 * discriminator if real projects turn out to plan several same-type tests at
 * once often enough for the refusal to be felt.
 */
export async function findWaitingTestResultForCertificate(
  tx: Prisma.TransactionClient,
  projectId: string,
  extractedData: ExtractedCertificateFields,
): Promise<{ id: string } | null> {
  const testType = extractedData.testType.value.trim();

  if (!testType || extractedData.testType.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return null;
  }

  // `take: 2` is all ambiguity detection needs: one row lands, two or more
  // refuse.
  const candidates = await tx.testResult.findMany({
    where: {
      projectId,
      status: { in: CERTIFICATE_LANDING_STATUSES },
      certificateDocId: null,
      testType: { equals: testType, mode: 'insensitive' },
    },
    select: { id: true },
    take: 2,
  });

  return candidates.length === 1 ? candidates[0]! : null;
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
