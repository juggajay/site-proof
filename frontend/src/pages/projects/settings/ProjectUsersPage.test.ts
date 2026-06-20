import { describe, expect, it } from 'vitest';
import { formatProjectUserJoinedDate } from './projectUserDateFormatting';

describe('formatProjectUserJoinedDate', () => {
  it('formats the explicit joined date when present', () => {
    expect(formatProjectUserJoinedDate({ joinedAt: '2026-06-02T00:00:00.000Z' })).toBe(
      '02/06/2026',
    );
  });

  it('falls back through accepted and invited dates', () => {
    expect(formatProjectUserJoinedDate({ acceptedAt: '2026-06-03T00:00:00.000Z' })).toBe(
      '03/06/2026',
    );
    expect(formatProjectUserJoinedDate({ invitedAt: '2026-06-04T00:00:00.000Z' })).toBe(
      '04/06/2026',
    );
  });

  it('does not render invalid dates', () => {
    expect(formatProjectUserJoinedDate({})).toBe('—');
    expect(formatProjectUserJoinedDate({ joinedAt: 'not-a-date' })).toBe('—');
  });
});
