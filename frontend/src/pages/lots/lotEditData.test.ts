import { describe, expect, it } from 'vitest';
import type { OfflineLotEdit } from '@/lib/offlineDb';
import {
  buildLotDetailPath,
  buildLotUpdatePayload,
  buildOfflineLotCacheInput,
  buildOfflineLotEditInput,
  buildProjectSubcontractorsPath,
  deriveLotEditLocks,
  getOptionalDecimalValidationError,
  mapLotToFormData,
  mapOfflineLotToFormData,
  mapOfflineLotToLot,
  normalizeSubcontractors,
  type Lot,
  type LotEditFormData,
} from './lotEditData';

const baseLot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Test lot',
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: 10.5,
  chainageEnd: 20.75,
  offset: 'left',
  offsetCustom: null,
  layer: 'subgrade',
  areaZone: 'Zone A',
  budgetAmount: 1250.25,
  assignedSubcontractorId: 'sub-9',
};

const baseForm: LotEditFormData = {
  lotNumber: 'LOT-001',
  description: 'Test lot',
  activityType: 'Earthworks',
  chainageStart: '10.5',
  chainageEnd: '20.75',
  offset: 'left',
  offsetCustom: '',
  layer: 'subgrade',
  areaZone: 'Zone A',
  status: 'in_progress',
  budgetAmount: '1250.25',
  assignedSubcontractorId: 'sub-9',
};

const baseOfflineLot: OfflineLotEdit = {
  id: 'lot-1',
  projectId: 'proj-1',
  lotNumber: 'LOT-001',
  description: 'Offline lot',
  chainageStart: 10,
  chainageEnd: 20,
  offset: 2.5,
  layer: 'base',
  areaZone: 'Zone B',
  activityType: 'Drainage',
  status: 'awaiting_test',
  budget: 999,
  syncStatus: 'pending',
  localUpdatedAt: '2026-06-01T00:00:00.000Z',
  editedBy: 'user-1',
};

describe('path builders', () => {
  it('builds the lot detail path without encoding (byte-identical to the original)', () => {
    expect(buildLotDetailPath('lot-1')).toBe('/api/lots/lot-1');
  });

  it('builds the project subcontractors path without encoding', () => {
    expect(buildProjectSubcontractorsPath('proj-1')).toBe('/api/subcontractors/for-project/proj-1');
  });
});

describe('getOptionalDecimalValidationError', () => {
  it('returns null for an empty / whitespace value', () => {
    expect(getOptionalDecimalValidationError('', 'Chainage start')).toBeNull();
    expect(getOptionalDecimalValidationError('   ', 'Chainage start')).toBeNull();
  });

  it('returns null for a valid non-negative decimal', () => {
    expect(getOptionalDecimalValidationError('250.5', 'Chainage start')).toBeNull();
    expect(getOptionalDecimalValidationError('0', 'Budget amount')).toBeNull();
  });

  it('returns a labelled message for invalid input (scientific notation, negative, text)', () => {
    expect(getOptionalDecimalValidationError('1e2', 'Chainage start')).toBe(
      'Chainage start must be a non-negative decimal number.',
    );
    expect(getOptionalDecimalValidationError('-5', 'Budget amount')).toBe(
      'Budget amount must be a non-negative decimal number.',
    );
    expect(getOptionalDecimalValidationError('abc', 'Chainage end')).toBe(
      'Chainage end must be a non-negative decimal number.',
    );
  });
});

describe('mapLotToFormData', () => {
  it('coerces a fully populated lot into string form fields', () => {
    expect(mapLotToFormData(baseLot)).toEqual(baseForm);
  });

  it('maps nulls to empty strings and keeps "0" for zero numbers', () => {
    const lot: Lot = {
      ...baseLot,
      description: null,
      activityType: null,
      chainageStart: 0,
      chainageEnd: null,
      offset: null,
      offsetCustom: null,
      layer: null,
      areaZone: null,
      status: '',
      budgetAmount: null,
      assignedSubcontractorId: null,
    };
    expect(mapLotToFormData(lot)).toEqual({
      lotNumber: 'LOT-001',
      description: '',
      activityType: '',
      chainageStart: '0',
      chainageEnd: '',
      offset: '',
      offsetCustom: '',
      layer: '',
      areaZone: '',
      status: '',
      budgetAmount: '',
      assignedSubcontractorId: '',
    });
  });
});

describe('mapOfflineLotToFormData', () => {
  it('stringifies the numeric offset and always blanks offsetCustom / subcontractor', () => {
    expect(mapOfflineLotToFormData(baseOfflineLot)).toEqual({
      lotNumber: 'LOT-001',
      description: 'Offline lot',
      activityType: 'Drainage',
      chainageStart: '10',
      chainageEnd: '20',
      offset: '2.5',
      offsetCustom: '',
      layer: 'base',
      areaZone: 'Zone B',
      status: 'awaiting_test',
      budgetAmount: '999',
      assignedSubcontractorId: '',
    });
  });

  it('defaults the offset to "" when undefined and uses "" (not not_started) for status', () => {
    const result = mapOfflineLotToFormData({
      ...baseOfflineLot,
      offset: undefined,
      status: undefined,
    });
    expect(result.offset).toBe('');
    expect(result.status).toBe('');
  });
});

