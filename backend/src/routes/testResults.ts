import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../lib/pagination.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  getEffectiveProjectRole,
  isCompanyAdminRole,
  isSubcontractorPortalRole,
  requireSubcontractorPortalModuleAccess,
} from '../lib/projectAccess.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
import { logWarn } from '../lib/serverLogger.js';
import {
  certificateUpload,
  cleanupStoredCertificateUpload,
  cleanupUploadedCertificateFile,
  deleteCertificateFromSupabase,
  isOwnedSupabaseCertificateUrl,
  sanitizeUploadFilename,
  shouldUploadCertificateToSupabase,
  uploadCertificateToSupabase,
} from './testResults/certificateStorage.js';
import {
  LOW_CONFIDENCE_THRESHOLD,
  type ExtractedCertificateFields,
  buildConfidenceObject,
  extractCertificateFields,
  getLowConfidenceFields,
} from './testResults/certificateExtraction.js';
import {
  applyTestResultCorrections,
  type TestResultCorrections,
} from './testResults/corrections.js';
import { buildTestResultData, suggestLotsFromLocation } from './testResults/testResultMapping.js';
import { testTypeSpecifications } from './testResults/specifications.js';
import {
  buildTestRequestFormMetadata,
  buildVerificationViewData,
  renderTestRequestFormHtml,
} from './testResults/presentation.js';
import { STATUS_LABELS, VALID_STATUS_TRANSITIONS } from './testResults/statusWorkflow.js';
import {
  MAX_REJECTION_REASON_LENGTH,
  MAX_RESULT_UNIT_LENGTH,
  MAX_SAMPLE_LOCATION_LENGTH,
  MAX_SEARCH_LENGTH,
  MAX_TEST_ID_LENGTH,
  MAX_TEST_REQUEST_NUMBER_LENGTH,
  MAX_TEST_TEXT_LENGTH,
  MAX_TEST_TYPE_LENGTH,
  MAX_UPLOAD_PROJECT_ID_LENGTH,
  normalizeOptionalQueryString,
  normalizeOptionalString,
  normalizePassFail,
  normalizeRequiredString,
  parseRequestFormFormat,
  parseTestResultRouteParam,
  toNullableDate,
  toNullableFloat,
  toNullableString,
} from './testResults/validation.js';

export const testResultsRouter = Router();

function cleanupUploadedCertificateFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    cleanupUploadedCertificateFile(file);
  }
}

function getRequiredUploadProjectId(body: Record<string, unknown>): string {
  const projectId = body.projectId;

  if (typeof projectId !== 'string') {
    throw AppError.badRequest('projectId is required');
  }

  const trimmed = projectId.trim();
  if (!trimmed) {
    throw AppError.badRequest('projectId is required');
  }

  if (trimmed.length > MAX_UPLOAD_PROJECT_ID_LENGTH) {
    throw AppError.badRequest('projectId is too long');
  }

  return trimmed;
}

// Apply authentication middleware to all test result routes
testResultsRouter.use(requireAuth);

// Roles that can create/edit test results
const TEST_CREATORS = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
  'foreman',
];
// Roles that can verify test results
const TEST_VERIFIERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
// Roles that can delete test results
const TEST_DELETERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

type AuthenticatedUser = NonNullable<Request['user']>;
type TestResultAccessTarget = { projectId: string; lotId?: string | null };
type TestFieldValue = string | number | Date | Prisma.Decimal | null;
type TestFieldStatus = { value: TestFieldValue; confidence: number; status: string };

type BatchUploadResult =
  | {
      success: true;
      filename: string;
      testResult: {
        id: string;
        testType: string;
        status: string;
        aiExtracted: boolean;
        certificateDoc: {
          id: string;
          filename: string;
          fileUrl: string;
          mimeType: string | null;
        } | null;
      };
      extraction: {
        extractedFields: ExtractedCertificateFields;
        confidence: Record<string, number>;
        lowConfidenceFields: Array<{ field: string; confidence: number }>;
        needsReview: boolean;
      };
    }
  | { success: false; filename: string; error: string };

type BatchConfirmResult =
  | {
      success: true;
      testResultId: string;
      testResult: {
        id: string;
        testType: string;
        status: string;
      };
    }
  | { success: false; testResultId: string; error: string };

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return isCompanyAdminRole(user.roleInCompany);
}

function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return isSubcontractorPortalRole(user.roleInCompany);
}

async function getReadableProjectIds(user: AuthenticatedUser): Promise<string[]> {
  const isSubcontractor = isSubcontractorUser(user);
  const [projectUsers, companyProjects, subcontractorCompanies] = await Promise.all([
    isSubcontractor
      ? Promise.resolve([])
      : prisma.projectUser.findMany({
          where: { userId: user.id, status: 'active' },
          select: { projectId: true },
        }),
    !isSubcontractor && isCompanyAdmin(user) && user.companyId
      ? prisma.project.findMany({
          where: { companyId: user.companyId },
          select: { id: true },
        })
      : Promise.resolve([]),
    isSubcontractor
      ? prisma.subcontractorCompany.findMany({
          where: activeSubcontractorCompanyWhere({ users: { some: { userId: user.id } } }),
          select: { projectId: true },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Set([
      ...projectUsers.map((projectUser) => projectUser.projectId),
      ...companyProjects.map((project) => project.id),
      ...subcontractorCompanies.map((subcontractorCompany) => subcontractorCompany.projectId),
    ]),
  ];
}

async function requireProjectReadAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
) {
  const hasAccess = await checkProjectAccess(user.id, projectId);
  if (!hasAccess) {
    throw AppError.forbidden(message);
  }
}

async function requireTestResultsPortalAccess(projectId: string, user: AuthenticatedUser) {
  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: 'testResults',
  });
}

