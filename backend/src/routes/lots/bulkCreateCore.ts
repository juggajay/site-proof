/**
 * Shared transactional core behind bulk lot creation.
 *
 * Both POST /api/lots/bulk (createRoutes.ts) and the copilot lot_breakdown apply
 * handler must produce EXACTLY the same records — lots + per-lot ITP instances +
 * chainage-offset geometry, in one transaction. This module owns that single
 * source of truth so the two call sites can never drift.
 *
 * The caller supplies the write client: the /bulk route opens its own
 * `prisma.$transaction`, the copilot apply handler passes the deciding
 * transaction so apply + proposal status commit or roll back together. Reads that
 * touch never-mutated rows (ITP templates, the control line) go through the
 * global prisma client, matching the pre-extraction route exactly.
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { generateChainageOffsetPolygon } from '../../lib/spatial/lotGeometry.js';
import type { ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';
import { planBulkItpTemplates, type BulkItpPlan } from './bulkItpPlan.js';
import { requireItpTemplateForProject } from './assignmentHelpers.js';

export interface BulkLotInput {
  lotNumber: string;
  description?: string | null;
  activityType?: string | null;
  lotType?: 'chainage' | 'area' | 'structure';
  chainageStart?: number | null;
  chainageEnd?: number | null;
  layer?: string | null;
  itpTemplateId?: string | null;
}

export interface BulkGeometryInput {
  controlLineId: string;
  offsetLeft: number;
  offsetRight: number;
}

interface BulkGeometryPlanEntry {
  lotNumber: string;
  row: Omit<Prisma.LotGeometryCreateManyInput, 'lotId'>;
}

// The lot rows createManyAndReturn hands back — the fields both call sites need
// for their audit logs / responses.
export interface CreatedBulkLot {
  id: string;
  lotNumber: string;
  description: string | null;
  status: string;
  activityType: string;
  chainageStart: Prisma.Decimal | null;
  chainageEnd: Prisma.Decimal | null;
  createdAt: Date;
}

export interface BulkCreateResult {
  createdLots: CreatedBulkLot[];
  itpPlan: BulkItpPlan;
  /** ITP instance ids created (one per lot that resolved to a template). */
  itpInstanceIds: string[];
  /** Lot geometry ids created (empty when no geometry was requested). */
  geometryIds: string[];
}

