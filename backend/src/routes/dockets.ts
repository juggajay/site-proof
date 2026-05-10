import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { activeSubcontractorCompanyWhere, checkProjectAccess } from '../lib/projectAccess.js';
import type { Prisma } from '@prisma/client';

const DOCKET_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'queried'] as const;
const DOCKET_SORT_FIELDS = new Set([
  'date',
  'status',
  'submittedAt',
  'approvedAt',
  'createdAt',
  'updatedAt',
]);
const MAX_DOCKET_ID_LENGTH = 120;
const MAX_DOCKET_DATE_LENGTH = 64;
const MAX_DOCKET_NOTES_LENGTH = 5000;
const MAX_DOCKET_REASON_LENGTH = 3000;
const MAX_LOT_ALLOCATIONS_PER_ENTRY = 200;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const finiteNonNegativeNumber = (fieldName: string) =>
  z
    .number()
    .min(0, `${fieldName} cannot be negative`)
    .refine(Number.isFinite, `${fieldName} must be a finite number`);

const dailyHoursNumber = (fieldName: string) =>
  z
    .number()
    .gt(0, `${fieldName} must be greater than 0`)
    .max(24, `${fieldName} must be 24 or less`)
    .refine(Number.isFinite, `${fieldName} must be a finite number`);

const requiredDocketIdSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(MAX_DOCKET_ID_LENGTH, `${fieldName} is too long`);

const optionalTimeSchema = z
  .string()
  .trim()
  .max(5, 'Time must be in HH:mm format')
  .regex(TIME_PATTERN, 'Time must be in HH:mm format')
  .optional();
const optionalDateStringSchema = z
  .string()
  .trim()
  .max(MAX_DOCKET_DATE_LENGTH, `Date must be ${MAX_DOCKET_DATE_LENGTH} characters or less`)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date must be valid')
  .optional();

// Zod schemas for request body validation
const createDocketSchema = z.object({
  projectId: requiredDocketIdSchema('projectId'),
  date: optionalDateStringSchema,
  labourHours: finiteNonNegativeNumber('Labour total').optional(),
  plantHours: finiteNonNegativeNumber('Plant total').optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_DOCKET_NOTES_LENGTH, `Notes must be ${MAX_DOCKET_NOTES_LENGTH} characters or less`)
    .optional(),
});

const updateDocketSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(MAX_DOCKET_NOTES_LENGTH, `Notes must be ${MAX_DOCKET_NOTES_LENGTH} characters or less`)
    .nullable()
    .optional(),
});

const approveDocketSchema = z.object({
  foremanNotes: z
    .string()
    .trim()
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Foreman notes must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    )
    .optional(),
  adjustmentReason: z
    .string()
    .trim()
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Adjustment reason must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    )
    .optional(),
  adjustedLabourHours: finiteNonNegativeNumber('Adjusted labour total').optional(),
  adjustedPlantHours: finiteNonNegativeNumber('Adjusted plant total').optional(),
});

const rejectDocketSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(MAX_DOCKET_REASON_LENGTH, `Reason must be ${MAX_DOCKET_REASON_LENGTH} characters or less`)
    .optional(),
});

const queryDocketSchema = z.object({
  questions: z
    .string()
    .trim()
    .min(1, 'Questions/issues are required')
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Questions/issues must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    ),
});

const respondDocketSchema = z.object({
  response: z
    .string()
    .trim()
    .min(1, 'Response is required')
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Response must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    ),
});

const lotAllocationSchema = z.object({
  lotId: requiredDocketIdSchema('lotId'),
  hours: dailyHoursNumber('Lot allocation hours'),
});

const addLabourEntrySchema = z.object({
  employeeId: requiredDocketIdSchema('employeeId'),
  startTime: optionalTimeSchema,
  finishTime: optionalTimeSchema,
  lotAllocations: z
    .array(lotAllocationSchema)
    .max(
      MAX_LOT_ALLOCATIONS_PER_ENTRY,
      `Cannot allocate more than ${MAX_LOT_ALLOCATIONS_PER_ENTRY} lots to one entry`,
    )
    .optional(),
});

const updateLabourEntrySchema = z.object({
  startTime: optionalTimeSchema,
  finishTime: optionalTimeSchema,
  lotAllocations: z
    .array(lotAllocationSchema)
    .max(
      MAX_LOT_ALLOCATIONS_PER_ENTRY,
      `Cannot allocate more than ${MAX_LOT_ALLOCATIONS_PER_ENTRY} lots to one entry`,
    )
    .optional(),
});

const addPlantEntrySchema = z.object({
  plantId: requiredDocketIdSchema('plantId'),
  hoursOperated: dailyHoursNumber('Hours operated'),
  wetOrDry: z.enum(['wet', 'dry']).optional(),
});

const updatePlantEntrySchema = z.object({
  hoursOperated: dailyHoursNumber('Hours operated').optional(),
  wetOrDry: z.enum(['wet', 'dry']).optional(),
});

export const docketsRouter = Router();

// Apply authentication middleware to all docket routes
docketsRouter.use(requireAuth);

