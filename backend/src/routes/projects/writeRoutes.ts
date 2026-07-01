import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { buildProjectDeletedResponse, buildProjectDetailResponse } from './listDetailResponses.js';
import { buildProjectCreatedResponse } from './costResponses.js';
import { assertCompanyProjectCapacity } from './projectCreationLimit.js';
import { ARCHIVED_PROJECT_READ_ONLY_MESSAGE } from '../../lib/projectAccess.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectWriteRouterDependencies = {
  canCreateProjectForCompany: (user: AuthenticatedUser) => boolean;
  hasSubcontractorProjectIdentity: (user: AuthenticatedUser) => Promise<boolean>;
  isCompanyAdmin: (user: AuthenticatedUser) => boolean;
  isSubcontractorUser: (user: AuthenticatedUser) => boolean;
  parseOptionalDate: (value: unknown, fieldName: string) => Date | null;
  parseOptionalNonNegativeNumber: (value: unknown, fieldName: string) => number | null | undefined;
  parseOptionalPositiveInteger: (value: unknown, fieldName: string) => number | undefined;
  parseOptionalProjectSettings: (value: unknown) => Record<string, unknown> | undefined;
  parseOptionalTrimmedString: (
    value: unknown,
    fieldName: string,
    maxLength: number,
  ) => string | null | undefined;
  parseOptionalWorkingDays: (value: unknown) => string | null | undefined;
  parseOptionalWorkingTime: (value: unknown, fieldName: string) => string | null | undefined;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
  parseRequiredTrimmedString: (value: unknown, fieldName: string, maxLength: number) => string;
  projectClientMaxLength: number;
  projectNameMaxLength: number;
  projectNumberMaxLength: number;
  projectPrefixMaxLength: number;
  projectSpecificationSetMaxLength: number;
  projectStateMaxLength: number;
  projectStatuses: ReadonlySet<string>;
};

const RETAINED_PROJECT_RELATIONS = [
  'projectAreas',
  'lots',
  'itpTemplates',
  'ncrs',
  'dailyDiaries',
  'subcontractorCompanies',
  'dailyDockets',
  'progressClaims',
  'documents',
  'drawings',
  'notifications',
  'notificationAlerts',
  'testResults',
  'lotSubcontractorAssignments',
  'scheduledReports',
  'auditLogs',
  'comments',
] as const;

type RetainedProjectRelation = (typeof RETAINED_PROJECT_RELATIONS)[number];
type RetainedProjectCounts = Record<RetainedProjectRelation, number>;

const AUSTROADS_SPECIFICATION_SET = 'Austroads';

const PROJECT_SPECIFICATION_SET_BY_STATE: Record<string, string> = {
  NSW: 'TfNSW',
  QLD: 'MRTS',
  VIC: 'VicRoads',
  SA: 'DIT',
  WA: 'MRWA',
};

export function getDefaultProjectSpecificationSet(state: string | null | undefined): string {
  const normalizedState = state?.trim().toUpperCase() ?? '';
  return PROJECT_SPECIFICATION_SET_BY_STATE[normalizedState] ?? AUSTROADS_SPECIFICATION_SET;
}

function nonZeroRetainedProjectCounts(
  counts: RetainedProjectCounts,
): Partial<RetainedProjectCounts> {
  return Object.fromEntries(
    RETAINED_PROJECT_RELATIONS.filter((relation) => counts[relation] > 0).map((relation) => [
      relation,
      counts[relation],
    ]),
  );
}

function retainedProjectRecordTotal(counts: RetainedProjectCounts): number {
  return RETAINED_PROJECT_RELATIONS.reduce((total, relation) => total + counts[relation], 0);
}

function sortedRecordKeys(value: Record<string, unknown> | undefined): string[] {
  return value ? Object.keys(value).sort() : [];
}

function parseCommentCount(value: number | bigint | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  return value ?? 0;
}

