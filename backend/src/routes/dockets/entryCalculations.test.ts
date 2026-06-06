import { describe, expect, it } from 'vitest';
import {
  buildLabourLotAllocationCreate,
  buildLabourLotAllocationRows,
  calculateHoursFromTimeRange,
  calculateLabourEntryCost,
  calculatePlantEntryCost,
  selectPlantHourlyRate,
} from './entryCalculations.js';

describe('docket entry calculations', () => {
  it('calculates labour hours for same-day and overnight shifts', () => {
    expect(calculateHoursFromTimeRange('07:30', '16:00')).toBe(8.5);
    expect(calculateHoursFromTimeRange('22:00', '02:30')).toBe(4.5);
  });

  it('uses the fallback hours when either labour time is missing', () => {
    expect(calculateHoursFromTimeRange(undefined, '16:00', 7.25)).toBe(7.25);
    expect(calculateHoursFromTimeRange('07:30', null, 6)).toBe(6);
  });

  it('calculates labour cost from numeric-ish rates', () => {
    expect(calculateLabourEntryCost(8.5, '85')).toBe(722.5);
    expect(calculateLabourEntryCost(8.5, null)).toBe(0);
  });

  it('builds labour lot allocation payloads without changing values', () => {
    const allocations = [
      { lotId: 'lot-1', hours: 3 },
      { lotId: 'lot-2', hours: 5.5 },
    ];

    expect(buildLabourLotAllocationCreate(allocations)).toEqual({ create: allocations });
    expect(buildLabourLotAllocationCreate([])).toBeUndefined();
    expect(buildLabourLotAllocationRows('labour-1', allocations)).toEqual([
      { docketLabourId: 'labour-1', lotId: 'lot-1', hours: 3 },
      { docketLabourId: 'labour-1', lotId: 'lot-2', hours: 5.5 },
    ]);
  });

  it('selects wet plant rates with dry fallback', () => {
    expect(selectPlantHourlyRate('wet', { wetRate: '200', dryRate: '150' })).toBe(200);
    expect(selectPlantHourlyRate('wet', { wetRate: null, dryRate: '150' })).toBe(150);
    expect(selectPlantHourlyRate('dry', { wetRate: '200', dryRate: '150' })).toBe(150);
  });

  it('calculates plant cost from selected rate and operated hours', () => {
    expect(calculatePlantEntryCost('8', 'wet', { wetRate: '200', dryRate: '150' })).toEqual({
      hours: 8,
      hourlyRate: 200,
      cost: 1600,
    });
  });
});