// Roles that can approve dockets
const DOCKET_APPROVERS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];
const SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const DOCKET_ENTRY_EDIT_STATUSES = new Set(['draft', 'queried', 'rejected']);

type AuthUser = NonNullable<Express.Request['user']>;
type DocketAccess = {
  projectId: string;
  subcontractorCompanyId: string;
};

function isSubcontractorUser(user: AuthUser): boolean {
  return SUBCONTRACTOR_ROLES.has(user.roleInCompany);
}

function isCompanyAdmin(user: AuthUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

function isDocketEntryEditable(status: string): boolean {
  return DOCKET_ENTRY_EDIT_STATUSES.has(status);
}

async function hasLinkedSubcontractorCompany(
  userId: string,
  subcontractorCompanyId: string,
): Promise<boolean> {
  const count = await prisma.subcontractorUser.count({
    where: {
      userId,
      subcontractorCompanyId,
      subcontractorCompany: activeSubcontractorCompanyWhere(),
    },
  });
  return count > 0;
}

async function requireProjectReadAccess(user: AuthUser, projectId: string): Promise<void> {
  if (!(await checkProjectAccess(user.id, projectId))) {
    throw AppError.forbidden('Access denied');
  }
}

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  const isSubcontractor = isSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  if (!isSubcontractor && isCompanyAdmin(user) && project.companyId === user.companyId) {
    return user.roleInCompany;
  }

  return projectUser?.role ?? null;
}

async function requireDocketApproverAccess(user: AuthUser, projectId: string): Promise<void> {
  const role = await getEffectiveProjectRole(user, projectId);
  if (!role || !DOCKET_APPROVERS.includes(role)) {
    throw AppError.forbidden('You do not have permission to perform this action.');
  }
}

async function requireDocketReadAccess(user: AuthUser, docket: DocketAccess): Promise<void> {
  if (isSubcontractorUser(user)) {
    if (!(await hasLinkedSubcontractorCompany(user.id, docket.subcontractorCompanyId))) {
      throw AppError.forbidden('Access denied');
    }
    return;
  }

  await requireProjectReadAccess(user, docket.projectId);
}

async function requireDocketSubcontractorAccess(
  user: AuthUser,
  docket: DocketAccess,
): Promise<void> {
  if (
    !isSubcontractorUser(user) ||
    !(await hasLinkedSubcontractorCompany(user.id, docket.subcontractorCompanyId))
  ) {
    throw AppError.forbidden('Only the linked subcontractor can modify this docket');
  }
}

async function requireLotAllocationsInProject(
  projectId: string,
  subcontractorCompanyId: string,
  lotAllocations?: Array<{ lotId: string }>,
): Promise<void> {
  const lotIds = [...new Set(lotAllocations?.map((alloc) => alloc.lotId) ?? [])];
  if (lotIds.length === 0) return;

  const lotCount = await prisma.lot.count({
    where: {
      id: { in: lotIds },
      projectId,
    },
  });

  if (lotCount !== lotIds.length) {
    throw AppError.badRequest('All lot allocations must belong to the docket project');
  }

  const assignedLotCount = await prisma.lot.count({
    where: {
      id: { in: lotIds },
      projectId,
      OR: [
        { assignedSubcontractorId: subcontractorCompanyId },
        {
          subcontractorAssignments: {
            some: {
              projectId,
              subcontractorCompanyId,
              status: 'active',
            },
          },
        },
      ],
    },
  });

  if (assignedLotCount !== lotIds.length) {
    throw AppError.forbidden('Docket lot allocations are limited to lots assigned to your company');
  }
}

function parseRequiredQueryString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw AppError.badRequest(`${fieldName} query parameter is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DOCKET_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} query parameter is too long`);
  }
  return trimmed;
}

function parseDocketRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_DOCKET_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function parseOptionalDocketStatus(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !DOCKET_STATUSES.includes(value.trim() as (typeof DOCKET_STATUSES)[number])
  ) {
    throw AppError.badRequest('Invalid docket status');
  }
  return value.trim();
}

const DATE_COMPONENT_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

function assertValidDateComponent(value: string, errorMessage: string) {
  const match = DATE_COMPONENT_INPUT_PATTERN.exec(value);
  if (!match) {
    throw AppError.badRequest(errorMessage);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.badRequest(errorMessage);
  }
}

function parseDocketDate(date?: unknown): Date {
  if (date === undefined || date === null || date === '') return new Date();
  if (typeof date !== 'string') {
    throw AppError.badRequest('Date must be valid');
  }

  const trimmed = date.trim();
  if (!trimmed) return new Date();

  assertValidDateComponent(trimmed, 'Date must be valid');
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest('Date must be valid');
  }
  return parsed;
}