async function getAssignedSubcontractorLotIds(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string[] | null> {
  if (!isSubcontractorUser(user)) {
    return null;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  if (!subcontractorUser) {
    return [];
  }

  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: subcontractorUser.subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([
      ...assignments.map((assignment) => assignment.lotId),
      ...legacyLots.map((lot) => lot.id),
    ]),
  ];
}

async function hasAssignedSubcontractorLotAccess(
  projectId: string,
  lotId: string | null | undefined,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (!lotId) {
    return !isSubcontractorUser(user);
  }

  const assignedLotIds = await getAssignedSubcontractorLotIds(projectId, user);
  return assignedLotIds === null || assignedLotIds.includes(lotId);
}

async function requireTestResultReadAccess(
  testResult: TestResultAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this test result',
) {
  await requireProjectReadAccess(testResult.projectId, user, message);
  await requireTestResultsPortalAccess(testResult.projectId, user);

  if (!(await hasAssignedSubcontractorLotAccess(testResult.projectId, testResult.lotId, user))) {
    throw AppError.forbidden(message);
  }
}

async function requireTestProjectRole(
  projectId: string,
  user: AuthenticatedUser,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });

  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden(message);
  }

  return role;
}

async function requireLotInProject(lotId: string, projectId: string) {
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.badRequest('Lot not found or does not belong to this project');
  }
}

// GET /api/test-results/specifications - Get all test type specifications
testResultsRouter.get(
  '/specifications',
  asyncHandler(async (_req, res) => {
    res.json({
      specifications: Object.entries(testTypeSpecifications).map(([key, spec]) => ({
        testType: key,
        ...spec,
      })),
    });
  }),
);

// GET /api/test-results/specifications/:testType - Get specification for a specific test type
testResultsRouter.get(
  '/specifications/:testType',
  asyncHandler(async (req, res) => {
    const testType = parseTestResultRouteParam(
      req.params.testType,
      'testType',
      MAX_TEST_TYPE_LENGTH,
    );

    // Normalize test type key (lowercase, replace spaces with underscore)
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_');

    const spec = testTypeSpecifications[normalizedType];

    if (!spec) {
      // Try to find a partial match
      const partialMatch = Object.entries(testTypeSpecifications).find(
        ([key, value]) =>
          key.includes(normalizedType) || value.name.toLowerCase().includes(testType.toLowerCase()),
      );

      if (partialMatch) {
        return res.json({
          testType: partialMatch[0],
          ...partialMatch[1],
        });
      }

      throw new AppError(404, `No specification found for test type: ${testType}`, 'NOT_FOUND', {
        availableTypes: Object.keys(testTypeSpecifications),
      });
    }

    res.json({
      testType: normalizedType,
      ...spec,
    });
  }),
);

// GET /api/test-results/laboratories - Get recent laboratory names for auto-population (Feature #470)
testResultsRouter.get(
  '/laboratories',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeOptionalQueryString(
      req.query.projectId,
      'projectId',
      MAX_UPLOAD_PROJECT_ID_LENGTH,
    );
    const search = normalizeOptionalQueryString(req.query.search, 'search', MAX_SEARCH_LENGTH);

    const whereClause: Prisma.TestResultWhereInput = {
      laboratoryName: { not: null },
    };

    if (projectId) {
      await requireProjectReadAccess(projectId, user);
      await requireTestResultsPortalAccess(projectId, user);
      whereClause.projectId = projectId;
      const assignedLotIds = await getAssignedSubcontractorLotIds(projectId, user);
      if (assignedLotIds !== null) {
        if (assignedLotIds.length === 0) {
          return res.json({ laboratories: [] });
        }
        whereClause.lotId = { in: assignedLotIds };
      }
    } else {
      let readableProjectIds = await getReadableProjectIds(user);
      if (readableProjectIds.length === 0) {
        return res.json({ laboratories: [] });
      }

      if (isSubcontractorUser(user)) {
        const portalEnabledProjectIds: string[] = [];
        for (const readableProjectId of readableProjectIds) {
          try {
            await requireTestResultsPortalAccess(readableProjectId, user);
            portalEnabledProjectIds.push(readableProjectId);
          } catch (error) {
            if (!(error instanceof AppError) || error.statusCode !== 403) {
              throw error;
            }
          }
        }

        readableProjectIds = portalEnabledProjectIds;
        if (readableProjectIds.length === 0) {
          return res.json({ laboratories: [] });
        }
      }

      whereClause.projectId = { in: readableProjectIds };
      if (isSubcontractorUser(user)) {
        const assignedLotIdSets = await Promise.all(
          readableProjectIds.map((readableProjectId) =>
            getAssignedSubcontractorLotIds(readableProjectId, user),
          ),
        );
        const assignedLotIds = [...new Set(assignedLotIdSets.flatMap((lotIds) => lotIds ?? []))];
        if (assignedLotIds.length === 0) {
          return res.json({ laboratories: [] });
        }
        whereClause.lotId = { in: assignedLotIds };
      }
    }

    if (search) {
      whereClause.laboratoryName = {
        not: null,
        contains: search,
        mode: 'insensitive',
      };
    }

    // Get distinct laboratory names, ordered by most recently used
    const recentLabs = await prisma.testResult.groupBy({
      by: ['laboratoryName'],
      where: whereClause,
      _max: {
        createdAt: true,
      },
      orderBy: {
        _max: {
          createdAt: 'desc',
        },
      },
      take: 20,
    });

    const laboratories = recentLabs
      .filter((lab) => lab.laboratoryName)
      .map((lab) => lab.laboratoryName);

    res.json({ laboratories });
  }),
);

