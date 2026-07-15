import { z } from 'zod';
import type { SubcontractorPortalAccessKey } from '../../lib/projectAccess.js';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Valid lot statuses
const validStatuses = [
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
] as const;

const terminalStatuses = ['conformed', 'claimed'] as const;
const queryableStatuses = [...validStatuses, ...terminalStatuses] as const;

// Valid lot types
const validLotTypes = ['chainage', 'area', 'structure'] as const;

const lotSortFields = [
  'lotNumber',
  'status',
  'activityType',
  'chainageStart',
  'chainageEnd',
  'createdAt',
  'updatedAt',
] as const;
const LOT_PORTAL_MODULES = new Set<SubcontractorPortalAccessKey>(['lots', 'itps']);

const MAX_ID_LENGTH = 120;
const MAX_LOT_NUMBER_LENGTH = 100;
const MAX_SHORT_TEXT_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_BULK_LOTS = 500;
const MAX_SEARCH_LENGTH = 200;

const requiredIdSchema = (field: string) =>
  z.string().trim().min(1, `${field} is required`).max(MAX_ID_LENGTH, `${field} is too long`);

const requiredTextSchema = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} must be ${maxLength} characters or less`);

const optionalNullableTextSchema = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must be ${maxLength} characters or less`)
    .optional()
    .nullable();

const finiteNumberSchema = (field: string) =>
  z.number({ invalid_type_error: `${field} must be a number` }).finite(`${field} must be finite`);

function validateChainageRange(
  chainageStart: number | null | undefined,
  chainageEnd: number | null | undefined,
  addIssue: (message: string, path: (string | number)[]) => void,
) {
  if (
    chainageStart !== null &&
    chainageStart !== undefined &&
    chainageEnd !== null &&
    chainageEnd !== undefined &&
    chainageStart > chainageEnd
  ) {
    addIssue('chainageStart must be less than or equal to chainageEnd', ['chainageStart']);
  }
}

function addDuplicateIssues(
  values: string[],
  addIssue: (message: string, path: (string | number)[]) => void,
  field: string,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      addIssue(`Duplicate ${field} values are not allowed`, [index]);
      return;
    }
    seen.add(value);
  });
}

const lotIdArraySchema = z
  .array(requiredIdSchema('lotId'))
  .min(1, 'lotIds array is required and must not be empty')
  .max(MAX_BULK_LOTS, `Cannot operate on more than ${MAX_BULK_LOTS} lots at once`)
  .superRefine((lotIds, ctx) => {
    addDuplicateIssues(
      lotIds,
      (message, path) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path }),
      'lotId',
    );
  });

// Schema for creating a lot
const createLotSchema = z
  .object({
    projectId: requiredIdSchema('projectId'),
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH),
    description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
    activityType: requiredTextSchema('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
    lotType: z.enum(validLotTypes).optional(),
    itpTemplateId: requiredIdSchema('itpTemplateId').optional().nullable(),
    // Legacy single-FK subcontractor assignment is retired on create. The field
    // is intentionally absent here so any client-sent value is stripped (Zod
    // drops unknown keys) — subcontractors are assigned through the modern
    // per-lot assignments UI after the lot exists. See docs/research/
    // agentic-setup-synthesis-2026-07-15.md §1.
    areaZone: optionalNullableTextSchema('areaZone', MAX_SHORT_TEXT_LENGTH),
    structureId: optionalNullableTextSchema('structureId', MAX_SHORT_TEXT_LENGTH),
    structureElement: optionalNullableTextSchema('structureElement', MAX_SHORT_TEXT_LENGTH),
    budgetAmount: finiteNumberSchema('budgetAmount')
      .nonnegative('budgetAmount cannot be negative')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for bulk creating lots
// Offsets mirror the single-geometry route's 0–1000m bounds (geometryRoutes.ts).
const bulkLotGeometrySchema = z
  .object({
    controlLineId: requiredIdSchema('controlLineId'),
    offsetLeft: finiteNumberSchema('offsetLeft')
      .min(0, 'offsetLeft must not be negative')
      .max(1000, 'offsetLeft must be 1000m or less'),
    offsetRight: finiteNumberSchema('offsetRight')
      .min(0, 'offsetRight must not be negative')
      .max(1000, 'offsetRight must be 1000m or less'),
  })
  .superRefine((data, ctx) => {
    if (data.offsetLeft + data.offsetRight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A lot needs a non-zero offset on at least one side',
        path: ['offsetLeft'],
      });
    }
  });