// GET /api/dockets - List dockets for a project
docketsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = parseRequiredQueryString(req.query.projectId, 'projectId');
    const status = parseOptionalDocketStatus(req.query.status);

    await requireProjectReadAccess(user, projectId);

    // Parse pagination parameters
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    if (sortBy && !DOCKET_SORT_FIELDS.has(sortBy)) {
      throw AppError.badRequest('Invalid sort field');
    }
    const { skip, take } = getPrismaSkipTake(page, limit);

    const whereClause: Prisma.DailyDocketWhereInput = { projectId };

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    // Subcontractors can only see their own company's dockets
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
        },
      });

      if (subcontractorUser) {
        whereClause.subcontractorCompanyId = subcontractorUser.subcontractorCompanyId;
      } else {
        return res.json({ data: [], dockets: [], pagination: getPaginationMeta(0, page, limit) });
      }
    }

    const [dockets, total] = await Promise.all([
      prisma.dailyDocket.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          subcontractorCompany: {
            select: {
              id: true,
              companyName: true,
            },
          },
          labourEntries: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          plantEntries: {
            include: {
              plant: {
                select: {
                  id: true,
                  type: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { date: 'desc' },
      }),
      prisma.dailyDocket.count({ where: whereClause }),
    ]);

    // Format dockets for response
    const formattedDockets = dockets.map((docket) => ({
      id: docket.id,
      docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
      subcontractor: docket.subcontractorCompany.companyName,
      subcontractorId: docket.subcontractorCompany.id,
      date: docket.date.toISOString().split('T')[0],
      status: docket.status,
      notes: docket.notes,
      labourHours: docket.labourEntries.reduce(
        (sum, entry) => sum + (Number(entry.submittedHours) || 0),
        0,
      ),
      plantHours: docket.plantEntries.reduce(
        (sum, entry) => sum + (Number(entry.hoursOperated) || 0),
        0,
      ),
      totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
      totalLabourApproved: Number(docket.totalLabourApproved) || 0,
      totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
      totalPlantApproved: Number(docket.totalPlantApproved) || 0,
      submittedAt: docket.submittedAt,
      approvedAt: docket.approvedAt,
      foremanNotes: docket.foremanNotes,
    }));

    res.json({
      data: formattedDockets,
      pagination: getPaginationMeta(total, page, limit),
      dockets: formattedDockets, // Backward compatibility
    });
  }),
);

// POST /api/dockets - Create a new docket
docketsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const parseResult = createDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { projectId, date, labourHours, plantHours, notes } = parseResult.data;

    if (!isSubcontractorUser(user)) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    // Find user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId: user.id,
        subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
      },
      include: {
        subcontractorCompany: {
          select: { projectId: true },
        },
      },
    });

    if (!subcontractorUser) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    const docket = await prisma.dailyDocket.create({
      data: {
        projectId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        date: parseDocketDate(date),
        status: 'draft',
        notes,
        totalLabourSubmitted: labourHours || 0,
        totalPlantSubmitted: plantHours || 0,
      },
      include: {
        subcontractorCompany: {
          select: {
            companyName: true,
          },
        },
      },
    });

    res.status(201).json({
      docket: {
        id: docket.id,
        docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
        subcontractor: docket.subcontractorCompany.companyName,
        date: docket.date.toISOString().split('T')[0],
        status: docket.status,
        labourHours: Number(docket.totalLabourSubmitted) || 0,
        plantHours: Number(docket.totalPlantSubmitted) || 0,
        notes: docket.notes,
      },
    });
  }),
);

