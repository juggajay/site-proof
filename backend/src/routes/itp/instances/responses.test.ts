import { describe, expect, it } from 'vitest';

import { buildItpInstanceResponse } from './responses.js';

describe('ITP instance response helpers', () => {
  it('preserves instance envelope for created and fetched instances', () => {
    const instance = { id: 'instance-1', lotId: 'lot-1' };

    expect(buildItpInstanceResponse(instance)).toEqual({ instance });
  });

  it('preserves null instance envelope for unassigned lots', () => {
    expect(buildItpInstanceResponse(null)).toEqual({ instance: null });
  });
});
