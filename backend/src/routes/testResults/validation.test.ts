import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  DATE_ONLY_INPUT_PATTERN,
  MAX_TEST_ID_LENGTH,
  normalizeOptionalQueryString,
  normalizeOptionalString,
  normalizePassFail,
  normalizeRequiredString,
  parseRequestFormFormat,
  parseStrictDateOnlyMatch,
  parseTestResultRouteParam,
  toNullableDate,
  toNullableFloat,
  toNullableString,
} from './validation.js';

describe('testResults validation helpers', () => {
  describe('normalizeOptionalString', () => {
    it('passes undefined and null through unchanged', () => {
      expect(normalizeOptionalString(undefined, 'note')).toBeUndefined();
      expect(normalizeOptionalString(null, 'note')).toBeNull();
    });

    it('trims valid strings and collapses blank strings to null', () => {
      expect(normalizeOptionalString('  hello  ', 'note')).toBe('hello');
      expect(normalizeOptionalString('   ', 'note')).toBeNull();
    });

    it('rejects non-strings with a "must be a string" message', () => {
      expect(() => normalizeOptionalString(42, 'note')).toThrow('note must be a string');
    });

    it('rejects strings longer than the supplied maxLength', () => {
      expect(() => normalizeOptionalString('x'.repeat(11), 'note', 10)).toThrow('note is too long');
    });
  });

  describe('normalizeRequiredString', () => {
    it('returns the trimmed value when present', () => {
      expect(normalizeRequiredString('  Compaction Test  ', 'testType')).toBe('Compaction Test');
    });

    it('rejects missing / blank values with a "required" message', () => {
      expect(() => normalizeRequiredString(undefined, 'testType')).toThrow('testType is required');
      expect(() => normalizeRequiredString(null, 'testType')).toThrow('testType is required');
      expect(() => normalizeRequiredString('   ', 'testType')).toThrow('testType is required');
    });

    it('still surfaces the optional-string length and type errors first', () => {
      expect(() => normalizeRequiredString('x'.repeat(11), 'testType', 10)).toThrow(
        'testType is too long',
      );
      expect(() => normalizeRequiredString(7, 'testType')).toThrow('testType must be a string');
    });
  });

  describe('parseTestResultRouteParam', () => {
    it('returns the trimmed param when valid', () => {
      expect(parseTestResultRouteParam('  abc123  ', 'id')).toBe('abc123');
    });

    it('rejects a missing param as required', () => {
      expect(() => parseTestResultRouteParam(undefined, 'id')).toThrow('id is required');
    });

    it('rejects an oversized param using the route-param max length', () => {
      const oversized = 'a'.repeat(MAX_TEST_ID_LENGTH + 1);
      expect(() => parseTestResultRouteParam(oversized, 'id')).toThrow('id is too long');
    });
  });

  describe('toNullableString', () => {
    it('maps undefined, null and blank to null', () => {
      expect(toNullableString(undefined)).toBeNull();
      expect(toNullableString(null)).toBeNull();
      expect(toNullableString('   ')).toBeNull();
    });

    it('trims valid values', () => {
      expect(toNullableString('  LAB-001  ')).toBe('LAB-001');
    });

    it('uses the default field name in error messages', () => {
      expect(() => toNullableString(123)).toThrow('value must be a string');
    });
  });

  describe('normalizeOptionalQueryString', () => {
    it('returns undefined when the param is absent', () => {
      expect(normalizeOptionalQueryString(undefined, 'search', 200)).toBeUndefined();
    });

    it('trims a provided value', () => {
      expect(normalizeOptionalQueryString('  pavement  ', 'search', 200)).toBe('pavement');
    });

    it('rejects an explicitly empty value as "must not be empty"', () => {
      expect(() => normalizeOptionalQueryString('   ', 'search', 200)).toThrow(
        'search query parameter must not be empty',
      );
    });

    it('rejects values over the supplied maxLength', () => {
      expect(() => normalizeOptionalQueryString('x'.repeat(201), 'search', 200)).toThrow(
        'search is too long',
      );
    });
  });

  describe('parseRequestFormFormat', () => {
    it('defaults to html when the format is absent', () => {
      expect(parseRequestFormFormat(undefined)).toBe('html');
    });

    it('accepts the allowed formats and trims surrounding whitespace', () => {
      expect(parseRequestFormFormat('html')).toBe('html');
      expect(parseRequestFormFormat('json')).toBe('json');
      expect(parseRequestFormFormat('  json  ')).toBe('json');
    });

    it('rejects a non-string (repeated query param) value', () => {
      expect(() => parseRequestFormFormat(['html', 'json'])).toThrow(
        'format query parameter must be a single value',
      );
    });

    it('rejects an unsupported format with the allowed-values message', () => {
      expect(() => parseRequestFormFormat('pdf')).toThrow('format must be one of: html, json');
    });
  });

  describe('parseStrictDateOnlyMatch', () => {
    const match = (input: string) => {
      const result = DATE_ONLY_INPUT_PATTERN.exec(input);
      if (!result) {
        throw new Error(`test input ${input} did not match the date pattern`);
      }
      return result;
    };

    it('returns a UTC date for a real calendar date', () => {
      expect(parseStrictDateOnlyMatch(match('2026-05-29'))).toEqual(
        new Date(Date.UTC(2026, 4, 29)),
      );
    });

    it('returns null when the components do not form a real date', () => {
      expect(parseStrictDateOnlyMatch(match('2026-02-30'))).toBeNull();
      expect(parseStrictDateOnlyMatch(match('2026-13-01'))).toBeNull();
    });
  });

  describe('toNullableDate', () => {
    it('maps undefined, null and blank to null', () => {
      expect(toNullableDate(undefined, 'sampleDate')).toBeNull();
      expect(toNullableDate(null, 'sampleDate')).toBeNull();
      expect(toNullableDate('   ', 'sampleDate')).toBeNull();
    });

    it('parses a YYYY-MM-DD string into a UTC date', () => {
      expect(toNullableDate('2026-05-29', 'sampleDate')).toEqual(new Date(Date.UTC(2026, 4, 29)));
    });

    it('rejects wrongly formatted dates', () => {
      expect(() => toNullableDate('29-05-2026', 'sampleDate')).toThrow(
        'sampleDate must be a date in YYYY-MM-DD format',
      );
      expect(() => toNullableDate('2026/05/29', 'sampleDate')).toThrow(
        'sampleDate must be a date in YYYY-MM-DD format',
      );
    });

    it('rejects a well-formatted but impossible date', () => {
      expect(() => toNullableDate('2026-02-30', 'sampleDate')).toThrow(
        'sampleDate must be a valid date',
      );
    });
  });

  describe('toNullableFloat', () => {
    it('maps undefined, null and blank to null', () => {
      expect(toNullableFloat(undefined, 'resultValue')).toBeNull();
      expect(toNullableFloat(null, 'resultValue')).toBeNull();
      expect(toNullableFloat('   ', 'resultValue')).toBeNull();
    });

    it('parses decimals, signs, leading dots and exponents', () => {
      expect(toNullableFloat('97.5', 'resultValue')).toBe(97.5);
      expect(toNullableFloat('  -3.2 ', 'resultValue')).toBe(-3.2);
      expect(toNullableFloat('.5', 'resultValue')).toBe(0.5);
      expect(toNullableFloat('1e3', 'resultValue')).toBe(1000);
    });

    it('rejects non-numeric strings', () => {
      expect(() => toNullableFloat('12abc', 'resultValue')).toThrow(
        'resultValue must be a valid number',
      );
    });

    it('rejects non-string inputs as "must be a string"', () => {
      expect(() => toNullableFloat(5, 'resultValue')).toThrow('resultValue must be a string');
    });
  });

  describe('normalizePassFail', () => {
    it('returns the default when the value is absent or blank', () => {
      expect(normalizePassFail(undefined)).toBeUndefined();
      expect(normalizePassFail(undefined, 'pending')).toBe('pending');
      expect(normalizePassFail('   ', 'pending')).toBe('pending');
    });

    it('lowercases and trims accepted values', () => {
      expect(normalizePassFail('pass')).toBe('pass');
      expect(normalizePassFail('FAIL')).toBe('fail');
      expect(normalizePassFail('  Pending  ')).toBe('pending');
    });

    it('rejects unsupported values', () => {
      expect(() => normalizePassFail('maybe')).toThrow('passFail must be pass, fail, or pending');
    });
  });

  describe('AppError wire contract', () => {
    it('throws AppError.badRequest (HTTP 400 / VALIDATION_ERROR) for invalid input', () => {
      let caught: unknown;
      try {
        normalizeRequiredString(undefined, 'testType');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AppError);
      const appError = caught as AppError;
      expect(appError.statusCode).toBe(400);
      expect(appError.code).toBe('VALIDATION_ERROR');
      expect(appError.message).toBe('testType is required');
    });
  });
});
