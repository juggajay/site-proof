import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

const routeParamSchema = z.string().trim().min(1).max(120);

export function parseProjectRouteParam(value: unknown, field: string): string {
  const parsed = routeParamSchema.safeParse(value);
  if (!parsed.success) {
    throw AppError.badRequest(`${field} must be a valid identifier`);
  }
  return parsed.data;
}

const finiteNumber = z.number().finite();

const controlPointSchema = z.object({
  chainage: finiteNumber,
  easting: finiteNumber,
  northing: finiteNumber,
});

const pointsSchema = z.array(controlPointSchema).min(2).max(2000);

export const createControlLineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  coordinateSystem: z.string().trim().min(1).max(50),
  points: pointsSchema,
});

export const updateControlLineSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    coordinateSystem: z.string().trim().min(1).max(50).optional(),
    points: pointsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export type CreateControlLineInput = z.infer<typeof createControlLineSchema>;
export type UpdateControlLineInput = z.infer<typeof updateControlLineSchema>;
