import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildAbnValidationResponse } from './abnValidationResponse.js';

type AbnValidationResult = { valid: boolean; error?: string };

export interface SubcontractorAbnValidationRouterDependencies {
  abnMaxLength: number;
}

// Feature #483: ABN (Australian Business Number) validation
// ABN is an 11-digit number with a specific checksum algorithm
export function validateABN(abn: string): AbnValidationResult {
  if (!abn) {
    return { valid: true }; // ABN is optional
  }

  // Remove spaces and dashes
  const cleanABN = abn.replace(/[\s-]/g, '');

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(cleanABN)) {
    return { valid: false, error: 'ABN must be exactly 11 digits' };
  }

  // ABN validation algorithm (ATO specification)
  // 1. Subtract 1 from the first digit
  // 2. Multiply each digit by its weighting factor
  // 3. Sum the results
  // 4. If divisible by 89, ABN is valid
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanABN.split('').map(Number);

  // Subtract 1 from first digit
  digits[0] = digits[0] - 1;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN - checksum failed' };
  }

  return { valid: true };
}

export function createSubcontractorAbnValidationRouter({
  abnMaxLength,
}: SubcontractorAbnValidationRouterDependencies): Router {
  const router = Router();

  // Feature #483: POST /api/subcontractors/validate-abn - Validate an ABN
  router.post(
    '/validate-abn',
    asyncHandler(async (req, res) => {
      const { abn } = req.body;

      if (typeof abn !== 'string' || !abn.trim()) {
        throw AppError.badRequest('Please provide an ABN to validate');
      }
      if (abn.length > abnMaxLength) {
        throw AppError.badRequest(`ABN must be ${abnMaxLength} characters or fewer`);
      }

      const validation = validateABN(abn);

      res.json(buildAbnValidationResponse(abn, validation));
    }),
  );

  return router;
}
