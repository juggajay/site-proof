import { describe, expect, it } from 'vitest';
import {
  buildHoldPointChaseResponse,
  buildHoldPointEscalatedResponse,
  buildHoldPointEscalationResolvedResponse,
  buildHoldPointReleasedResponse,
  buildHoldPointReleaseRequestedResponse,
  buildPublicHoldPointReleasedResponse,
} from './actionResponses.js';

const holdPoint = { id: 'hp-1', status: 'requested' };

describe('hold point action response builders', () => {
  it('preserves the release-request response shape', () => {
    expect(buildHoldPointReleaseRequestedResponse(holdPoint)).toEqual({
      success: true,
      message: 'Hold point release requested successfully',
      holdPoint,
    });
  });

  it('preserves the release response shape and notified user projection', () => {
    expect(
      buildHoldPointReleasedResponse(holdPoint, [
        { user: { email: 'pm@example.com', fullName: 'Project Manager' } },
        { user: { email: 'no-name@example.com', fullName: null } },
      ]),
    ).toEqual({
      success: true,
      message: 'Hold point released successfully',
      holdPoint,
      notifiedUsers: [
        { email: 'pm@example.com', fullName: 'Project Manager' },
        { email: 'no-name@example.com', fullName: null },
      ],
    });
  });

  it('preserves the chase response shape', () => {
    expect(buildHoldPointChaseResponse(holdPoint)).toEqual({
      success: true,
      message: 'Chase notification sent',
      holdPoint,
    });
  });

  it('preserves the escalation response shape and includes role', () => {
    expect(
      buildHoldPointEscalatedResponse(holdPoint, [
        {
          role: 'quality_manager',
          user: { email: 'qm@example.com', fullName: 'Quality Manager' },
        },
      ]),
    ).toEqual({
      success: true,
      message: 'Hold point escalated successfully',
      holdPoint,
      notifiedUsers: [
        {
          email: 'qm@example.com',
          fullName: 'Quality Manager',
          role: 'quality_manager',
        },
      ],
    });
  });

  it('preserves the resolve-escalation response shape', () => {
    expect(buildHoldPointEscalationResolvedResponse(holdPoint)).toEqual({
      success: true,
      message: 'Escalation resolved',
      holdPoint,
    });
  });

  it('preserves the public secure-link release response projection', () => {
    const releasedAt = new Date('2026-06-01T01:02:03.000Z');
    const publicHoldPoint = {
      id: 'hp-2',
      description: 'Witness compaction test',
      itpChecklistItemId: 'item-hp-2',
      status: 'released',
      releasedAt,
      releasedByName: 'Superintendent',
      releasedByOrg: 'Client Org',
      releaseMethod: 'secure_link',
      releaseNotes: 'Released from email',
      lot: {
        id: 'lot-1',
        lotNumber: 'EW-001',
      },
    };

    expect(buildPublicHoldPointReleasedResponse(publicHoldPoint)).toEqual({
      success: true,
      message: 'Hold point released successfully via secure link',
      holdPoint: {
        id: 'hp-2',
        description: 'Witness compaction test',
        itpChecklistItemId: 'item-hp-2',
        status: 'released',
        releasedAt,
        releasedByName: 'Superintendent',
        releasedByOrg: 'Client Org',
        releaseMethod: 'secure_link',
        releaseNotes: 'Released from email',
      },
      lot: {
        id: 'lot-1',
        lotNumber: 'EW-001',
      },
    });
  });
});
