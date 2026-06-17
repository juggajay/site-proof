import { describe, expect, it } from 'vitest';
import { buildLotListOrderBy, buildLotListSelect, buildLotListWhere } from './listQuery.js';

describe('buildLotListWhere', () => {
  it('returns the base where clause unchanged when no search is provided', () => {
    const where = { projectId: 'project-1', status: 'conformed' };

    expect(buildLotListWhere(where, undefined)).toBe(where);
  });

  it('adds the existing six-field insensitive search OR when search is provided', () => {
    expect(buildLotListWhere({ projectId: 'project-1' }, 'bridge')).toEqual({
      AND: [
        { projectId: 'project-1' },
        {
          OR: [
            { lotNumber: { contains: 'bridge', mode: 'insensitive' } },
            { description: { contains: 'bridge', mode: 'insensitive' } },
            { activityType: { contains: 'bridge', mode: 'insensitive' } },
            { areaZone: { contains: 'bridge', mode: 'insensitive' } },
            { structureId: { contains: 'bridge', mode: 'insensitive' } },
            { structureElement: { contains: 'bridge', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });
});

describe('buildLotListSelect', () => {
  it('builds the base lot list select without ITP data', () => {
    const select = buildLotListSelect(false);

    expect(Object.keys(select)).toEqual([
      'id',
      'lotNumber',
      'description',
      'status',
      'activityType',
      'chainageStart',
      'chainageEnd',
      'offset',
      'offsetCustom',
      'layer',
      'areaZone',
      'budgetAmount',
      'assignedSubcontractorId',
      'assignedSubcontractor',
      'subcontractorAssignments',
      'createdAt',
    ]);
    expect(select.itpInstance).toBeUndefined();
    expect(select.subcontractorAssignments).toEqual({
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
    });
  });

  it('adds the singular ITP instance select only when requested', () => {
    expect(buildLotListSelect(true).itpInstance).toEqual({
      select: {
        id: true,
        templateId: true,
        status: true,
        templateSnapshot: true,
        completions: {
          select: {
            checklistItemId: true,
            status: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            activityType: true,
            checklistItems: {
              select: {
                id: true,
                sequenceNumber: true,
              },
            },
          },
        },
      },
    });
  });
});

describe('buildLotListOrderBy', () => {
  it('defaults to lotNumber ascending', () => {
    expect(buildLotListOrderBy(undefined, 'desc')).toEqual({ lotNumber: 'asc' });
  });

  it('uses the requested sort field and order', () => {
    expect(buildLotListOrderBy('createdAt', 'desc')).toEqual({ createdAt: 'desc' });
  });
});
