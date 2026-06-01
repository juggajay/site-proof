type ReceivedNotificationInput = {
  userId: string;
  projectId: string;
  testType: string;
  requestNumber: string;
  labName: string;
};

type ReceivedEmailInput = {
  projectId: string;
  projectName: string | undefined;
  testType: string;
  requestNumber: string;
  labName: string;
};

export function buildTestResultReceivedNotification({
  userId,
  projectId,
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
    linkUrl: `/projects/${projectId}/tests`,
  };
}

export function buildTestResultReceivedEmail({
  projectId,
  projectName,
  testType,
  requestNumber,
  labName,
}: ReceivedEmailInput) {
  return {
    title: 'Test Result Received',
    message: `Test result for ${testType} (${requestNumber}) from ${labName} is pending verification.`,
    linkUrl: `/projects/${projectId}/tests`,
    projectName,
  };
}