// GET /api/test-results - List all test results for a project
testResultsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeOptionalQueryString(
      req.query.projectId,
      'projectId',
      MAX_UPLOAD_PROJECT_ID_LENGTH,
    );
    const lotId = normalizeOptionalQueryString(req.query.lotId, 'lotId', MAX_TEST_ID_LENGTH);
    const search = normalizeOptionalQueryString(req.query.search, 'search', MAX_SEARCH_LENGTH);

    if (!projectId) {
      throw AppError.badRequest('projectId query parameter is required');
    }

    await requireProjectReadAccess(projectId, user);
    await requireSubcontractorPortalModuleAccess({
      userId: user.id,
      role: user.roleInCompany,
      projectId,
      module: 'testResults',
    });

    // Build where clause
    const whereClause: Prisma.TestResultWhereInput = { projectId };

    // Filter by lot if provided
    if (lotId) {
      whereClause.lotId = lotId;
    }

    const assignedLotIds = await getAssignedSubcontractorLotIds(projectId, user);
    if (assignedLotIds !== null) {
      // Subcontractors can only see test results on their assigned lots.
      if (assignedLotIds.length === 0) {
        return res.json({ testResults: [] });
      }

      if (lotId) {
        if (!assignedLotIds.includes(lotId)) {
          return res.json({ testResults: [] });
        }
        whereClause.lotId = lotId;
      } else {
        whereClause.lotId = { in: assignedLotIds };
      }
    }

    const pagination = parsePagination(req.query);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);
    const finalWhereClause: Prisma.TestResultWhereInput = search
      ? {
          AND: [
            whereClause,
            {
              OR: [
                { testType: { contains: search, mode: 'insensitive' } },
                { testRequestNumber: { contains: search, mode: 'insensitive' } },
                { laboratoryName: { contains: search, mode: 'insensitive' } },
                { laboratoryReportNumber: { contains: search, mode: 'insensitive' } },
                { sampleLocation: { contains: search, mode: 'insensitive' } },
                { resultUnit: { contains: search, mode: 'insensitive' } },
                { status: { contains: search, mode: 'insensitive' } },
                {
                  lot: {
                    is: {
                      lotNumber: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
          ],
        }
      : whereClause;

    const [testResults, total] = await Promise.all([
      prisma.testResult.findMany({
        where: finalWhereClause,
        select: {
          id: true,
          testType: true,
          testRequestNumber: true,
          laboratoryName: true,
          laboratoryReportNumber: true,
          sampleDate: true,
          sampleLocation: true,
          testDate: true,
          resultDate: true,
          resultValue: true,
          resultUnit: true,
          specificationMin: true,
          specificationMax: true,
          passFail: true,
          status: true,
          lotId: true,
          lot: {
            select: {
              id: true,
              lotNumber: true,
            },
          },
          aiExtracted: true, // Feature #200
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.testResult.count({ where: finalWhereClause }),
    ]);

    res.json({
      testResults,
      pagination: getPaginationMeta(total, pagination.page, pagination.limit),
    });
  }),
);

// GET /api/test-results/:id - Get a single test result
testResultsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
          },
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);

    res.json({ testResult });
  }),
);

// POST /api/test-results - Create a new test result
testResultsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const {
      projectId,
      lotId,
      testType,
      testRequestNumber,
      laboratoryName,
      laboratoryReportNumber,
      sampleDate,
      sampleLocation,
      testDate,
      resultDate,
      resultValue,
      resultUnit,
      specificationMin,
      specificationMax,
      passFail,
    } = req.body;

    const projectIdValue = normalizeRequiredString(projectId, 'projectId', MAX_TEST_ID_LENGTH);
    const lotIdValue = normalizeOptionalString(lotId, 'lotId', MAX_TEST_ID_LENGTH) ?? null;
    const testTypeValue = normalizeRequiredString(testType, 'testType', MAX_TEST_TYPE_LENGTH);
    const testRequestNumberValue = toNullableString(
      testRequestNumber,
      'testRequestNumber',
      MAX_TEST_REQUEST_NUMBER_LENGTH,
    );
    const laboratoryNameValue = toNullableString(
      laboratoryName,
      'laboratoryName',
      MAX_TEST_TEXT_LENGTH,
    );
    const laboratoryReportNumberValue = toNullableString(
      laboratoryReportNumber,
      'laboratoryReportNumber',
      MAX_TEST_TEXT_LENGTH,
    );
    const sampleDateValue = toNullableDate(sampleDate, 'sampleDate');
    const sampleLocationValue = toNullableString(
      sampleLocation,
      'sampleLocation',
      MAX_SAMPLE_LOCATION_LENGTH,
    );
    const testDateValue = toNullableDate(testDate, 'testDate');
    const resultDateValue = toNullableDate(resultDate, 'resultDate');
    const resultValueValue = toNullableFloat(resultValue, 'resultValue');
    const resultUnitValue = toNullableString(resultUnit, 'resultUnit', MAX_RESULT_UNIT_LENGTH);
    const specificationMinValue = toNullableFloat(specificationMin, 'specificationMin');
    const specificationMaxValue = toNullableFloat(specificationMax, 'specificationMax');
    const passFailValue = normalizePassFail(passFail, 'pending');

    await requireTestProjectRole(
      projectIdValue,
      user,
      TEST_CREATORS,
      'You do not have permission to create test results',
    );

    // If lotId is provided, verify lot exists and belongs to project
    if (lotIdValue) {
      await requireLotInProject(lotIdValue, projectIdValue);
    }

    const testResult = await prisma.testResult.create({
      data: {
        projectId: projectIdValue,
        lotId: lotIdValue,
        testType: testTypeValue,
        testRequestNumber: testRequestNumberValue,
        laboratoryName: laboratoryNameValue,
        laboratoryReportNumber: laboratoryReportNumberValue,
        sampleDate: sampleDateValue,
        sampleLocation: sampleLocationValue,
        testDate: testDateValue,
        resultDate: resultDateValue,
        resultValue: resultValueValue,
        resultUnit: resultUnitValue,
        specificationMin: specificationMinValue,
        specificationMax: specificationMaxValue,
        passFail: passFailValue,
        status: 'requested', // Feature #196: Start in 'requested' status
      },
      select: {
        id: true,
        testType: true,
        testRequestNumber: true,
        lotId: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
          },
        },
        passFail: true,
        status: true,
        createdAt: true,
      },
    });

    // Audit log for test result creation
    await createAuditLog({
      projectId: projectIdValue,
      userId: user.id,
      entityType: 'test_result',
      entityId: testResult.id,
      action: AuditAction.TEST_RESULT_CREATED,
      changes: { testType: testTypeValue, lotId: lotIdValue, passFail: passFailValue },
      req,
    });

    res.status(201).json({ testResult });
  }),
);

