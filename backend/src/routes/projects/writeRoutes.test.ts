import { describe, expect, it } from 'vitest';

import { getDefaultProjectSpecificationSet } from './writeRoutes.js';

describe('project write route specification defaults', () => {
  it('maps state-specific project standards for omitted specification sets', () => {
    expect(getDefaultProjectSpecificationSet('NSW')).toBe('TfNSW');
    expect(getDefaultProjectSpecificationSet('QLD')).toBe('MRTS');
    expect(getDefaultProjectSpecificationSet('VIC')).toBe('VicRoads');
    expect(getDefaultProjectSpecificationSet('SA')).toBe('DIT');
    expect(getDefaultProjectSpecificationSet('WA')).toBe('MRWA');
  });

  it('uses Austroads as the fallback for states without a state-specific library', () => {
    expect(getDefaultProjectSpecificationSet('TAS')).toBe('Austroads');
    expect(getDefaultProjectSpecificationSet(null)).toBe('Austroads');
  });
});
