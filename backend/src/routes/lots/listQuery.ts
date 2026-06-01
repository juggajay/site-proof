import type { Prisma } from '@prisma/client';

const LOT_SEARCH_FIELDS = [
  'lotNumber',
  'description',
  'activityType',
  'areaZone',
  'structureId',
  'structureElement',
] as const;

export function buildLotListWhere(
  whereClause: Prisma.LotWhereInput,
  search: string | undefined,
): Prisma.LotWhereInput {
  return search
    ? {
        AND: [
          whereClause,
          {
            OR: LOT_SEARCH_FIELDS.map((field) => ({
              [field]: { contains: search, mode: 'insensitive' },
            })),
          },
        ],
      }
    : whereClause;
}

export function buildLotListSelect(includeITP: boolean): Prisma.LotSelect {
  const selectClause: Prisma.LotSelect = {
    id: true,
    lotNumber: true,
    description: true,
    status: true,
    activityType: true,
    chainageStart: true,
    chainageEnd: true,
    offset: true,
    offsetCustom: true,
    layer: true,
    areaZone: true,
    budgetAmount: true,
    assignedSubcontractorId: true,
    assignedSubcontractor: {
      select: {
        companyName: true,
      },
    },
    // Include subcontractor assignments with ITP permissions.
    subcontractorAssignments: {
      where: { status: 'active' },
      select: {
        id: true,
        subcontractorCompanyId: true,
        canCompleteITP: true,
        itpRequiresVerification: true,
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    },
    createdAt: true,
  };

  if (includeITP) {
    selectClause.itpInstance = {
      select: {
        id: true,
        templateId: true,
        status: true,
        template: {
          select: {
            id: true,
            name: true,
            activityType: true,
          },
        },
      },
    };
  }

  return selectClause;
}

export function buildLotListOrderBy(
  sortBy: string | undefined,
  sortOrder: Prisma.SortOrder,
): Prisma.LotOrderByWithRelationInput {
  return sortBy ? { [sortBy]: sortOrder } : { lotNumber: 'asc' };
}
