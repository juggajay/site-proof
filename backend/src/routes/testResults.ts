import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getEffectiveProjectRole } from '../lib/projectAccess.js';
import { logWarn } from '../lib/serverLogger.js';
import {
  TEST_CREATORS,
  TEST_DELETERS,
  TEST_VERIFIERS,
  requireLotInProject,
  requireTestProjectRole,
  requireTestResultReadAccess,
} from './testResults/accessControl.js';
import {
  certificateUpload,
  deleteCertificateFromSupabase,
  isOwnedSupabaseCertificateUrl,
} from './testResults/certificateStorage.js';
import { applyTestResultCorrections } from './testResults/corrections.js';
import { buildCertificateExtractionResponse } from './testResults/extractionResponse.js';
import {
  processBatchCertificateUpload,
  processCertificateUpload,
} from './testResults/certificateIntake.js';
import { confirmExtraction, processBatchConfirm } from './testResults/extractionConfirmation.js';
import { workflowRoutes } from './testResults/workflowRoutes.js';
import {
  buildTestResultCreatedResponse,
  buildTestResultDeletedResponse,
  buildTestResultDetailResponse,
  buildTestResultUpdatedResponse,
} from './testResults/detailResponses.js';
import { listRoutes } from './testResults/listRoutes.js';
import { specificationRoutes } from './testResults/specificationRoutes.js';
import {
  buildTestRequestFormMetadata,
  buildTestRequestFormResponse,
  buildVerificationViewData,
  buildVerificationViewResponse,
  renderTestRequestFormHtml,
} from './testResults/presentation.js';
import {
  MAX_RESULT_UNIT_LENGTH,
  MAX_SAMPLE_LOCATION_LENGTH,
  MAX_TEST_ID_LENGTH,
  MAX_TEST_REQUEST_NUMBER_LENGTH,
  MAX_TEST_TEXT_LENGTH,
  MAX_TEST_TYPE_LENGTH,
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

testResultsRouter.use('/specifications', specificationRoutes);
testResultsRouter.use(listRoutes);

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

    res.status(201).json(buildTestResultCreatedResponse(testResult));
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

testResultsRouter.use(workflowRoutes);

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

    res.json(buildCertificateExtractionResponse(testResult));
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
