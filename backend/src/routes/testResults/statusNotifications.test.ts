import { describe, expect, it } from 'vitest';

import {
  buildTestResultReceivedEmail,
  buildTestResultReceivedNotification,
} from './statusNotifications.js';

describe('test result status notification helpers', () => {
  it('builds the in-app received notification with the exact existing message', () => {
    expect(
      buildTestResultReceivedNotification({
        userId: 'user-1',
        projectId: 'project-1',
        testType: 'Compaction Test',
        requestNumber: 'TR-42',
        labName: 'ACME Labs',
      }),
    ).toEqual({
      userId: 'user-1',
      projectId: 'project-1',
      type: 'test_result_received',
      title: 'Test Result Received',
      message:
        'Test result for Compaction Test (TR-42) has been received from ACME Labs. Pending verification.',
      linkUrl: '/projects/project-1/tests',
    });
  });

  it('builds the email notification payload with the exact existing message', () => {
    expect(
      buildTestResultReceivedEmail({
        projectId: 'project-2',
        projectName: 'Northern Bypass',
        testType: 'CBR Test',
        requestNumber: 'TR-99',
        labName: 'Road Lab',
      }),
    ).toEqual({
      title: 'Test Result Received',
      message: 'Test result for CBR Test (TR-99) from Road Lab is pending verification.',
      linkUrl: '/projects/project-2/tests',
      projectName: 'Northern Bypass',
    });
  });

  it('preserves an undefined project name for the email sender', () => {
    expect(
      buildTestResultReceivedEmail({
        projectId: 'project-3',
        projectName: undefined,
        testType: 'Concrete Strength',
        requestNumber: 'ABCDEF12',
        labName: 'laboratory',
      }),
    ).toEqual({
      title: 'Test Result Received',
      message:
        'Test result for Concrete Strength (ABCDEF12) from laboratory is pending verification.',
      linkUrl: '/projects/project-3/tests',
      projectName: undefined,
    });
  });
});
