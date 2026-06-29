import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import {
  buildProjectAreaDeletedResponse,
  buildProjectAreaResponse,
  buildProjectAreasResponse,
} from './areaResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectAreaAuditSnapshotInput = {
  name: string;
  chainageStart: unknown;
  chainageEnd: unknown;
  colour: string | null;
};

function buildProjectAreaAuditSnapshot(area: ProjectAreaAuditSnapshotInput) {
  return {
    name: area.name,
    chainageStart: area.chainageStart == null ? null : Number(area.chainageStart),
    chainageEnd: area.chainageEnd == null ? null : Number(area.chainageEnd),
    colour: area.colour,
  };
}

type ProjectAreaRouterDependencies = {
  getProjectAccessContext: (
    projectId: string,
    user: AuthenticatedUser,
  ) => Promise<{
    hasProjectAccess: boolean;
    isProjectAdmin: boolean;
  }>;
  parseOptionalNonNegativeNumber: (value: unknown, fieldName: string) => number | null | undefined;
  parseOptionalProjectColour: (value: unknown) => string | null | undefined;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
  parseRequiredTrimmedString: (value: unknown, fieldName: string, maxLength: number) => string;
  projectAreaNameMaxLength: number;
};

export function createProjectAreaRouter({
  getProjectAccessContext,
  parseOptionalNonNegativeNumber,
  parseOptionalProjectColour,
  parseProjectRouteParam,
  parseRequiredTrimmedString,
  projectAreaNameMaxLength,
}: ProjectAreaRouterDependencies) {
  const projectAreaRouter = Router();

  projectAreaRouter.use(requireAuth);

  // GET /api/projects/:id/areas - Get all project areas
  projectAreaRouter.get(
    '/:id/areas',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      const access = await getProjectAccessContext(projectId, user);

      if (!access.hasProjectAccess) {
        throw AppError.forbidden('Not a member of this project');
      }

      const areas = await prisma.projectArea.findMany({
        where: { projectId },
        orderBy: { chainageStart: 'asc' },
      });

      res.json(buildProjectAreasResponse(areas));
    }),
  );

  // POST /api/projects/:id/areas - Create a new project area
  projectAreaRouter.post(
    '/:id/areas',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;
      requireBrowserSession(req, 'Project area creation');
      const name = parseRequiredTrimmedString(req.body.name, 'Area name', projectAreaNameMaxLength);
      const chainageStart = parseOptionalNonNegativeNumber(
        req.body.chainageStart,
        'Chainage start',
      );
      const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
      const colour = parseOptionalProjectColour(req.body.colour);

      const access = await getProjectAccessContext(projectId, user);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can create areas');
      }
      await assertProjectAllowsWrite(projectId);

      // Feature #906: Require chainage range for areas
      if (chainageStart == null || chainageEnd == null) {
        throw AppError.badRequest(
          'Both chainage start and chainage end are required for project areas.',
        );
      }

      // Validate start is less than end
      if (chainageStart >= chainageEnd) {
        throw AppError.badRequest('Chainage start must be less than chainage end.');
      }

      const area = await prisma.$transaction(async (tx) => {
        const createdArea = await tx.projectArea.create({
          data: {
            projectId,
            name,
            chainageStart,
            chainageEnd,
            colour: colour ?? null,
          },
        });

        await writeAuditLogInTransaction(tx, {
          projectId,
          userId: user.id,
          entityType: 'project_area',
          entityId: createdArea.id,
          action: AuditAction.PROJECT_AREA_CREATED,
          changes: {
            name,
            chainageStart,
            chainageEnd,
            colour: colour ?? null,
          },
          req,
        });

        return createdArea;
      });

      res.status(201).json(buildProjectAreaResponse(area));
    }),
  );

  // PATCH /api/projects/:id/areas/:areaId - Update a project area
  projectAreaRouter.patch(
    '/:id/areas/:areaId',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const areaId = parseProjectRouteParam(req.params.areaId, 'areaId');
      const user = req.user!;
      requireBrowserSession(req, 'Project area update');
      const name =
        req.body.name === undefined
          ? undefined
          : parseRequiredTrimmedString(req.body.name, 'Area name', projectAreaNameMaxLength);
      const chainageStart = parseOptionalNonNegativeNumber(
        req.body.chainageStart,
        'Chainage start',
      );
      const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
      const colour = parseOptionalProjectColour(req.body.colour);

      const access = await getProjectAccessContext(projectId, user);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can update areas');
      }
      await assertProjectAllowsWrite(projectId);

      // Check area exists and belongs to project
      const existingArea = await prisma.projectArea.findFirst({
        where: { id: areaId, projectId },
      });

      if (!existingArea) {
        throw AppError.notFound('Area');
      }

      // Feature #906: Validate chainage if being updated
      // If either chainage is being set to null, reject
      if (
        (req.body.chainageStart !== undefined && chainageStart == null) ||
        (req.body.chainageEnd !== undefined && chainageEnd == null)
      ) {
        throw AppError.badRequest(
          'Both chainage start and chainage end are required for project areas.',
        );
      }

      const newChainageStart =
        chainageStart !== undefined
          ? chainageStart
          : existingArea.chainageStart === null
            ? null
            : Number(existingArea.chainageStart);
      const newChainageEnd =
        chainageEnd !== undefined
          ? chainageEnd
          : existingArea.chainageEnd === null
            ? null
            : Number(existingArea.chainageEnd);

      if (
        newChainageStart != null &&
        newChainageEnd != null &&
        newChainageStart >= newChainageEnd
      ) {
        throw AppError.badRequest('Chainage start must be less than chainage end.');
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
      if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
      if (colour !== undefined) updateData.colour = colour;

      const changedFields = Object.keys(updateData);
      const area = await prisma.$transaction(async (tx) => {
        const updatedArea = await tx.projectArea.update({
          where: { id: areaId },
          data: updateData,
        });

        if (changedFields.length > 0) {
          await writeAuditLogInTransaction(tx, {
            projectId,
            userId: user.id,
            entityType: 'project_area',
            entityId: areaId,
            action: AuditAction.PROJECT_AREA_UPDATED,
            changes: {
              changedFields,
              previous: buildProjectAreaAuditSnapshot(existingArea),
              next: buildProjectAreaAuditSnapshot(updatedArea),
            },
            req,
          });
        }

        return updatedArea;
      });

      res.json(buildProjectAreaResponse(area));
    }),
  );

  // DELETE /api/projects/:id/areas/:areaId - Delete a project area
  projectAreaRouter.delete(
    '/:id/areas/:areaId',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const areaId = parseProjectRouteParam(req.params.areaId, 'areaId');
      const user = req.user!;
      requireBrowserSession(req, 'Project area deletion');

      const access = await getProjectAccessContext(projectId, user);

      if (!access.isProjectAdmin) {
        throw AppError.forbidden('Only admins can delete areas');
      }
      await assertProjectAllowsWrite(projectId);

      // Check area exists and belongs to project
      const existingArea = await prisma.projectArea.findFirst({
        where: { id: areaId, projectId },
      });

      if (!existingArea) {
        throw AppError.notFound('Area');
      }

      await prisma.$transaction(async (tx) => {
        await tx.projectArea.delete({
          where: { id: areaId },
        });

        await writeAuditLogInTransaction(tx, {
          projectId,
          userId: user.id,
          entityType: 'project_area',
          entityId: areaId,
          action: AuditAction.PROJECT_AREA_DELETED,
          changes: buildProjectAreaAuditSnapshot(existingArea),
          req,
        });
      });

      res.json(buildProjectAreaDeletedResponse());
    }),
  );

  return projectAreaRouter;
}
