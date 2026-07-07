import { buildProjectEntityLink } from '../notifications/links.js';

type ReceivedNotificationInput = {
  userId: string;
  projectId: string;
  testResultId: string;
  testType: string;
  requestNumber: string;
  labName: string;
};

type ReceivedEmailInput = {
  projectId: string;
  testResultId: string;
  projectName: string | undefined;
  testType: string;
  requestNumber: string;
  labName: string;
};

export function buildTestResultReceivedNotification({
  userId,
  projectId,
  testResultId,
  testType,
  requestNumber,
  labName,
}: ReceivedNotificationInput) {
  return {
    userId,
    projectId,
    type: 'test_result_received',
    title: 'Test Result Received',
    message: `Test result for ${testType} (${requestNumber}) has been received from ${labName}. Pending verification.`,
    linkUrl: buildProjectEntityLink('test', testResultId, projectId),
  };
}

export function buildTestResultReceivedEmail({
  projectId,
  testResultId,
  projectName,
  testType,
  requestNumber,
  labName,
}: ReceivedEmailInput) {
  return {
    title: 'Test Result Received',
    message: `Test result for ${testType} (${requestNumber}) from ${labName} is pending verification.`,
    linkUrl: buildProjectEntityLink('test', testResultId, projectId),
    projectName,
  };
}