// GET /api/dockets/:id - Get single docket with full details (Feature #265)
docketsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        labourEntries: {
          include: {
            employee: { select: { id: true, name: true, role: true, hourlyRate: true } },
            lotAllocations: {
              include: { lot: { select: { id: true, lotNumber: true } } },
            },
          },
          orderBy: { startTime: 'asc' },
        },
        plantEntries: {
          include: {
            plant: {
              select: {
                id: true,
                type: true,
                description: true,
                idRego: true,
                dryRate: true,
                wetRate: true,
              },
            },
          },
          orderBy: { hoursOperated: 'desc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Get foreman diary for the same date to compare (Feature #265 Step 3)
    let foremanDiary = null;
    const discrepancies: string[] = [];

    const diary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: docket.projectId,
        date: docket.date,
      },
      include: {
        personnel: {
          select: { id: true, name: true, company: true, role: true },
        },
        plant: {
          select: { id: true, description: true, idRego: true },
        },
        activities: {
          select: { id: true, description: true, lotId: true },
        },
        delays: {
          select: { id: true, delayType: true, durationHours: true, description: true },
        },
      },
    });

    if (diary) {
      // Calculate weather hours lost from delays
      const weatherDelays = diary.delays.filter((d) => d.delayType === 'weather');
      const weatherHoursLost = weatherDelays.reduce(
        (sum, d) => sum + (Number(d.durationHours) || 0),
        0,
      );

      foremanDiary = {
        id: diary.id,
        date: diary.date.toISOString().split('T')[0],
        status: diary.status,
        personnelCount: diary.personnel.length,
        plantCount: diary.plant.length,
        weatherConditions: diary.weatherConditions,
        weatherHoursLost,
        activitiesCount: diary.activities.length,
      };

      // Feature #265 Step 4 - Highlight discrepancies
      const docketPersonnelCount = docket.labourEntries.length;
      const diaryPersonnelCount = diary.personnel.length;
      if (docketPersonnelCount > 0 && diaryPersonnelCount !== docketPersonnelCount) {
        discrepancies.push(
          `Personnel count may differ: docket has ${docketPersonnelCount} entries, diary has ${diaryPersonnelCount}`,
        );
      }

      const docketPlantCount = docket.plantEntries.length;
      const diaryPlantCount = diary.plant.length;
      if (docketPlantCount > 0 && diaryPlantCount !== docketPlantCount) {
        discrepancies.push(
          `Plant/equipment count may differ: docket has ${docketPlantCount} entries, diary has ${diaryPlantCount}`,
        );
      }

      if (weatherHoursLost > 0) {
        discrepancies.push(`Weather hours lost noted in diary: ${weatherHoursLost} hours`);
      }
    }

    // Format labour entries
    const labourEntries = docket.labourEntries.map((entry) => ({
      id: entry.id,
      employee: {
        id: entry.employee.id,
        name: entry.employee.name,
        role: entry.employee.role,
        hourlyRate: Number(entry.employee.hourlyRate) || 0,
      },
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      submittedHours: Number(entry.submittedHours) || 0,
      approvedHours: Number(entry.approvedHours) || 0,
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      lotAllocations: entry.lotAllocations.map((a) => ({
        lotId: a.lotId,
        lotNumber: a.lot.lotNumber,
        hours: Number(a.hours) || 0,
      })),
    }));

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) => ({
      id: entry.id,
      plant: {
        id: entry.plant.id,
        type: entry.plant.type,
        description: entry.plant.description,
        idRego: entry.plant.idRego,
        dryRate: Number(entry.plant.dryRate) || 0,
        wetRate: Number(entry.plant.wetRate) || 0,
      },
      hoursOperated: Number(entry.hoursOperated) || 0,
      wetOrDry: entry.wetOrDry || 'dry',
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
    }));

    // Fetch project info separately since it's not a relation on DailyDocket
    const project = await prisma.project.findUnique({
      where: { id: docket.projectId },
      select: { id: true, name: true },
    });

    // Fetch submittedBy and approvedBy user info separately
    const submittedBy = docket.submittedById
      ? await prisma.user.findUnique({
          where: { id: docket.submittedById },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    const approvedBy = docket.approvedById
      ? await prisma.user.findUnique({
          where: { id: docket.approvedById },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    res.json({
      docket: {
        id: docket.id,
        docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
        date: docket.date.toISOString().split('T')[0],
        status: docket.status,
        projectId: docket.projectId,
        project,
        subcontractor: docket.subcontractorCompany,
        notes: docket.notes,
        foremanNotes: docket.foremanNotes,
        adjustmentReason: docket.adjustmentReason,
        submittedAt: docket.submittedAt,
        submittedById: docket.submittedById,
        submittedBy,
        approvedAt: docket.approvedAt,
        approvedById: docket.approvedById,
        approvedBy,
        totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
        totalLabourApproved: Number(docket.totalLabourApproved) || 0,
        totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
        totalPlantApproved: Number(docket.totalPlantApproved) || 0,
        labourEntries,
        plantEntries,
      },
      foremanDiary,
      discrepancies: discrepancies.length > 0 ? discrepancies : null,
    });
  }),
);

// PATCH /api/dockets/:id - Update editable subcontractor docket metadata
docketsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const parseResult = updateDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { notes } = parseResult.data;
    if (notes === undefined) {
      throw AppError.badRequest('No fields to update');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }

    await requireDocketSubcontractorAccess(user, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only update draft, queried, or rejected dockets');
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: { notes },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    res.json({
      docket: {
        id: updatedDocket.id,
        docketNumber: `DKT-${updatedDocket.id.slice(0, 6).toUpperCase()}`,
        date: updatedDocket.date.toISOString().split('T')[0],
        status: updatedDocket.status,
        notes: updatedDocket.notes,
        foremanNotes: updatedDocket.foremanNotes,
        subcontractor: updatedDocket.subcontractorCompany,
      },
    });
  }),
);

