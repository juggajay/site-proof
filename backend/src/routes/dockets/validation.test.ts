import { describe, expect, it } from 'vitest';
import {
  addLabourEntrySchema,
  addPlantEntrySchema,
  approveDocketSchema,
  createDocketSchema,
  optionalNullableTextSchema,
  optionalTimeSchema,
  parseDocketDate,
  parseDocketRouteParam,
  parseOptionalDocketStatus,
  parseRequiredQueryString,
  queryDocketSchema,
  rejectDocketSchema,
  respondDocketSchema,
  updateDocketSchema,
  updateLabourEntrySchema,
  updatePlantEntrySchema,
} from './validation.js';

const firstMessage = (result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}) => (result.success ? undefined : result.error?.issues[0]?.message);

describe('dockets validation helpers', () => {
  describe('createDocketSchema', () => {
    it('accepts a minimal payload (only projectId) and trims projectId', () => {
      const result = createDocketSchema.safeParse({ projectId: '  p1  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe('p1');
      }
    });

    it('strips legacy create-time hour totals because entries are the source of truth', () => {
      const result = createDocketSchema.safeParse({
        projectId: 'p1',
        date: '2026-01-15',
        labourHours: 8,
        plantHours: 0,
        notes: 'all good',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          projectId: 'p1',
          date: '2026-01-15',
          notes: 'all good',
        });
      }
    });

    it('requires projectId (missing -> zod default, blank -> custom message)', () => {
      // Missing key -> zod's default required message; present-but-blank -> custom min(1) message.
      expect(firstMessage(createDocketSchema.safeParse({}))).toBe('Required');
      expect(firstMessage(createDocketSchema.safeParse({ projectId: '   ' }))).toBe(
        'projectId is required',
      );
    });

    it('rejects an unparseable date string', () => {
      const result = createDocketSchema.safeParse({ projectId: 'p1', date: 'not-a-date' });
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Date must be valid');
    });

    it('ignores invalid legacy hour totals instead of accepting them into the create contract', () => {
      const result = createDocketSchema.safeParse({ projectId: 'p1', labourHours: -1 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('labourHours' in result.data).toBe(false);
      }
    });
  });

  describe('updateDocketSchema', () => {
    it('accepts empty, null, and string notes', () => {
      expect(updateDocketSchema.safeParse({}).success).toBe(true);
      expect(updateDocketSchema.safeParse({ notes: null }).success).toBe(true);
      expect(updateDocketSchema.safeParse({ notes: 'edited' }).success).toBe(true);
    });
  });

  describe('approveDocketSchema', () => {
    it('accepts an empty payload (all fields optional)', () => {
      expect(approveDocketSchema.safeParse({}).success).toBe(true);
    });

    it('accepts null adjustment text when hours are not adjusted', () => {
      const result = approveDocketSchema.safeParse({
        foremanNotes: null,
        adjustmentReason: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts adjusted hours when an adjustment reason is supplied', () => {
      const result = approveDocketSchema.safeParse({
        foremanNotes: null,
        adjustmentReason: 'Rounded after review',
        adjustedLabourHours: 0,
        adjustedPlantHours: 0,
      });
      expect(result.success).toBe(true);
    });

    it('allows adjusted-hour fields without a reason so the route can compare to submitted totals', () => {
      const result = approveDocketSchema.safeParse({
        adjustmentReason: null,
        adjustedLabourHours: 0,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative adjusted labour totals', () => {
      const result = approveDocketSchema.safeParse({ adjustedLabourHours: -0.5 });
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Adjusted labour total cannot be negative');
    });
  });

  describe('rejectDocketSchema', () => {
    it('requires a non-empty rejection reason', () => {
      expect(firstMessage(rejectDocketSchema.safeParse({}))).toBe('Rejection reason is required');
      expect(firstMessage(rejectDocketSchema.safeParse({ reason: null }))).toBe(
        'Rejection reason is required',
      );
      expect(firstMessage(rejectDocketSchema.safeParse({ reason: '   ' }))).toBe(
        'Rejection reason is required',
      );
      expect(rejectDocketSchema.safeParse({ reason: 'Hours do not match diary' }).success).toBe(
        true,
      );
    });
  });

  describe('queryDocketSchema', () => {
    it('accepts non-empty questions', () => {
      expect(queryDocketSchema.safeParse({ questions: 'why these hours?' }).success).toBe(true);
    });

    it('rejects a missing field with zod default and a blank field with the custom message', () => {
      // Missing key -> zod's default required message; present-but-blank -> custom min(1) message.
      expect(firstMessage(queryDocketSchema.safeParse({}))).toBe('Required');
      expect(firstMessage(queryDocketSchema.safeParse({ questions: '   ' }))).toBe(
        'Questions/issues are required',
      );
    });
  });

  describe('respondDocketSchema', () => {
    it('accepts a non-empty response', () => {
      expect(respondDocketSchema.safeParse({ response: 'corrected' }).success).toBe(true);
    });

    it('rejects a missing field with zod default and a blank field with the custom message', () => {
      // Missing key -> zod's default required message; present-but-blank -> custom min(1) message.
      expect(firstMessage(respondDocketSchema.safeParse({}))).toBe('Required');
      expect(firstMessage(respondDocketSchema.safeParse({ response: '  ' }))).toBe(
        'Response is required',
      );
    });
  });

  describe('optionalNullableTextSchema', () => {
    const schema = optionalNullableTextSchema('Notes', 10);

    it('passes undefined and null through', () => {
      expect(schema.safeParse(undefined).success).toBe(true);
      expect(schema.safeParse(null).success).toBe(true);
    });

    it('trims provided strings', () => {
      const result = schema.safeParse('  hello  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('rejects strings longer than the supplied maxLength', () => {
      const result = schema.safeParse('x'.repeat(11));
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Notes must be 10 characters or less');
    });
  });

  describe('optionalTimeSchema', () => {
    it('accepts undefined and valid HH:mm values', () => {
      expect(optionalTimeSchema.safeParse(undefined).success).toBe(true);
      expect(optionalTimeSchema.safeParse('09:30').success).toBe(true);
      expect(optionalTimeSchema.safeParse('23:59').success).toBe(true);
    });

    it('rejects out-of-range and malformed times with the HH:mm message', () => {
      expect(firstMessage(optionalTimeSchema.safeParse('9:30'))).toBe(
        'Time must be in HH:mm format',
      );
      expect(firstMessage(optionalTimeSchema.safeParse('24:00'))).toBe(
        'Time must be in HH:mm format',
      );
      expect(firstMessage(optionalTimeSchema.safeParse('12:60'))).toBe(
        'Time must be in HH:mm format',
      );
      expect(firstMessage(optionalTimeSchema.safeParse(''))).toBe('Time must be in HH:mm format');
    });
  });

  describe('addLabourEntrySchema / lot allocations', () => {
    it('accepts an entry with valid lot allocations', () => {
      const result = addLabourEntrySchema.safeParse({
        employeeId: 'e1',
        startTime: '07:00',
        finishTime: '15:30',
        lotAllocations: [{ lotId: 'lot-1', hours: 8 }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects a lot allocation of zero hours', () => {
      const result = addLabourEntrySchema.safeParse({
        employeeId: 'e1',
        startTime: '07:00',
        finishTime: '15:00',
        lotAllocations: [{ lotId: 'lot-1', hours: 0 }],
      });
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Lot allocation hours must be greater than 0');
    });

    it('rejects a labour entry whose start equals its finish (M86)', () => {
      const result = addLabourEntrySchema.safeParse({
        employeeId: 'e1',
        startTime: '07:00',
        finishTime: '07:00',
      });
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Start and finish time cannot be the same');
    });

    it('rejects a labour update whose start equals its finish, but allows a partial time update (M86)', () => {
      expect(
        updateLabourEntrySchema.safeParse({ startTime: '07:00', finishTime: '07:00' }).success,
      ).toBe(false);
      // Updating only one of the two times is fine (the handler keeps the other).
      expect(updateLabourEntrySchema.safeParse({ startTime: '07:00' }).success).toBe(true);
    });

    it('requires start and finish times on new labour entries', () => {
      expect(firstMessage(addLabourEntrySchema.safeParse({ employeeId: 'e1' }))).toBe(
        'Start time is required',
      );
      expect(
        firstMessage(addLabourEntrySchema.safeParse({ employeeId: 'e1', startTime: '07:00' })),
      ).toBe('Finish time is required');
    });
  });

  describe('plant entry schemas', () => {
    it('accepts a valid add-plant payload', () => {
      expect(
        addPlantEntrySchema.safeParse({ plantId: 'pl1', hoursOperated: 6, wetOrDry: 'wet' })
          .success,
      ).toBe(true);
    });

    it('rejects hours operated over 24', () => {
      const result = addPlantEntrySchema.safeParse({ plantId: 'pl1', hoursOperated: 25 });
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe('Hours operated must be 24 or less');
    });

    it('allows an empty update payload', () => {
      expect(updatePlantEntrySchema.safeParse({}).success).toBe(true);
    });
  });

  describe('parseOptionalDocketStatus', () => {
    it('returns undefined when value is undefined', () => {
      expect(parseOptionalDocketStatus(undefined)).toBeUndefined();
    });

    it('accepts a valid status and trims surrounding whitespace', () => {
      expect(parseOptionalDocketStatus('approved')).toBe('approved');
      expect(parseOptionalDocketStatus('  pending_approval  ')).toBe('pending_approval');
    });

    it('throws on unknown status values', () => {
      expect(() => parseOptionalDocketStatus('bogus')).toThrow('Invalid docket status');
    });

    it('throws on non-string values', () => {
      expect(() => parseOptionalDocketStatus(5)).toThrow('Invalid docket status');
      expect(() => parseOptionalDocketStatus(['approved', 'draft'])).toThrow(
        'Invalid docket status',
      );
    });
  });

  describe('parseRequiredQueryString', () => {
    it('returns the trimmed value', () => {
      expect(parseRequiredQueryString('  abc  ', 'projectId')).toBe('abc');
    });

    it('throws "required" for missing, empty, blank, or non-string values', () => {
      expect(() => parseRequiredQueryString(undefined, 'projectId')).toThrow(
        'projectId query parameter is required',
      );
      expect(() => parseRequiredQueryString('', 'projectId')).toThrow(
        'projectId query parameter is required',
      );
      expect(() => parseRequiredQueryString('   ', 'projectId')).toThrow(
        'projectId query parameter is required',
      );
      expect(() => parseRequiredQueryString(['a', 'b'], 'projectId')).toThrow(
        'projectId query parameter is required',
      );
    });

    it('throws "too long" past the id length cap', () => {
      expect(() => parseRequiredQueryString('x'.repeat(121), 'projectId')).toThrow(
        'projectId query parameter is too long',
      );
    });
  });

  describe('parseDocketRouteParam', () => {
    it('returns the trimmed value', () => {
      expect(parseDocketRouteParam('  abc ', 'id')).toBe('abc');
    });

    it('throws "must be a single value" for non-string values', () => {
      expect(() => parseDocketRouteParam(123, 'id')).toThrow('id must be a single value');
      expect(() => parseDocketRouteParam(['a', 'b'], 'id')).toThrow('id must be a single value');
    });

    it('throws "is required" for empty/blank strings', () => {
      expect(() => parseDocketRouteParam('', 'id')).toThrow('id is required');
      expect(() => parseDocketRouteParam('   ', 'id')).toThrow('id is required');
    });

    it('throws "is too long" past the id length cap', () => {
      expect(() => parseDocketRouteParam('x'.repeat(121), 'id')).toThrow('id is too long');
    });
  });

  describe('parseDocketDate', () => {
    it('returns today at UTC midnight for missing/blank input', () => {
      for (const value of [undefined, null, '', '   ']) {
        const result = parseDocketDate(value);
        expect(result).toBeInstanceOf(Date);
        expect(Number.isNaN(result.getTime())).toBe(false);
        expect(result.toISOString()).toContain('T00:00:00.000Z');
      }
    });

    it('parses a valid date-only string as UTC midnight', () => {
      expect(parseDocketDate('2026-01-15').toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('normalizes date-time strings to the provided date component at UTC midnight', () => {
      expect(parseDocketDate('2026-01-15T13:45:00+11:00').toISOString()).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });

    it('throws on non-string values', () => {
      expect(() => parseDocketDate(123)).toThrow('Date must be valid');
    });

    it('throws on wrong-format strings', () => {
      expect(() => parseDocketDate('2026/01/15')).toThrow('Date must be valid');
      expect(() => parseDocketDate('15-01-2026')).toThrow('Date must be valid');
    });

    it('throws on impossible date components (rollover guard)', () => {
      expect(() => parseDocketDate('2026-02-30')).toThrow('Date must be valid');
      expect(() => parseDocketDate('2026-13-01')).toThrow('Date must be valid');
    });
  });
});
