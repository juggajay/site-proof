export function buildTestResultDetailResponse<TTestResult>(testResult: TTestResult) {
  return { testResult };
}

export function buildTestResultUpdatedResponse<TTestResult>(testResult: TTestResult) {
  return { testResult };
}

export function buildTestResultDeletedResponse() {
  return {
    message: 'Test result deleted successfully',
  };
}
