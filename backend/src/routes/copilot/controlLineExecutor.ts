import { z } from 'zod';
import type { AiProposal, Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { isSupportedEpsg, listSupportedEpsg } from '../../lib/spatial/crs.js';
import { controlLineToWgs84, type ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { applyHandlers, rollbackHandlers, type AppliedRecordGroup } from './proposalService.js';

export const CONTROL_LINE_STAGE = 'control_line';

// Matches the ControlLine field caps in controlLines/validation.ts so an accepted
// proposal is always a legal control-line create — the apply handler re-checks
// them (never trust the wire).
const NAME_MAX_LENGTH = 200;
const CRS_MAX_LENGTH = 50;
const MAX_POINTS = 2000;

// A single reviewed alignment on its way to becoming a ControlLine. `selected`
// lets the review UI drop alignments; a missing flag means "keep" so an
// unedited verbatim accept (payload has no `selected`) still creates every one.
const applyPointSchema = z.object({
  chainage: z.coerce.number().finite(),
  easting: z.coerce.number().finite(),
  northing: z.coerce.number().finite(),
});

const applyAlignmentSchema = z.object({
  name: z.string().trim().max(NAME_MAX_LENGTH).nullish(),
  coordinateSystem: z.string().trim().min(1).max(CRS_MAX_LENGTH).nullable(),
  points: z.array(applyPointSchema).min(2).max(MAX_POINTS),
  selected: z.boolean().optional(),
});

const applyPayloadSchema = z.object({
  alignments: z.array(applyAlignmentSchema),
});

// apply: re-validate the effective payload, then create one ControlLine per
// SELECTED alignment inside the deciding transaction — same field rules and
// WGS84 derivation as the manual POST /control-lines route. Returns the created
// ids so rollback can delete exactly them.
applyHandlers[CONTROL_LINE_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
): Promise<AppliedRecordGroup[]> => {
  const parsed = applyPayloadSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }

  // Missing `selected` (a verbatim accept of the stored candidate) means keep.
  const selected = parsed.data.alignments.filter((a) => a.selected !== false);
  if (selected.length === 0) {
    throw new AppError(
      400,
      'Select at least one alignment to create a control line.',
      'NO_ALIGNMENT_SELECTED',
    );
  }

  const createdIds: string[] = [];
  for (const [index, alignment] of selected.entries()) {
    if (!alignment.coordinateSystem || !isSupportedEpsg(alignment.coordinateSystem)) {
      throw new AppError(
        400,
        `Alignment ${index + 1} has an unsupported coordinate system. Choose one of: ${listSupportedEpsg().join(', ')}.`,
        'UNSUPPORTED_CRS',
      );
    }
    // Names are required non-empty at apply time; fall back to a stable label so
    // an accept never fails on a blank name.
    const name = alignment.name?.trim() || `Alignment ${index + 1}`;
    const points = alignment.points as ControlPoint[];
    const geometryWgs84 = controlLineToWgs84(
      alignment.coordinateSystem,
      points,
    ) as unknown as Prisma.InputJsonValue;

    const controlLine = await tx.controlLine.create({
      data: {
        projectId: proposal.projectId,
        name,
        coordinateSystem: alignment.coordinateSystem,
        points: points as unknown as Prisma.InputJsonValue,
        geometryWgs84,
        createdById: proposal.requestedById,
      },
      select: { id: true },
    });
    createdIds.push(controlLine.id);
  }

  return [{ model: 'ControlLine', ids: createdIds }];
};

// rollback: delete the ControlLine rows this proposal created — but a
// chainage_offset lot footprint (LotGeometry.controlLineId) points at a control
// line with onDelete: SetNull, so a plain delete would silently orphan those
// footprints. Guard first: if any lot geometry still references a created line,
// refuse and tell the user to remove the dependents.
rollbackHandlers[CONTROL_LINE_STAGE] = async (
  tx: Prisma.TransactionClient,
  _proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  for (const group of groups) {
    if (group.model !== 'ControlLine' || group.ids.length === 0) continue;

    const dependentCount = await tx.lotGeometry.count({
      where: { controlLineId: { in: group.ids } },
    });
    if (dependentCount > 0) {
      throw new AppError(
        400,
        `Control lines from this proposal are already used by ${dependentCount} lot footprint${
          dependentCount === 1 ? '' : 's'
        }; remove those lot geometries first.`,
        'CONTROL_LINE_IN_USE',
      );
    }

    await tx.controlLine.deleteMany({ where: { id: { in: group.ids } } });
  }
};
