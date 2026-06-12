import { describe, expect, it } from 'vitest';
import {
  HOURS_INPUT_ERROR,
  buildDocketActionPath,
  buildDocketActionPayload,
  buildDocketDetailPath,
  getDocketApprovalDiarySyncWarning,
  hasHoursChanged,
  parseHoursInput,
  resolveDocketActionEndpoint,
  statusColors,
  statusLabels,
  validateHours,
} from './docketActionData';

describe('parseHoursInput', () => {
  it('treats blank/whitespace input as zero', () => {
    expect(parseHoursInput('')).toBe(0);
    expect(parseHoursInput('   ')).toBe(0);
  });

  it('parses whole and decimal hours, trimming surrounding whitespace', () => {
    expect(parseHoursInput('8')).toBe(8);
    expect(parseHoursInput('7.5')).toBe(7.5);
    expect(parseHoursInput('  3.25  ')).toBe(3.25);
    expect(parseHoursInput('0')).toBe(0);
  });

  it('rejects scientific notation, negatives, and non-numeric input', () => {
    expect(parseHoursInput('1e2')).toBeNull();
    expect(parseHoursInput('-5')).toBeNull();
    expect(parseHoursInput('abc')).toBeNull();
    expect(parseHoursInput('5h')).toBeNull();
  });
});

describe('hasHoursChanged', () => {
  it('is false when the parsed value equals the submitted value', () => {
    expect(hasHoursChanged('8', 8)).toBe(false);
    expect(hasHoursChanged('', 0)).toBe(false);
  });

  it('is true when the parsed value differs from the submitted value', () => {
    expect(hasHoursChanged('7.5', 8)).toBe(true);
    // Blank parses to 0, which differs from a non-zero submitted value.
    expect(hasHoursChanged('', 5)).toBe(true);
  });

  it('is false when the input cannot be parsed', () => {
    expect(hasHoursChanged('1e2', 8)).toBe(false);
    expect(hasHoursChanged('abc', 8)).toBe(false);
  });
});

describe('validateHours', () => {
  it('accepts blank input with no warning', () => {
    expect(validateHours('')).toEqual({ isValid: true, warning: null });
  });

  it('flags negative input', () => {
    expect(validateHours('-5')).toEqual({ isValid: false, warning: 'Hours cannot be negative' });
  });

  it('flags un-parseable input with the decimal error', () => {
    expect(validateHours('1e2')).toEqual({ isValid: false, warning: HOURS_INPUT_ERROR });
    expect(validateHours('abc')).toEqual({ isValid: false, warning: HOURS_INPUT_ERROR });
  });

  it('warns (but stays valid) when hours exceed 24', () => {
    expect(validateHours('25')).toEqual({
      isValid: true,
      warning: 'Warning: Hours exceed 24 - please verify this is correct',
    });
  });

  it('accepts normal hours up to and including 24 with no warning', () => {
    expect(validateHours('8')).toEqual({ isValid: true, warning: null });
    expect(validateHours('24')).toEqual({ isValid: true, warning: null });
  });
});

describe('resolveDocketActionEndpoint', () => {
  it('maps approve and reject to their own endpoints', () => {
    expect(resolveDocketActionEndpoint('approve')).toBe('approve');
    expect(resolveDocketActionEndpoint('reject')).toBe('reject');
  });

  it('maps query and any other type to the query endpoint', () => {
    expect(resolveDocketActionEndpoint('query')).toBe('query');
    expect(resolveDocketActionEndpoint('view')).toBe('query');
  });
});

describe('path builders', () => {
  it('builds the docket detail path, encoding the id', () => {
    expect(buildDocketDetailPath('docket-1')).toBe('/api/dockets/docket-1');
    expect(buildDocketDetailPath('a/b')).toBe('/api/dockets/a%2Fb');
  });

  it('builds the docket action path, encoding the id', () => {
    expect(buildDocketActionPath('docket-1', 'approve')).toBe('/api/dockets/docket-1/approve');
    expect(buildDocketActionPath('a b', 'reject')).toBe('/api/dockets/a%20b/reject');
    expect(buildDocketActionPath('docket-1', 'query')).toBe('/api/dockets/docket-1/query');
  });
});

