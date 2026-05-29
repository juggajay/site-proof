import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildConfidenceObject,
  createManualReviewExtraction,
  derivePassFail,
  extractCertificateFields,
  extractJsonObject,
  getLowConfidenceFields,
  normalizeConfidence,
  normalizeExtractedFields,
  parseDateField,
  parseNumberField,
} from './certificateExtraction.js';

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;
const ORIGINAL_ANTHROPIC_TEST_CERT_MODEL = process.env.ANTHROPIC_TEST_CERT_MODEL;

function restoreOptionalEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('certificateExtraction helpers', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_TEST_CERT_MODEL;
  });

  afterEach(() => {
    restoreOptionalEnv('ANTHROPIC_API_KEY', ORIGINAL_ANTHROPIC_API_KEY);
    restoreOptionalEnv('ANTHROPIC_MODEL', ORIGINAL_ANTHROPIC_MODEL);
    restoreOptionalEnv('ANTHROPIC_TEST_CERT_MODEL', ORIGINAL_ANTHROPIC_TEST_CERT_MODEL);
  });

  it('builds deterministic manual-review fields from certificate filenames', async () => {
    const file = {
      originalname: 'compaction CH 1234_5.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    const extraction = await extractCertificateFields(file);

    expect(extraction.testType).toEqual({ value: 'Compaction Test', confidence: 0.45 });
    expect(extraction.sampleLocation).toEqual({ value: 'CH 1234+05', confidence: 0.4 });
    expect(extraction.laboratoryName).toEqual({ value: '', confidence: 0 });
  });

  it('extracts JSON objects from fenced Anthropic responses', () => {
    expect(
      extractJsonObject(`
        \`\`\`json
        {"testType":{"value":"CBR","confidence":95}}
        \`\`\`
      `),
    ).toEqual({
      testType: {
        value: 'CBR',
        confidence: 95,
      },
    });
  });

  it('normalizes extracted fields and preserves filename fallbacks', () => {
    const fields = normalizeExtractedFields(
      {
        testType: { value: '  CBR  ', confidence: 95 },
        laboratoryName: 'Acme Lab',
        resultValue: { value: null, confidence: 'bad' },
      },
      'density CH 1000-25.pdf',
    );

    expect(fields.testType).toEqual({ value: 'CBR', confidence: 0.95 });
    expect(fields.laboratoryName).toEqual({ value: 'Acme Lab', confidence: 0.5 });
    expect(fields.resultValue).toEqual({ value: '', confidence: 0 });
    expect(fields.sampleLocation).toEqual({ value: 'CH 1000+25', confidence: 0.4 });
  });

  it('normalizes confidence and reports low-confidence fields', () => {
    expect(normalizeConfidence(80)).toBe(0.8);
    expect(normalizeConfidence('35')).toBe(0.35);
    expect(normalizeConfidence(-1)).toBe(0);
    expect(normalizeConfidence(170)).toBe(1);
    expect(normalizeConfidence('not-a-number')).toBe(0);

    const extraction = createManualReviewExtraction('certificate.pdf');
    extraction.testType = { value: 'CBR', confidence: 0.81 };
    extraction.laboratoryName = { value: 'Acme Lab', confidence: 0.79 };

    const confidence = buildConfidenceObject(extraction);

    expect(confidence.testType).toBe(0.81);
    expect(getLowConfidenceFields(confidence)).toContainEqual({
      field: 'laboratoryName',
      confidence: 0.79,
    });
  });

  it('parses extracted dates and numbers conservatively', () => {
    expect(parseDateField('2026-05-29')?.toISOString()).toBe('2026-05-29T00:00:00.000Z');
    expect(parseDateField('2026-02-31')).toBeNull();
    expect(parseDateField('29/05/2026')).toBeNull();

    expect(parseNumberField('1,234.5')).toBe(1234.5);
    expect(parseNumberField('95 % MDD')).toBe(95);
    expect(parseNumberField('')).toBeNull();
    expect(parseNumberField('no result')).toBeNull();
  });

  it('derives pass-fail state from extracted result and specification bounds', () => {
    expect(derivePassFail(null, 90, null)).toBe('pending');
    expect(derivePassFail(89, 90, null)).toBe('fail');
    expect(derivePassFail(101, null, 100)).toBe('fail');
    expect(derivePassFail(95, 90, 100)).toBe('pass');
  });
});
