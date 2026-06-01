import { describe, expect, it } from 'vitest';
import { buildTestResultWorkflowResponse } from './workflowResponse.js';

describe('buildTestResultWorkflowResponse', () => {
  it('builds the requested-state workflow with creator transition permission', () => {
    const createdAt = new Date('2026-05-20T00:00:00.000Z');

    expect(
      buildTestResultWorkflowResponse(
        {
          status: 'requested',
          createdAt,
          enteredAt: null,
          verifiedAt: null,
          enteredBy: null,
          verifiedBy: null,
        },
        { canCreateTest: true, canVerifyTest: false },
      ),
    ).toEqual({
      workflow: {
        currentStatus: 'requested',
        currentStatusLabel: 'Requested',
        steps: [
          {
            status: 'requested',
            label: 'Requested',
            completed: true,
            completedAt: createdAt,
            completedBy: null,
          },
          {
            status: 'at_lab',
            label: 'At Lab',
            completed: false,
            completedAt: null,
            completedBy: null,
          },
          {
            status: 'results_received',
            label: 'Results Received',
            completed: false,
            completedAt: null,
            completedBy: null,
          },
          {
            status: 'entered',
            label: 'Entered',
            completed: false,
            completedAt: null,
            completedBy: null,
          },
          {
            status: 'verified',
            label: 'Verified',
            completed: false,
            completedAt: null,
            completedBy: null,
          },
        ],
        nextTransitions: [{ status: 'at_lab', label: 'At Lab', canPerform: true }],
        canAdvance: true,
        isComplete: false,
      },
    });
  });

  it('uses verifier permission for the verified transition', () => {
    const enteredAt = new Date('2026-05-21T01:00:00.000Z');

    const response = buildTestResultWorkflowResponse(
      {
        status: 'entered',
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        enteredAt,
        verifiedAt: null,
        enteredBy: { fullName: 'Engineer' },
        verifiedBy: null,
      },
      { canCreateTest: true, canVerifyTest: false },
    );

    expect(response.workflow.steps[3]).toEqual({
      status: 'entered',
      label: 'Entered',
      completed: true,
      completedAt: enteredAt,
      completedBy: 'Engineer',
    });
    expect(response.workflow.nextTransitions).toEqual([
      { status: 'verified', label: 'Verified', canPerform: false },
    ]);
  });

  it('marks verified results complete with no outgoing transitions', () => {
    const verifiedAt = new Date('2026-05-22T02:00:00.000Z');

    const response = buildTestResultWorkflowResponse(
      {
        status: 'verified',
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        enteredAt: new Date('2026-05-21T01:00:00.000Z'),
        verifiedAt,
        enteredBy: { fullName: null },
        verifiedBy: { fullName: 'Verifier' },
      },
      { canCreateTest: true, canVerifyTest: true },
    );

    expect(response.workflow.currentStatusLabel).toBe('Verified');
    expect(response.workflow.steps[4]).toEqual({
      status: 'verified',
      label: 'Verified',
      completed: true,
      completedAt: verifiedAt,
      completedBy: 'Verifier',
    });
    expect(response.workflow.nextTransitions).toEqual([]);
    expect(response.workflow.canAdvance).toBe(false);
    expect(response.workflow.isComplete).toBe(true);
  });
});