// POST /api/dockets/:id/submit - Submit a docket for approval
docketsRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
        labourEntries: {
          include: {
            lotAllocations: true,
          },
        },
        plantEntries: true,
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(user, docket);

    if (!['draft', 'rejected'].includes(docket.status)) {
      throw AppError.badRequest('Only draft or rejected dockets can be submitted');
    }

    // Feature #891: Require at least one entry before submission
    const hasLabourEntries = docket.labourEntries && docket.labourEntries.length > 0;
    const hasPlantEntries = docket.plantEntries && docket.plantEntries.length > 0;
    if (!hasLabourEntries && !hasPlantEntries) {
      throw new AppError(
        400,
        'At least one labour or plant entry is required before submitting the docket.',
        'ENTRY_REQUIRED',
      );
    }

    // Feature #890: Require lot selection for docket submission
    // Check if docket has labour entries that need lot allocation
    if (docket.labourEntries.length > 0) {
      const hasAnyLotAllocation = docket.labourEntries.some(
        (entry) => entry.lotAllocations && entry.lotAllocations.length > 0,
      );
      if (!hasAnyLotAllocation) {
        throw new AppError(
          400,
          'At least one labour entry must be allocated to a lot before submitting the docket.',
          'LOT_REQUIRED',
        );
      }
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval',
        submittedById: user.id,
        submittedAt: new Date(),
      },
    });

    // Feature #926 - Notify foremen and approvers about pending docket
    // Get all project users who can approve dockets (foreman, site_manager, project_manager, admin, owner)
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'] },
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Count total pending dockets for this project
    const pendingCount = await prisma.dailyDocket.count({
      where: {
        projectId: docket.projectId,
        status: 'pending_approval',
      },
    });

    // Create in-app notifications for approvers
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`;
    const docketDate = docket.date.toISOString().split('T')[0];
    const subcontractorName = docket.subcontractorCompany.companyName;

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: docket.projectId,
      type: 'docket_pending',
      title: 'Docket Pending Approval',
      message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval. ${pendingCount} docket${pendingCount !== 1 ? 's' : ''} pending.`,
      linkUrl: `/projects/${docket.projectId}/dockets`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to approvers (if configured)
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'enabled', {
          title: 'Docket Pending Approval',
          message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval.\n\nProject: ${docket.project.name}\nPending Dockets: ${pendingCount}\n\nPlease review and approve at your earliest convenience.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`,
        });
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket submitted for approval',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
        submittedAt: updatedDocket.submittedAt,
      },
      notifiedUsers: projectUsers.map((pu) => ({
        email: pu.user.email,
        fullName: pu.user.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/approve - Approve a docket
docketsRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = approveDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { foremanNotes, adjustmentReason, adjustedLabourHours, adjustedPlantHours } =
      parseResult.data;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be approved');
    }

    // Use adjusted values if provided, otherwise copy submitted values
    const labourApproved =
      adjustedLabourHours !== undefined ? adjustedLabourHours : docket.totalLabourSubmitted;
    const plantApproved =
      adjustedPlantHours !== undefined ? adjustedPlantHours : docket.totalPlantSubmitted;

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes,
        adjustmentReason,
        totalLabourApproved: labourApproved,
        totalPlantApproved: plantApproved,
      },
      include: {
        subcontractorCompany: {
          select: {
            companyName: true,
          },
        },
      },
    });

    // === DIARY AUTO-POPULATION ===
    // When a docket is approved, write its labour and plant data into the daily diary
    try {
      // Find or create diary for this date
      let diary = await prisma.dailyDiary.findUnique({
        where: { projectId_date: { projectId: docket.projectId, date: docket.date } },
      });

      if (!diary) {
        diary = await prisma.dailyDiary.create({
          data: {
            projectId: docket.projectId,
            date: docket.date,
            status: 'draft',
          },
        });
      }

      // Don't modify submitted diaries
      if (diary.status !== 'submitted') {
        // Fetch full docket with labour and plant entries
        const fullDocket = await prisma.dailyDocket.findUnique({
          where: { id: docket.id },
          include: {
            labourEntries: {
              include: {
                employee: { select: { name: true, role: true } },
                lotAllocations: true,
              },
            },
            plantEntries: {
              include: {
                plant: { select: { type: true, description: true, idRego: true } },
                lotAllocations: true,
              },
            },
            subcontractorCompany: { select: { companyName: true } },
          },
        });

        if (fullDocket) {
          // Write personnel records from labour entries
          for (const entry of fullDocket.labourEntries) {
            await prisma.diaryPersonnel.create({
              data: {
                diaryId: diary.id,
                name: entry.employee.name,
                role: entry.employee.role || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hours: entry.approvedHours || entry.submittedHours || undefined,
                startTime: entry.startTime || undefined,
                finishTime: entry.finishTime || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            });
          }

          // Write plant records from plant entries
          for (const entry of fullDocket.plantEntries) {
            await prisma.diaryPlant.create({
              data: {
                diaryId: diary.id,
                description: entry.plant.description || entry.plant.type,
                idRego: entry.plant.idRego || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hoursOperated: entry.hoursOperated || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            });
          }
        }
      }
    } catch {
      // Don't fail the approval if diary population fails
    }
    // === END DIARY AUTO-POPULATION ===

    // Feature #927 - Notify subcontractor users about docket approval
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`;
    const docketDate = docket.date.toISOString().split('T')[0];
    const approverName = user.fullName || user.email;

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      projectId: docket.projectId,
      type: 'docket_approved',
      title: 'Docket Approved',
      message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}. Status: Approved${adjustmentReason ? ` (with adjustments)` : ''}.`,
      linkUrl: `/projects/${docket.projectId}/dockets`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Approved',
          message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}.\n\nProject: ${docket.project.name}\nStatus: Approved\n${foremanNotes ? `Notes: ${foremanNotes}` : ''}\n${adjustmentReason ? `Adjustment Reason: ${adjustmentReason}` : ''}`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`,
        });
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket approved successfully',
      docket: {
        id: updatedDocket.id,
        docketNumber: `DKT-${updatedDocket.id.slice(0, 6).toUpperCase()}`,
        subcontractor: updatedDocket.subcontractorCompany.companyName,
        status: updatedDocket.status,
        approvedAt: updatedDocket.approvedAt,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/reject - Reject a docket
docketsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = rejectDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { reason } = parseResult.data;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be rejected');
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes: reason,
      },
    });

    // Feature #928 - Notify subcontractor users about docket rejection
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`;
    const docketDate = docket.date.toISOString().split('T')[0];
    const rejectorName = user.fullName || user.email;

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      projectId: docket.projectId,
      type: 'docket_rejected',
      title: 'Docket Rejected',
      message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.${reason ? ` Reason: ${reason}` : ''}`,
      linkUrl: `/projects/${docket.projectId}/dockets`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Rejected',
          message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.\n\nProject: ${docket.project.name}\nStatus: Rejected\n${reason ? `Reason: ${reason}` : 'No reason provided.'}\n\nPlease review and resubmit if necessary.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`,
        });
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket rejected',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/query - Query a docket (Feature #268)
docketsRouter.post(
  '/:id/query',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = queryDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(
        parseResult.error.errors[0]?.message || 'Questions/issues are required',
      );
    }

    const { questions } = parseResult.data;

    if (questions.trim() === '') {
      throw AppError.badRequest('Questions/issues are required');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be queried');
    }

    // Step 5 - Update status to 'queried'
    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'queried',
        foremanNotes: questions, // Store the query in foreman notes
      },
    });

    // Step 6 - Notify subcontractor users
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`;
    const docketDate = docket.date.toISOString().split('T')[0];
    const querierName = user.fullName || user.email;

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      projectId: docket.projectId,
      type: 'docket_queried',
      title: 'Docket Query',
      message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nQuestions: ${questions.substring(0, 200)}${questions.length > 200 ? '...' : ''}\n\nPlease review and respond or amend the docket.`,
      linkUrl: `/projects/${docket.projectId}/dockets`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Query - Response Required',
          message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nProject: ${docket.project.name}\n\nQuestions/Issues:\n${questions}\n\nPlease review and respond or amend the docket.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`,
        });
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket queried successfully',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/respond - Respond to a docket query (Feature #268 Step 7)
docketsRouter.post(
  '/:id/respond',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = respondDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Response is required');
    }

    const { response } = parseResult.data;

    if (response.trim() === '') {
      throw AppError.badRequest('Response is required');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(user, docket);

    if (docket.status !== 'queried') {
      throw AppError.badRequest('Only queried dockets can be responded to');
    }

    // Update status back to pending_approval and append response to notes
    const existingNotes = docket.notes || '';
    const newNotes = existingNotes
      ? `${existingNotes}\n\n--- Response to Query ---\n${response}`
      : `--- Response to Query ---\n${response}`;

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval', // Back to pending for re-review
        notes: newNotes,
      },
    });

    // Notify project approvers about the response
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`;
    const docketDate = docket.date.toISOString().split('T')[0];
    const responderName = user.fullName || user.email;

    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: DOCKET_APPROVERS },
        status: 'active',
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: docket.projectId,
      type: 'docket_query_response',
      title: 'Docket Query Response',
      message: `${responderName} has responded to the query on docket ${docketNumber} (${docketDate}).\n\nResponse: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}\n\nThe docket is ready for review.`,
      linkUrl: `/projects/${docket.projectId}/dockets`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    res.json({
      message: 'Query response submitted',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
    });
  }),
);

