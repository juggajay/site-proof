import { describe, expect, it } from 'vitest';

import { buildCertificateExtractionResponse } from './extractionResponse.js';

const baseExtractionSource = {
  aiExtracted: true,
  aiConfidence: null,
  certificateDoc: {
    id: 'doc-1',
    filename: 'certificate.pdf',
    fileUrl: 'https://files.test/certificate.pdf',
    mimeType: 'application/pdf',
    uploadedAt: new Date('2026-06-01T01:02:03.000Z'),
  },
  testType: 'Compaction',
  laboratoryName: 'ACME Labs',
  laboratoryReportNumber: 'LR-001',
  sampleDate: new Date('2026-05-20T00:00:00.000Z'),
  testDate: new Date('2026-05-21T00:00:00.000Z'),
  sampleLocation: 'CH 100',
  resultValue: 98,
  resultUnit: '% MDD',
  specificationMin: 95,
  specificationMax: 100,
};

describe('certificate extraction response helpers', () => {
  it('preserves the non-AI extraction message shape', () => {
    expect(
      buildCertificateExtractionResponse({
        ...baseExtractionSource,
        aiExtracted: false,
      }),
    ).toEqual({
      extraction: {
        aiExtracted: false,
        message: 'This test result was not AI-extracted',
      },
    });
  });

  it('defaults missing confidence values to high confidence', () => {
    const response = buildCertificateExtractionResponse(baseExtractionSource);
    const extraction = response.extraction;
    if (!('fields' in extraction)) {
      throw new Error('Expected AI extraction response');
    }

    expect(extraction).toMatchObject({
      aiExtracted: true,
      certificateDoc: {
        id: 'doc-1',
        filename: 'certificate.pdf',
        mimeType: 'application/pdf',
        uploadedAt: new Date('2026-06-01T01:02:03.000Z'),
      },
      lowConfidenceFields: [],
      needsReview: false,
      thresholds: {
        low: 0.8,
        medium: 0.9,
      },
    });
    expect(extraction.fields).toBeDefined();
    expect(extraction.fields!.testType).toEqual({
      value: 'Compaction',
      confidence: 1,
      status: 'high',
    });
    expect(extraction.certificateDoc).not.toHaveProperty('fileUrl');
  });

  it('buckets low and medium confidence fields without rewriting values', () => {
    const response = buildCertificateExtractionResponse({
      ...baseExtractionSource,
      aiConfidence: JSON.stringify({
        testType: 0.95,
        laboratoryName: 0.85,
        resultValue: 0.5,
      }),
    });
    const extraction = response.extraction;
    if (!('fields' in extraction)) {
      throw new Error('Expected AI extraction response');
    }

    expect(extraction.fields).toBeDefined();
    expect(extraction.fields!.laboratoryName).toEqual({
      value: 'ACME Labs',
      confidence: 0.85,
      status: 'medium',
    });
    expect(extraction.fields!.resultValue).toEqual({
      value: 98,
      confidence: 0.5,
      status: 'low',
    });
    expect(extraction.lowConfidenceFields).toEqual([{ field: 'resultValue', confidence: 0.5 }]);
    expect(extraction.needsReview).toBe(true);
  });
});