// PATCH /api/test-results/:id - Update a test result
testResultsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    const userProjectRole = await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_CREATORS,
      'You do not have permission to edit test results',
    );

    if (testResult.status === 'verified' && !TEST_VERIFIERS.includes(userProjectRole)) {
      throw AppError.conflict('Verified test results can only be edited by test result verifiers', {
        status: testResult.status,
      });
    }

    const {
      lotId,
      testType,
      testRequestNumber,
      laboratoryName,
      laboratoryReportNumber,
      sampleDate,
      sampleLocation,
      testDate,
      resultDate,
      resultValue,
      resultUnit,
      specificationMin,
      specificationMax,
      passFail,
    } = req.body;

    const lotIdValue = normalizeOptionalString(lotId, 'lotId', MAX_TEST_ID_LENGTH);

    if (lotIdValue) {
      await requireLotInProject(lotIdValue, testResult.projectId);
    }

    // Build update data
    const updateData: Prisma.TestResultUncheckedUpdateInput = {};
    if (lotId !== undefined) updateData.lotId = lotIdValue || null;
    applyTestResultCorrections(updateData, {
      testType,
      testRequestNumber,
      laboratoryName,
      laboratoryReportNumber,
      sampleDate,
      sampleLocation,
      testDate,
      resultDate,
      resultValue,
      resultUnit,
      specificationMin,
      specificationMax,
      passFail,
    });

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        testRequestNumber: true,
        lotId: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
          },
        },
        passFail: true,
        status: true,
        updatedAt: true,
      },
    });

    // Audit log for test result update
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_UPDATED,
      changes: updateData,
      req,
    });

    res.json({ testResult: updatedTestResult });
  }),
);

// DELETE /api/test-results/:id - Delete a test result
testResultsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: { certificateDoc: true },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_DELETERS,
      'You do not have permission to delete test results',
    );

    // Audit log for test result deletion (before deleting the record)
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_DELETED,
      changes: { testType: testResult.testType, lotId: testResult.lotId },
      req,
    });

    // Capture certificate doc info before the row is gone, so we can clean up
    // the linked Document and Supabase object after the DB transaction.
    const certificateDoc = testResult.certificateDoc;
    const isSupabaseStored =
      !!certificateDoc?.fileUrl &&
      isOwnedSupabaseCertificateUrl(certificateDoc.fileUrl, testResult.projectId);

    // Atomic DB delete: testResult plus the linked Document row when present.
    // The relation is `onDelete: SetNull`, so document deletion alone wouldn't
    // remove the testResult — we have to delete both explicitly.
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.testResult.delete({ where: { id } }),
    ];
    if (certificateDoc) {
      operations.push(prisma.document.delete({ where: { id: certificateDoc.id } }));
    }
    await prisma.$transaction(operations);

    // Best-effort Supabase removal after the DB state is committed. A failure
    // here leaves an orphan storage object but the DB is the source of truth.
    if (isSupabaseStored && certificateDoc?.fileUrl) {
      try {
        await deleteCertificateFromSupabase(certificateDoc.fileUrl, testResult.projectId);
      } catch (error) {
        logWarn(
          'Failed to delete test certificate file from Supabase after database delete:',
          error,
        );
      }
    }

    res.json({ message: 'Test result deleted successfully' });
  }),
);

// GET /api/test-results/:id/request-form - Generate printable test request form for lab
testResultsRouter.get(
  '/:id/request-form',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            clientName: true,
            company: {
              select: {
                name: true,
                abn: true,
                address: true,
                logoUrl: true,
              },
            },
          },
        },
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
            chainageStart: true,
            chainageEnd: true,
            layer: true,
            activityType: true,
          },
        },
        enteredBy: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);
    const format = parseRequestFormFormat(req.query.format);

    if (format === 'json') {
      // Return JSON metadata for the request form
      res.json({ testRequestForm: buildTestRequestFormMetadata(testResult) });
    } else {
      // Return HTML for printing
      res.setHeader('Content-Type', 'text/html');
      res.send(renderTestRequestFormHtml(testResult));
    }
  }),
);

