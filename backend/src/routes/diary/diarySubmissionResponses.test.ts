import { describe, expect, it } from 'vitest';

import {
  buildDiaryAddendumCreatedResponse,
  buildDiaryAddendumsResponse,
  buildDiarySubmitResponse,
  buildDiaryValidationResponse,
} from './diarySubmissionResponses.js';

describe('diary submission response helpers', () => {
  it('preserves validation response shape and canSubmit mirror', () => {
    const warnings = [
      {
        section: 'weather',
        message: 'Weather information is not filled in',
        severity: 'warning' as const,
      },
    ];
    const errors = [{ section: 'personnel', message: 'Missing personnel' }];
    const summary = {
      personnel: 0,
      activities: 1,
      plant: 2,
      delays: 0,
      visitors: 3,
      hasWeather: false,
    };

    expect(
      buildDiaryValidationResponse({
        isValid: false,
        hasWarnings: true,
        errors,
        warnings,
        summary,
      }),
    ).toEqual({
      isValid: false,
      hasWarnings: true,
      canSubmit: false,
      errors,
      warnings,
      summary,
    });
  });

  it('preserves submit response envelope', () => {
    const diary = { id: 'diary-1', status: 'submitted' };

    expect(buildDiarySubmitResponse(diary, true)).toEqual({
      diary,
      warningsAcknowledged: true,
    });
  });

  it('preserves raw addendum create and list responses', () => {
    const addendum = { id: 'addendum-1', content: 'Late note' };

    expect(buildDiaryAddendumCreatedResponse(addendum)).toBe(addendum);
    expect(buildDiaryAddendumsResponse([addendum])).toEqual([addendum]);
  });
});
