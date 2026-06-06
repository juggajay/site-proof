import { z } from 'zod';

export const DIARY_SHORT_TEXT_MAX_LENGTH = 120;
const DIARY_LONG_TEXT_MAX_LENGTH = 5000;
const DIARY_ID_MAX_LENGTH = 128;
const DIARY_QUANTITY_MAX = 1_000_000_000;
const DIARY_DAILY_HOURS_MAX = 24;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
}

function normalizeRequiredString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function requiredText(fieldName: string, maxLength = DIARY_SHORT_TEXT_MAX_LENGTH) {
  return z.preprocess(
    normalizeRequiredString,
    z
      .string({
        required_error: `${fieldName} is required`,
        invalid_type_error: `${fieldName} must be text`,
      })
      .min(1, `${fieldName} is required`)
      .max(maxLength, `${fieldName} is too long`),
  );
}

function optionalText(fieldName: string, maxLength = DIARY_SHORT_TEXT_MAX_LENGTH) {
  return z.preprocess(
    normalizeOptionalString,
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} is too long`)
      .optional(),
  );
}

function optionalTime(fieldName: string) {
  return z.preprocess(
    normalizeOptionalString,
    z
      .string({ invalid_type_error: `${fieldName} must be a time` })
      .regex(TIME_PATTERN, `${fieldName} must be in HH:mm format`)
      .optional(),
  );
}

function optionalDailyHours(fieldName: string) {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .finite(`${fieldName} must be finite`)
    .gt(0, `${fieldName} must be greater than 0`)
    .max(DIARY_DAILY_HOURS_MAX, `${fieldName} cannot exceed ${DIARY_DAILY_HOURS_MAX}`)
    .optional();
}

function optionalNonNegativeQuantity(fieldName: string) {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .finite(`${fieldName} must be finite`)
    .min(0, `${fieldName} cannot be negative`)
    .max(DIARY_QUANTITY_MAX, `${fieldName} is too large`)
    .optional();
}

export const addPersonnelSchema = z.object({
  name: requiredText('name'),
  company: optionalText('company'),
  role: optionalText('role'),
  startTime: optionalTime('startTime'),
  finishTime: optionalTime('finishTime'),
  hours: optionalDailyHours('hours'),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

export const addPlantSchema = z.object({
  description: requiredText('description'),
  idRego: optionalText('idRego'),
  company: optionalText('company'),
  hoursOperated: optionalDailyHours('hoursOperated'),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

export const addActivitySchema = z.object({
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  quantity: optionalNonNegativeQuantity('quantity'),
  unit: optionalText('unit'),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
});

export const addDelaySchema = z.object({
  delayType: requiredText('delayType'),
  startTime: optionalTime('startTime'),
  endTime: optionalTime('endTime'),
  durationHours: optionalDailyHours('durationHours'),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  impact: optionalText('impact', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

export const addVisitorSchema = z.object({
  name: requiredText('name'),
  company: optionalText('company'),
  purpose: optionalText('purpose', DIARY_LONG_TEXT_MAX_LENGTH),
  timeInOut: optionalText('timeInOut'),
});

export const addDeliverySchema = z.object({
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  supplier: optionalText('supplier'),
  docketNumber: optionalText('docketNumber'),
  quantity: optionalNonNegativeQuantity('quantity'),
  unit: optionalText('unit'),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
});

export const addEventSchema = z.object({
  eventType: z.enum(['visitor', 'safety', 'instruction', 'variation', 'other']),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});
