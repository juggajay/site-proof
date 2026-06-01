import { describe, expect, it } from 'vitest';
import {
  mapDocketLabourEntry,
  mapDocketListItem,
  mapDocketPlantEntry,
  sumDocketLabourTotals,
  sumDocketPlantTotals,
  type DocketLabourEntrySource,
  type DocketListItemSource,
  type DocketPlantEntrySource,
} from './presentation.js';

const labourSource: DocketLabourEntrySource = {
  id: 'lab-1',
  employee: { id: 'emp-1', name: 'Alice', role: 'Carpenter', hourlyRate: 50 },
  startTime: '07:00',
  finishTime: '15:30',
  submittedHours: 8,
  approvedHours: 7.5,
  hourlyRate: 50,
  submittedCost: 400,
  approvedCost: 375,
  adjustmentReason: 'rounded down',
  lotAllocations: [
    { lotId: 'lot-1', lot: { lotNumber: 'L-100' }, hours: 5 },
    { lotId: 'lot-2', lot: { lotNumber: 'L-200' }, hours: 3 },
  ],
};

const plantSource: DocketPlantEntrySource = {
  id: 'pl-1',
  plant: {
    id: 'p-1',
    type: 'Excavator',
    description: '20t',
    idRego: 'ABC123',
    dryRate: 120,
    wetRate: 150,
  },
  hoursOperated: 6,
  wetOrDry: 'wet',
  hourlyRate: 150,
  submittedCost: 900,
  approvedCost: 880,
  adjustmentReason: 'fuel adjusted',
};

const listSource: DocketListItemSource = {
  id: 'abc123def456',
  subcontractorCompany: { id: 'sc-1', companyName: 'Acme Concreting' },
  date: new Date('2026-03-04T10:00:00.000Z'),
  status: 'submitted',
  notes: 'site notes',
  labourEntries: [{ submittedHours: 8 }, { submittedHours: 4.5 }],
  plantEntries: [{ hoursOperated: 6 }, { hoursOperated: 2 }],
  totalLabourSubmitted: 600,
  totalLabourApproved: 550,
  totalPlantSubmitted: 800,
  totalPlantApproved: 780,
  submittedAt: new Date('2026-03-05T01:00:00.000Z'),
  approvedAt: new Date('2026-03-06T02:00:00.000Z'),
  foremanNotes: 'approved with notes',
};