// GET /api/test-results/:id/verification-view - Get side-by-side verification view data
testResultsRouter.get(
  '/:id/verification-view',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            specificationSet: true,
          },
        },
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
            activityType: true,
            chainageStart: true,
            chainageEnd: true,
            layer: true,
          },
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        certificateDoc: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);
    const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });

    const canVerify = TEST_VERIFIERS.includes(userProjectRole || '');

    res.json({ verificationView: buildVerificationViewData(testResult, { canVerify }) });
  }),
);

// POST /api/test-results/:id/reject - Reject a test result verification (Feature #204)
testResultsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;
    const reason = normalizeRequiredString(req.body.reason, 'reason', MAX_REJECTION_REASON_LENGTH);

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_VERIFIERS,
      'You do not have permission to reject test results',
    );

    // Can only reject tests that are in 'entered' status (pending verification)
    if (testResult.status !== 'entered') {
      throw AppError.badRequest(
        `Cannot reject a test result with status '${testResult.status}'. Only tests in 'Entered' status can be rejected.`,
      );
    }

    // Reset status back to 'results_received' so engineer can re-enter
    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'results_received',
        rejectedById: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
        // Clear verification fields
        verifiedById: null,
        verifiedAt: null,
        // Clear entered fields so engineer can re-enter
        enteredById: null,
        enteredAt: null,
      },
      select: {
        id: true,
        testType: true,
        status: true,
        rejectedAt: true,
        rejectionReason: true,
        rejectedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // In a real app, we would send a notification to the engineer here
    // For now, we'll just include the engineer info in the response
    const engineerNotified = testResult.enteredBy
      ? {
          userId: testResult.enteredBy.id,
          name: testResult.enteredBy.fullName,
          email: testResult.enteredBy.email,
          message: `Your test result "${testResult.testType}" was rejected. Reason: ${reason}`,
        }
      : null;

    // Audit log for test result rejection
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_REJECTED,
      changes: { reason, previousStatus: testResult.status },
      req,
    });

    res.json({
      message: 'Test result rejected',
      testResult: updatedTestResult,
      notification: {
        sent: engineerNotified !== null,
        recipient: engineerNotified,
      },
    });
  }),
);

// POST /api/test-results/:id/verify - Verify a test result (quality management)
testResultsRouter.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_VERIFIERS,
      'You do not have permission to verify test results',
    );

    if (testResult.status === 'verified') {
      const existingVerifiedTestResult = await prisma.testResult.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          testType: true,
          status: true,
          verifiedAt: true,
          verifiedBy: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      });

      return res.json({
        message: 'Test result already verified',
        testResult: existingVerifiedTestResult,
      });
    }

    // Feature #883: Require certificate before verification
    if (!testResult.certificateDocId) {
      throw new AppError(
        400,
        'A test certificate must be uploaded before the test result can be verified.',
        'CERTIFICATE_REQUIRED',
      );
    }

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'verified',
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        testType: true,
        status: true,
        verifiedAt: true,
        verifiedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Audit log for test result verification
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_VERIFIED,
      changes: { status: 'verified' },
      req,
    });

    res.json({
      message: 'Test result verified successfully',
      testResult: updatedTestResult,
    });
  }),
);

// POST /api/test-results/:id/status - Update test result status (Feature #196)
testResultsRouter.post(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;
    const status = normalizeRequiredString(req.body.status, 'status', 40);

    if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
      throw AppError.badRequest('status must be a valid test result status');
    }

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });

    // Verification requires higher permission
    if (status === 'verified' && (!userProjectRole || !TEST_VERIFIERS.includes(userProjectRole))) {
      throw AppError.forbidden('You do not have permission to verify test results');
    }

    // Other status changes require creator permission
    if (status !== 'verified' && (!userProjectRole || !TEST_CREATORS.includes(userProjectRole))) {
      throw AppError.forbidden('You do not have permission to update test result status');
    }

    // Validate the status transition
    const currentStatus = testResult.status;
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw AppError.badRequest(
        `Cannot transition from '${STATUS_LABELS[currentStatus] || currentStatus}' to '${STATUS_LABELS[status] || status}'`,
        {
          currentStatus: currentStatus,
          allowedTransitions: allowedTransitions.map((s) => ({
            status: s,
            label: STATUS_LABELS[s] || s,
          })),
        },
      );
    }

    // Feature #883: Require certificate before verification
    if (status === 'verified' && !testResult.certificateDocId) {
      throw new AppError(
        400,
        'A test certificate must be uploaded before the test result can be verified.',
        'CERTIFICATE_REQUIRED',
      );
    }

    // Build update data based on the new status
    const updateData: Prisma.TestResultUncheckedUpdateInput = { status };

    // If entering 'entered' status, record who entered and when
    if (status === 'entered') {
      updateData.enteredById = user.id;
      updateData.enteredAt = new Date();
    }

    // If entering 'verified' status, record who verified and when
    if (status === 'verified') {
      updateData.verifiedById = user.id;
      updateData.verifiedAt = new Date();
    }

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        status: true,
        enteredAt: true,
        verifiedAt: true,
        enteredBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        verifiedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Feature #933 - Notify engineers when test results are received (pending verification)
    if (status === 'results_received' && currentStatus !== 'results_received') {
      try {
        // Get project info
        const project = await prisma.project.findUnique({
          where: { id: testResult.projectId },
          select: { id: true, name: true },
        });

        // Get active site engineers
        const siteEngineers = await prisma.projectUser.findMany({
          where: {
            projectId: testResult.projectId,
            role: 'site_engineer',
            status: 'active',
          },
        });

        // Get user details for engineers
        const engineerUserIds = siteEngineers.map((se) => se.userId);
        const engineerUsers =
          engineerUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: engineerUserIds } },
                select: { id: true, email: true, fullName: true },
              })
            : [];

        // Get laboratory name for more context
        const testWithLab = await prisma.testResult.findUnique({
          where: { id },
          select: { laboratoryName: true, testRequestNumber: true },
        });
        const labName = testWithLab?.laboratoryName || 'laboratory';
        const requestNum = testWithLab?.testRequestNumber || id.substring(0, 8).toUpperCase();

        // Create in-app notifications for site engineers
        const notificationsToCreate = engineerUsers.map((eng) => ({
          userId: eng.id,
          projectId: testResult.projectId,
          type: 'test_result_received',
          title: 'Test Result Received',
          message: `Test result for ${testResult.testType} (${requestNum}) has been received from ${labName}. Pending verification.`,
          linkUrl: `/projects/${testResult.projectId}/tests`,
        }));

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({
            data: notificationsToCreate,
          });
        }

        // Send email notifications
        for (const eng of engineerUsers) {
          await sendNotificationIfEnabled(eng.id, 'enabled', {
            title: 'Test Result Received',
            message: `Test result for ${testResult.testType} (${requestNum}) from ${labName} is pending verification.`,
            linkUrl: `/projects/${testResult.projectId}/tests`,
            projectName: project?.name,
          });
        }
      } catch {
        // Don't fail the main request if notifications fail
      }
    }

    // Audit log for test result status change
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_STATUS_CHANGED,
      changes: { previousStatus: currentStatus, newStatus: status },
      req,
    });

    res.json({
      message: `Test result status updated to '${STATUS_LABELS[status] || status}'`,
      testResult: updatedTestResult,
      nextTransitions: (VALID_STATUS_TRANSITIONS[status] || []).map((s) => ({
        status: s,
        label: STATUS_LABELS[s] || s,
      })),
    });
  }),
);