describe('buildDocketActionPayload', () => {
  it('shapes the approve payload with trimmed notes/reason and parsed adjusted hours', () => {
    expect(
      buildDocketActionPayload('approve', {
        actionNotes: '  good work  ',
        adjustedLabourHours: 7.5,
        adjustedPlantHours: 3.25,
        adjustmentReason: '  corrected totals  ',
      }),
    ).toEqual({
      foremanNotes: 'good work',
      adjustedLabourHours: 7.5,
      adjustedPlantHours: 3.25,
      adjustmentReason: 'corrected totals',
    });
  });

  it('nulls empty approve notes and reason', () => {
    expect(
      buildDocketActionPayload('approve', {
        actionNotes: '   ',
        adjustedLabourHours: 8,
        adjustedPlantHours: 3,
        adjustmentReason: '',
      }),
    ).toEqual({
      foremanNotes: null,
      adjustedLabourHours: 8,
      adjustedPlantHours: 3,
      adjustmentReason: null,
    });
  });

  // Mirrors the e2e "renders and approves the seeded pending docket" POST body.
  it('matches the seeded approve contract (trimmed notes, defaulted hours, null reason)', () => {
    expect(
      buildDocketActionPayload('approve', {
        actionNotes: '  Approved in E2E  ',
        adjustedLabourHours: 8,
        adjustedPlantHours: 3,
        adjustmentReason: '',
      }),
    ).toEqual({
      foremanNotes: 'Approved in E2E',
      adjustedLabourHours: 8,
      adjustedPlantHours: 3,
      adjustmentReason: null,
    });
  });

  it('shapes the query payload with trimmed questions', () => {
    expect(
      buildDocketActionPayload('query', {
        actionNotes: '  please clarify  ',
        adjustmentReason: '',
      }),
    ).toEqual({ questions: 'please clarify' });
  });

  it('shapes the reject payload, nulling empty reasons', () => {
    expect(
      buildDocketActionPayload('reject', {
        actionNotes: '  not acceptable ',
        adjustmentReason: '',
      }),
    ).toEqual({ reason: 'not acceptable' });
    expect(
      buildDocketActionPayload('reject', { actionNotes: '   ', adjustmentReason: '' }),
    ).toEqual({ reason: null });
  });
});

describe('getDocketApprovalDiarySyncWarning', () => {
  it('returns the diary sync message when approval succeeded but diary sync did not', () => {
    expect(
      getDocketApprovalDiarySyncWarning({
        diarySync: {
          status: 'skipped',
          code: 'DIARY_LOCKED',
          message:
            'Docket approved, but diary auto-population was skipped because the daily diary is locked.',
        },
      }),
    ).toBe(
      'Docket approved, but diary auto-population was skipped because the daily diary is locked.',
    );
  });

  it('does not warn when the diary sync succeeded or was not reported', () => {
    expect(
      getDocketApprovalDiarySyncWarning({
        diarySync: {
          status: 'synced',
          message: 'Diary auto-populated from approved docket.',
        },
      }),
    ).toBeNull();
    expect(getDocketApprovalDiarySyncWarning({})).toBeNull();
  });
});

describe('status display maps', () => {
  it('exposes labels and colours for every docket status', () => {
    expect(statusLabels.pending_approval).toBe('Pending Approval');
    expect(statusLabels.approved).toBe('Approved');
    expect(statusLabels.rejected).toBe('Rejected');
    expect(statusLabels.queried).toBe('Queried');
    expect(statusLabels.draft).toBe('Draft');
    expect(statusColors.pending_approval).toContain('text-muted-foreground');
    expect(statusColors.approved).toContain('text-muted-foreground');
  });
});
