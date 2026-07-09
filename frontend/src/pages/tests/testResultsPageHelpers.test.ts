import { describe, expect, it } from 'vitest';

import {
  buildTestResultsCsvRows,
  filterTestResults,
  getUniqueTestTypes,
  hasActiveTestFilters,
  TEST_RESULTS_CSV_HEADERS,
  type TestResultFilterState,
} from './testResultsPageHelpers';
import type { TestResult } from './types';

const emptyFilters: TestResultFilterState = {
  searchQuery: '',
  filterTestType: '',
  filterStatus: '',
  filterPassFail: '',
  filterLot: '',
  filterDateFrom: '',
  filterDateTo: '',
};

const testResults: TestResult[] = [
  {
    id: 'test-1',
    testType: 'Compaction',
    testRequestNumber: 'TR-001',
    laboratoryName: 'Lab One',
    laboratoryReportNumber: 'LR-001',
    sampleDate: '2026-06-01T09:00:00.000Z',
    sampleLocation: 'Chainage 10',
    testDate: '2026-06-02T00:00:00.000Z',
    resultDate: null,
    resultValue: 97,
    resultUnit: '%',
    specificationMin: 95,
    specificationMax: 100,
    passFail: 'pass',
    status: 'verified',
    verifiedBy: { id: 'user-1', fullName: 'Quinn Verifier', email: 'quinn@example.com' },
    verifiedAt: '2026-06-03T00:00:00.000Z',
    lotId: 'lot-1',
    lot: { id: 'lot-1', lotNumber: 'LOT-001' },
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'test-2',
    testType: 'Concrete',
    testRequestNumber: null,
    laboratoryName: null,
    laboratoryReportNumber: null,
    sampleDate: null,
    sampleLocation: null,
    testDate: null,
    resultDate: null,
    resultValue: null,
    resultUnit: null,
    specificationMin: null,
    specificationMax: null,
    passFail: 'fail',
    status: 'entered',
    lotId: 'lot-2',
    lot: { id: 'lot-2', lotNumber: 'LOT-002' },
    createdAt: '2026-06-04T08:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
  },
];

describe('testResultsPageHelpers', () => {
  it('filters by search, status, pass/fail, lot, type, and date range using existing rules', () => {
    expect(filterTestResults(testResults, { ...emptyFilters, searchQuery: 'lr-001' })).toEqual([
      testResults[0],
    ]);
    expect(filterTestResults(testResults, { ...emptyFilters, filterStatus: 'entered' })).toEqual([
      testResults[1],
    ]);
    expect(filterTestResults(testResults, { ...emptyFilters, filterPassFail: 'pass' })).toEqual([
      testResults[0],
    ]);
    expect(filterTestResults(testResults, { ...emptyFilters, filterLot: 'lot-2' })).toEqual([
      testResults[1],
    ]);
    expect(filterTestResults(testResults, { ...emptyFilters, filterTestType: 'compact' })).toEqual([
      testResults[0],
    ]);
    expect(
      filterTestResults(testResults, {
        ...emptyFilters,
        filterDateFrom: '2026-06-04',
        filterDateTo: '2026-06-04',
      }),
    ).toEqual([testResults[1]]);
  });

  it('sorts unique test types and detects active filters', () => {
    expect(getUniqueTestTypes(testResults)).toEqual(['Compaction', 'Concrete']);
    expect(hasActiveTestFilters(emptyFilters)).toBe(false);
    expect(hasActiveTestFilters({ ...emptyFilters, searchQuery: 'lab' })).toBe(true);
  });

  it('builds CSV rows with the existing fallback values and result formatting', () => {
    expect(TEST_RESULTS_CSV_HEADERS).toContain('Linked Lot');
    expect(TEST_RESULTS_CSV_HEADERS).toContain('Lab Report #');
    expect(TEST_RESULTS_CSV_HEADERS).toContain('Verified By (Contractor)');
    expect(buildTestResultsCsvRows(testResults)).toEqual([
      [
        'Compaction',
        'TR-001',
        'LOT-001',
        'Lab One',
        'LR-001',
        'Chainage 10',
        '97 %',
        95,
        100,
        'pass',
        'verified',
        '02/06/2026',
        'Quinn Verifier',
      ],
      ['Concrete', '-', 'LOT-002', '-', '-', '-', '-', '-', '-', 'fail', 'entered', '-', '-'],
    ]);
  });
});