// GET /api/test-results/:id/workflow - Get workflow status info (Feature #196)
testResultsRouter.get(
  '/:id/workflow',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        projectId: true,
        lotId: true,
        enteredAt: true,
        verifiedAt: true,
        createdAt: true,
        enteredBy: {
          select: { fullName: true },
        },
        verifiedBy: {
          select: { fullName: true },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);
    const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });

    // Build workflow steps with status
    const workflowSteps = [
      {
        status: 'requested',
        label: 'Requested',
        completed: true, // Always completed (initial state)
        completedAt: testResult.createdAt,
        completedBy: null,
      },
      {
        status: 'at_lab',
        label: 'At Lab',
        completed: ['at_lab', 'results_received', 'entered', 'verified'].includes(
          testResult.status,
        ),
        completedAt: null,
        completedBy: null,
      },
      {
        status: 'results_received',
        label: 'Results Received',
        completed: ['results_received', 'entered', 'verified'].includes(testResult.status),
        completedAt: null,
        completedBy: null,
      },
      {
        status: 'entered',
        label: 'Entered',
        completed: ['entered', 'verified'].includes(testResult.status),
        completedAt: testResult.enteredAt,
        completedBy: testResult.enteredBy?.fullName || null,
      },
      {
        status: 'verified',
        label: 'Verified',
        completed: testResult.status === 'verified',
        completedAt: testResult.verifiedAt,
        completedBy: testResult.verifiedBy?.fullName || null,
      },
    ];

    res.json({
      workflow: {
        currentStatus: testResult.status,
        currentStatusLabel: STATUS_LABELS[testResult.status] || testResult.status,
        steps: workflowSteps,
        nextTransitions: (VALID_STATUS_TRANSITIONS[testResult.status] || []).map((s) => ({
          status: s,
          label: STATUS_LABELS[s] || s,
          canPerform:
            s === 'verified'
              ? TEST_VERIFIERS.includes(userProjectRole || '')
              : TEST_CREATORS.includes(userProjectRole || ''),
        })),
        canAdvance: (VALID_STATUS_TRANSITIONS[testResult.status] || []).length > 0,
        isComplete: testResult.status === 'verified',
      },
    });
  }),
);

// ============================================================================
// Feature #200: AI Test Certificate Extraction
// ============================================================================

