export function buildTestResultsListResponse<TTestResult, TPagination>(
  testResults: TTestResult[],
  pagination: TPagination,
) {
  return {
    testResults,
    pagination,
  };
}

export function buildEmptyTestResultsListResponse() {
  return {
    testResults: [],
  };
}