// ============================================================================
// Feature #261 - Labour Entry Management
// ============================================================================

// GET /api/dockets/:id/labour - Get labour entries for a docket
docketsRouter.get(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        labourEntries: {
          include: {
            employee: {
              select: { id: true, name: true, role: true, hourlyRate: true },
            },
            lotAllocations: {
              include: {
                lot: { select: { id: true, lotNumber: true } },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Format labour entries
    const labourEntries = docket.labourEntries.map((entry) => ({
      id: entry.id,
      employee: {
        id: entry.employee.id,
        name: entry.employee.name,
        role: entry.employee.role,
        hourlyRate: Number(entry.employee.hourlyRate) || 0,
      },
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      submittedHours: Number(entry.submittedHours) || 0,
      approvedHours: Number(entry.approvedHours) || 0,
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      adjustmentReason: entry.adjustmentReason,
      lotAllocations: entry.lotAllocations.map((alloc) => ({
        lotId: alloc.lotId,
        lotNumber: alloc.lot.lotNumber,
        hours: Number(alloc.hours) || 0,
      })),
    }));

    // Calculate totals
    const totalSubmittedHours = labourEntries.reduce((sum, e) => sum + e.submittedHours, 0);
    const totalSubmittedCost = labourEntries.reduce((sum, e) => sum + e.submittedCost, 0);
    const totalApprovedHours = labourEntries.reduce((sum, e) => sum + e.approvedHours, 0);
    const totalApprovedCost = labourEntries.reduce((sum, e) => sum + e.approvedCost, 0);

    res.json({
      labourEntries,
      totals: {
        submittedHours: totalSubmittedHours,
        submittedCost: totalSubmittedCost,
        approvedHours: totalApprovedHours,
        approvedCost: totalApprovedCost,
      },
    });
  }),
);

// POST /api/dockets/:id/labour - Add a labour entry to a docket
docketsRouter.post(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { employeeId, startTime, finishTime, lotAllocations } = parseResult.data;

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Get employee from roster
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: employeeId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!employee) {
      throw AppError.notFound('Employee in roster');
    }

    // Calculate hours from start/finish time
    let hours = 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24; // Handle overnight shifts
    }

    // Calculate cost
    const hourlyRate = Number(employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    // Create labour entry
    const entry = await prisma.docketLabour.create({
      data: {
        docketId: id,
        employeeId,
        startTime,
        finishTime,
        submittedHours: hours,
        hourlyRate,
        submittedCost: cost,
        lotAllocations: lotAllocations?.length
          ? {
              create: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
                lotId: alloc.lotId,
                hours: alloc.hours,
              })),
            }
          : undefined,
      },
      include: {
        employee: {
          select: { id: true, name: true, role: true, hourlyRate: true },
        },
        lotAllocations: {
          include: {
            lot: { select: { id: true, lotNumber: true } },
          },
        },
      },
    });

    // Update docket totals
    const allEntries = await prisma.docketLabour.findMany({
      where: { docketId: id },
    });
    const totalHours = allEntries.reduce((sum, e) => sum + (Number(e.submittedHours) || 0), 0);
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

    await prisma.dailyDocket.update({
      where: { id },
      data: {
        totalLabourSubmitted: totalCost,
      },
    });

    res.status(201).json({
      labourEntry: {
        id: entry.id,
        employee: {
          id: entry.employee.id,
          name: entry.employee.name,
          role: entry.employee.role,
          hourlyRate: Number(entry.employee.hourlyRate) || 0,
        },
        startTime: entry.startTime,
        finishTime: entry.finishTime,
        submittedHours: Number(entry.submittedHours) || 0,
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0,
        lotAllocations: entry.lotAllocations.map((alloc) => ({
          lotId: alloc.lotId,
          lotNumber: alloc.lot.lotNumber,
          hours: Number(alloc.hours) || 0,
        })),
      },
      runningTotal: {
        hours: totalHours,
        cost: totalCost,
      },
    });
  }),
);

