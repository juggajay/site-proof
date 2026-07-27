import { buildProjectEntityLink } from '../notifications/links.js';

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

/**
 * Turn the rejection recipient payload into the Notification row the engineer
 * actually receives (mirrors buildTestResultReceivedNotification in
 * ./statusNotifications.ts). The message is reused verbatim from the recipient
 * payload so the in-app record, the email, and the API response can never drift
 * apart. The row doubles as the email payload source in the reject handler.
 */
export function buildTestResultRejectedNotificationRow(
  recipient: NonNullable<ReturnType<typeof buildTestResultRejectionNotification>>,
  { projectId, testResultId }: { projectId: string; testResultId: string },
) {
  return {
    userId: recipient.userId,
    projectId,
    type: 'test_result_rejected',
    title: 'Test Result Rejected',
    message: recipient.message,
    linkUrl: buildProjectEntityLink('test', testResultId, projectId),
  };
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
