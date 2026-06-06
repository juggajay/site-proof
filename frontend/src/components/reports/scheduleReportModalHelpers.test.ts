import { describe, expect, it } from 'vitest';
import {
  DAYS_OF_WEEK,
  DEFAULT_MAX_SCHEDULED_REPORTS,
  FREQUENCIES,
  MAX_SCHEDULE_RECIPIENTS,
  REPORT_TYPES,
  getRecipientValidationError,
  normalizeRecipientList,
  parseRecipientList,
  scheduleFormSchema,
} from './scheduleReportModalHelpers';

describe('schedule report modal helpers', () => {
  it('parses recipients separated by commas, semicolons, and newlines', () => {
    expect(parseRecipientList(' Alice@example.com, bob@example.com;\ncarol@example.com  ')).toEqual(
      ['Alice@example.com', 'bob@example.com', 'carol@example.com'],
    );
  });

  it('normalizes recipients to unique lowercase addresses in first-seen order', () => {
    expect(normalizeRecipientList('Alice@Example.com, alice@example.com; BOB@example.com')).toEqual(
      ['alice@example.com', 'bob@example.com'],
    );
  });

  it('returns recipient validation errors for blank, invalid, and over-limit lists', () => {
    expect(getRecipientValidationError('   ')).toBe('At least one recipient is required');
    expect(getRecipientValidationError('valid@example.com, not-an-email')).toBe(
      'Enter valid email addresses',
    );

    const tooManyRecipients = Array.from(
      { length: MAX_SCHEDULE_RECIPIENTS + 1 },
      (_, index) => `user-${index}@example.com`,
    ).join(',');
    expect(getRecipientValidationError(tooManyRecipients)).toBe(
      `Use ${MAX_SCHEDULE_RECIPIENTS} or fewer recipients`,
    );
  });

  it('accepts valid schedule form data and rejects invalid time and recipient values', () => {
    expect(
      scheduleFormSchema.safeParse({
        reportType: 'lot-status',
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        timeOfDay: '09:00',
        recipients: 'owner@example.com; qa@example.com',
      }).success,
    ).toBe(true);

    const invalidResult = scheduleFormSchema.safeParse({
      reportType: 'lot-status',
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      timeOfDay: '25:00',
      recipients: '',
    });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(['Enter a valid time', 'At least one recipient is required']),
      );
    }
  });

  it('pins schedule limits and option ordering', () => {
    expect(DEFAULT_MAX_SCHEDULED_REPORTS).toBe(25);
    expect(REPORT_TYPES.map((option) => option.value)).toEqual([
      'lot-status',
      'ncr',
      'test',
      'diary',
    ]);
    expect(FREQUENCIES.map((option) => option.value)).toEqual(['daily', 'weekly', 'monthly']);
    expect(DAYS_OF_WEEK.map((option) => option.label)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });
});
