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
import { buildTestResultData, suggestLotsFromLocation } from './testResults/testResultMapping.js';

export const testResultsRouter = Router();

const MAX_UPLOAD_PROJECT_ID_LENGTH = 120;
const MAX_TEST_ID_LENGTH = 120;
const MAX_TEST_TYPE_LENGTH = 160;
const MAX_TEST_REQUEST_NUMBER_LENGTH = 120;
const MAX_TEST_TEXT_LENGTH = 240;
const MAX_SAMPLE_LOCATION_LENGTH = 500;
const MAX_RESULT_UNIT_LENGTH = 80;
const MAX_REJECTION_REASON_LENGTH = 3000;
const MAX_DATE_INPUT_LENGTH = 32;
const MAX_SEARCH_LENGTH = 200;
const DATE_ONLY_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const PASS_FAIL_VALUES = ['pass', 'fail', 'pending'] as const;
const REQUEST_FORM_FORMATS = ['html', 'json'] as const;

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

function escapeHtml(value: unknown, fallback = 'N/A'): string {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Test type specifications lookup table
// Based on Australian road standards (TMR MRTS, RMS QA specs, etc.)
const testTypeSpecifications: Record<
  string,
  {
    name: string;
    description: string;
    specificationMin: number | null;
    specificationMax: number | null;
    unit: string;
    specReference: string;
  }
> = {
  compaction: {
    name: 'Compaction Test',
    description: 'Relative compaction as percentage of maximum dry density',
    specificationMin: 95,
    specificationMax: 100,
    unit: '% MDD',
    specReference: 'TMR MRTS04 / AS 1289.5.4.1',
  },
  cbr: {
    name: 'California Bearing Ratio (CBR)',
    description: 'Soil strength test for pavement design',
    specificationMin: 15,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.6.1.1',
  },
  moisture_content: {
    name: 'Moisture Content',
    description: 'Soil moisture as percentage of dry weight',
    specificationMin: null,
    specificationMax: null,
    unit: '%',
    specReference: 'AS 1289.2.1.1',
  },
  plasticity_index: {
    name: 'Plasticity Index (PI)',
    description: 'Difference between liquid and plastic limits',
    specificationMin: null,
    specificationMax: 25,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.3.3.1',
  },
  liquid_limit: {
    name: 'Liquid Limit (LL)',
    description: 'Water content at which soil behaves as liquid',
    specificationMin: null,
    specificationMax: 45,
    unit: '%',
    specReference: 'AS 1289.3.1.1',
  },
  grading: {
    name: 'Particle Size Distribution',
    description: 'Grading envelope compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'envelope',
    specReference: 'TMR MRTS05 / AS 1289.3.6.1',
  },
  sand_equivalent: {
    name: 'Sand Equivalent',
    description: 'Cleanliness of fine aggregate',
    specificationMin: 30,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS30 / Q203',
  },
  concrete_slump: {
    name: 'Concrete Slump',
    description: 'Workability measurement for concrete',
    specificationMin: 50,
    specificationMax: 120,
    unit: 'mm',
    specReference: 'AS 1012.3.1',
  },
  concrete_strength: {
    name: 'Concrete Compressive Strength',
    description: '28-day compressive strength',
    specificationMin: 32,
    specificationMax: null,
    unit: 'MPa',
    specReference: 'AS 1012.9',
  },
  asphalt_density: {
    name: 'Asphalt Density',
    description: 'Field density as percentage of Marshall density',
    specificationMin: 93,
    specificationMax: 100,
    unit: '%',
    specReference: 'TMR MRTS30 / AS 2891.9.1',
  },
  asphalt_thickness: {
    name: 'Asphalt Layer Thickness',
    description: 'Pavement layer thickness compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'mm',
    specReference: 'TMR MRTS30',
  },
  dcp: {
    name: 'Dynamic Cone Penetrometer (DCP)',
    description: 'In-situ bearing capacity indicator',
    specificationMin: null,
    specificationMax: 10,
    unit: 'mm/blow',
    specReference: 'AS 1289.6.3.2',
  },
  permeability: {
    name: 'Permeability Test',
    description: 'Hydraulic conductivity of soil',
    specificationMin: null,
    specificationMax: null,
    unit: 'm/s',
    specReference: 'AS 1289.6.7.1',
  },
};

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
type TestResultCorrections = {
  testType?: unknown;
  testRequestNumber?: unknown;
  laboratoryName?: unknown;
  laboratoryReportNumber?: unknown;
  sampleDate?: unknown;
  sampleLocation?: unknown;
  testDate?: unknown;
  resultDate?: unknown;
  resultValue?: unknown;
  resultUnit?: unknown;
  specificationMin?: unknown;
  specificationMax?: unknown;
  passFail?: unknown;
};

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

function normalizeOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_TEXT_LENGTH,
): string {
  const normalized = normalizeOptionalString(value, fieldName, maxLength);
  if (!normalized) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  return normalized;
}

