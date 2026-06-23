import { describe, expect, it } from 'vitest';
import { emptyCertificateExtraction } from './certificateExtraction.js';
import { buildTestResultData, parseChainageFromLocation } from './testResultMapping.js';

describe('parseChainageFromLocation (M46: AU chainage convention)', () => {
  it('treats CH N+M as M whole metres past station N (1234+50 -> 1284)', () => {
    expect(parseChainageFromLocation('CH 1234+50')).toBe(1284);
    expect(parseChainageFromLocation('1234+50')).toBe(1284);
    expect(parseChainageFromLocation(' CH 1234+50 ')).toBe(1284);
  });

  it('treats CH N.M as decimal metres (1234.50 -> 1234.5, 1234.5 -> 1234.5)', () => {
    expect(parseChainageFromLocation('CH 1234.50')).toBe(1234.5);
    // Previously the /100 offset wrongly yielded 1234.05 for a single decimal digit.
    expect(parseChainageFromLocation('1234.5')).toBe(1234.5);
  });

  it('parses whole-metre chainage with a CH or chainage prefix', () => {
    expect(parseChainageFromLocation('CH 1234')).toBe(1234);
    expect(parseChainageFromLocation('chainage 1234')).toBe(1234);
  });

  it('returns null when no chainage is present', () => {
    expect(parseChainageFromLocation('north abutment')).toBeNull();
    expect(parseChainageFromLocation('')).toBeNull();
  });
});

describe('testResultMapping helpers', () => {
  it('maps extracted certificate fields into TestResult create data', () => {
    const extracted = emptyCertificateExtraction();
    extracted.testType = { value: 'Compaction Test', confidence: 0.95 };
    extracted.laboratoryName = { value: '  ACME Labs  ', confidence: 0.91 };
    extracted.laboratoryReportNumber = { value: 'LAB-001', confidence: 0.9 };
    extracted.sampleDate = { value: '2026-05-28', confidence: 0.86 };
    extracted.testDate = { value: '2026-05-29', confidence: 0.88 };
    extracted.sampleLocation = { value: ' CH 1234+50 ', confidence: 0.82 };
    extracted.resultValue = { value: '97.5 % MDD', confidence: 0.8 };
    extracted.resultUnit = { value: '% MDD', confidence: 0.84 };
    extracted.specificationMin = { value: '95', confidence: 0.83 };
    extracted.specificationMax = { value: '', confidence: 0 };

    const data = buildTestResultData('project-1', 'document-1', extracted);

    expect(data).toMatchObject({
      projectId: 'project-1',
      testType: 'Compaction Test',
      laboratoryName: 'ACME Labs',
      laboratoryReportNumber: 'LAB-001',
      sampleLocation: 'CH 1234+50',
      resultValue: 97.5,
      resultUnit: '% MDD',
      specificationMin: 95,
      specificationMax: null,
      passFail: 'pass',
      certificateDocId: 'document-1',
      aiExtracted: true,
      status: 'results_received',
    });
    expect(data.sampleDate).toEqual(new Date(Date.UTC(2026, 4, 28)));
    expect(data.testDate).toEqual(new Date(Date.UTC(2026, 4, 29)));
    expect(JSON.parse(data.aiConfidence as string)).toMatchObject({
      testType: 0.95,
      laboratoryName: 0.91,
      resultValue: 0.8,
    });
  });

  it('falls back to manual-review defaults when extracted fields are blank', () => {
    const data = buildTestResultData('project-1', 'document-1', emptyCertificateExtraction());

    expect(data).toMatchObject({
      testType: 'Certificate Review Required',
      laboratoryName: null,
      laboratoryReportNumber: null,
      sampleDate: null,
      testDate: null,
      sampleLocation: null,
      resultValue: null,
      resultUnit: null,
      specificationMin: null,
      specificationMax: null,
      passFail: 'pending',
    });
  });
});
