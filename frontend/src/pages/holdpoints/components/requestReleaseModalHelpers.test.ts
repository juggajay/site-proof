import { describe, expect, it } from 'vitest';

import { parseNotificationEmails, requestReleaseSchema } from './requestReleaseModalHelpers';

describe('requestReleaseModalHelpers', () => {
  it('parses notification emails from commas, semicolons, and newlines', () => {
    expect(
      parseNotificationEmails(
        ' inspector@example.com, superintendent@example.com;qa@example.com\nclient@example.com ',
      ),
    ).toEqual([
      'inspector@example.com',
      'superintendent@example.com',
      'qa@example.com',
      'client@example.com',
    ]);
  });

  it('validates required request release fields and multiple email addresses', () => {
    expect(
      requestReleaseSchema.safeParse({
        scheduledDate: '2026-06-06',
        scheduledTime: '09:30',
        notificationSentTo: 'inspector@example.com; qa@example.com',
        overrideReason: '',
      }).success,
    ).toBe(true);

    const missing = requestReleaseSchema.safeParse({
      scheduledDate: '',
      scheduledTime: '',
      notificationSentTo: '',
      overrideReason: '',
    });

    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.flatten().fieldErrors).toMatchObject({
        scheduledDate: ['Scheduled date is required'],
        scheduledTime: ['Scheduled time is required'],
        notificationSentTo: [
          'At least one notification email is required',
          'Enter valid email addresses separated by commas or semicolons',
        ],
      });
    }
  });

  it('rejects malformed notification email lists', () => {
    const result = requestReleaseSchema.safeParse({
      scheduledDate: '2026-06-06',
      scheduledTime: '09:30',
      notificationSentTo: 'inspector@example.com, not-an-email',
      overrideReason: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.notificationSentTo).toEqual([
        'Enter valid email addresses separated by commas or semicolons',
      ]);
    }
  });
});
