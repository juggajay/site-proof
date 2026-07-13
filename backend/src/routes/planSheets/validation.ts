import { z } from 'zod';

import { isSupportedEpsg } from '../../lib/spatial/crs.js';

const finiteNumber = z.number().finite();

// Same EPSG preset set as ControlLine: reject anything crs.ts does not know.
const coordinateSystemSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine(isSupportedEpsg, { message: 'Unsupported coordinate system' });

// Text fields of the multipart create request (the file is handled by multer).
// pageNumber arrives as a string, hence coerce.
export const createPlanSheetTextSchema = z.object({
  name: z.string().trim().min(1).max(200),
  pageNumber: z.coerce.number().int().min(1).default(1),
  coordinateSystem: coordinateSystemSchema,
  documentId: z.string().uuid().optional(),
});

const registrationPointSchema = z.object({
  px: finiteNumber,
  py: finiteNumber,
  easting: finiteNumber,
  northing: finiteNumber,
});

// transform = [a,b,c,d,e,f] affine, exactly 6 finite numbers. See PlanSheet model.
const registrationSchema = z.object({
  points: z.array(registrationPointSchema).min(2).max(12),
  transform: z.array(finiteNumber).length(6),
  rmsErrorM: finiteNumber.min(0),
});

// Pixel-space clip ring: at least 3 [x,y] pairs.
const perimeterSchema = z.array(z.tuple([finiteNumber, finiteNumber])).min(3);

export const updatePlanSheetSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    coordinateSystem: coordinateSystemSchema.optional(),
    // null clears the stored value; undefined leaves it untouched.
    registration: registrationSchema.nullable().optional(),
    perimeter: perimeterSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

export type CreatePlanSheetTextInput = z.infer<typeof createPlanSheetTextSchema>;
export type UpdatePlanSheetInput = z.infer<typeof updatePlanSheetSchema>;
