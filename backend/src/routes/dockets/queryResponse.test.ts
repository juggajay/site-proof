import { describe, expect, it } from 'vitest';
import { buildQueryResponseNotes } from './queryResponse.js';

describe('buildQueryResponseNotes (pure, DB-free)', () => {
  it('uses only the separator + response when there are no existing notes', () => {
    expect(buildQueryResponseNotes('', 'Fixed the hours')).toBe(
      '--- Response to Query ---\nFixed the hours',
    );
  });

  it('treats null/undefined existing notes the same as no notes', () => {
    expect(buildQueryResponseNotes(null, 'Fixed the hours')).toBe(
      '--- Response to Query ---\nFixed the hours',
    );
    expect(buildQueryResponseNotes(undefined, 'Fixed the hours')).toBe(
      '--- Response to Query ---\nFixed the hours',
    );
  });

  it('appends to existing notes with exactly two leading newlines before the separator', () => {
    expect(buildQueryResponseNotes('Original site note', 'Adjusted plant hours')).toBe(
      'Original site note\n\n--- Response to Query ---\nAdjusted plant hours',
    );
  });

  it('treats whitespace-only existing notes as existing (truthy) and preserves them verbatim', () => {
    expect(buildQueryResponseNotes('   ', 'resp')).toBe('   \n\n--- Response to Query ---\nresp');
  });

  it('does not trim or otherwise mutate the response text', () => {
    const response = '   leading + trailing spaces and a\nline break   ';
    const result = buildQueryResponseNotes(null, response);
    expect(result).toBe(`--- Response to Query ---\n${response}`);
    expect(result.endsWith(response)).toBe(true);
  });

  it('produces repeated response sections in order when called on its prior output', () => {
    const first = buildQueryResponseNotes('Base', 'first response');
    const second = buildQueryResponseNotes(first, 'second response');
    expect(second).toBe(
      'Base\n\n--- Response to Query ---\nfirst response\n\n--- Response to Query ---\nsecond response',
    );
  });
});