// PUT /api/dockets/:id/labour/:entryId - Update a labour entry
docketsRouter.put(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updateLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { startTime, finishTime, lotAllocations } = parseResult.data;

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        employee: { select: { hourlyRate: true } },
      },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Recalculate hours
    let hours = Number(entry.submittedHours) || 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24;
    }

    const hourlyRate = Number(entry.hourlyRate) || Number(entry.employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.docketLabour.update({
        where: { id: entryId },
        data: {
          startTime,
          finishTime,
          submittedHours: hours,
          submittedCost: cost,
        },
      });

      if (lotAllocations) {
        await tx.docketLabourLot.deleteMany({ where: { docketLabourId: entryId } });
        if (lotAllocations.length > 0) {
          await tx.docketLabourLot.createMany({
            data: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
              docketLabourId: entryId,
              lotId: alloc.lotId,
              hours: alloc.hours,
            })),
          });
        }
      }

      const allEntries = await tx.docketLabour.findMany({
        where: { docketId: id },
      });
      const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

      await tx.dailyDocket.update({
        where: { id },
        data: { totalLabourSubmitted: totalCost },
      });

      const refreshed = await tx.docketLabour.findUnique({
        where: { id: entryId },
        include: {
          employee: {
            select: { id: true, name: true, role: true, hourlyRate: true },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      if (!refreshed) {
        throw AppError.notFound('Labour entry');
      }
      return refreshed;
    });

    res.json({
      labourEntry: {
        id: updated.id,
        employee: {
          id: updated.employee.id,
          name: updated.employee.name,
          role: updated.employee.role,
          hourlyRate: Number(updated.employee.hourlyRate) || 0,
        },
        startTime: updated.startTime,
        finishTime: updated.finishTime,
        submittedHours: Number(updated.submittedHours) || 0,
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0,
        lotAllocations: updated.lotAllocations.map((alloc) => ({
          lotId: alloc.lotId,
          lotNumber: alloc.lot.lotNumber,
          hours: Number(alloc.hours) || 0,
        })),
      },
    });
  }),
);

// DELETE /api/dockets/:id/labour/:entryId - Delete a labour entry
docketsRouter.delete(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    // Delete entry (cascade deletes lot allocations)
    await prisma.docketLabour.delete({ where: { id: entryId } });

    // Update docket totals
    const allEntries = await prisma.docketLabour.findMany({
      where: { docketId: id },
    });
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalLabourSubmitted: totalCost },
    });

    res.json({ message: 'Labour entry deleted' });
  }),
);

// ============================================================================
// Feature #262 - Plant Entry Management
// ============================================================================

