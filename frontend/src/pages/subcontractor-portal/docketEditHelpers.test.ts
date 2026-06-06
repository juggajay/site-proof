// Characterization tests for the docket edit time/validation/status helpers,
// pinning the behavior DocketEditPage shipped with. The display formatters
// (formatCurrency/formatDate) are pinned separately in
// docketEditDisplay.test.ts, and the entry sheet's TIME_PRESETS stay with the
// sheet UI in components/DocketEntrySheet.tsx.
import { describe, expect, it } from 'vitest';

import {
  calculateHours,
  getPlantHoursError,
  isEditableDocketStatus,
  parseDailyHoursInput,
  PLANT_HOURS_INPUT_ERROR,
} from './docketEditHelpers';

describe('calculateHours', () => {
  it('returns 0 when either time is missing', () => {
    expect(calculateHours('', '15:00')).toBe(0);
    expect(calculateHours('07:00', '')).toBe(0);
    expect(calculateHours('', '')).toBe(0);
  });

  it('calculates same-day hours', () => {
    expect(calculateHours('07:00', '15:00')).toBe(8);
    expect(calculateHours('07:30', '16:00')).toBe(8.5);
  });

  it('rounds to one decimal place', () => {
    expect(calculateHours('07:00', '15:10')).toBe(8.2); // 8h10m = 8.1667 -> 8.2

    expect(calculateHours('08:00', '08:05')).toBe(0.1);
  });

  it('handles overnight shifts by wrapping past midnight', () => {
    expect(calculateHours('22:00', '06:00')).toBe(8);
    expect(calculateHours('23:30', '00:15')).toBe(0.8);
  });

  it('returns 0 for identical start and finish', () => {
    expect(calculateHours('07:00', '07:00')).toBe(0);
  });
});

describe('parseDailyHoursInput', () => {
  it('parses whole and decimal hours within range', () => {
    expect(parseDailyHoursInput('8')).toBe(8);
    expect(parseDailyHoursInput('8.5')).toBe(8.5);
    expect(parseDailyHoursInput(' 12 ')).toBe(12);
    expect(parseDailyHoursInput('24')).toBe(24);
    expect(parseDailyHoursInput('0.1')).toBe(0.1);
  });

  it('rejects blank, zero, out-of-range, and malformed input', () => {
    expect(parseDailyHoursInput('')).toBeNull();
    expect(parseDailyHoursInput('   ')).toBeNull();
    expect(parseDailyHoursInput('0')).toBeNull();
    expect(parseDailyHoursInput('24.5')).toBeNull();
    expect(parseDailyHoursInput('-3')).toBeNull();
    expect(parseDailyHoursInput('8h')).toBeNull();
    expect(parseDailyHoursInput('eight')).toBeNull();
    expect(parseDailyHoursInput('1,5')).toBeNull();
    expect(parseDailyHoursInput('.5')).toBeNull();
  });
});

describe('getPlantHoursError', () => {
  it('requires a value', () => {
    expect(getPlantHoursError('')).toBe('Hours operated is required.');
    expect(getPlantHoursError('   ')).toBe('Hours operated is required.');
  });

  it('gives the negative-specific error for negative input', () => {
    expect(getPlantHoursError('-1')).toBe('Hours operated cannot be negative.');
    expect(getPlantHoursError(' -0.5 ')).toBe('Hours operated cannot be negative.');
  });

  it('gives the range error for zero, above 24, and malformed input', () => {
    expect(getPlantHoursError('0')).toBe(PLANT_HOURS_INPUT_ERROR);
    expect(getPlantHoursError('25')).toBe(PLANT_HOURS_INPUT_ERROR);
    expect(getPlantHoursError('8h')).toBe(PLANT_HOURS_INPUT_ERROR);
  });

  it('returns null for valid hours including the 24 boundary', () => {
    expect(getPlantHoursError('8')).toBeNull();
    expect(getPlantHoursError('8.5')).toBeNull();
    expect(getPlantHoursError('24')).toBeNull();
    expect(getPlantHoursError('0.1')).toBeNull();
  });

  it('pins the shared range error wording', () => {
    expect(PLANT_HOURS_INPUT_ERROR).toBe('Hours operated must be greater than 0 and 24 or less.');
  });
});

describe('isEditableDocketStatus', () => {
  it('treats missing status and draft/queried/rejected as editable', () => {
    expect(isEditableDocketStatus(undefined)).toBe(true);
    expect(isEditableDocketStatus('')).toBe(true);
    expect(isEditableDocketStatus('draft')).toBe(true);
    expect(isEditableDocketStatus('queried')).toBe(true);
    expect(isEditableDocketStatus('rejected')).toBe(true);
  });

  it('treats submitted/approved and unknown statuses as locked', () => {
    expect(isEditableDocketStatus('submitted')).toBe(false);
    expect(isEditableDocketStatus('approved')).toBe(false);
    expect(isEditableDocketStatus('DRAFT')).toBe(false);
  });
});