// POST /api/test-results/upload-certificate - Upload a test certificate PDF for AI extraction
testResultsRouter.post(
  '/upload-certificate',
  certificateUpload.single('certificate'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const file = req.file;

    if (!file) {
      throw AppError.badRequest('No file uploaded');
    }

    let projectId: string;
    try {
      projectId = getRequiredUploadProjectId(req.body);
    } catch (error) {
      cleanupUploadedCertificateFile(file);
      throw error;
    }

    try {
      await requireTestProjectRole(
        projectId,
        user,
        TEST_CREATORS,
        'You do not have permission to upload test certificates',
      );
    } catch (error) {
      // Delete uploaded file if permission denied
      cleanupUploadedCertificateFile(file);
      throw error;
    }

    try {
      assertUploadedFileMatchesDeclaredType(file);
    } catch (error) {
      cleanupUploadedCertificateFile(file);
      throw error;
    }

    const extractedData = await extractCertificateFields(file);
    const confidenceObj = buildConfidenceObject(extractedData);
    const displayFilename = sanitizeUploadFilename(file.originalname);

    let fileUrl: string | null = null;
    try {
      if (shouldUploadCertificateToSupabase(file)) {
        const uploaded = await uploadCertificateToSupabase(file, projectId);
        fileUrl = uploaded.url;
      } else {
        fileUrl = `/uploads/certificates/${file.filename}`;
      }
    } catch (error) {
      cleanupUploadedCertificateFile(file);
      throw error;
    }

    let testResult;
    try {
      testResult = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            projectId,
            documentType: 'test_certificate',
            category: 'test_results',
            filename: displayFilename,
            fileUrl: fileUrl!,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: user.id,
          },
        });

        return tx.testResult.create({
          data: buildTestResultData(projectId, document.id, extractedData),
          include: {
            certificateDoc: {
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                mimeType: true,
              },
            },
          },
        });
      });
    } catch (error) {
      await cleanupStoredCertificateUpload(fileUrl, file, projectId);
      throw error;
    }

    // Identify low confidence fields that need review
    const lowConfidenceFields = getLowConfidenceFields(confidenceObj);

    // Feature #727: Suggest lots based on extracted location
    const locationSuggestion = await suggestLotsFromLocation(
      projectId,
      extractedData.sampleLocation.value,
    );

    res.status(201).json({
      message: 'Certificate uploaded and processed successfully',
      testResult: {
        id: testResult.id,
        testType: testResult.testType,
        status: testResult.status,
        aiExtracted: testResult.aiExtracted,
        certificateDoc: testResult.certificateDoc,
      },
      extraction: {
        success: true,
        extractedFields: extractedData,
        confidence: confidenceObj,
        lowConfidenceFields,
        needsReview: lowConfidenceFields.length > 0,
        reviewMessage:
          lowConfidenceFields.length > 0
            ? `${lowConfidenceFields.length} field(s) need manual verification due to low AI confidence`
            : 'All fields extracted with high confidence',
      },
      // Feature #727: Lot suggestion based on extracted location
      lotSuggestion: {
        extractedLocation: extractedData.sampleLocation.value,
        extractedChainage: locationSuggestion.extractedChainage,
        suggestedLots: locationSuggestion.suggestedLots,
        hasSuggestion: locationSuggestion.suggestedLots.length > 0,
        message:
          locationSuggestion.suggestedLots.length > 0
            ? `Found ${locationSuggestion.suggestedLots.length} lot(s) matching the extracted location`
            : 'No matching lots found for the extracted location',
      },
    });
  }),
);

// GET /api/test-results/:id/extraction - Get AI extraction details for a test result
testResultsRouter.get(
  '/:id/extraction',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        certificateDoc: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);

    if (!testResult.aiExtracted) {
      return res.json({
        extraction: {
          aiExtracted: false,
          message: 'This test result was not AI-extracted',
        },
      });
    }

    const confidence = (
      testResult.aiConfidence ? JSON.parse(testResult.aiConfidence) : {}
    ) as Record<string, number>;
    const lowConfidenceThreshold = LOW_CONFIDENCE_THRESHOLD;
    const mediumConfidenceThreshold = 0.9;

    // Build field status with confidence indicators
    const fieldStatus: Record<string, TestFieldStatus> = {};

    const fields = [
      { key: 'testType', value: testResult.testType },
      { key: 'laboratoryName', value: testResult.laboratoryName },
      { key: 'laboratoryReportNumber', value: testResult.laboratoryReportNumber },
      { key: 'sampleDate', value: testResult.sampleDate },
      { key: 'testDate', value: testResult.testDate },
      { key: 'sampleLocation', value: testResult.sampleLocation },
      { key: 'resultValue', value: testResult.resultValue },
      { key: 'resultUnit', value: testResult.resultUnit },
      { key: 'specificationMin', value: testResult.specificationMin },
      { key: 'specificationMax', value: testResult.specificationMax },
    ];

    for (const { key, value } of fields) {
      const conf = confidence[key] || 1.0;
      let status = 'high';
      if (conf < lowConfidenceThreshold) status = 'low';
      else if (conf < mediumConfidenceThreshold) status = 'medium';

      fieldStatus[key] = { value, confidence: conf, status };
    }

    const lowConfidenceFields = Object.entries(fieldStatus)
      .filter(([_, f]) => f.status === 'low')
      .map(([key, f]) => ({ field: key, confidence: f.confidence }));

    res.json({
      extraction: {
        aiExtracted: true,
        certificateDoc: testResult.certificateDoc,
        fields: fieldStatus,
        lowConfidenceFields,
        needsReview: lowConfidenceFields.length > 0,
        thresholds: {
          low: lowConfidenceThreshold,
          medium: mediumConfidenceThreshold,
        },
      },
    });
  }),
);

// PATCH /api/test-results/:id/confirm-extraction - Confirm or correct AI-extracted fields
testResultsRouter.patch(
  '/:id/confirm-extraction',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;
    const { corrections } = req.body;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_CREATORS,
      'You do not have permission to confirm test results',
    );

    // Build update data from corrections
    const updateData: Prisma.TestResultUncheckedUpdateInput = {};
    applyTestResultCorrections(updateData, corrections as TestResultCorrections | undefined);

    // Move to 'entered' status after confirmation
    updateData.status = 'entered';
    updateData.enteredById = user.id;
    updateData.enteredAt = new Date();

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        laboratoryName: true,
        laboratoryReportNumber: true,
        sampleDate: true,
        testDate: true,
        sampleLocation: true,
        resultValue: true,
        resultUnit: true,
        specificationMin: true,
        specificationMax: true,
        passFail: true,
        status: true,
        aiExtracted: true,
        enteredAt: true,
        enteredBy: {
          select: {
            fullName: true,
          },
        },
      },
    });

    res.json({
      message: 'Extraction confirmed and test result saved',
      testResult: updatedTestResult,
      nextStep: {
        status: 'entered',
        message: 'Test result is now entered and ready for verification',
      },
    });
  }),
);

