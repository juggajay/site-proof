import { describe, expect, it } from 'vitest';
import {
  mapDocketLabourEntry,
  mapDocketPlantEntry,
  sumDocketLabourTotals,
  sumDocketPlantTotals,
  type DocketLabourEntrySource,
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
});