const bulkCreateLotsSchema = z
  .object({
    projectId: requiredIdSchema('projectId'),
    // Batch-level default template, applied to any lot that omits its own
    // per-lot itpTemplateId below (activity-aware batches set one per lot so
    // each activity gets its correct ITP).
    itpTemplateId: requiredIdSchema('itpTemplateId').optional().nullable(),
    geometry: bulkLotGeometrySchema.optional(),
    lots: z
      .array(
        z
          .object({
            lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH),
            description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
            activityType: optionalNullableTextSchema('activityType', MAX_SHORT_TEXT_LENGTH),
            lotType: z.enum(validLotTypes).optional(),
            chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
            chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
            layer: optionalNullableTextSchema('layer', MAX_SHORT_TEXT_LENGTH),
            itpTemplateId: requiredIdSchema('itpTemplateId').optional().nullable(),
          })
          .superRefine((data, ctx) => {
            validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
            });
          }),
      )
      .min(1, 'lots array is required and must not be empty')
      .max(MAX_BULK_LOTS, `Cannot create more than ${MAX_BULK_LOTS} lots at once`),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.lots.forEach((lot, index) => {
      if (seen.has(lot.lotNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate lotNumber values are not allowed',
          path: ['lots', index, 'lotNumber'],
        });
        return;
      }
      seen.add(lot.lotNumber);
    });
    if (data.geometry) {
      data.lots.forEach((lot, index) => {
        if (lot.chainageStart == null || lot.chainageEnd == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Every lot needs a chainage range when generating map geometry',
            path: ['lots', index, 'chainageStart'],
          });
        }
      });
    }
  });

// Schema for cloning a lot
const cloneLotSchema = z
  .object({
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for updating a lot
const updateLotSchema = z
  .object({
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH).optional(),
    description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
    activityType: requiredTextSchema('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
    offset: optionalNullableTextSchema('offset', MAX_SHORT_TEXT_LENGTH),
    offsetCustom: optionalNullableTextSchema('offsetCustom', MAX_SHORT_TEXT_LENGTH),
    layer: optionalNullableTextSchema('layer', MAX_SHORT_TEXT_LENGTH),
    areaZone: optionalNullableTextSchema('areaZone', MAX_SHORT_TEXT_LENGTH),
    lotType: z.enum(validLotTypes).optional(),
    structureId: optionalNullableTextSchema('structureId', MAX_SHORT_TEXT_LENGTH),
    structureElement: optionalNullableTextSchema('structureElement', MAX_SHORT_TEXT_LENGTH),
    status: z
      .enum(validStatuses, {
        errorMap: () => ({ message: `status must be one of: ${validStatuses.join(', ')}` }),
      })
      .optional(),
    budgetAmount: finiteNumberSchema('budgetAmount')
      .nonnegative('budgetAmount cannot be negative')
      .optional()
      .nullable(),
    assignedSubcontractorId: requiredIdSchema('assignedSubcontractorId').optional().nullable(),
    expectedUpdatedAt: z.string().optional(), // For optimistic locking
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for bulk delete
const bulkDeleteSchema = z.object({
  lotIds: lotIdArraySchema,
});

// Schema for bulk update status
const bulkUpdateStatusSchema = z.object({
  lotIds: lotIdArraySchema,
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `status must be one of: ${validStatuses.join(', ')}` }),
  }),
});

// Schema for bulk assign subcontractor
const bulkAssignSubcontractorSchema = z.object({
  lotIds: lotIdArraySchema,
  subcontractorId: requiredIdSchema('subcontractorId').nullable().optional(),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

// Schema for assigning subcontractor to lot
const assignSubcontractorSchema = z.object({
  subcontractorId: requiredIdSchema('subcontractorId').nullable().optional(),
});

// Schema for conforming a lot
const conformLotSchema = z.object({
  force: z.boolean().optional(),
  reason: z.string().trim().max(1000, 'Reason must be at most 1000 characters').optional(),
});

// Schema for overriding status
const overrideStatusSchema = z.object({
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
  }),
  reason: requiredTextSchema('reason', 1000).min(5, 'Reason must be at least 5 characters'),
});

// Schema for creating subcontractor assignment
const createSubcontractorAssignmentSchema = z.object({
  subcontractorCompanyId: requiredIdSchema('subcontractorCompanyId'),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

// Schema for updating subcontractor assignment
const updateSubcontractorAssignmentSchema = z.object({
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

export {
  validStatuses,
  terminalStatuses,
  queryableStatuses,
  validLotTypes,
  lotSortFields,
  LOT_PORTAL_MODULES,
  MAX_ID_LENGTH,
  MAX_LOT_NUMBER_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_BULK_LOTS,
  MAX_SEARCH_LENGTH,
  requiredIdSchema,
  requiredTextSchema,
  optionalNullableTextSchema,
  finiteNumberSchema,
  validateChainageRange,
  addDuplicateIssues,
  lotIdArraySchema,
  createLotSchema,
  bulkCreateLotsSchema,
  cloneLotSchema,
  updateLotSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkAssignSubcontractorSchema,
  assignSubcontractorSchema,
  conformLotSchema,
  overrideStatusSchema,
  createSubcontractorAssignmentSchema,
  updateSubcontractorAssignmentSchema,
};
