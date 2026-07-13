import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { Prisma, type PlanSheet } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { assertUploadedImageFile } from '../../lib/imageValidation.js';
import { prisma } from '../../lib/prisma.js';
import {
  requireInternalProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../../lib/projectAccess.js';
import { ROLES } from '../../lib/roles.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parseProjectRouteParam } from '../controlLines/validation.js';
import {
  deletePlanSheetImage,
  planSheetUpload,
  processPlanSheetImage,
  sendPlanSheetImage,
  storePlanSheetImage,
} from './storage.js';
import { computeCornersWgs84 } from './corners.js';
import { createPlanSheetTextSchema, updatePlanSheetSchema } from './validation.js';

// Plan-sheet setup mirrors control-line permissions exactly: owner/admin/
// project_manager may write; any internal project member may read.
const WRITE_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const;
const WRITE_DENIED_MESSAGE = 'You do not have permission to manage plan sheets';

const planSheetsRouter = Router();

planSheetsRouter.use(requireAuth);

// Derive the WGS84 overlay corners from the stored registration + pixel size.
function cornersFor(sheet: PlanSheet) {
  return computeCornersWgs84(
    sheet.registration as { transform: number[] } | null,
    sheet.imageWidth,
    sheet.imageHeight,
    sheet.coordinateSystem,
  );
}

// List rows omit the raw registration payload but DO carry cornersWgs84 +
// perimeter: the map overlay needs both to place and clip a sheet without a
// second round-trip per shown sheet.
function mapListItem(sheet: PlanSheet) {
  return {
    id: sheet.id,
    name: sheet.name,
    pageNumber: sheet.pageNumber,
    imageWidth: sheet.imageWidth,
    imageHeight: sheet.imageHeight,
    coordinateSystem: sheet.coordinateSystem,
    hasRegistration: sheet.registration != null,
    cornersWgs84: cornersFor(sheet),
    perimeter: sheet.perimeter,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
  };
}

function mapFull(sheet: PlanSheet) {
  return {
    id: sheet.id,
    projectId: sheet.projectId,
    documentId: sheet.documentId,
    name: sheet.name,
    pageNumber: sheet.pageNumber,
    // imageRef is the storage locator; the browser renders via GET .../image.
    imageRef: sheet.imageRef,
    imageWidth: sheet.imageWidth,
    imageHeight: sheet.imageHeight,
    coordinateSystem: sheet.coordinateSystem,
    registration: sheet.registration,
    perimeter: sheet.perimeter,
    cornersWgs84: cornersFor(sheet),
    hasRegistration: sheet.registration != null,
    createdById: sheet.createdById,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
  };
}

// Prisma Json update: undefined leaves the column untouched, explicit null
// clears it to SQL NULL (DbNull), a value writes it.
function jsonUpdate(
  value: unknown | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

planSheetsRouter.post(
  '/:projectId/plan-sheets',
  planSheetUpload.single('image'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    if (!req.file) {
      throw AppError.badRequest('No image uploaded');
    }

    const validation = createPlanSheetTextSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { name, pageNumber, coordinateSystem, documentId } = validation.data;

    // Sniff magic bytes: the declared mimetype must match real PNG/JPEG content.
    assertUploadedImageFile(req.file);

    // Cross-tenant boundary: a linked source document must live in this project.
    if (documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: documentId, projectId },
        select: { id: true },
      });
      if (!doc) {
        throw new AppError(
          400,
          'documentId does not belong to this project',
          'DOCUMENT_NOT_IN_PROJECT',
        );
      }
    }

    const sheetId = randomUUID();
    const { png, width, height } = await processPlanSheetImage(req.file.buffer);
    const imageRef = await storePlanSheetImage(projectId, sheetId, png);

    let planSheet: PlanSheet;
    try {
      planSheet = await prisma.planSheet.create({
        data: {
          id: sheetId,
          projectId,
          documentId: documentId ?? null,
          name,
          pageNumber,
          imageRef,
          imageWidth: width,
          imageHeight: height,
          coordinateSystem,
          createdById: req.user!.userId,
        },
      });
    } catch (err) {
      // Don't orphan the uploaded object if the row write fails.
      await deletePlanSheetImage(imageRef, projectId);
      throw err;
    }

    res.status(201).json({ planSheet: mapFull(planSheet) });
  }),
);

planSheetsRouter.get(
  '/:projectId/plan-sheets',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const planSheets = await prisma.planSheet.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ planSheets: planSheets.map(mapListItem) });
  }),
);

// Registered before `/:id` so the literal `image` suffix is unambiguous.
planSheetsRouter.get(
  '/:projectId/plan-sheets/:id/image',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireInternalProjectAccess(req.user!, projectId);

    const sheet = await prisma.planSheet.findFirst({
      where: { id, projectId },
      select: { imageRef: true },
    });
    if (!sheet) {
      throw AppError.notFound('Plan sheet');
    }

    await sendPlanSheetImage(sheet.imageRef, projectId, res);
  }),
);

planSheetsRouter.get(
  '/:projectId/plan-sheets/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireInternalProjectAccess(req.user!, projectId);

    const sheet = await prisma.planSheet.findFirst({ where: { id, projectId } });
    if (!sheet) {
      throw AppError.notFound('Plan sheet');
    }

    res.json({ planSheet: mapFull(sheet) });
  }),
);

planSheetsRouter.patch(
  '/:projectId/plan-sheets/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const validation = updatePlanSheetSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const existing = await prisma.planSheet.findFirst({
      where: { id, projectId },
      select: { id: true, coordinateSystem: true, registration: true },
    });
    if (!existing) {
      throw AppError.notFound('Plan sheet');
    }

    const data = validation.data;

    // A registration's transform is only meaningful in the coordinate system it
    // was fitted in. Changing the CRS out from under an existing registration
    // would silently mis-georeference the overlay, so require the caller to
    // re-register (or clear) in the same request.
    if (
      data.coordinateSystem !== undefined &&
      data.coordinateSystem !== existing.coordinateSystem &&
      existing.registration != null &&
      data.registration === undefined
    ) {
      throw new AppError(
        400,
        'This sheet is registered in its current coordinate system — include a new registration (or registration: null) when changing it',
        'COORDINATE_SYSTEM_LOCKED_BY_REGISTRATION',
      );
    }
    const planSheet = await prisma.planSheet.update({
      where: { id },
      data: {
        name: data.name,
        coordinateSystem: data.coordinateSystem,
        registration: jsonUpdate(data.registration),
        perimeter: jsonUpdate(data.perimeter),
      },
    });

    res.json({ planSheet: mapFull(planSheet) });
  }),
);

planSheetsRouter.delete(
  '/:projectId/plan-sheets/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const existing = await prisma.planSheet.findFirst({
      where: { id, projectId },
      select: { id: true, imageRef: true },
    });
    if (!existing) {
      throw AppError.notFound('Plan sheet');
    }

    await prisma.planSheet.delete({ where: { id } });
    // Best-effort: never fails the delete on a storage error.
    await deletePlanSheetImage(existing.imageRef, projectId);

    res.json({ success: true });
  }),
);

export { planSheetsRouter };