describe('mapOfflineLotToLot', () => {
  it('maps offline fields and defaults status to not_started (distinct from the form default)', () => {
    expect(mapOfflineLotToLot(baseOfflineLot)).toEqual({
      id: 'lot-1',
      lotNumber: 'LOT-001',
      description: 'Offline lot',
      status: 'awaiting_test',
      activityType: 'Drainage',
      chainageStart: 10,
      chainageEnd: 20,
      offset: '2.5',
      offsetCustom: null,
      layer: 'base',
      areaZone: 'Zone B',
      budgetAmount: 999,
      assignedSubcontractorId: null,
    });
  });

  it('falls back to not_started status and null offset when missing', () => {
    const result = mapOfflineLotToLot({
      ...baseOfflineLot,
      status: undefined,
      offset: undefined,
      budget: undefined,
    });
    expect(result.status).toBe('not_started');
    expect(result.offset).toBeNull();
    expect(result.budgetAmount).toBeUndefined();
  });
});

describe('buildOfflineLotCacheInput', () => {
  it('maps a loaded lot to the cache input, converting nulls to undefined', () => {
    expect(buildOfflineLotCacheInput(baseLot, 'proj-7')).toEqual({
      id: 'lot-1',
      projectId: 'proj-7',
      lotNumber: 'LOT-001',
      description: 'Test lot',
      chainageStart: 10.5,
      chainageEnd: 20.75,
      layer: 'subgrade',
      areaZone: 'Zone A',
      activityType: 'Earthworks',
      status: 'in_progress',
      budget: 1250.25,
    });
  });

  it('drops null fields to undefined', () => {
    const result = buildOfflineLotCacheInput(
      { ...baseLot, description: null, layer: null, budgetAmount: null },
      'proj-7',
    );
    expect(result.description).toBeUndefined();
    expect(result.layer).toBeUndefined();
    expect(result.budget).toBeUndefined();
  });
});

describe('buildOfflineLotEditInput', () => {
  it('shapes the offline edit record with pending status and a parsed offset', () => {
    const result = buildOfflineLotEditInput({
      lotId: 'lot-1',
      projectId: 'proj-1',
      formData: { ...baseForm, offset: '2.5' },
      parsedChainageStart: 10.5,
      parsedChainageEnd: 20.75,
      parsedBudgetAmount: 1250.25,
      serverUpdatedAt: '2026-01-15T00:00:00.000Z',
      userId: 'user-1',
    });

    expect(result).toMatchObject({
      id: 'lot-1',
      projectId: 'proj-1',
      lotNumber: 'LOT-001',
      description: 'Test lot',
      chainage: 10.5,
      chainageStart: 10.5,
      chainageEnd: 20.75,
      offset: 2.5,
      layer: 'subgrade',
      areaZone: 'Zone A',
      activityType: 'Earthworks',
      status: 'in_progress',
      budget: 1250.25,
      notes: undefined,
      syncStatus: 'pending',
      serverUpdatedAt: '2026-01-15T00:00:00.000Z',
      editedBy: 'user-1',
    });
    expect(typeof result.localUpdatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(result.localUpdatedAt))).toBe(false);
  });

  it('converts blank strings / null numbers to undefined and a blank offset stays undefined', () => {
    const result = buildOfflineLotEditInput({
      lotId: 'lot-1',
      projectId: 'proj-1',
      formData: {
        ...baseForm,
        description: '',
        layer: '',
        areaZone: '',
        activityType: '',
        status: '',
        offset: '',
      },
      parsedChainageStart: null,
      parsedChainageEnd: null,
      parsedBudgetAmount: null,
      serverUpdatedAt: null,
      userId: 'user-1',
    });

    expect(result.description).toBeUndefined();
    expect(result.layer).toBeUndefined();
    expect(result.areaZone).toBeUndefined();
    expect(result.activityType).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.offset).toBeUndefined();
    expect(result.chainage).toBeUndefined();
    expect(result.chainageStart).toBeUndefined();
    expect(result.chainageEnd).toBeUndefined();
    expect(result.budget).toBeUndefined();
    expect(result.serverUpdatedAt).toBeUndefined();
  });
});

