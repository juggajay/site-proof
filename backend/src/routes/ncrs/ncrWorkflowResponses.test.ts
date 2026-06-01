import { describe, expect, it } from 'vitest';
import {
  buildNcrClientNotificationResponse,
  buildNcrClosedResponse,
  buildNcrSubmittedForVerificationResponse,
  buildNcrWorkflowMessageResponse,
  buildNcrWorkflowResponse,
} from './ncrWorkflowResponses.js';

describe('ncrWorkflowResponses', () => {
  it('builds generic NCR envelopes', () => {
    const ncr = { id: 'ncr-1' };

    expect(buildNcrWorkflowResponse(ncr)).toEqual({ ncr });
    expect(buildNcrWorkflowMessageResponse(ncr, 'Response accepted')).toEqual({
      ncr,
      message: 'Response accepted',
    });
  });

  it('builds close responses with severity-specific copy', () => {
    const ncr = { id: 'ncr-1' };

    expect(buildNcrClosedResponse(ncr, 'major')).toEqual({
      ncr,
      message: 'Major NCR closed successfully with QM approval',
    });
    expect(buildNcrClosedResponse(ncr, 'minor')).toEqual({
      ncr,
      message: 'NCR closed successfully',
    });
  });

  it('builds client notification and verification submission responses', () => {
    const ncr = { id: 'ncr-1', ncrEvidence: [{ id: 'evidence-1' }] };
    const notificationPackage = { recipient: 'client@example.test' };

    expect(buildNcrClientNotificationResponse(ncr, notificationPackage, 'NCR-001')).toEqual({
      ncr,
      notificationPackage,
      message: 'Client notification sent for NCR-001',
    });
    expect(buildNcrSubmittedForVerificationResponse(ncr)).toEqual({
      ncr,
      message: 'NCR submitted for verification successfully',
      evidenceCount: 1,
    });
  });
});
