import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  TEST_CREATORS,
  TEST_DELETERS,
  TEST_VERIFIERS,
  requireLotInProject,
  requireTestProjectRole,
  requireTestResultReadAccess,
} from './accessControl.js';
import {
  deleteCertificateFromSupabase,
  isOwnedSupabaseCertificateUrl,
} from './certificateStorage.js';
import { applyTestResultCorrections } from './corrections.js';
import { resolveEffectivePassFail } from './certificateExtraction.js';
import { applyConfirmedPassFailBackstop } from './extractionConfirmation.js';
import {
  buildTestResultCreatedResponse,
  buildTestResultDeletedResponse,
  buildTestResultDetailResponse,
  buildTestResultUpdatedResponse,
} from './detailResponses.js';
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
  parseTestResultRouteParam,
  toNullableDate,
  toNullableFloat,
  toNullableString,
} from './validation.js';

export const crudRoutes = Router();

// GET /api/test-results/:id - Get a single test result
crudRoutes.get(
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
crudRoutes.post(
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
    // H13 backstop: the client pass/fail cannot contradict the value + spec.
    const effectivePassFail = resolveEffectivePassFail(
      passFailValue,
      resultValueValue,
      specificationMinValue,
      specificationMaxValue,
    );

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
        passFail: effectivePassFail,
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
      changes: { testType: testTypeValue, lotId: lotIdValue, passFail: effectivePassFail },
      req,
    });

    res.status(201).json(buildTestResultCreatedResponse(testResult));
  }),
);

// PATCH /api/test-results/:id - Update a test result
crudRoutes.patch(
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

    // H13 backstop on the manual edit path (mirrors the confirm flow): when the
    // edit touches the value, spec, or pass/fail, recompute the outcome from the
    // effective value + spec so a stored/edited pass cannot contradict the data.
    if (
      'passFail' in updateData ||
      'resultValue' in updateData ||
      'specificationMin' in updateData ||
      'specificationMax' in updateData
    ) {
      applyConfirmedPassFailBackstop(updateData, testResult);
    }

    if (testResult.status === 'verified' && Object.keys(updateData).length > 0) {
      updateData.status = 'entered';
      updateData.enteredById = user.id;
      updateData.enteredAt = new Date();
      updateData.verifiedById = null;
      updateData.verifiedAt = null;
    }

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
crudRoutes.delete(
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

    if (testResult.status === 'verified') {
      throw AppError.conflict(
        'Verified test results cannot be deleted. Reopen or create a corrected test result instead.',
        { status: testResult.status },
      );
    }

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
