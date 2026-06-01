import { describe, expect, it } from 'vitest';
import { buildTestSpecificationsResponse, mapTestSpecification } from './specificationResponses.js';
import { testTypeSpecifications } from './specifications.js';

describe('test result specification response helpers', () => {
  it('maps one specification with the testType field first-class in the response', () => {
    expect(mapTestSpecification('compaction', testTypeSpecifications.compaction)).toEqual({
      testType: 'compaction',
      name: 'Compaction Test',
      description: 'Relative compaction as percentage of maximum dry density',
      specificationMin: 95,
      specificationMax: 100,
      unit: '% MDD',
      specReference: 'TMR MRTS04 / AS 1289.5.4.1',
    });
  });

  it('preserves the list response shape and ordered specification keys', () => {
    const response = buildTestSpecificationsResponse(testTypeSpecifications);

    expect(response.specifications.map((spec) => spec.testType)).toEqual([
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

  it('does not mutate representative spec values while wrapping them', () => {
    const response = buildTestSpecificationsResponse(testTypeSpecifications);

    expect(response.specifications.find((spec) => spec.testType === 'concrete_strength')).toEqual({
      testType: 'concrete_strength',
      name: 'Concrete Compressive Strength',
      description: '28-day compressive strength',
      specificationMin: 32,
      specificationMax: null,
      unit: 'MPa',
      specReference: 'AS 1012.9',
    });
  });
});