// Pre-computes every polygon before any write (the generator is pure), so a
// chainage outside the control line rejects the whole batch with the lot
// numbers named instead of failing mid-transaction. Same skip-vs-throw split
// as the backfill route's planBackfill, except failures here are fatal — a
// generated batch promised N mapped lots, so it's all-or-nothing.
async function planBulkLotGeometry(
  projectId: string,
  lotsData: { lotNumber: string; chainageStart?: number | null; chainageEnd?: number | null }[],
  geometry: BulkGeometryInput,
): Promise<BulkGeometryPlanEntry[]> {
  const controlLine = await prisma.controlLine.findFirst({
    where: { id: geometry.controlLineId, projectId },
    select: { coordinateSystem: true, points: true },
  });
  if (!controlLine) {
    throw AppError.notFound('Control line');
  }
  const points = controlLine.points as unknown as ControlPoint[];

  const plan: BulkGeometryPlanEntry[] = [];
  const failures: string[] = [];
  for (const lot of lotsData) {
    // Schema guarantees chainageStart/End when geometry is requested.
    try {
      const generated = generateChainageOffsetPolygon({
        points,
        epsg: controlLine.coordinateSystem,
        chainageStart: lot.chainageStart!,
        chainageEnd: lot.chainageEnd!,
        offsetLeft: geometry.offsetLeft,
        offsetRight: geometry.offsetRight,
      });
      plan.push({
        lotNumber: lot.lotNumber,
        row: {
          kind: 'chainage_offset',
          controlLineId: geometry.controlLineId,
          chainageStart: lot.chainageStart!,
          chainageEnd: lot.chainageEnd!,
          offsetLeft: geometry.offsetLeft,
          offsetRight: geometry.offsetRight,
          geometryWgs84: generated.feature as unknown as Prisma.InputJsonValue,
          areaM2: generated.areaM2,
          lengthM: generated.lengthM,
        },
      });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) {
        failures.push(`${lot.lotNumber}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
  if (failures.length > 0) {
    throw AppError.badRequest(
      `Cannot generate map geometry for ${failures.length} lot(s): ${failures
        .slice(0, 5)
        .join('; ')}${failures.length > 5 ? ' …' : ''}`,
      { code: 'GEOMETRY_OUT_OF_RANGE' },
    );
  }
  return plan;
}

export interface CreateBulkLotsArgs {
  projectId: string;
  lotsData: BulkLotInput[];
  /** Batch-level default template for lots that omit their own. */
  itpTemplateId?: string | null;
  /** When present, every lot gets a chainage-offset footprint. */
  geometry?: BulkGeometryInput | null;
}

/**
 * Resolve per-lot ITP templates, plan geometry, then create lots + ITP instances
 * + geometries as three bulk statements inside the supplied transaction. Throws
 * (NotFound / GEOMETRY_OUT_OF_RANGE) exactly as the pre-extraction route did; the
 * caller owns the P2002 → LOT_NUMBER_TAKEN translation, audit logs, webhooks and
 * the response shape.
 */
export async function createBulkLots(
  tx: Prisma.TransactionClient,
  { projectId, lotsData, itpTemplateId, geometry }: CreateBulkLotsArgs,
): Promise<BulkCreateResult> {
  // Resolve which template each lot receives (its own, else the batch default)
  // and snapshot each distinct template once — the same frozen snapshot
  // semantics as single create.
  const itpPlan = planBulkItpTemplates(lotsData, itpTemplateId);
  const snapshotByTemplateId = new Map<string, string>();
  for (const templateId of itpPlan.distinctTemplateIds) {
    await requireItpTemplateForProject(templateId, projectId);
    const template = await prisma.iTPTemplate.findUnique({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    if (!template) {
      throw AppError.notFound('ITP template');
    }
    snapshotByTemplateId.set(templateId, JSON.stringify(buildTemplateSnapshot(template)));
  }

  const geometryPlan = geometry ? await planBulkLotGeometry(projectId, lotsData, geometry) : [];

  // Three bulk statements (lots, ITP instances, geometries) instead of N
  // individual creates — keeps a 500-lot batch well inside the interactive
  // transaction window. All-or-nothing: the preview count is what you get.
  const createdLots = await tx.lot.createManyAndReturn({
    data: lotsData.map((lot) => ({
      projectId,
      lotNumber: lot.lotNumber,
      description: lot.description || null,
      activityType: lot.activityType || 'Earthworks',
      lotType: lot.lotType || 'chainage',
      chainageStart: lot.chainageStart ?? null,
      chainageEnd: lot.chainageEnd ?? null,
      layer: lot.layer || null,
      itpTemplateId: itpPlan.templateIdByLotNumber.get(lot.lotNumber) ?? null,
    })),
    select: {
      id: true,
      lotNumber: true,
      description: true,
      status: true,
      activityType: true,
      chainageStart: true,
      chainageEnd: true,
      createdAt: true,
    },
  });

  const itpInstanceData = createdLots.flatMap((lot) => {
    const templateId = itpPlan.templateIdByLotNumber.get(lot.lotNumber);
    if (!templateId) return [];
    return [
      {
        lotId: lot.id,
        templateId,
        templateSnapshot: snapshotByTemplateId.get(templateId)!,
        status: 'not_started',
      },
    ];
  });
  if (itpInstanceData.length > 0) {
    await tx.iTPInstance.createMany({ data: itpInstanceData });
  }

  if (geometryPlan.length > 0) {
    const idByNumber = new Map(createdLots.map((lot) => [lot.lotNumber, lot.id]));
    await tx.lotGeometry.createMany({
      data: geometryPlan.map((plan) => ({
        ...plan.row,
        lotId: idByNumber.get(plan.lotNumber)!,
      })),
    });
  }

  // Query the created child ids so the proposal's appliedRecordIds document
  // everything this create produced (lot delete cascades them, but the record is
  // the audit trail). Indexed by lotId, cheap.
  const createdLotIds = createdLots.map((lot) => lot.id);
  const itpInstanceIds =
    itpInstanceData.length > 0
      ? (
          await tx.iTPInstance.findMany({
            where: { lotId: { in: createdLotIds } },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];
  const geometryIds =
    geometryPlan.length > 0
      ? (
          await tx.lotGeometry.findMany({
            where: { lotId: { in: createdLotIds } },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [];

  return { createdLots, itpPlan, itpInstanceIds, geometryIds };
}
