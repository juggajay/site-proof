type RejectionNotificationSource = {
  id: string;
  fullName: string | null;
  email: string;
} | null;

type RejectedTestResultSource = {
  testType: string;
  enteredBy: RejectionNotificationSource;
};

export function buildTestResultRejectionNotification(
  testResult: RejectedTestResultSource,
  reason: string,
) {
  return testResult.enteredBy
    ? {
        userId: testResult.enteredBy.id,
        name: testResult.enteredBy.fullName,
        email: testResult.enteredBy.email,
        message: `Your test result "${testResult.testType}" was rejected. Reason: ${reason}`,
      }
    : null;
}

export function buildTestResultRejectedResponse<TTestResult>(
  updatedTestResult: TTestResult,
  engineerNotified: ReturnType<typeof buildTestResultRejectionNotification>,
) {
  return {
    message: 'Test result rejected',
    testResult: updatedTestResult,
    notification: {
      sent: engineerNotified !== null,
      recipient: engineerNotified,
    },
  };
}

export function buildTestResultAlreadyVerifiedResponse<TTestResult>(testResult: TTestResult) {
  return {
    message: 'Test result already verified',
    testResult,
  };
}

export function buildTestResultVerifiedResponse<TTestResult>(updatedTestResult: TTestResult) {
  return {
    message: 'Test result verified successfully',
    testResult: updatedTestResult,
  };
}
