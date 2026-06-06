import { z } from 'zod';

import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

// Lot number length constraints
export const LOT_NUMBER_MIN_LENGTH = 3;
export const LOT_NUMBER_MAX_LENGTH = 50;

// Chainage min/max constraints
export const CHAINAGE_MIN = 0;
export const CHAINAGE_MAX = 999999;

export const parseChainageInput = (value: string): number | null => {
  return parseOptionalNonNegativeDecimalInput(value);
};

const isValidOptionalChainage = (value: string): boolean => {
  return value.trim() === '' || parseChainageInput(value) !== null;
};

export const createLotSchema = z
  .object({
    lotNumber: z
      .string()
      .trim()
      .min(1, 'Lot Number is required')
      .min(LOT_NUMBER_MIN_LENGTH, `Lot Number must be at least ${LOT_NUMBER_MIN_LENGTH} characters`)
      .max(LOT_NUMBER_MAX_LENGTH, `Lot Number must be at most ${LOT_NUMBER_MAX_LENGTH} characters`),
    description: z.string().trim(),
    activityType: z.string().trim(),
    chainageStart: z
      .string()
      .trim()
      .refine(isValidOptionalChainage, 'Chainage Start must be a valid number'),
    chainageEnd: z
      .string()
      .trim()
      .refine(isValidOptionalChainage, 'Chainage End must be a valid number'),
    assignedSubcontractorId: z.string().trim(),
    canCompleteITP: z.boolean(),
    itpRequiresVerification: z.boolean(),
  })
  .refine(
    (data) => {
      const startNum = parseChainageInput(data.chainageStart);
      const endNum = parseChainageInput(data.chainageEnd);
      if (startNum !== null && endNum !== null && endNum < startNum) {
        return false;
      }
      return true;
    },
    {
      message: 'Chainage End must be greater than or equal to Chainage Start',
      path: ['chainageEnd'],
    },
  )
  .refine(
    (data) => {
      const startNum = parseChainageInput(data.chainageStart);
      if (startNum !== null && (startNum < CHAINAGE_MIN || startNum > CHAINAGE_MAX)) {
        return false;
      }
      return true;
    },
    {
      message: `Chainage Start must be between ${CHAINAGE_MIN} and ${CHAINAGE_MAX}`,
      path: ['chainageStart'],
    },
  )
  .refine(
    (data) => {
      const endNum = parseChainageInput(data.chainageEnd);
      if (endNum !== null && (endNum < CHAINAGE_MIN || endNum > CHAINAGE_MAX)) {
        return false;
      }
      return true;
    },
    {
      message: `Chainage End must be between ${CHAINAGE_MIN} and ${CHAINAGE_MAX}`,
      path: ['chainageEnd'],
    },
  );

export type CreateLotFormData = z.infer<typeof createLotSchema>;

export const CREATE_LOT_DEFAULT_VALUES: CreateLotFormData = {
  lotNumber: '',
  description: '',
  activityType: 'Earthworks',
  chainageStart: '',
  chainageEnd: '',
  assignedSubcontractorId: '',
  canCompleteITP: false,
  itpRequiresVerification: true,
};