async function countRetainedProjectComments(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: number | bigint }>>(Prisma.sql`
    WITH normalized_comments AS (
      SELECT
        id,
        entity_id,
        lower(replace(replace(entity_type, ' ', '_'), '-', '_')) AS entity_type
      FROM comments
    )
    SELECT COUNT(*)::int AS count
    FROM normalized_comments c
    WHERE
      (c.entity_type = 'project' AND c.entity_id = ${projectId})
      OR (
        c.entity_type = 'lot'
        AND EXISTS (
          SELECT 1 FROM lots l WHERE l.id = c.entity_id AND l.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type = 'ncr'
        AND EXISTS (
          SELECT 1 FROM ncrs n WHERE n.id = c.entity_id AND n.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type = 'document'
        AND EXISTS (
          SELECT 1 FROM documents d WHERE d.id = c.entity_id AND d.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type = 'drawing'
        AND EXISTS (
          SELECT 1 FROM drawings d WHERE d.id = c.entity_id AND d.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('docket', 'daily_docket', 'dailydocket')
        AND EXISTS (
          SELECT 1 FROM daily_dockets dd WHERE dd.id = c.entity_id AND dd.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('diary', 'daily_diary', 'dailydiary')
        AND EXISTS (
          SELECT 1 FROM daily_diaries dd WHERE dd.id = c.entity_id AND dd.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('test', 'test_result', 'testresult')
        AND EXISTS (
          SELECT 1 FROM test_results tr WHERE tr.id = c.entity_id AND tr.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('progress_claim', 'progressclaim')
        AND EXISTS (
          SELECT 1 FROM progress_claims pc WHERE pc.id = c.entity_id AND pc.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('holdpoint', 'hold_point')
        AND EXISTS (
          SELECT 1
          FROM hold_points hp
          JOIN lots l ON l.id = hp.lot_id
          WHERE hp.id = c.entity_id AND l.project_id = ${projectId}
        )
      )
      OR (
        c.entity_type IN ('itp', 'itp_instance', 'itpinstance')
        AND (
          EXISTS (
            SELECT 1
            FROM itp_instances ii
            JOIN lots l ON l.id = ii.lot_id
            WHERE ii.id = c.entity_id AND l.project_id = ${projectId}
          )
          OR EXISTS (
            SELECT 1 FROM lots l WHERE l.id = c.entity_id AND l.project_id = ${projectId}
          )
        )
      )
      OR (
        c.entity_type IN ('itp_completion', 'itpcompletion')
        AND EXISTS (
          SELECT 1
          FROM itp_completions ic
          JOIN itp_instances ii ON ii.id = ic.itp_instance_id
          JOIN lots l ON l.id = ii.lot_id
          WHERE ic.id = c.entity_id AND l.project_id = ${projectId}
        )
      )
  `);

  return parseCommentCount(rows[0]?.count);
}

