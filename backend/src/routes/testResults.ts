import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getEffectiveProjectRole } from '../lib/projectAccess.js';
import {
  TEST_CREATORS,
  TEST_VERIFIERS,
  requireTestProjectRole,
  requireTestResultReadAccess,
} from './testResults/accessControl.js';
import { certificateUpload } from './testResults/certificateStorage.js';
import { buildCertificateExtractionResponse } from './testResults/extractionResponse.js';
import {
  processBatchCertificateUpload,
  processCertificateUpload,
} from './testResults/certificateIntake.js';
import { processCertificateAttachment } from './testResults/certificateAttachment.js';
import { confirmExtraction, processBatchConfirm } from './testResults/extractionConfirmation.js';
import { workflowRoutes } from './testResults/workflowRoutes.js';
import { crudRoutes } from './testResults/crudRoutes.js';
import { listRoutes } from './testResults/listRoutes.js';
import { specificationRoutes } from './testResults/specificationRoutes.js';
import {
  buildTestRequestFormMetadata,
  buildTestRequestFormResponse,
  buildVerificationViewData,
  buildVerificationViewResponse,
  renderTestRequestFormHtml,
} from './testResults/presentation.js';
import { parseRequestFormFormat, parseTestResultRouteParam } from './testResults/validation.js';

export const testResultsRouter = Router();

// Apply authentication middleware to all test result routes
testResultsRouter.use(requireAuth);

testResultsRouter.use('/specifications', specificationRoutes);
testResultsRouter.use(listRoutes);
testResultsRouter.use(crudRoutes);

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

// POST /api/test-results/:id/certificate - Attach (or replace) a certificate on
// an EXISTING test result (Feature B2). Unlike /upload-certificate this performs
// NO AI extraction and does not create a new test — it links a Document to the
// supplied test so a manually-created test can satisfy the verification gate.
// Registered before /:id/extraction so the literal /certificate suffix wins over
// the /:id parameter route.
testResultsRouter.post(
  '/:id/certificate',
  certificateUpload.single('certificate'),
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const result = await processCertificateAttachment({
      testResultId: id,
      file: req.file,
      userId: user.id,
      loadTestResult: (testId) =>
        prisma.testResult.findUnique({
          where: { id: testId },
          select: {
            projectId: true,
            status: true,
            certificateDocId: true,
            certificateDoc: { select: { id: true, fileUrl: true } },
          },
        }),
      authorize: async (projectId) => {
        await requireTestProjectRole(
          projectId,
          user,
          TEST_CREATORS,
          'You do not have permission to attach test certificates',
        );
      },
    });

    res.status(200).json(result);
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