describe('dockets presentation helpers (pure)', () => {
  describe('mapDocketLabourEntry', () => {
    it('maps the entry and omits adjustmentReason by default (detail-route shape)', () => {
      const result = mapDocketLabourEntry(labourSource);
      expect(result).toStrictEqual({
        id: 'lab-1',
        employee: { id: 'emp-1', name: 'Alice', role: 'Carpenter', hourlyRate: 50 },
        startTime: '07:00',
        finishTime: '15:30',
        submittedHours: 8,
        approvedHours: 7.5,
        hourlyRate: 50,
        submittedCost: 400,
        approvedCost: 375,
        lotAllocations: [
          { lotId: 'lot-1', lotNumber: 'L-100', hours: 5 },
          { lotId: 'lot-2', lotNumber: 'L-200', hours: 3 },
        ],
      });
      expect('adjustmentReason' in result).toBe(false);
    });

    it('includes adjustmentReason when requested (per-entry-route shape)', () => {
      const result = mapDocketLabourEntry(labourSource, { includeAdjustmentReason: true });
      expect('adjustmentReason' in result).toBe(true);
      expect((result as { adjustmentReason: string | null }).adjustmentReason).toBe('rounded down');
      // adjustmentReason sits between approvedCost and lotAllocations, as in the route.
      expect(Object.keys(result)).toEqual([
        'id',
        'employee',
        'startTime',
        'finishTime',
        'submittedHours',
        'approvedHours',
        'hourlyRate',
        'submittedCost',
        'approvedCost',
        'adjustmentReason',
        'lotAllocations',
      ]);
    });

    it('coerces null/undefined numerics to 0 and passes nullable strings through', () => {
      const result = mapDocketLabourEntry({
        id: 'lab-2',
        employee: { id: 'emp-2', name: 'Bob', role: null, hourlyRate: null },
        startTime: null,
        finishTime: null,
        submittedHours: null,
        approvedHours: undefined,
        hourlyRate: null,
        submittedCost: undefined,
        approvedCost: null,
        adjustmentReason: null,
        lotAllocations: [{ lotId: 'lot-3', lot: { lotNumber: 'L-300' }, hours: null }],
      });
      expect(result).toStrictEqual({
        id: 'lab-2',
        employee: { id: 'emp-2', name: 'Bob', role: null, hourlyRate: 0 },
        startTime: null,
        finishTime: null,
        submittedHours: 0,
        approvedHours: 0,
        hourlyRate: 0,
        submittedCost: 0,
        approvedCost: 0,
        lotAllocations: [{ lotId: 'lot-3', lotNumber: 'L-300', hours: 0 }],
      });
    });
  });

  describe('mapDocketPlantEntry', () => {
    it('maps the entry and omits adjustmentReason by default (detail-route shape)', () => {
      const result = mapDocketPlantEntry(plantSource);
      expect(result).toStrictEqual({
        id: 'pl-1',
        plant: {
          id: 'p-1',
          type: 'Excavator',
          description: '20t',
          idRego: 'ABC123',
          dryRate: 120,
          wetRate: 150,
        },
        hoursOperated: 6,
        wetOrDry: 'wet',
        hourlyRate: 150,
        submittedCost: 900,
        approvedCost: 880,
      });
      expect('adjustmentReason' in result).toBe(false);
    });

    it('includes adjustmentReason when requested (per-entry-route shape)', () => {
      const result = mapDocketPlantEntry(plantSource, { includeAdjustmentReason: true });
      expect('adjustmentReason' in result).toBe(true);
      expect((result as { adjustmentReason: string | null }).adjustmentReason).toBe(
        'fuel adjusted',
      );
      expect(Object.keys(result)).toEqual([
        'id',
        'plant',
        'hoursOperated',
        'wetOrDry',
        'hourlyRate',
        'submittedCost',
        'approvedCost',
        'adjustmentReason',
      ]);
    });

    it('falls back wetOrDry to "dry" when null and coerces null/undefined numerics to 0', () => {
      const result = mapDocketPlantEntry({
        id: 'pl-2',
        plant: {
          id: 'p-2',
          type: 'Roller',
          description: null,
          idRego: null,
          dryRate: null,
          wetRate: undefined,
        },
        hoursOperated: null,
        wetOrDry: null,
        hourlyRate: undefined,
        submittedCost: null,
        approvedCost: null,
        adjustmentReason: null,
      });
      expect(result).toStrictEqual({
        id: 'pl-2',
        plant: {
          id: 'p-2',
          type: 'Roller',
          description: null,
          idRego: null,
          dryRate: 0,
          wetRate: 0,
        },
        hoursOperated: 0,
        wetOrDry: 'dry',
        hourlyRate: 0,
        submittedCost: 0,
        approvedCost: 0,
      });
    });
  });

  describe('sumDocketLabourTotals', () => {
    it('sums submitted/approved hours and costs across entries', () => {
      expect(
        sumDocketLabourTotals([
          { submittedHours: 8, submittedCost: 400, approvedHours: 7, approvedCost: 350 },
          { submittedHours: 4, submittedCost: 200, approvedHours: 4, approvedCost: 200 },
        ]),
      ).toEqual({ submittedHours: 12, submittedCost: 600, approvedHours: 11, approvedCost: 550 });
    });

    it('returns zeros for an empty list', () => {
      expect(sumDocketLabourTotals([])).toEqual({
        submittedHours: 0,
        submittedCost: 0,
        approvedHours: 0,
        approvedCost: 0,
      });
    });

    it('matches the route pipeline when fed mapped entries', () => {
      const mapped = [labourSource].map((e) =>
        mapDocketLabourEntry(e, { includeAdjustmentReason: true }),
      );
      expect(sumDocketLabourTotals(mapped)).toEqual({
        submittedHours: 8,
        submittedCost: 400,
        approvedHours: 7.5,
        approvedCost: 375,
      });
    });
  });

  describe('sumDocketPlantTotals', () => {
    it('sums hours operated and submitted/approved costs across entries', () => {
      expect(
        sumDocketPlantTotals([
          { hoursOperated: 6, submittedCost: 300, approvedCost: 280 },
          { hoursOperated: 2, submittedCost: 100, approvedCost: 100 },
        ]),
      ).toEqual({ hours: 8, submittedCost: 400, approvedCost: 380 });
    });

    it('returns zeros for an empty list', () => {
      expect(sumDocketPlantTotals([])).toEqual({ hours: 0, submittedCost: 0, approvedCost: 0 });
    });
  });

  describe('mapDocketListItem', () => {
    it('maps a docket row into the GET /api/dockets list shape (fields + order)', () => {
      const result = mapDocketListItem(listSource);
      expect(result).toStrictEqual({
        id: 'abc123def456',
        docketNumber: 'DKT-ABC123', // DKT- + first 6 chars uppercased
        subcontractor: 'Acme Concreting',
        subcontractorId: 'sc-1',
        date: '2026-03-04', // formatDocketDate -> ISO (UTC) date part
        status: 'submitted',
        notes: 'site notes',
        labourHours: 12.5, // 8 + 4.5
        plantHours: 8, // 6 + 2
        totalLabourSubmitted: 600,
        totalLabourApproved: 550,
        totalPlantSubmitted: 800,
        totalPlantApproved: 780,
        submittedAt: listSource.submittedAt, // Date passed through unchanged
        approvedAt: listSource.approvedAt,
        foremanNotes: 'approved with notes',
      });
      // Lock the response key order to the route's original object literal.
      expect(Object.keys(result)).toEqual([
        'id',
        'docketNumber',
        'subcontractor',
        'subcontractorId',
        'date',
        'status',
        'notes',
        'labourHours',
        'plantHours',
        'totalLabourSubmitted',
        'totalLabourApproved',
        'totalPlantSubmitted',
        'totalPlantApproved',
        'submittedAt',
        'approvedAt',
        'foremanNotes',
      ]);
    });

    it('coerces labour/plant hours and stored totals numerically, defaulting missing/invalid to 0', () => {
      const result = mapDocketListItem({
        id: 'lower-id',
        subcontractorCompany: { id: 'sc-2', companyName: 'Beta Earthworks' },
        date: new Date('2026-01-01T00:00:00.000Z'),
        status: 'draft',
        notes: null,
        labourEntries: [
          { submittedHours: null },
          { submittedHours: undefined },
          { submittedHours: '3' }, // numeric strings convert
          { submittedHours: 'abc' }, // invalid -> 0
        ],
        plantEntries: [{ hoursOperated: null }, { hoursOperated: '2.5' }],
        totalLabourSubmitted: null,
        totalLabourApproved: undefined,
        totalPlantSubmitted: null,
        totalPlantApproved: 'oops',
        submittedAt: null,
        approvedAt: null,
        foremanNotes: null,
      });
      expect(result.labourHours).toBe(3); // 0 + 0 + 3 + 0
      expect(result.plantHours).toBe(2.5); // 0 + 2.5
      expect(result.totalLabourSubmitted).toBe(0);
      expect(result.totalLabourApproved).toBe(0);
      expect(result.totalPlantSubmitted).toBe(0);
      expect(result.totalPlantApproved).toBe(0);
      // Nullable optional fields pass through untouched.
      expect(result.notes).toBeNull();
      expect(result.foremanNotes).toBeNull();
      expect(result.submittedAt).toBeNull();
      expect(result.approvedAt).toBeNull();
    });

    it('preserves subcontractor id/name and applies docket-number + date formatting', () => {
      const result = mapDocketListItem({
        ...listSource,
        id: 'ff00aa-extra',
        date: new Date('2026-12-31T23:30:00.000Z'),
      });
      expect(result.subcontractor).toBe('Acme Concreting');
      expect(result.subcontractorId).toBe('sc-1');
      expect(result.docketNumber).toBe('DKT-FF00AA');
      expect(result.date).toBe('2026-12-31'); // UTC-based, TZ-stable
    });
  });
});
