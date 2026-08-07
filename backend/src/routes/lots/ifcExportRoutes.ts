// P1a DRAFT IFC export. This child router is parent-protected by lots.ts's
// router-wide requireAuth. The three-segment path cannot collide with GET /:id.

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { getFrontendUrl } from '../../lib/runtimeConfig.js';
import { serializeDraftLotIfc, validateAndNormaliseRing } from '../../lib/ifc/serializer.js';
import { isSupportedEpsg, listSupportedEpsg } from '../../lib/spatial/crs.js';
import {
  generateChainageOffsetLocalRing,
  type ChainageOffsetInput,
} from '../../lib/spatial/lotGeometry.js';
import type { ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { requireProjectRole } from './access.js';
import { parseLotRouteParam } from './requestParsing.js';

export const ifcExportRouter = Router();

// Same per-lot evidence-export boundary as FOLIO_ISSUERS. This is deliberately
// explicit rather than hierarchy-derived so a new role cannot widen it silently.
const IFC_DRAFT_EXPORTERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

interface IfcExportOrigin {
  e: number;
  n: number;
  epsg: string;
}

function parseSettings(settings: string | null): Record<string, unknown> {
  if (!settings) return {};
  try {
    const parsed: unknown = JSON.parse(settings);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readOrigin(settings: Record<string, unknown>): IfcExportOrigin | null {
  const candidate = settings.ifcExportOrigin;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const { e, n, epsg } = candidate as Record<string, unknown>;
  return typeof e === 'number' &&
    Number.isFinite(e) &&
    typeof n === 'number' &&
    Number.isFinite(n) &&
    typeof epsg === 'string'
    ? { e, n, epsg }
    : null;
}

function assertOriginEpsg(origin: IfcExportOrigin, epsg: string): void {
  if (origin.epsg !== epsg) {
    throw AppError.badRequest(
      `This project's IFC export origin uses ${origin.epsg}, but this lot uses ${epsg}`,
      { code: 'IFC_ORIGIN_EPSG_MISMATCH', originEpsg: origin.epsg, lotEpsg: epsg },
    );
  }
}

async function getOrCreateProjectOrigin(
  projectId: string,
  proposed: IfcExportOrigin,
): Promise<IfcExportOrigin> {
  return prisma.$transaction(async (tx) => {
    // Compare-and-set preserves the first writer under concurrent first exports,
    // while also preserving unrelated settings written between retries.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { settings: true },
      });
      if (!project) throw AppError.notFound('Project');

      const settings = parseSettings(project.settings);
      const existing = readOrigin(settings);
      if (existing) {
        assertOriginEpsg(existing, proposed.epsg);
        return existing;
      }

      const update = await tx.project.updateMany({
        where: { id: projectId, settings: project.settings },
        data: { settings: JSON.stringify({ ...settings, ifcExportOrigin: proposed }) },
      });
      if (update.count === 1) return proposed;
    }

    throw AppError.conflict('Project settings changed while establishing the IFC export origin');
  });
}

function requiredNumber(value: { toString(): string } | number | null, lotNumber: string): number {
  const number = value === null ? Number.NaN : Number(value);
  if (!Number.isFinite(number)) {
    throw AppError.badRequest('This lot has no chainage-based geometry to export', {
      code: 'IFC_NOT_EXPORTABLE',
      lotNumber,
    });
  }
  return number;
}

export function describeDraftIfcCrs(epsg: string): { datum: string; zone?: string } {
  const code = Number(epsg.slice('EPSG:'.length));
  if (code >= 7_849 && code <= 7_856) return { datum: 'GDA2020', zone: String(code - 7_800) };
  if (code >= 28_349 && code <= 28_356) return { datum: 'GDA94', zone: String(code - 28_300) };
  return { datum: 'WGS84' };
}

function sanitiseLotNumber(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_') || 'lot';
}

