import { describe, expect, it } from 'vitest';

import { DIARY_LOCK_AFTER_MS, isDiaryLocked } from './diaryAccess.js';

describe('isDiaryLocked (M32 auto-lock)', () => {
  const now = new Date('2026-06-20T00:00:00.000Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it('locks a submitted diary once the cutoff has elapsed', () => {
    expect(isDiaryLocked({ status: 'submitted', submittedAt: daysAgo(8) }, now)).toBe(true);
  });

  it('keeps a recently submitted diary unlocked', () => {
    expect(isDiaryLocked({ status: 'submitted', submittedAt: daysAgo(1) }, now)).toBe(false);
  });

  it('locks exactly at the cutoff boundary', () => {
    const submittedAt = new Date(now.getTime() - DIARY_LOCK_AFTER_MS);
    expect(isDiaryLocked({ status: 'submitted', submittedAt }, now)).toBe(true);
  });

  it('never locks a draft diary', () => {
    expect(isDiaryLocked({ status: 'draft', submittedAt: null }, now)).toBe(false);
    expect(isDiaryLocked({ status: 'draft', submittedAt: daysAgo(30) }, now)).toBe(false);
  });

  it('does not lock a submitted diary with no submittedAt', () => {
    expect(isDiaryLocked({ status: 'submitted', submittedAt: null }, now)).toBe(false);
  });

  it('treats an explicit lockedAt as locked regardless of elapsed time', () => {
    expect(
      isDiaryLocked({ status: 'submitted', submittedAt: daysAgo(1), lockedAt: daysAgo(1) }, now),
    ).toBe(true);
  });

  it('uses a 7-day cutoff', () => {
    expect(DIARY_LOCK_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
