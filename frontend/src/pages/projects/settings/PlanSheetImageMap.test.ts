import { describe, expect, it } from 'vitest';

import { isPointInImage } from './PlanSheetImageMap';

describe('isPointInImage', () => {
  it('accepts points inside the sheet and on its edges', () => {
    expect(isPointInImage({ px: 10, py: 10 }, 100, 200)).toBe(true);
    expect(isPointInImage({ px: 0, py: 0 }, 100, 200)).toBe(true);
    expect(isPointInImage({ px: 100, py: 200 }, 100, 200)).toBe(true);
  });

  it('rejects negative and out-of-range clicks in the map margin', () => {
    expect(isPointInImage({ px: -5, py: 10 }, 100, 200)).toBe(false);
    expect(isPointInImage({ px: 10, py: -1 }, 100, 200)).toBe(false);
    expect(isPointInImage({ px: 120, py: 10 }, 100, 200)).toBe(false);
    expect(isPointInImage({ px: 10, py: 250 }, 100, 200)).toBe(false);
  });
});