ifcExportRouter.get(
  '/:id/exports/ifc-draft',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        description: true,
        status: true,
        conformedAt: true,
        conformanceOverriddenAt: true,
        conformanceOverrideReason: true,
        conformedBy: { select: { fullName: true, email: true } },
        project: { select: { id: true, name: true, projectNumber: true } },
        geometries: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            kind: true,
            chainageStart: true,
            chainageEnd: true,
            offsetLeft: true,
            offsetRight: true,
            controlLine: { select: { name: true, coordinateSystem: true, points: true } },
          },
        },
        ncrLots: { select: { ncr: { select: { ncrNumber: true } } } },
        _count: { select: { holdPoints: true, testResults: true } },
        itpInstance: {
          select: {
            _count: {
              select: {
                completions: { where: { status: { in: ['completed', 'not_applicable'] } } },
              },
            },
            template: { select: { _count: { select: { checklistItems: true } } } },
          },
        },
      },
    });
    if (!lot) throw AppError.notFound('Lot');

    await requireProjectRole(
      lot.projectId,
      req.user!,
      IFC_DRAFT_EXPORTERS,
      'Only owners, admins, project managers and quality managers can export draft IFC files',
    );

    const geometry = lot.geometries[0];
    if (geometry?.kind !== 'chainage_offset' || !geometry.controlLine) {
      throw AppError.badRequest('This lot has no chainage-based geometry to export', {
        code: 'IFC_NOT_EXPORTABLE',
      });
    }
    const epsg = geometry.controlLine.coordinateSystem;
    if (!isSupportedEpsg(epsg)) {
      throw AppError.badRequest(`Unsupported coordinate system: ${epsg}`, {
        code: 'UNSUPPORTED_COORDINATE_SYSTEM',
        supported: listSupportedEpsg(),
      });
    }

    const geometryInput: ChainageOffsetInput = {
      points: geometry.controlLine.points as unknown as ControlPoint[],
      epsg,
      chainageStart: requiredNumber(geometry.chainageStart, lot.lotNumber),
      chainageEnd: requiredNumber(geometry.chainageEnd, lot.lotNumber),
      offsetLeft: requiredNumber(geometry.offsetLeft, lot.lotNumber),
      offsetRight: requiredNumber(geometry.offsetRight, lot.lotNumber),
    };
    const gridRing = generateChainageOffsetLocalRing(geometryInput);
    validateAndNormaliseRing(gridRing, lot.lotNumber);

    const proposedOrigin: IfcExportOrigin = {
      e: Math.floor(gridRing[0].easting / 100) * 100,
      n: Math.floor(gridRing[0].northing / 100) * 100,
      epsg,
    };
    const origin = await getOrCreateProjectOrigin(lot.projectId, proposedOrigin);
    const crs = describeDraftIfcCrs(epsg);
    const completedItems = lot.itpInstance?._count.completions ?? null;
    const totalItems = lot.itpInstance?.template._count.checklistItems ?? null;
    const ncrReferences = lot.ncrLots
      .map(({ ncr }) => ncr.ncrNumber)
      .sort((a, b) => a.localeCompare(b))
      .join(',');
    const frontendUrl = getFrontendUrl().replace(/\/$/, '');
    const safeLotNumber = sanitiseLotNumber(lot.lotNumber);
    const filename = `IFC-DRAFT-${safeLotNumber}.ifc`;
    const exportedAt = new Date();

    const ifc = serializeDraftLotIfc({
      filename,
      exportedAt: exportedAt.toISOString(),
      authorName: req.user!.fullName || req.user!.email,
      project: {
        id: lot.project.id,
        name: lot.project.name,
        description: lot.project.projectNumber,
      },
      origin,
      lot: { id: lot.id, lotNumber: lot.lotNumber, description: lot.description },
      gridRing,
      propertySets: {
        project: {
          Datum: crs.datum,
          Zone: crs.zone,
          OriginEasting: origin.e,
          OriginNorthing: origin.n,
        },
        design: {
          ControlLine: geometry.controlLine.name,
          StartCHG: geometryInput.chainageStart,
          EndCHG: geometryInput.chainageEnd,
        },
        construction: {
          ConstructionLotNumber: lot.lotNumber,
          ConstructionDate: lot.conformedAt?.toISOString().slice(0, 10),
        },
        assetManagement: {
          Offset: `L${geometryInput.offsetLeft} R${geometryInput.offsetRight}`,
        },
        civosQa: {
          ConformanceStatus: lot.status,
          ConformedAt: lot.conformedAt?.toISOString(),
          ConformedBy: lot.conformedBy?.fullName || lot.conformedBy?.email,
          ConformanceOverridden: Boolean(lot.conformanceOverriddenAt),
          ConformanceOverrideReason: lot.conformanceOverriddenAt
            ? lot.conformanceOverrideReason
            : null,
          ITPItemsCompleted: completedItems,
          ITPItemsTotal: totalItems,
          NCRReferences: ncrReferences,
          HoldPointCount: lot._count.holdPoints,
          TestResultCount: lot._count.testResults,
          CivosLotId: lot.id,
          CivosUrl: `${frontendUrl}/projects/${lot.projectId}/lots/${lot.id}`,
          GeometrySource: 'LotRecords (not survey)',
          HeightData: 'NoHeightData',
        },
      },
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(ifc);
  }),
);