describe('buildLotUpdatePayload', () => {
  it('builds the full payload in normal mode with budget access', () => {
    expect(
      buildLotUpdatePayload({
        formData: baseForm,
        parsedChainageStart: 10.5,
        parsedChainageEnd: 20.75,
        parsedBudgetAmount: 1250.25,
        isConformedBudgetOnlyMode: false,
        canViewBudgets: true,
        serverUpdatedAt: '2026-01-15T00:00:00.000Z',
      }),
    ).toEqual({
      lotNumber: 'LOT-001',
      description: 'Test lot',
      activityType: 'Earthworks',
      chainageStart: 10.5,
      chainageEnd: 20.75,
      offset: 'left',
      offsetCustom: null,
      layer: 'subgrade',
      areaZone: 'Zone A',
      status: 'in_progress',
      budgetAmount: 1250.25,
      assignedSubcontractorId: 'sub-9',
      expectedUpdatedAt: '2026-01-15T00:00:00.000Z',
    });
  });

  it('includes a custom offset value only when offset is "custom"', () => {
    const custom = buildLotUpdatePayload({
      formData: { ...baseForm, offset: 'custom', offsetCustom: '+2.5m CL' },
      parsedChainageStart: null,
      parsedChainageEnd: null,
      parsedBudgetAmount: null,
      isConformedBudgetOnlyMode: false,
      canViewBudgets: false,
      serverUpdatedAt: null,
    });
    expect(custom.offset).toBe('custom');
    expect(custom.offsetCustom).toBe('+2.5m CL');
  });

  it('omits budget and subcontractor fields when the user lacks budget access', () => {
    const payload = buildLotUpdatePayload({
      formData: baseForm,
      parsedChainageStart: 10.5,
      parsedChainageEnd: 20.75,
      parsedBudgetAmount: 1250.25,
      isConformedBudgetOnlyMode: false,
      canViewBudgets: false,
      serverUpdatedAt: null,
    });
    expect(payload).not.toHaveProperty('budgetAmount');
    expect(payload).not.toHaveProperty('assignedSubcontractorId');
    expect(payload).not.toHaveProperty('expectedUpdatedAt');
  });

  it('omits budgetAmount when budget is blank in normal mode even with access', () => {
    const payload = buildLotUpdatePayload({
      formData: baseForm,
      parsedChainageStart: null,
      parsedChainageEnd: null,
      parsedBudgetAmount: null,
      isConformedBudgetOnlyMode: false,
      canViewBudgets: true,
      serverUpdatedAt: null,
    });
    expect(payload).not.toHaveProperty('budgetAmount');
    expect(payload.assignedSubcontractorId).toBe('sub-9');
  });

  it('sends ONLY budgetAmount + expectedUpdatedAt in conformed-budget-only mode', () => {
    // Mirrors the lots.spec.ts E2E contract exactly.
    expect(
      buildLotUpdatePayload({
        formData: { ...baseForm, status: 'conformed', budgetAmount: '48000' },
        parsedChainageStart: null,
        parsedChainageEnd: null,
        parsedBudgetAmount: 48000,
        isConformedBudgetOnlyMode: true,
        canViewBudgets: true,
        serverUpdatedAt: '2026-01-15T00:00:00.000Z',
      }),
    ).toEqual({
      budgetAmount: 48000,
      expectedUpdatedAt: '2026-01-15T00:00:00.000Z',
    });
  });
});

describe('deriveLotEditLocks', () => {
  it('locks everything for a claimed lot', () => {
    expect(deriveLotEditLocks({ ...baseLot, status: 'claimed' }, true)).toEqual({
      isClaimed: true,
      isConformed: false,
      canEditConformedBudget: false,
      detailsLocked: true,
      budgetLocked: true,
      canSubmit: false,
    });
  });

  it('allows budget repair on a conformed lot when the user can view budgets', () => {
    expect(deriveLotEditLocks({ ...baseLot, status: 'conformed' }, true)).toEqual({
      isClaimed: false,
      isConformed: true,
      canEditConformedBudget: true,
      detailsLocked: true,
      budgetLocked: false,
      canSubmit: true,
    });
  });

  it('fully locks a conformed lot when the user cannot view budgets', () => {
    expect(deriveLotEditLocks({ ...baseLot, status: 'conformed' }, false)).toEqual({
      isClaimed: false,
      isConformed: true,
      canEditConformedBudget: false,
      detailsLocked: true,
      budgetLocked: true,
      canSubmit: false,
    });
  });

  it('leaves an in-progress lot fully editable and submittable', () => {
    expect(deriveLotEditLocks({ ...baseLot, status: 'in_progress' }, true)).toEqual({
      isClaimed: false,
      isConformed: false,
      canEditConformedBudget: false,
      detailsLocked: false,
      budgetLocked: false,
      canSubmit: true,
    });
  });
});

describe('normalizeSubcontractors', () => {
  it('returns the subcontractors array', () => {
    const subs = [{ id: 's1', companyName: 'Acme', status: 'approved' }];
    expect(normalizeSubcontractors({ subcontractors: subs })).toBe(subs);
  });

  it('returns an empty array when the field is missing', () => {
    expect(normalizeSubcontractors({} as never)).toEqual([]);
  });
});
