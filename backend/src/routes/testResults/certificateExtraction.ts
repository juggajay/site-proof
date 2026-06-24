import fs from 'fs';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';

export type ExtractedCertificateField = { value: string; confidence: number };
export type ExtractedCertificateFieldName =
  | 'testType'
  | 'laboratoryName'
  | 'laboratoryReportNumber'
  | 'sampleDate'
  | 'testDate'
  | 'resultValue'
  | 'resultUnit'
  | 'specificationMin'
  | 'specificationMax'
  | 'sampleLocation';
export type ExtractedCertificateFields = Record<
  ExtractedCertificateFieldName,
  ExtractedCertificateField
>;

const CERTIFICATE_FIELD_NAMES: ExtractedCertificateFieldName[] = [
  'testType',
  'laboratoryName',
  'laboratoryReportNumber',
  'sampleDate',
  'testDate',
  'resultValue',
  'resultUnit',
  'specificationMin',
  'specificationMax',
  'sampleLocation',
];

const DATE_ONLY_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const LOW_CONFIDENCE_THRESHOLD = 0.8;

export function emptyCertificateExtraction(): ExtractedCertificateFields {
  return Object.fromEntries(
    CERTIFICATE_FIELD_NAMES.map((fieldName) => [fieldName, { value: '', confidence: 0 }]),
  ) as ExtractedCertificateFields;
}

function inferTestTypeFromFilename(filename: string): ExtractedCertificateField {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.includes('cbr')) return { value: 'CBR Test', confidence: 0.45 };
  if (lowerFilename.includes('grading') || lowerFilename.includes('sieve')) {
    return { value: 'Grading Analysis', confidence: 0.45 };
  }
  if (lowerFilename.includes('moisture')) return { value: 'Moisture Content', confidence: 0.45 };
  if (lowerFilename.includes('plasticity') || lowerFilename.includes('pi')) {
    return { value: 'Plasticity Index', confidence: 0.45 };
  }
  if (lowerFilename.includes('compaction') || lowerFilename.includes('density')) {
    return { value: 'Compaction Test', confidence: 0.45 };
  }

  return { value: 'Certificate Review Required', confidence: 0.15 };
}

function inferLocationFromFilename(filename: string): ExtractedCertificateField {
  const chainageMatch = filename.match(/(?:CH|chainage)?\s*(\d{2,5})[+_-](\d{1,3})/i);

  if (!chainageMatch) {
    return { value: '', confidence: 0 };
  }

  return {
    value: `CH ${chainageMatch[1]}+${chainageMatch[2].padStart(2, '0')}`,
    confidence: 0.4,
  };
}

export function createManualReviewExtraction(filename: string): ExtractedCertificateFields {
  const extraction = emptyCertificateExtraction();
  extraction.testType = inferTestTypeFromFilename(filename);
  extraction.sampleLocation = inferLocationFromFilename(filename);
  return extraction;
}

export function isAnthropicConfigured(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Boolean(
    apiKey &&
    apiKey !== 'sk-placeholder' &&
    !apiKey.toLowerCase().includes('placeholder') &&
    !apiKey.toLowerCase().includes('your-'),
  );
}

export function normalizeConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const normalized = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, Number(normalized.toFixed(2))));
}

export function normalizeExtractedFields(
  rawFields: unknown,
  filename: string,
): ExtractedCertificateFields {
  const normalized = createManualReviewExtraction(filename);
  const raw =
    rawFields && typeof rawFields === 'object' ? (rawFields as Record<string, unknown>) : {};

  for (const fieldName of CERTIFICATE_FIELD_NAMES) {
    const rawField = raw[fieldName];

    if (rawField && typeof rawField === 'object' && 'value' in rawField) {
      const fieldRecord = rawField as { value?: unknown; confidence?: unknown };
      normalized[fieldName] = {
        value:
          fieldRecord.value === null || fieldRecord.value === undefined
            ? ''
            : String(fieldRecord.value).trim(),
        confidence: normalizeConfidence(fieldRecord.confidence),
      };
    } else if (typeof rawField === 'string' || typeof rawField === 'number') {
      normalized[fieldName] = {
        value: String(rawField).trim(),
        confidence: 0.5,
      };
    }
  }

  return normalized;
}

export function extractJsonObject(text: string): unknown {
  const withoutCodeFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const start = withoutCodeFence.indexOf('{');
  const end = withoutCodeFence.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI extraction response did not contain a JSON object');
  }

  return JSON.parse(withoutCodeFence.slice(start, end + 1));
}

