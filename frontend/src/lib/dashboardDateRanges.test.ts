import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATE_RANGE_PRESETS, formatDateForApi } from './dashboardDateRanges';

function preset(value: string) {
  const found = DATE_RANGE_PRESETS.find((item) => item.value === value);
  if (!found) {
    throw new Error(`Missing preset ${value}`);
  }
  return found;
}

function localDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds(),
  };
}

describe('dashboardDateRanges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 29, 12, 30, 15, 123));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds current-day and previous-day preset boundaries', () => {
    expect(localDateParts(preset('today').getRange().start)).toEqual({
      year: 2026,
      month: 4,
      day: 29,
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    expect(localDateParts(preset('today').getRange().end)).toEqual({
      year: 2026,
      month: 4,
      day: 29,
      hours: 23,
      minutes: 59,
      seconds: 59,
      milliseconds: 999,
    });
    expect(localDateParts(preset('yesterday').getRange().start)).toMatchObject({
      year: 2026,
      month: 4,
      day: 28,
      hours: 0,
    });
  });

  it('builds rolling and calendar preset starts without changing labels', () => {
    expect(DATE_RANGE_PRESETS.map((item) => item.label)).toEqual([
      'Today',
      'Yesterday',
      'Last 7 Days',
      'Last 30 Days',
      'This Month',
      'Last Month',
      'This Quarter',
    ]);

    expect(localDateParts(preset('last7days').getRange().start)).toMatchObject({
      year: 2026,
      month: 4,
      day: 23,
      hours: 0,
    });
    expect(localDateParts(preset('last30days').getRange().start)).toMatchObject({
      year: 2026,
      month: 3,
      day: 30,
      hours: 0,
    });
    expect(localDateParts(preset('thisMonth').getRange().start)).toMatchObject({
      year: 2026,
      month: 4,
      day: 1,
    });
    expect(localDateParts(preset('lastMonth').getRange().start)).toMatchObject({
      year: 2026,
      month: 3,
      day: 1,
    });
    expect(localDateParts(preset('thisQuarter').getRange().start)).toMatchObject({
      year: 2026,
      month: 3,
      day: 1,
    });
  });

  it('formats API dates through the local date-key helper', () => {
    expect(formatDateForApi(new Date(2026, 4, 9, 12, 0))).toBe('2026-05-09');
  });
});
