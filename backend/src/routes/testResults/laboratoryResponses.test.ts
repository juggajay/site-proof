import { describe, expect, it } from 'vitest';
import { buildLaboratoriesResponse } from './laboratoryResponses.js';

describe('buildLaboratoriesResponse', () => {
  it('preserves the laboratory list response shape', () => {
    expect(buildLaboratoriesResponse(['Lab A', 'Lab B'])).toEqual({
      laboratories: ['Lab A', 'Lab B'],
    });
  });

  it('preserves the empty response used by inaccessible or unassigned scopes', () => {
    expect(buildLaboratoriesResponse([])).toEqual({ laboratories: [] });
  });

  it('filters null grouped values before returning laboratory names', () => {
    expect(buildLaboratoriesResponse(['Lab A', null, 'Lab B'])).toEqual({
      laboratories: ['Lab A', 'Lab B'],
    });
  });
});