// POST /api/test-results/batch-upload - Batch upload multiple test certificates (Feature #202)
testResultsRouter.post(
  '/batch-upload',
  certificateUpload.array('certificates', 10),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw AppError.badRequest('No files uploaded');
    }

    let projectId: string;
    try {
      projectId = getRequiredUploadProjectId(req.body);
    } catch (error) {
      cleanupUploadedCertificateFiles(files);
      throw error;
    }

    try {
      await requireTestProjectRole(
        projectId,
        user,
        TEST_CREATORS,
        'You do not have permission to upload test certificates',
      );
    } catch (error) {
      // Delete uploaded files if permission denied
      cleanupUploadedCertificateFiles(files);
      throw error;
    }

    try {
      for (const file of files) {
        assertUploadedFileMatchesDeclaredType(file);
      }
    } catch (error) {
      cleanupUploadedCertificateFiles(files);
      throw error;
    }

    // Process each file
    const results: BatchUploadResult[] = [];

    for (const file of files) {
      let fileUrl: string | null = null;
      try {
        const extractedData = await extractCertificateFields(file);
        const confidenceObj = buildConfidenceObject(extractedData);
        const displayFilename = sanitizeUploadFilename(file.originalname);

        if (shouldUploadCertificateToSupabase(file)) {
          const uploaded = await uploadCertificateToSupabase(file, projectId);
          fileUrl = uploaded.url;
        } else {
          fileUrl = `/uploads/certificates/${file.filename}`;
        }

        const testResult = await prisma.$transaction(async (tx) => {
          const document = await tx.document.create({
            data: {
              projectId,
              documentType: 'test_certificate',
              category: 'test_results',
              filename: displayFilename,
              fileUrl: fileUrl!,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedById: user.id,
            },
          });

          return tx.testResult.create({
            data: buildTestResultData(projectId, document.id, extractedData),
            include: {
              certificateDoc: {
                select: {
                  id: true,
                  filename: true,
                  fileUrl: true,
                  mimeType: true,
                },
              },
            },
          });
        });

        // Identify low confidence fields
        const lowConfidenceFields = getLowConfidenceFields(confidenceObj);

        results.push({
          success: true,
          filename: displayFilename,
          testResult: {
            id: testResult.id,
            testType: testResult.testType,
            status: testResult.status,
            aiExtracted: testResult.aiExtracted,
            certificateDoc: testResult.certificateDoc,
          },
          extraction: {
            extractedFields: extractedData,
            confidence: confidenceObj,
            lowConfidenceFields,
            needsReview: lowConfidenceFields.length > 0,
          },
        });
      } catch {
        await cleanupStoredCertificateUpload(fileUrl, file, projectId);
        results.push({
          success: false,
          filename: sanitizeUploadFilename(file.originalname),
          error: 'Failed to process file',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const needsReviewCount = results.filter((r) => r.success && r.extraction?.needsReview).length;

    res.status(201).json({
      message: `Processed ${successCount} of ${files.length} certificates`,
      summary: {
        total: files.length,
        success: successCount,
        failed: failCount,
        needsReview: needsReviewCount,
      },
      results,
    });
  }),
);

// POST /api/test-results/batch-confirm - Batch confirm multiple extractions (Feature #202)
testResultsRouter.post(
  '/batch-confirm',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { confirmations } = req.body;

    if (!confirmations || !Array.isArray(confirmations) || confirmations.length === 0) {
      throw AppError.badRequest('confirmations array is required');
    }

    const results: BatchConfirmResult[] = [];

    for (const confirmation of confirmations) {
      const { testResultId, corrections } = confirmation as {
        testResultId?: unknown;
        corrections?: TestResultCorrections;
      };

      if (typeof testResultId !== 'string' || !testResultId) {
        results.push({
          success: false,
          testResultId: '',
          error: 'Invalid test result id',
        });
        continue;
      }

      try {
        const testResult = await prisma.testResult.findUnique({
          where: { id: testResultId },
        });

        if (!testResult) {
          results.push({
            success: false,
            testResultId,
            error: 'Test result not found',
          });
          continue;
        }

        const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });

        if (!userProjectRole || !TEST_CREATORS.includes(userProjectRole)) {
          results.push({
            success: false,
            testResultId,
            error: 'No permission',
          });
          continue;
        }

        // Build update data from corrections
        const updateData: Prisma.TestResultUncheckedUpdateInput = {};
        applyTestResultCorrections(updateData, corrections);

        // Move to 'entered' status after confirmation
        updateData.status = 'entered';
        updateData.enteredById = user.id;
        updateData.enteredAt = new Date();

        const updatedTestResult = await prisma.testResult.update({
          where: { id: testResultId },
          data: updateData,
          select: {
            id: true,
            testType: true,
            status: true,
          },
        });

        results.push({
          success: true,
          testResultId,
          testResult: updatedTestResult,
        });
      } catch {
        results.push({
          success: false,
          testResultId,
          error: 'Failed to confirm',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    res.json({
      message: `Confirmed ${successCount} of ${confirmations.length} test results`,
      summary: {
        total: confirmations.length,
        success: successCount,
        failed: confirmations.length - successCount,
      },
      results,
    });
  }),
);
