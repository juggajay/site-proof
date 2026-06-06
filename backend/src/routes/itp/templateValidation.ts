import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';

export const MAX_TEMPLATE_NAME_LENGTH = 160;
export const MAX_TEMPLATE_DESCRIPTION_LENGTH = 1000;
export const MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH = 1000;
export const MAX_SHORT_TEXT_LENGTH = 120;
export const MAX_CHECKLIST_ITEMS = 500;
export const MAX_PROPAGATE_INSTANCES = 500;
export const MAX_TEMPLATE_ID_LENGTH = 128;

const requiredText = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} must be ${maxLength} characters or less`);

const optionalText = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must be ${maxLength} characters or less`)
    .optional()
    .nullable();

export const checklistItemSchema = z.object({
  description: requiredText('description', MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH),
  pointType: requiredText('pointType', MAX_SHORT_TEXT_LENGTH).optional(),
  isHoldPoint: z.boolean().optional(),
  category: requiredText('category', MAX_SHORT_TEXT_LENGTH).optional(),
  responsibleParty: requiredText('responsibleParty', MAX_SHORT_TEXT_LENGTH).optional(),
  evidenceRequired: requiredText('evidenceRequired', MAX_SHORT_TEXT_LENGTH).optional(),
  acceptanceCriteria: optionalText('acceptanceCriteria', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  testType: optionalText('testType', MAX_SHORT_TEXT_LENGTH),
});

export const createTemplateSchema = z.object({
  projectId: z.string().max(MAX_TEMPLATE_ID_LENGTH, 'projectId is too long').uuid(),
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH),
  description: optionalText('description', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  activityType: requiredText('activityType', MAX_SHORT_TEXT_LENGTH),
  checklistItems: z
    .array(checklistItemSchema)
    .max(MAX_CHECKLIST_ITEMS, `Cannot add more than ${MAX_CHECKLIST_ITEMS} checklist items`)
    .optional(),
});

export const cloneTemplateSchema = z.object({
  projectId: z.string().max(MAX_TEMPLATE_ID_LENGTH, 'projectId is too long').uuid().optional(),
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH).optional(),
});

export const updateTemplateSchema = z.object({
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH).optional(),
  description: optionalText('description', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  activityType: requiredText('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
  checklistItems: z
    .array(checklistItemSchema)
    .max(MAX_CHECKLIST_ITEMS, `Cannot add more than ${MAX_CHECKLIST_ITEMS} checklist items`)
    .optional(),
  isActive: z.boolean().optional(),
});

export const propagateTemplateSchema = z.object({
  instanceIds: z
    .array(z.string().max(MAX_TEMPLATE_ID_LENGTH, 'instanceId is too long').uuid())
    .min(1, 'instanceIds array is required')
    .max(
      MAX_PROPAGATE_INSTANCES,
      `Cannot update more than ${MAX_PROPAGATE_INSTANCES} instances at once`,
    )
    .superRefine((instanceIds, ctx) => {
      const seen = new Set<string>();
      instanceIds.forEach((instanceId, index) => {
        if (seen.has(instanceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Duplicate instanceIds are not allowed',
            path: [index],
          });
          return;
        }
        seen.add(instanceId);
      });
    }),
});

export function parseRequiredTemplateQueryString(
  value: unknown,
  field: string,
  maxLength = MAX_TEMPLATE_ID_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parseTemplateRouteId(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > MAX_TEMPLATE_ID_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parseOptionalTemplateBooleanQuery(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw AppError.badRequest(`${field} must be true or false`);
}
