import { STATUS_LABELS, VALID_STATUS_TRANSITIONS } from './statusWorkflow.js';

type WorkflowTestResult = {
  status: string;
  createdAt: Date;
  enteredAt: Date | null;
  verifiedAt: Date | null;
  enteredBy?: { fullName: string | null } | null;
  verifiedBy?: { fullName: string | null } | null;
};

type WorkflowPermissionOptions = {
  canCreateTest: boolean;
  canVerifyTest: boolean;
};

export function buildTestResultWorkflowResponse(
  testResult: WorkflowTestResult,
  { canCreateTest, canVerifyTest }: WorkflowPermissionOptions,
) {
  const workflowSteps = [
    {
      status: 'requested',
      label: 'Requested',
      completed: true,
      completedAt: testResult.createdAt,
      completedBy: null,
    },
    {
      status: 'at_lab',
      label: 'At Lab',
      completed: ['at_lab', 'results_received', 'entered', 'verified'].includes(testResult.status),
      completedAt: null,
      completedBy: null,
    },
    {
      status: 'results_received',
      label: 'Results Received',
      completed: ['results_received', 'entered', 'verified'].includes(testResult.status),
      completedAt: null,
      completedBy: null,
    },
    {
      status: 'entered',
      label: 'Entered',
      completed: ['entered', 'verified'].includes(testResult.status),
      completedAt: testResult.enteredAt,
      completedBy: testResult.enteredBy?.fullName || null,
    },
    {
      status: 'verified',
      label: 'Verified',
      completed: testResult.status === 'verified',
      completedAt: testResult.verifiedAt,
      completedBy: testResult.verifiedBy?.fullName || null,
    },
  ];

  const nextTransitions = VALID_STATUS_TRANSITIONS[testResult.status] || [];

  return {
    workflow: {
      currentStatus: testResult.status,
      currentStatusLabel: STATUS_LABELS[testResult.status] || testResult.status,
      steps: workflowSteps,
      nextTransitions: nextTransitions.map((status) => ({
        status,
        label: STATUS_LABELS[status] || status,
        canPerform: status === 'verified' ? canVerifyTest : canCreateTest,
      })),
      canAdvance: nextTransitions.length > 0,
      isComplete: testResult.status === 'verified',
    },
  };
}

export function buildTestResultStatusUpdatedResponse<TTestResult>(
  status: string,
  updatedTestResult: TTestResult,
) {
  return {
    message: `Test result status updated to '${STATUS_LABELS[status] || status}'`,
    testResult: updatedTestResult,
    nextTransitions: (VALID_STATUS_TRANSITIONS[status] || []).map((nextStatus) => ({
      status: nextStatus,
      label: STATUS_LABELS[nextStatus] || nextStatus,
    })),
  };
}
