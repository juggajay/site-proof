import { describe, expect, it } from 'vitest';
import { buildHoldPointDetailResponse, resolveHoldPointDetailSettings } from './detailResponse.js';

describe('resolveHoldPointDetailSettings', () => {
  it('returns defaults when the user cannot request release', () => {
    expect(
      resolveHoldPointDetailSettings({
        hasRequestPermission: false,
        projectSettings: JSON.stringify({
          hpRecipients: [{ email: 'super@example.com' }],
          hpApprovalRequirement: 'superintendent',
        }),
      }),
    ).toEqual({
      defaultRecipients: [],
      approvalRequirement: 'any',
    });
  });

  it('parses default recipients and approval requirement when permitted', () => {
    expect(
      resolveHoldPointDetailSettings({
        hasRequestPermission: true,
        projectSettings: JSON.stringify({
          hpRecipients: [
            { email: 'super@example.com' },
            { email: 'invalid-email' },
            { email: 'pm@example.com' },
          ],
          hpApprovalRequirement: 'superintendent',
        }),
      }),
    ).toEqual({
      defaultRecipients: ['super@example.com', 'pm@example.com'],
      approvalRequirement: 'superintendent',
    });
  });

  it('falls back to defaults for invalid settings JSON', () => {
    expect(
      resolveHoldPointDetailSettings({
        hasRequestPermission: true,
        projectSettings: '{not json',
      }),
    ).toEqual({
      defaultRecipients: [],
      approvalRequirement: 'any',
    });
  });
});

describe('buildHoldPointDetailResponse', () => {
  it('builds a virtual pending hold point when no persisted row exists', () => {
    const prerequisites = [
      {
        id: 'item-1',
        description: 'Prerequisite item',
        sequenceNumber: 1,
        isHoldPoint: false,
        isCompleted: false,
        isVerified: false,
        completedAt: null,
      },
    ];

    expect(
      buildHoldPointDetailResponse({
        lotId: 'lot-1',
        lotNumber: 'LOT-001',
        itemId: 'hp-item-1',
        holdPointItem: {
          id: 'hp-item-1',
          description: 'Hold point item',
          sequenceNumber: 2,
        },
        prerequisites,
        incompletePrerequisites: prerequisites,
        canRequestRelease: false,
        defaultRecipients: [],
        approvalRequirement: 'any',
      }),
    ).toEqual({
      holdPoint: {
        id: null,
        lotId: 'lot-1',
        lotNumber: 'LOT-001',
        itpChecklistItemId: 'hp-item-1',
        description: 'Hold point item',
        sequenceNumber: 2,
        status: 'pending',
        notificationSentAt: undefined,
        scheduledDate: undefined,
        releasedAt: undefined,
        releasedByName: undefined,
        releasedByOrg: undefined,
        releaseMethod: undefined,
        releaseRecipientEmail: null,
        releaseNotes: undefined,
      },
      prerequisites,
      incompletePrerequisites: prerequisites,
      canRequestRelease: false,
      defaultRecipients: [],
      approvalRequirement: 'any',
    });
  });

  it('preserves persisted hold point fields', () => {
    const notificationSentAt = new Date('2026-05-21T01:00:00.000Z');
    const scheduledDate = new Date('2026-05-22T02:00:00.000Z');
    const releasedAt = new Date('2026-05-23T03:00:00.000Z');

    expect(
      buildHoldPointDetailResponse({
        lotId: 'lot-1',
        lotNumber: 'LOT-001',
        itemId: 'hp-item-1',
        holdPointItem: {
          id: 'hp-item-1',
          description: 'Hold point item',
          sequenceNumber: 2,
        },
        existingHoldPoint: {
          id: 'hp-1',
          status: 'released',
          notificationSentAt,
          scheduledDate,
          releasedAt,
          releasedByName: 'Superintendent',
          releasedByOrg: 'Client Company',
          releaseMethod: 'secure_link',
          releaseTokens: [{ recipientEmail: 'super@example.com', usedAt: releasedAt }],
          releaseNotes: 'Released via email confirmation',
        },
        prerequisites: [],
        incompletePrerequisites: [],
        canRequestRelease: true,
        defaultRecipients: ['super@example.com'],
        approvalRequirement: 'superintendent',
      }).holdPoint,
    ).toEqual({
      id: 'hp-1',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      itpChecklistItemId: 'hp-item-1',
      description: 'Hold point item',
      sequenceNumber: 2,
      status: 'released',
      notificationSentAt,
      scheduledDate,
      releasedAt,
      releasedByName: 'Superintendent',
      releasedByOrg: 'Client Company',
      releaseMethod: 'secure_link',
      releaseRecipientEmail: 'super@example.com',
      releaseNotes: 'Released via email confirmation',
    });
  });
});
