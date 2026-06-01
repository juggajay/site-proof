import type { TestTypeSpecification } from './specifications.js';

export function mapTestSpecification(testType: string, spec: TestTypeSpecification) {
  return {
    testType,
    ...spec,
  };
}

export function buildTestSpecificationsResponse(
  specifications: Record<string, TestTypeSpecification>,
) {
  return {
    specifications: Object.entries(specifications).map(([key, spec]) =>
      mapTestSpecification(key, spec),
    ),
  };
}
