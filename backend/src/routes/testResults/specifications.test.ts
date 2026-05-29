import { describe, expect, it } from 'vitest';
import { testTypeSpecifications } from './specifications.js';

describe('testTypeSpecifications', () => {
  it('exposes the compaction spec with its AU standard values', () => {
    expect(testTypeSpecifications.compaction).toMatchObject({
      name: 'Compaction Test',
      description: 'Relative compaction as percentage of maximum dry density',
      specificationMin: 95,
      specificationMax: 100,
      unit: '% MDD',
      specReference: 'TMR MRTS04 / AS 1289.5.4.1',
    });
  });

  it('keeps the full set of known test-type keys in order', () => {
    expect(Object.keys(testTypeSpecifications)).toEqual([
      'compaction',
      'cbr',
      'moisture_content',
      'plasticity_index',
      'liquid_limit',
      'grading',
      'sand_equivalent',
      'concrete_slump',
      'concrete_strength',
      'asphalt_density',
      'asphalt_thickness',
      'dcp',
      'permeability',
    ]);
  });

  it('preserves other representative specs (guards accidental truncation)', () => {
    expect(testTypeSpecifications.cbr).toMatchObject({
      name: 'California Bearing Ratio (CBR)',
      specificationMin: 15,
      specificationMax: null,
      unit: '%',
    });
    expect(testTypeSpecifications.concrete_strength).toMatchObject({
      name: 'Concrete Compressive Strength',
      specificationMin: 32,
      specificationMax: null,
      unit: 'MPa',
      specReference: 'AS 1012.9',
    });
    expect(testTypeSpecifications.permeability).toMatchObject({
      name: 'Permeability Test',
      unit: 'm/s',
    });
  });
});