function parseTestResultRouteParam(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_ID_LENGTH,
): string {
  return normalizeRequiredString(value, fieldName, maxLength);
}

function toNullableString(
  value: unknown,
  fieldName = 'value',
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null {
  return normalizeOptionalString(value, fieldName, maxLength) ?? null;
}

function normalizeOptionalQueryString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined {
  const normalized = normalizeOptionalString(value, fieldName, maxLength);
  if (normalized === null) {
    throw AppError.badRequest(`${fieldName} query parameter must not be empty`);
  }
  return normalized;
}

function parseRequestFormFormat(value: unknown): (typeof REQUEST_FORM_FORMATS)[number] {
  if (value === undefined) {
    return 'html';
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('format query parameter must be a single value');
  }

  const normalized = value.trim();
  if (!REQUEST_FORM_FORMATS.includes(normalized as (typeof REQUEST_FORM_FORMATS)[number])) {
    throw AppError.badRequest(`format must be one of: ${REQUEST_FORM_FORMATS.join(', ')}`);
  }

  return normalized as (typeof REQUEST_FORM_FORMATS)[number];
}

function parseStrictDateOnlyMatch(dateOnly: RegExpExecArray): Date | null {
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toNullableDate(value: unknown, fieldName = 'date'): Date | null {
  const normalized = normalizeOptionalString(value, fieldName, MAX_DATE_INPUT_LENGTH);
  if (!normalized) {
    return null;
  }

  const dateOnly = DATE_ONLY_INPUT_PATTERN.exec(normalized);
  if (!dateOnly) {
    throw AppError.badRequest(`${fieldName} must be a date in YYYY-MM-DD format`);
  }

  const date = parseStrictDateOnlyMatch(dateOnly);
  if (!date) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  return date;
}

function toNullableFloat(value: unknown, fieldName = 'value'): number | null {
  const normalized = normalizeOptionalString(value, fieldName, MAX_RESULT_UNIT_LENGTH);
  if (!normalized) {
    return null;
  }

  if (!DECIMAL_NUMBER_PATTERN.test(normalized)) {
    throw AppError.badRequest(`${fieldName} must be a valid number`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw AppError.badRequest(`${fieldName} must be a valid number`);
  }

  return parsed;
}

function normalizePassFail(
  value: unknown,
  defaultValue?: (typeof PASS_FAIL_VALUES)[number],
): (typeof PASS_FAIL_VALUES)[number] | undefined {
  const normalized = normalizeOptionalString(value, 'passFail', 20);
  if (!normalized) {
    return defaultValue;
  }

  const candidate = normalized.toLowerCase();
  if (!PASS_FAIL_VALUES.includes(candidate as (typeof PASS_FAIL_VALUES)[number])) {
    throw AppError.badRequest('passFail must be pass, fail, or pending');
  }

  return candidate as (typeof PASS_FAIL_VALUES)[number];
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

function applyTestResultCorrections(
  updateData: Prisma.TestResultUncheckedUpdateInput,
  corrections: TestResultCorrections | undefined,
) {
  if (!corrections) {
    return;
  }

  if (corrections.testType !== undefined)
    updateData.testType = normalizeRequiredString(
      corrections.testType,
      'testType',
      MAX_TEST_TYPE_LENGTH,
    );
  if (corrections.testRequestNumber !== undefined)
    updateData.testRequestNumber = toNullableString(
      corrections.testRequestNumber,
      'testRequestNumber',
      MAX_TEST_REQUEST_NUMBER_LENGTH,
    );
  if (corrections.laboratoryName !== undefined)
    updateData.laboratoryName = toNullableString(
      corrections.laboratoryName,
      'laboratoryName',
      MAX_TEST_TEXT_LENGTH,
    );
  if (corrections.laboratoryReportNumber !== undefined)
    updateData.laboratoryReportNumber = toNullableString(
      corrections.laboratoryReportNumber,
      'laboratoryReportNumber',
      MAX_TEST_TEXT_LENGTH,
    );
  if (corrections.sampleDate !== undefined)
    updateData.sampleDate = toNullableDate(corrections.sampleDate, 'sampleDate');
  if (corrections.sampleLocation !== undefined)
    updateData.sampleLocation = toNullableString(
      corrections.sampleLocation,
      'sampleLocation',
      MAX_SAMPLE_LOCATION_LENGTH,
    );
  if (corrections.testDate !== undefined)
    updateData.testDate = toNullableDate(corrections.testDate, 'testDate');
  if (corrections.resultDate !== undefined)
    updateData.resultDate = toNullableDate(corrections.resultDate, 'resultDate');
  if (corrections.resultValue !== undefined)
    updateData.resultValue = toNullableFloat(corrections.resultValue, 'resultValue');
  if (corrections.resultUnit !== undefined)
    updateData.resultUnit = toNullableString(
      corrections.resultUnit,
      'resultUnit',
      MAX_RESULT_UNIT_LENGTH,
    );
  if (corrections.specificationMin !== undefined)
    updateData.specificationMin = toNullableFloat(corrections.specificationMin, 'specificationMin');
  if (corrections.specificationMax !== undefined)
    updateData.specificationMax = toNullableFloat(corrections.specificationMax, 'specificationMax');
  if (corrections.passFail !== undefined)
    updateData.passFail = normalizePassFail(corrections.passFail, 'pending');
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

    // Format dates for display
    const formatDate = (date: Date | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };
    const formatHtmlValue = (value: unknown, fallback = 'N/A') => escapeHtml(value, fallback);
    const requestNumber =
      testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase();
    const specificationValue = (value: unknown) => {
      if (value === undefined || value === null || value === '') {
        return 'N/A';
      }

      return `${formatHtmlValue(value, '')} ${formatHtmlValue(testResult.resultUnit, '')}`.trim();
    };
    const generatedAt = escapeHtml(new Date().toLocaleString('en-AU'));

    // Generate HTML for printable form
    const formHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Request Form - ${formatHtmlValue(requestNumber)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #333;
        }
        .company-info { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #333; }
        .form-title { text-align: right; }
        .form-title h1 { font-size: 20px; color: #333; }
        .form-title p { font-size: 14px; color: #666; }

        .section {
            margin-bottom: 15px;
            border: 1px solid #ccc;
            padding: 10px;
        }
        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
            background: #f5f5f5;
            margin: -10px -10px 10px -10px;
            padding: 8px 10px;
        }
        .row {
            display: flex;
            margin-bottom: 8px;
        }
        .field {
            flex: 1;
            padding-right: 15px;
        }
        .field label {
            font-weight: bold;
            display: block;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
        }
        .field .value {
            border-bottom: 1px solid #999;
            min-height: 18px;
            padding: 2px 0;
        }

        .specifications {
            background: #f9f9f9;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        .signature-block {
            width: 45%;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-bottom: 5px;
        }
        .signature-label {
            font-size: 10px;
            color: #666;
        }

        .notes {
            min-height: 60px;
            border: 1px solid #ccc;
            padding: 8px;
            margin-top: 5px;
        }

        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
        <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer;">Print Form</button>
        <span style="margin-left: 10px; color: #666;">Press Ctrl+P to print or save as PDF</span>
    </div>

    <div class="header">
        <div class="company-info">
            <div class="company-name">${formatHtmlValue(testResult.project.company?.name, 'Company')}</div>
            ${testResult.project.company?.abn ? `<div>ABN: ${formatHtmlValue(testResult.project.company.abn)}</div>` : ''}
            ${testResult.project.company?.address ? `<div>${formatHtmlValue(testResult.project.company.address)}</div>` : ''}
        </div>
        <div class="form-title">
            <h1>TEST REQUEST FORM</h1>
            <p>Form No: ${formatHtmlValue(requestNumber)}</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Project Information</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Project Name</label>
                <div class="value">${formatHtmlValue(testResult.project.name)}</div>
            </div>
            <div class="field">
                <label>Project Number</label>
                <div class="value">${formatHtmlValue(testResult.project.projectNumber)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Client</label>
                <div class="value">${formatHtmlValue(testResult.project.clientName)}</div>
            </div>
            <div class="field">
                <label>Request Date</label>
                <div class="value">${formatHtmlValue(formatDate(testResult.createdAt))}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Sample Location</div>
        <div class="row">
            <div class="field">
                <label>Lot Number</label>
                <div class="value">${formatHtmlValue(testResult.lot?.lotNumber)}</div>
            </div>
            <div class="field">
                <label>Activity Type</label>
                <div class="value">${formatHtmlValue(testResult.lot?.activityType)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Lot Description</label>
                <div class="value">${formatHtmlValue(testResult.lot?.description)}</div>
            </div>
            <div class="field">
                <label>Layer</label>
                <div class="value">${formatHtmlValue(testResult.lot?.layer)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Chainage Start</label>
                <div class="value">${formatHtmlValue(testResult.lot?.chainageStart)}</div>
            </div>
            <div class="field">
                <label>Chainage End</label>
                <div class="value">${formatHtmlValue(testResult.lot?.chainageEnd)}</div>
            </div>
            <div class="field">
                <label>Sample Location Detail</label>
                <div class="value">${formatHtmlValue(testResult.sampleLocation)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Test Details</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Test Type</label>
                <div class="value">${formatHtmlValue(testResult.testType)}</div>
            </div>
            <div class="field">
                <label>Sample Date</label>
                <div class="value">${formatHtmlValue(formatDate(testResult.sampleDate))}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Laboratory</label>
                <div class="value">${formatHtmlValue(testResult.laboratoryName, '(To be assigned)')}</div>
            </div>
            <div class="field">
                <label>Priority</label>
                <div class="value">Standard</div>
            </div>
        </div>
    </div>

    <div class="section specifications">
        <div class="section-title">Specification Requirements</div>
        <div class="row">
            <div class="field">
                <label>Specification Min</label>
                <div class="value">${specificationValue(testResult.specificationMin)}</div>
            </div>
            <div class="field">
                <label>Specification Max</label>
                <div class="value">${specificationValue(testResult.specificationMax)}</div>
            </div>
            <div class="field">
                <label>Unit of Measurement</label>
                <div class="value">${formatHtmlValue(testResult.resultUnit)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Notes / Special Instructions</div>
        <div class="notes"></div>
    </div>

    <div class="footer">
        <div class="row">
            <div class="field">
                <label>Requested By</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.fullName)}</div>
            </div>
            <div class="field">
                <label>Contact Email</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.email)}</div>
            </div>
            <div class="field">
                <label>Contact Phone</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.phone)}</div>
            </div>
        </div>

        <div class="signature-row">
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Contractor Signature / Date</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Laboratory Receipt / Date</div>
            </div>
        </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #999;">
        Generated by SiteProof | ${generatedAt}
    </div>
</body>
</html>
`;

    if (format === 'json') {
      // Return JSON metadata for the request form
      res.json({
        testRequestForm: {
          requestNumber:
            testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase(),
          project: {
            name: testResult.project.name,
            number: testResult.project.projectNumber,
            client: testResult.project.clientName,
            company: testResult.project.company?.name,
          },
          lot: testResult.lot
            ? {
                number: testResult.lot.lotNumber,
                description: testResult.lot.description,
                activityType: testResult.lot.activityType,
                chainageStart: testResult.lot.chainageStart,
                chainageEnd: testResult.lot.chainageEnd,
                layer: testResult.lot.layer,
              }
            : null,
          testDetails: {
            type: testResult.testType,
            laboratory: testResult.laboratoryName,
            sampleDate: testResult.sampleDate,
            sampleLocation: testResult.sampleLocation,
          },
          specifications: {
            min: testResult.specificationMin,
            max: testResult.specificationMax,
            unit: testResult.resultUnit,
          },
          requestedBy: testResult.enteredBy,
          createdAt: testResult.createdAt,
        },
      });
    } else {
      // Return HTML for printing
      res.setHeader('Content-Type', 'text/html');
      res.send(formHtml);
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

    // Determine if result passes or fails specification
    let specificationStatus = 'unknown';
    if (testResult.resultValue !== null) {
      const value = Number(testResult.resultValue);
      const min = testResult.specificationMin !== null ? Number(testResult.specificationMin) : null;
      const max = testResult.specificationMax !== null ? Number(testResult.specificationMax) : null;

      if (min !== null && max !== null) {
        specificationStatus = value >= min && value <= max ? 'pass' : 'fail';
      } else if (min !== null) {
        specificationStatus = value >= min ? 'pass' : 'fail';
      } else if (max !== null) {
        specificationStatus = value <= max ? 'pass' : 'fail';
      }
    }

    // Get specification reference for this test type if available
    const normalizedType = testResult.testType.toLowerCase().replace(/\s+/g, '_');
    const standardSpec = testTypeSpecifications[normalizedType];

    // Format the response for side-by-side view
    res.json({
      verificationView: {
        // Left side: Document/Certificate info
        document: testResult.certificateDoc
          ? {
              id: testResult.certificateDoc.id,
              filename: testResult.certificateDoc.filename,
              fileUrl: testResult.certificateDoc.fileUrl,
              mimeType: testResult.certificateDoc.mimeType,
              uploadedAt: testResult.certificateDoc.uploadedAt,
              isPdf: testResult.certificateDoc.mimeType === 'application/pdf',
            }
          : null,

        // Right side: Extracted/Entered data
        extractedData: {
          testType: testResult.testType,
          testRequestNumber: testResult.testRequestNumber,
          laboratoryName: testResult.laboratoryName,
          laboratoryReportNumber: testResult.laboratoryReportNumber,
          sampleDate: testResult.sampleDate,
          sampleLocation: testResult.sampleLocation,
          testDate: testResult.testDate,
          resultDate: testResult.resultDate,
          resultValue: testResult.resultValue,
          resultUnit: testResult.resultUnit,
          aiExtracted: testResult.aiExtracted,
          aiConfidence: testResult.aiConfidence
            ? JSON.parse(testResult.aiConfidence as string)
            : null,
        },

        // Confidence highlighting for AI-extracted fields
        confidenceHighlights: (() => {
          if (!testResult.aiExtracted || !testResult.aiConfidence) {
            return { hasLowConfidence: false, lowConfidenceFields: [], fieldStatus: {} };
          }

          const confidence = JSON.parse(testResult.aiConfidence as string);
          const MEDIUM_CONFIDENCE_THRESHOLD = 0.9; // Fields below 90% get warning

          const fieldStatus: Record<
            string,
            { confidence: number; status: 'high' | 'medium' | 'low'; needsReview: boolean }
          > = {};
          const lowConfidenceFields: string[] = [];

          for (const [field, conf] of Object.entries(confidence)) {
            const confValue = conf as number;
            let status: 'high' | 'medium' | 'low' = 'high';
            let needsReview = false;

            if (confValue < LOW_CONFIDENCE_THRESHOLD) {
              status = 'low';
              needsReview = true;
              lowConfidenceFields.push(field);
            } else if (confValue < MEDIUM_CONFIDENCE_THRESHOLD) {
              status = 'medium';
              needsReview = false;
            }

            fieldStatus[field] = { confidence: confValue, status, needsReview };
          }

          return {
            hasLowConfidence: lowConfidenceFields.length > 0,
            lowConfidenceFields,
            fieldStatus,
            thresholds: {
              low: LOW_CONFIDENCE_THRESHOLD,
              medium: MEDIUM_CONFIDENCE_THRESHOLD,
            },
            reviewMessage:
              lowConfidenceFields.length > 0
                ? `${lowConfidenceFields.length} field(s) have low AI confidence and require manual verification: ${lowConfidenceFields.join(', ')}`
                : 'All AI-extracted fields have acceptable confidence levels',
          };
        })(),

        // Specification comparison
        specification: {
          min: testResult.specificationMin,
          max: testResult.specificationMax,
          unit: testResult.resultUnit,
          currentStatus: testResult.passFail,
          calculatedStatus: specificationStatus,
          standardReference: standardSpec?.specReference || null,
        },

        // Metadata
        metadata: {
          id: testResult.id,
          status: testResult.status,
          project: testResult.project,
          lot: testResult.lot,
          enteredBy: testResult.enteredBy,
          enteredAt: testResult.enteredAt,
          verifiedBy: testResult.verifiedBy,
          verifiedAt: testResult.verifiedAt,
          createdAt: testResult.createdAt,
          updatedAt: testResult.updatedAt,
        },

        // User permissions
        canVerify: TEST_VERIFIERS.includes(userProjectRole || ''),
        needsVerification: testResult.status !== 'verified',
      },
    });
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

// Valid status workflow transitions (Feature #196)
// requested -> at_lab -> results_received -> entered -> verified
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['at_lab'],
  at_lab: ['results_received'],
  results_received: ['entered'],
  entered: ['verified'],
  verified: [], // Terminal state
};

// Status labels for display
const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  at_lab: 'At Lab',
  results_received: 'Results Received',
  entered: 'Entered',
  verified: 'Verified',
};

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
