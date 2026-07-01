import { describe, expect, it } from 'vitest';

import {
  AUSTROADS_SPECIFICATION_SET,
  getDefaultSpecificationSetForState,
  getSpecificationSetOptionsForState,
  getSpecificationSetForStateChange,
  getStateSpecificationSet,
} from './projectSpecifications';

describe('project specification selection', () => {
  it('maps supported Australian states to their state-specific specification set', () => {
    expect(getStateSpecificationSet('NSW')).toBe('TfNSW');
    expect(getStateSpecificationSet('QLD')).toBe('MRTS');
    expect(getStateSpecificationSet('VIC')).toBe('VicRoads');
    expect(getStateSpecificationSet('SA')).toBe('DIT');
    expect(getStateSpecificationSet('WA')).toBe('MRWA');
  });

  it('defaults unsupported states to the Austroads national specification set', () => {
    expect(getDefaultSpecificationSetForState('TAS')).toBe(AUSTROADS_SPECIFICATION_SET);
    expect(getDefaultSpecificationSetForState('')).toBe(AUSTROADS_SPECIFICATION_SET);
  });

  it('keeps Austroads selected when the state changes but otherwise defaults to the new state spec', () => {
    expect(getSpecificationSetForStateChange('WA', 'Austroads')).toBe('Austroads');
    expect(getSpecificationSetForStateChange('WA', 'TfNSW')).toBe('MRWA');
    expect(getSpecificationSetForStateChange('QLD', '')).toBe('MRTS');
  });

  it('keeps national and custom options but removes unrelated state-specific specs', () => {
    const values = getSpecificationSetOptionsForState('QLD').map((option) => option.value);

    expect(values).toContain('Austroads');
    expect(values).toContain('MRTS');
    expect(values).toContain('custom');
    expect(values).not.toContain('TfNSW');
    expect(values).not.toContain('VicRoads');
    expect(values).not.toContain('DIT');
    expect(values).not.toContain('MRWA');
  });

  it('does not offer state-specific specs before a state is selected', () => {
    const values = getSpecificationSetOptionsForState('').map((option) => option.value);

    expect(values).toEqual(['Austroads', 'custom']);
  });
});
