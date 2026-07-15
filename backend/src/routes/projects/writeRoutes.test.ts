import { describe, expect, it } from 'vitest';

import {
  getDefaultProjectSpecificationSet,
  resolveProjectSpecificationSet,
} from './writeRoutes.js';

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

describe('resolveProjectSpecificationSet', () => {
  it('derives Austroads (not TfNSW) when both state and spec set are omitted', () => {
    expect(resolveProjectSpecificationSet(undefined, undefined)).toBe('Austroads');
    expect(resolveProjectSpecificationSet(null, null)).toBe('Austroads');
    expect(resolveProjectSpecificationSet('', '')).toBe('Austroads');
  });

  it('derives the state library when only the state is provided', () => {
    expect(resolveProjectSpecificationSet(undefined, 'QLD')).toBe('MRTS');
    expect(resolveProjectSpecificationSet(null, 'NSW')).toBe('TfNSW');
  });

  it('lets an explicit specification set win over the state derivation', () => {
    expect(resolveProjectSpecificationSet('VicRoads', 'NSW')).toBe('VicRoads');
    expect(resolveProjectSpecificationSet('CustomSpec', undefined)).toBe('CustomSpec');
  });
});
