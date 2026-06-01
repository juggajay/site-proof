import { describe, expect, it } from 'vitest';

import {
  buildTestResultAlreadyVerifiedResponse,
  buildTestResultRejectedResponse,
  buildTestResultRejectionNotification,
  buildTestResultVerifiedResponse,
} from './verificationResponses.js';

describe('test result verification response helpers', () => {
  it('builds the rejection notification recipient with the exact existing message', () => {
    expect(
      buildTestResultRejectionNotification(
        {
          testType: 'Compaction Test',
          enteredBy: {
            id: 'user-1',
            fullName: 'Site Engineer',
            email: 'engineer@example.com',
          },
        },
        'Certificate mismatch',
      ),
    ).toEqual({
      userId: 'user-1',
      name: 'Site Engineer',
      email: 'engineer@example.com',
      message: 'Your test result "Compaction Test" was rejected. Reason: Certificate mismatch',
    });
  });

  it('keeps the no-recipient rejection notification as null', () => {
    expect(
      buildTestResultRejectionNotification(
        { testType: 'CBR Test', enteredBy: null },
        'Missing page',
      ),
    ).toBeNull();
  });

  it('builds the rejected response shape with sent=true when a recipient exists', () => {
    const updated = { id: 'test-1', status: 'results_received' };
    const recipient = {
      userId: 'user-1',
      name: 'Site Engineer',
      email: 'engineer@example.com',
      message: 'Rejected',
    };

    expect(buildTestResultRejectedResponse(updated, recipient)).toEqual({
      message: 'Test result rejected',
      testResult: updated,
      notification: {
        sent: true,
        recipient,
      },
    });
  });

  it('builds the rejected response shape with sent=false when there is no recipient', () => {
    expect(buildTestResultRejectedResponse({ id: 'test-2' }, null)).toEqual({
      message: 'Test result rejected',
      testResult: { id: 'test-2' },
      notification: {
        sent: false,
        recipient: null,
      },
    });
  });

  it('builds the already-verified response shape', () => {
    expect(buildTestResultAlreadyVerifiedResponse({ id: 'test-3', status: 'verified' })).toEqual({
      message: 'Test result already verified',
      testResult: { id: 'test-3', status: 'verified' },
    });
  });

  it('builds the verified response shape', () => {
    expect(buildTestResultVerifiedResponse({ id: 'test-4', status: 'verified' })).toEqual({
      message: 'Test result verified successfully',
      testResult: { id: 'test-4', status: 'verified' },
    });
  });
});