export function createProjectWriteRouter({
  canCreateProjectForCompany,
  hasSubcontractorProjectIdentity,
  isCompanyAdmin,
  isSubcontractorUser,
  parseOptionalDate,
  parseOptionalNonNegativeNumber,
  parseOptionalPositiveInteger,
  parseOptionalProjectSettings,
  parseOptionalTrimmedString,
  parseOptionalWorkingDays,
  parseOptionalWorkingTime,
  parseProjectRouteParam,
  parseRequiredTrimmedString,
  projectClientMaxLength,
  projectNameMaxLength,
  projectNumberMaxLength,
  projectPrefixMaxLength,
  projectSpecificationSetMaxLength,
  projectStateMaxLength,
  projectStatuses,
}: ProjectWriteRouterDependencies) {
  const projectWriteRouter = Router();

  projectWriteRouter.use(requireAuth);

  // POST /api/projects - Create a new project
  projectWriteRouter.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      requireBrowserSession(req, 'Project creation');
      const name = parseRequiredTrimmedString(req.body.name, 'Name', projectNameMaxLength);
      const projectNumber = parseOptionalTrimmedString(
        req.body.projectNumber,
        'Project number',
        projectNumberMaxLength,
      );
      const clientName = parseOptionalTrimmedString(
        req.body.clientName,
        'Client name',
        projectClientMaxLength,
      );
      const startDate = parseOptionalDate(req.body.startDate, 'Start date');
      const targetCompletion = parseOptionalDate(req.body.targetCompletion, 'Target completion');
      const contractValue = parseOptionalNonNegativeNumber(
        req.body.contractValue,
        'Contract value',
      );
      const state = parseOptionalTrimmedString(req.body.state, 'State', projectStateMaxLength);
      const specificationSet = parseOptionalTrimmedString(
        req.body.specificationSet,
        'Specification set',
        projectSpecificationSetMaxLength,
      );
      const effectiveState = state || 'NSW';
      const effectiveSpecificationSet =
        specificationSet || getDefaultProjectSpecificationSet(effectiveState);

      if (await hasSubcontractorProjectIdentity(user)) {
        throw AppError.forbidden('Subcontractor portal users cannot create company projects');
      }

      if (!user.companyId) {
        throw AppError.forbidden('Users must belong to an organization before creating projects');
      }

      if (!canCreateProjectForCompany(user)) {
        throw AppError.forbidden('Only company admins and project managers can create projects');
      }

      const companyId = user.companyId;

      // Generate project number if not provided
      const generatedProjectNumber =
        projectNumber || `PRJ-${Date.now().toString(36).toUpperCase()}`;

      const project = await prisma.$transaction(async (tx) => {
        await assertCompanyProjectCapacity(tx, companyId);

        const createdProject = await tx.project.create({
          data: {
            name,
            projectNumber: generatedProjectNumber,
            clientName,
            startDate,
            targetCompletion,
            contractValue: contractValue ?? null,
            companyId,
            state: effectiveState,
            specificationSet: effectiveSpecificationSet,
          },
          select: {
            id: true,
            name: true,
            projectNumber: true,
            status: true,
            createdAt: true,
          },
        });

        await tx.projectUser.create({
          data: {
            projectId: createdProject.id,
            userId: user.id,
            role: 'admin',
            status: 'active',
            acceptedAt: new Date(),
          },
        });

        return createdProject;
      });

      await createAuditLog({
        projectId: project.id,
        userId: user.id,
        entityType: 'project',
        entityId: project.id,
        action: AuditAction.PROJECT_CREATED,
        changes: {
          name: project.name,
          projectNumber: project.projectNumber,
          state: effectiveState,
          specificationSet: effectiveSpecificationSet,
          clientName: clientName || null,
          contractValue: contractValue ?? null,
        },
        req,
      });

      res.status(201).json(buildProjectCreatedResponse(project));
    }),
  );

  // PATCH /api/projects/:id - Update project settings
  projectWriteRouter.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;
      requireBrowserSession(req, 'Project settings update');
      if (isSubcontractorUser(user)) {
        throw AppError.forbidden('Access denied. Only project admins can update settings.');
      }

      const name =
        req.body.name === undefined
          ? undefined
          : parseRequiredTrimmedString(req.body.name, 'Project name', projectNameMaxLength);
      const code =
        req.body.code === undefined
          ? undefined
          : parseRequiredTrimmedString(req.body.code, 'Project code', projectNumberMaxLength);
      // The specification standard determines which global ITP library templates
      // a project can use. It was previously only settable at creation, which
      // stranded projects created with a legacy value (e.g. 'rms') — they could
      // never see the library and there was no way to correct it. Allow updating
      // it here (non-empty; the field is required on the model).
      const specificationSet =
        req.body.specificationSet === undefined
          ? undefined
          : parseRequiredTrimmedString(
              req.body.specificationSet,
              'Specification set',
              projectSpecificationSetMaxLength,
            );
      const lotPrefix =
        req.body.lotPrefix === undefined
          ? undefined
          : parseRequiredTrimmedString(req.body.lotPrefix, 'Lot prefix', projectPrefixMaxLength);
      const ncrPrefix =
        req.body.ncrPrefix === undefined
          ? undefined
          : parseRequiredTrimmedString(req.body.ncrPrefix, 'NCR prefix', projectPrefixMaxLength);
      const lotStartingNumber = parseOptionalPositiveInteger(
        req.body.lotStartingNumber,
        'Lot starting number',
      );
      const ncrStartingNumber = parseOptionalPositiveInteger(
        req.body.ncrStartingNumber,
        'NCR starting number',
      );
      const workingHoursStart = parseOptionalWorkingTime(
        req.body.workingHoursStart,
        'Working hours start',
      );
      const workingHoursEnd = parseOptionalWorkingTime(
        req.body.workingHoursEnd,
        'Working hours end',
      );
      const workingDays = parseOptionalWorkingDays(req.body.workingDays);
      const chainageStart = parseOptionalNonNegativeNumber(
        req.body.chainageStart,
        'Chainage start',
      );
      const chainageEnd = parseOptionalNonNegativeNumber(req.body.chainageEnd, 'Chainage end');
      const settings = parseOptionalProjectSettings(req.body.settings);
      const status = req.body.status;
      if (status !== undefined && (typeof status !== 'string' || !projectStatuses.has(status))) {
        throw AppError.badRequest('Invalid status value');
      }

      // Check access - user must be admin or project admin
      const projectUser = await prisma.projectUser.findFirst({
        where: {
          projectId: id,
          userId: user.id,
          status: 'active',
        },
      });

      const isProjectAdmin =
        projectUser?.role === 'admin' || projectUser?.role === 'project_manager';
      const companyAdmin = isCompanyAdmin(user);

      // Get the project to check company ownership
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          companyId: true,
          chainageStart: true,
          chainageEnd: true,
          workingHoursStart: true,
          workingHoursEnd: true,
          settings: true,
          status: true,
        },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      const isCompanyProject = project.companyId === user.companyId;

      if (!isProjectAdmin && !(companyAdmin && isCompanyProject)) {
        throw AppError.forbidden('Access denied. Only project admins can update settings.');
      }

      const requestKeys =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? Object.keys(req.body)
          : [];
      const isStatusOnlyUpdate = requestKeys.length === 1 && requestKeys[0] === 'status';
      if (project.status === 'archived' && (!isStatusOnlyUpdate || status !== 'active')) {
        throw AppError.conflict(ARCHIVED_PROJECT_READ_ONLY_MESSAGE);
      }

      const effectiveChainageStart =
        chainageStart !== undefined
          ? chainageStart
          : project.chainageStart === null
            ? null
            : Number(project.chainageStart);
      const effectiveChainageEnd =
        chainageEnd !== undefined
          ? chainageEnd
          : project.chainageEnd === null
            ? null
            : Number(project.chainageEnd);
      if (
        effectiveChainageStart !== null &&
        effectiveChainageEnd !== null &&
        effectiveChainageStart >= effectiveChainageEnd
      ) {
        throw AppError.badRequest('Chainage end must be greater than chainage start');
      }

      const effectiveWorkingHoursStart =
        workingHoursStart !== undefined ? workingHoursStart : project.workingHoursStart;
      const effectiveWorkingHoursEnd =
        workingHoursEnd !== undefined ? workingHoursEnd : project.workingHoursEnd;
      if (
        effectiveWorkingHoursStart &&
        effectiveWorkingHoursEnd &&
        effectiveWorkingHoursStart >= effectiveWorkingHoursEnd
      ) {
        throw AppError.badRequest('Working hours end must be later than working hours start');
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.projectNumber = code;
      if (specificationSet !== undefined) updateData.specificationSet = specificationSet;
      if (lotPrefix !== undefined) updateData.lotPrefix = lotPrefix;
      if (lotStartingNumber !== undefined) updateData.lotStartingNumber = lotStartingNumber;
      if (ncrPrefix !== undefined) updateData.ncrPrefix = ncrPrefix;
      if (ncrStartingNumber !== undefined) updateData.ncrStartingNumber = ncrStartingNumber;
      if (workingHoursStart !== undefined) updateData.workingHoursStart = workingHoursStart;
      if (workingHoursEnd !== undefined) updateData.workingHoursEnd = workingHoursEnd;
      if (workingDays !== undefined) updateData.workingDays = workingDays;
      if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
      if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
      if (status !== undefined) updateData.status = status;
      // Feature #697 - Store HP recipients and other notification settings in JSON settings field
      if (settings !== undefined) {
        let existingSettings: Record<string, unknown> = {};
        if (project.settings) {
          try {
            existingSettings = JSON.parse(project.settings);
          } catch {
            // Invalid JSON, start fresh
          }
        }
        const mergedSettings = { ...existingSettings, ...settings };
        updateData.settings = JSON.stringify(mergedSettings);
      }

      // Update the project
      const updatedProject = await prisma.project.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          projectNumber: true,
          lotPrefix: true,
          lotStartingNumber: true,
          ncrPrefix: true,
          ncrStartingNumber: true,
          specificationSet: true,
          workingHoursStart: true,
          workingHoursEnd: true,
          workingDays: true,
          chainageStart: true,
          chainageEnd: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const changedFields = Object.keys(updateData);
      if (changedFields.length > 0) {
        await createAuditLog({
          projectId: id,
          userId: user.id,
          entityType: 'project',
          entityId: id,
          action: AuditAction.PROJECT_UPDATED,
          changes: {
            changedFields,
            settingsKeys: sortedRecordKeys(settings),
            previousStatus: status !== undefined ? project.status : undefined,
            newStatus: status !== undefined ? status : undefined,
          },
          req,
        });
      }

      // Map projectNumber to code for frontend consistency
      res.json(buildProjectDetailResponse(updatedProject));
    }),
  );

  // DELETE /api/projects/:id - Delete a project (requires password confirmation)
  projectWriteRouter.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseProjectRouteParam(req.params.id, 'id');
      const { password } = req.body;
      const user = req.user!;
      requireBrowserSession(req, 'Project deletion');

      // Password is required for deletion
      if (typeof password !== 'string' || password.length === 0) {
        throw AppError.badRequest('Password confirmation is required to delete a project');
      }

      // Get the full user record with password hash
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          passwordHash: true,
          roleInCompany: true,
          companyId: true,
        },
      });

      if (!fullUser || !fullUser.passwordHash) {
        throw AppError.unauthorized('Invalid credentials');
      }

      // Verify password
      const { verifyPassword } = await import('../../lib/auth.js');
      if (!verifyPassword(password, fullUser.passwordHash)) {
        throw AppError.unauthorized('Incorrect password');
      }

      // Check if project exists
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
          companyId: true,
        },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      // Authorization: only company owners/admins may delete projects in their own company.
      const isAdmin = fullUser.roleInCompany === 'admin' || fullUser.roleInCompany === 'owner';
      const isCompanyProject = project.companyId === fullUser.companyId;

      if (!isAdmin || !isCompanyProject) {
        throw AppError.forbidden('You do not have permission to delete this project');
      }

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM projects WHERE id = ${id} FOR UPDATE`);

        const retainedRecords = await tx.project.findUnique({
          where: { id },
          select: {
            _count: {
              select: {
                projectAreas: true,
                lots: true,
                itpTemplates: true,
                ncrs: true,
                dailyDiaries: true,
                subcontractorCompanies: true,
                dailyDockets: true,
                progressClaims: true,
                documents: true,
                drawings: true,
                notifications: true,
                notificationAlerts: true,
                testResults: true,
                lotSubcontractorAssignments: true,
                scheduledReports: true,
              },
            },
          },
        });

        if (!retainedRecords) {
          throw AppError.notFound('Project');
        }

        const retainedRecordCounts = {
          ...retainedRecords._count,
          auditLogs: await tx.auditLog.count({
            where: {
              projectId: id,
              action: { not: AuditAction.PROJECT_CREATED },
            },
          }),
          comments: await countRetainedProjectComments(tx, id),
        };

        if (retainedProjectRecordTotal(retainedRecordCounts) > 0) {
          throw AppError.conflict(
            'Project contains retained records and cannot be permanently deleted. Archive the project instead.',
            {
              retainedRecordCounts: nonZeroRetainedProjectCounts(retainedRecordCounts),
            },
          );
        }

        // Only empty setup projects can be hard-deleted. Projects with compliance
        // records must be archived so retention evidence and audit history survive.
        await tx.project.delete({
          where: { id },
        });
      });

      await createAuditLog({
        userId: user.id,
        entityType: 'project',
        entityId: project.id,
        action: AuditAction.PROJECT_DELETED,
        changes: {
          name: project.name,
          projectNumber: project.projectNumber,
          status: project.status,
          deletionType: 'empty_project_hard_delete',
        },
        req,
      });

      res.json(buildProjectDeletedResponse(project));
    }),
  );

  return projectWriteRouter;
}