export function getCertificateContentBlock(file: Express.Multer.File) {
  // multer.memoryStorage exposes file.buffer; diskStorage exposes file.path.
  // Support both so this works regardless of which storage mode is active.
  const fileData = (file.buffer ? file.buffer : fs.readFileSync(file.path)).toString('base64');

  if (file.mimetype === 'application/pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: fileData,
      },
    };
  }

  const mediaType = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: fileData,
    },
  };
}

export async function extractCertificateFields(
  file: Express.Multer.File,
): Promise<ExtractedCertificateFields> {
  if (!isAnthropicConfigured()) {
    return createManualReviewExtraction(file.originalname);
  }

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:
          process.env.ANTHROPIC_TEST_CERT_MODEL ||
          process.env.ANTHROPIC_MODEL ||
          'claude-3-5-haiku-20241022',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              getCertificateContentBlock(file),
              {
                type: 'text',
                text: `Extract civil construction laboratory test certificate data.

Return ONLY valid JSON with these exact keys:
testType, laboratoryName, laboratoryReportNumber, sampleDate, testDate, resultValue, resultUnit, specificationMin, specificationMax, sampleLocation.

Each key must be an object with:
- value: string. Use an empty string when the field is not visible.
- confidence: number from 0 to 1.

Rules:
- Dates must be YYYY-MM-DD when present.
- Numeric fields must contain only the numeric value, without units.
- resultUnit should contain the unit, such as "% MDD", "%", "mm", or "MPa".
- sampleLocation should preserve chainage/offset wording when present.
- Do not infer values that are not visible in the certificate.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic extraction failed with status ${response.status}`);
    }

    const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const responseText = result.content?.find((block) => block.type === 'text')?.text || '';
    return normalizeExtractedFields(extractJsonObject(responseText), file.originalname);
  } catch (error) {
    logWarn('AI certificate extraction unavailable; falling back to manual review:', error);
    return createManualReviewExtraction(file.originalname);
  }
}

export function buildConfidenceObject(
  extractedData: ExtractedCertificateFields,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(extractedData).map(([field, data]) => [
      field,
      normalizeConfidence(data.confidence),
    ]),
  );
}

export function getLowConfidenceFields(
  confidenceObj: Record<string, number>,
): Array<{ field: string; confidence: number }> {
  return Object.entries(confidenceObj)
    .filter(([, confidence]) => confidence < LOW_CONFIDENCE_THRESHOLD)
    .map(([field, confidence]) => ({ field, confidence }));
}

function parseStrictDateOnlyMatch(dateOnly: RegExpExecArray): Date | null {
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseDateField(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const dateOnly = DATE_ONLY_INPUT_PATTERN.exec(trimmed);
  if (!dateOnly) {
    return null;
  }

  return parseStrictDateOnlyMatch(dateOnly);
}

export function parseNumberField(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withoutThousandsSeparators = trimmed.replace(/,/g, '');
  const directNumber = Number(withoutThousandsSeparators);

  if (Number.isFinite(directNumber)) {
    return directNumber;
  }

  const numericMatch = withoutThousandsSeparators.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) {
    return null;
  }

  const parsed = Number(numericMatch[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function derivePassFail(
  resultValue: number | null,
  specificationMin: number | null,
  specificationMax: number | null,
): 'pass' | 'fail' | 'pending' {
  if (resultValue === null || (specificationMin === null && specificationMax === null)) {
    return 'pending';
  }

  if (specificationMin !== null && resultValue < specificationMin) {
    return 'fail';
  }

  if (specificationMax !== null && resultValue > specificationMax) {
    return 'fail';
  }

  return 'pass';
}

/**
 * H13 server-side pass/fail backstop for the manual create path: recompute the
 * outcome from the value + acceptance criteria so a client-supplied pass/fail
 * cannot contradict the data. Falls back to the client's value only when the data
 * is undecidable (no value, or no spec bound), i.e. when derivePassFail returns
 * 'pending'.
 */
export function resolveEffectivePassFail(
  clientPassFail: string | undefined,
  resultValue: number | null,
  specificationMin: number | null,
  specificationMax: number | null,
): string | undefined {
  const computed = derivePassFail(resultValue, specificationMin, specificationMax);
  return computed === 'pending' ? clientPassFail : computed;
}
