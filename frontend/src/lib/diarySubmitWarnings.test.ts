import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { extractSubmitWarnings } from './diarySubmitWarnings';

function gate422(details: unknown): ApiError {
  return new ApiError(422, JSON.stringify({ error: { details } }));
}

describe('extractSubmitWarnings (M30)', () => {
  it('returns the server warning list for a 422 acknowledgement gate', () => {
    const err = gate422({
      requiresAcknowledgement: true,
      warnings: ['Weather conditions not recorded', 'No personnel recorded'],
    });

    expect(extractSubmitWarnings(err)).toEqual([
      'Weather conditions not recorded',
      'No personnel recorded',
    ]);
  });

  it('drops empty/whitespace-only warnings', () => {
    const err = gate422({
      requiresAcknowledgement: true,
      warnings: ['Real warning', '', '   ', 42, null],
    });

    expect(extractSubmitWarnings(err)).toEqual(['Real warning']);
  });

  it('returns null when the gate has no usable warnings', () => {
    const err = gate422({ requiresAcknowledgement: true, warnings: ['', '  '] });
    expect(extractSubmitWarnings(err)).toBeNull();
  });

  it('returns null when acknowledgement is not required', () => {
    const err = gate422({ requiresAcknowledgement: false, warnings: ['ignored'] });
    expect(extractSubmitWarnings(err)).toBeNull();
  });

  it('returns null when warnings is not an array', () => {
    const err = gate422({ requiresAcknowledgement: true, warnings: 'nope' });
    expect(extractSubmitWarnings(err)).toBeNull();
  });

  it('returns null for a non-422 ApiError', () => {
    const err = new ApiError(
      500,
      JSON.stringify({ error: { details: { requiresAcknowledgement: true, warnings: ['x'] } } }),
    );
    expect(extractSubmitWarnings(err)).toBeNull();
  });

  it('returns null for a non-ApiError (e.g. a network failure)', () => {
    expect(extractSubmitWarnings(new Error('network down'))).toBeNull();
    expect(extractSubmitWarnings(null)).toBeNull();
  });
});
