import { formatTestDate } from './constants';
import type { TestResult } from './types';

export interface TestResultFilterState {
  searchQuery: string;
  filterTestType: string;
  filterStatus: string;
  filterPassFail: string;
  filterLot: string;
  filterDateFrom: string;
  filterDateTo: string;
}

export const TEST_RESULTS_CSV_HEADERS = [
  'Test Type',
  'Request #',
  'Linked Lot',
  'Laboratory',
  'Sample Location',
  'Result',
  'Spec Min',
  'Spec Max',
  'Pass/Fail',
  'Status',
  'Test Date',
];

export function filterTestResults(
  testResults: TestResult[],
  filters: TestResultFilterState,
): TestResult[] {
  return testResults.filter((test) => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTestType = test.testType.toLowerCase().includes(query);
      const matchesReportNumber = test.testRequestNumber?.toLowerCase().includes(query) || false;
      const matchesLabReportNumber =
        test.laboratoryReportNumber?.toLowerCase().includes(query) || false;
      const matchesLotNumber = test.lot?.lotNumber?.toLowerCase().includes(query) || false;
      const matchesLabName = test.laboratoryName?.toLowerCase().includes(query) || false;
      const matchesSampleLocation = test.sampleLocation?.toLowerCase().includes(query) || false;

      if (
        !matchesTestType &&
        !matchesReportNumber &&
        !matchesLabReportNumber &&
        !matchesLotNumber &&
        !matchesLabName &&
        !matchesSampleLocation
      ) {
        return false;
      }
    }

    if (
      filters.filterTestType &&
      !test.testType.toLowerCase().includes(filters.filterTestType.toLowerCase())
    ) {
      return false;
    }

    if (filters.filterStatus && test.status !== filters.filterStatus) {
      return false;
    }

    if (filters.filterPassFail && test.passFail !== filters.filterPassFail) {
      return false;
    }

    if (filters.filterLot && test.lot?.id !== filters.filterLot) {
      return false;
    }

    if (filters.filterDateFrom) {
      const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt);
      const fromDate = new Date(filters.filterDateFrom);
      if (testDate < fromDate) return false;
    }

    if (filters.filterDateTo) {
      const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt);
      const toDate = new Date(filters.filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (testDate > toDate) return false;
    }

    return true;
  });
}

export function getUniqueTestTypes(testResults: TestResult[]): string[] {
  return [...new Set(testResults.map((test) => test.testType))].sort();
}

export function hasActiveTestFilters(filters: TestResultFilterState): boolean {
  return Boolean(
    filters.filterTestType ||
    filters.filterStatus ||
    filters.filterPassFail ||
    filters.filterLot ||
    filters.filterDateFrom ||
    filters.filterDateTo ||
    filters.searchQuery,
  );
}

export function buildTestResultsCsvRows(testResults: TestResult[]): Array<Array<string | number>> {
  return testResults.map((test) => [
    test.testType,
    test.testRequestNumber || '-',
    test.lot?.lotNumber || '-',
    test.laboratoryName || '-',
    test.sampleLocation || '-',
    test.resultValue != null
      ? `${test.resultValue}${test.resultUnit ? ' ' + test.resultUnit : ''}`
      : '-',
    test.specificationMin != null ? test.specificationMin : '-',
    test.specificationMax != null ? test.specificationMax : '-',
    test.passFail,
    test.status,
    formatTestDate(test.testDate),
  ]);
}
