import { describe, expect, it } from 'vitest';
import { getAlertEmailNotificationType } from './notificationAlertConfig.js';

describe('getAlertEmailNotificationType', () => {
  it('keeps NCR alerts under NCR notification preferences', () => {
    expect(getAlertEmailNotificationType({ type: 'overdue_ncr', entityType: 'ncr' })).toBe(
      'ncrAssigned',
    );
  });

  it('keeps hold point alerts under hold point reminder preferences', () => {
    expect(
      getAlertEmailNotificationType({ type: 'stale_hold_point', entityType: 'hold-point' }),
    ).toBe('holdPointReminder');
  });

  it('keeps missing diary alerts under diary reminder preferences', () => {
    expect(getAlertEmailNotificationType({ type: 'pending_approval', entityType: 'diary' })).toBe(
      'diaryReminder',
    );
  });

  it('does not route generic operational alerts through NCR assignment preferences', () => {
    expect(getAlertEmailNotificationType({ type: 'pending_approval', entityType: 'docket' })).toBe(
      'holdPointReminder',
    );
    expect(getAlertEmailNotificationType({ type: 'overdue_test', entityType: 'test-result' })).toBe(
      'holdPointReminder',
    );
  });
});
