import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../lib/pagination.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getEffectiveProjectRole,
  requireSubcontractorPortalModuleAccess,
} from '../lib/projectAccess.js';
import { logWarn } from '../lib/serverLogger.js';
import {
  TEST_CREATORS,
  TEST_DELETERS,
  TEST_VERIFIERS,
  getAssignedSubcontractorLotIds,
  getReadableProjectIds,
  isSubcontractorUser,
  requireLotInProject,
  requireProjectReadAccess,
  requireTestProjectRole,
  requireTestResultReadAccess,
  requireTestResultsPortalAccess,
} from './testResults/accessControl.js';
import {
  certificateUpload,
  deleteCertificateFromSupabase,
  isOwnedSupabaseCertificateUrl,
} from './testResults/certificateStorage.js';
import { LOW_CONFIDENCE_THRESHOLD } from './testResults/certificateExtraction.js';
import { applyTestResultCorrections } from './testResults/corrections.js';
import {
  processBatchCertificateUpload,
  processCertificateUpload,
} from './testResults/certificateIntake.js';
import { confirmExtraction, processBatchConfirm } from './testResults/extractionConfirmation.js';
import { buildLaboratoriesResponse } from './testResults/laboratoryResponses.js';
import {
  buildEmptyTestResultsListResponse,
  buildTestResultsListResponse,
} from './testResults/listResponses.js';
import {
  buildTestResultDeletedResponse,
  buildTestResultDetailResponse,
  buildTestResultUpdatedResponse,
} from './testResults/detailResponses.js';
import { testTypeSpecifications } from './testResults/specifications.js';
import {
  buildTestSpecificationsResponse,
  mapTestSpecification,
} from './testResults/specificationResponses.js';
import {
  buildTestRequestFormMetadata,
  buildTestRequestFormResponse,
  buildVerificationViewData,
  buildVerificationViewResponse,
  renderTestRequestFormHtml,
} from './testResults/presentation.js';
import { STATUS_LABELS, VALID_STATUS_TRANSITIONS } from './testResults/statusWorkflow.js';
import {
  buildTestResultAlreadyVerifiedResponse,
  buildTestResultRejectedResponse,
  buildTestResultRejectionNotification,
  buildTestResultVerifiedResponse,
} from './testResults/verificationResponses.js';
import {
  buildTestResultReceivedEmail,
  buildTestResultReceivedNotification,
} from './testResults/statusNotifications.js';
import {
  buildTestResultStatusUpdatedResponse,
  buildTestResultWorkflowResponse,
} from './testResults/workflowResponse.js';
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

// Apply authentication middleware to all test result routes
testResultsRouter.use(requireAuth);

type TestFieldValue = string | number | Date | Prisma.Decimal | null;
type TestFieldStatus = { value: TestFieldValue; confidence: number; status: string };

// GET /api/test-results/specifications - Get all test type specifications
testResultsRouter.get(
  '/specifications',
  asyncHandler(async (_req, res) => {
    res.json(buildTestSpecificationsResponse(testTypeSpecifications));
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
        return res.json(mapTestSpecification(partialMatch[0], partialMatch[1]));
      }

      throw new AppError(404, `No specification found for test type: ${testType}`, 'NOT_FOUND', {
        availableTypes: Object.keys(testTypeSpecifications),
      });
    }

    res.json(mapTestSpecification(normalizedType, spec));
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
          return res.json(buildLaboratoriesResponse([]));
        }
        whereClause.lotId = { in: assignedLotIds };
      }
    } else {
      let readableProjectIds = await getReadableProjectIds(user);
      if (readableProjectIds.length === 0) {
        return res.json(buildLaboratoriesResponse([]));
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
          return res.json(buildLaboratoriesResponse([]));
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
          return res.json(buildLaboratoriesResponse([]));
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

    res.json(buildLaboratoriesResponse(recentLabs.map((lab) => lab.laboratoryName)));
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
        return res.json(buildEmptyTestResultsListResponse());
      }

      if (lotId) {
        if (!assignedLotIds.includes(lotId)) {
          return res.json(buildEmptyTestResultsListResponse());
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

    res.json(
      buildTestResultsListResponse(
        testResults,
        getPaginationMeta(total, pagination.page, pagination.limit),
      ),
    );
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

    res.json(buildTestResultDetailResponse(testResult));
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

    res.json(buildTestResultUpdatedResponse(updatedTestResult));
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

    res.json(buildTestResultDeletedResponse());
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
      res.json(buildTestRequestFormResponse(buildTestRequestFormMetadata(testResult)));
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

    res.json(buildVerificationViewResponse(buildVerificationViewData(testResult, { canVerify })));
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

    const engineerNotified = buildTestResultRejectionNotification(testResult, reason);

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

    res.json(buildTestResultRejectedResponse(updatedTestResult, engineerNotified));
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

      return res.json(buildTestResultAlreadyVerifiedResponse(existingVerifiedTestResult));
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

    res.json(buildTestResultVerifiedResponse(updatedTestResult));
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
        const notificationsToCreate = engineerUsers.map((eng) =>
          buildTestResultReceivedNotification({
            userId: eng.id,
            projectId: testResult.projectId,
            testType: testResult.testType,
            requestNumber: requestNum,
            labName,
          }),
        );

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({
            data: notificationsToCreate,
          });
        }

        // Send email notifications
        for (const eng of engineerUsers) {
          await sendNotificationIfEnabled(
            eng.id,
            'enabled',
            buildTestResultReceivedEmail({
              projectId: testResult.projectId,
              projectName: project?.name,
              testType: testResult.testType,
              requestNumber: requestNum,
              labName,
            }),
          );
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

    res.json(buildTestResultStatusUpdatedResponse(status, updatedTestResult));
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

    res.json(
      buildTestResultWorkflowResponse(testResult, {
        canCreateTest: TEST_CREATORS.includes(userProjectRole || ''),
        canVerifyTest: TEST_VERIFIERS.includes(userProjectRole || ''),
      }),
    );
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
    const result = await processCertificateUpload({
      file: req.file,
      body: req.body,
      userId: user.id,
      authorize: async (projectId) => {
        await requireTestProjectRole(
          projectId,
          user,
          TEST_CREATORS,
          'You do not have permission to upload test certificates',
        );
      },
    });

    res.status(201).json(result);
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

    const result = await confirmExtraction({
      id,
      corrections,
      userId: user.id,
      authorize: async (projectId) => {
        await requireTestProjectRole(
          projectId,
          user,
          TEST_CREATORS,
          'You do not have permission to confirm test results',
        );
      },
    });

    res.json(result);
  }),
);

// POST /api/test-results/batch-upload - Batch upload multiple test certificates (Feature #202)
testResultsRouter.post(
  '/batch-upload',
  certificateUpload.array('certificates', 10),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await processBatchCertificateUpload({
      files: req.files as Express.Multer.File[],
      body: req.body,
      userId: user.id,
      authorize: async (projectId) => {
        await requireTestProjectRole(
          projectId,
          user,
          TEST_CREATORS,
          'You do not have permission to upload test certificates',
        );
      },
    });

    res.status(201).json(result);
  }),
);

// POST /api/test-results/batch-confirm - Batch confirm multiple extractions (Feature #202)
testResultsRouter.post(
  '/batch-confirm',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { confirmations } = req.body;

    const result = await processBatchConfirm({
      confirmations,
      userId: user.id,
      authorize: async (projectId) => {
        const userProjectRole = await getEffectiveProjectRole(user, projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
        return !!userProjectRole && TEST_CREATORS.includes(userProjectRole);
      },
    });

    res.json(result);
  }),
);
