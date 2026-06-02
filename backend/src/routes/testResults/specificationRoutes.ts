import { Router } from 'express';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { MAX_TEST_TYPE_LENGTH, parseTestResultRouteParam } from './validation.js';
import { testTypeSpecifications } from './specifications.js';
import { buildTestSpecificationsResponse, mapTestSpecification } from './specificationResponses.js';

export const specificationRoutes = Router();

// GET /api/test-results/specifications - Get all test type specifications
specificationRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(buildTestSpecificationsResponse(testTypeSpecifications));
  }),
);

// GET /api/test-results/specifications/:testType - Get specification for a specific test type
specificationRoutes.get(
  '/:testType',
  asyncHandler(async (req, res) => {
    const testType = parseTestResultRouteParam(
      req.params.testType,
      'testType',
      MAX_TEST_TYPE_LENGTH,
    );

    // Normalize test type key (lowercase, replace spaces with underscore)
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_');

    const spec = testTypeSpecifications[normalizedType];

    if (!spec) {
      // Try to find a partial match
      const partialMatch = Object.entries(testTypeSpecifications).find(
        ([key, value]) =>
          key.includes(normalizedType) || value.name.toLowerCase().includes(testType.toLowerCase()),
      );

      if (partialMatch) {
        return res.json(mapTestSpecification(partialMatch[0], partialMatch[1]));
      }

      throw new AppError(404, `No specification found for test type: ${testType}`, 'NOT_FOUND', {
        availableTypes: Object.keys(testTypeSpecifications),
      });
    }

    res.json(mapTestSpecification(normalizedType, spec));
  }),
);