// GET /api/dockets/:id/plant - Get plant entries for a docket
docketsRouter.get(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        plantEntries: {
          include: {
            plant: {
              select: {
                id: true,
                type: true,
                description: true,
                idRego: true,
                dryRate: true,
                wetRate: true,
              },
            },
          },
          orderBy: { hoursOperated: 'desc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) => ({
      id: entry.id,
      plant: {
        id: entry.plant.id,
        type: entry.plant.type,
        description: entry.plant.description,
        idRego: entry.plant.idRego,
        dryRate: Number(entry.plant.dryRate) || 0,
        wetRate: Number(entry.plant.wetRate) || 0,
      },
      hoursOperated: Number(entry.hoursOperated) || 0,
      wetOrDry: entry.wetOrDry || 'dry',
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      adjustmentReason: entry.adjustmentReason,
    }));

    // Calculate totals
    const totalHours = plantEntries.reduce((sum, e) => sum + e.hoursOperated, 0);
    const totalSubmittedCost = plantEntries.reduce((sum, e) => sum + e.submittedCost, 0);
    const totalApprovedCost = plantEntries.reduce((sum, e) => sum + e.approvedCost, 0);

    res.json({
      plantEntries,
      totals: {
        hours: totalHours,
        submittedCost: totalSubmittedCost,
        approvedCost: totalApprovedCost,
      },
    });
  }),
);

// POST /api/dockets/:id/plant - Add a plant entry to a docket
docketsRouter.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addPlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { plantId, hoursOperated, wetOrDry } = parseResult.data;

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    // Get plant from register
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!plant) {
      throw AppError.notFound('Plant in register');
    }

    // Determine rate based on wet/dry
    const isWet = wetOrDry === 'wet';
    const hourlyRate = isWet
      ? Number(plant.wetRate) || Number(plant.dryRate) || 0
      : Number(plant.dryRate) || 0;
    const cost = Number(hoursOperated) * hourlyRate;

    // Create plant entry
    const entry = await prisma.docketPlant.create({
      data: {
        docketId: id,
        plantId,
        hoursOperated,
        wetOrDry: wetOrDry || 'dry',
        hourlyRate,
        submittedCost: cost,
      },
      include: {
        plant: {
          select: {
            id: true,
            type: true,
            description: true,
            idRego: true,
            dryRate: true,
            wetRate: true,
          },
        },
      },
    });

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id },
    });
    const totalHours = allEntries.reduce((sum, e) => sum + (Number(e.hoursOperated) || 0), 0);
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

    await prisma.dailyDocket.update({
      where: { id },
      data: {
        totalPlantSubmitted: totalCost,
      },
    });

    res.status(201).json({
      plantEntry: {
        id: entry.id,
        plant: {
          id: entry.plant.id,
          type: entry.plant.type,
          description: entry.plant.description,
          idRego: entry.plant.idRego,
          dryRate: Number(entry.plant.dryRate) || 0,
          wetRate: Number(entry.plant.wetRate) || 0,
        },
        hoursOperated: Number(entry.hoursOperated) || 0,
        wetOrDry: entry.wetOrDry || 'dry',
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0,
      },
      runningTotal: {
        hours: totalHours,
        cost: totalCost,
      },
    });
  }),
);

// PUT /api/dockets/:id/plant/:entryId - Update a plant entry
docketsRouter.put(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updatePlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { hoursOperated, wetOrDry } = parseResult.data;

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        plant: { select: { dryRate: true, wetRate: true } },
      },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    // Recalculate cost
    const hours = hoursOperated !== undefined ? Number(hoursOperated) : Number(entry.hoursOperated);
    const isWet = (wetOrDry || entry.wetOrDry) === 'wet';
    const hourlyRate = isWet
      ? Number(entry.plant.wetRate) || Number(entry.plant.dryRate) || 0
      : Number(entry.plant.dryRate) || 0;
    const cost = hours * hourlyRate;

    // Update entry
    const updated = await prisma.docketPlant.update({
      where: { id: entryId },
      data: {
        hoursOperated: hours,
        wetOrDry: wetOrDry || entry.wetOrDry,
        hourlyRate,
        submittedCost: cost,
      },
      include: {
        plant: {
          select: {
            id: true,
            type: true,
            description: true,
            idRego: true,
            dryRate: true,
            wetRate: true,
          },
        },
      },
    });

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id },
    });
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalPlantSubmitted: totalCost },
    });

    res.json({
      plantEntry: {
        id: updated.id,
        plant: {
          id: updated.plant.id,
          type: updated.plant.type,
          description: updated.plant.description,
          idRego: updated.plant.idRego,
          dryRate: Number(updated.plant.dryRate) || 0,
          wetRate: Number(updated.plant.wetRate) || 0,
        },
        hoursOperated: Number(updated.hoursOperated) || 0,
        wetOrDry: updated.wetOrDry || 'dry',
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0,
      },
    });
  }),
);

// DELETE /api/dockets/:id/plant/:entryId - Delete a plant entry
docketsRouter.delete(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    // Delete entry
    await prisma.docketPlant.delete({ where: { id: entryId } });

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id },
    });
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0);

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalPlantSubmitted: totalCost },
    });

    res.json({ message: 'Plant entry deleted' });
  }),
);
