import { describe, expect, it } from 'vitest';
import {
  buildDocketLabourEntryMutationResponse,
  buildDocketPlantEntryMutationResponse,
} from './entryMutationResponses.js';

describe('entryMutationResponses', () => {
  const labourEntry = {
    id: 'labour-1',
    employee: {
      id: 'employee-1',
      name: 'Jane',
      role: 'Operator',
      hourlyRate: '85.50',
    },
    startTime: '07:00',
    finishTime: '15:30',
    submittedHours: '8.5',
    hourlyRate: '85.50',
    submittedCost: '726.75',
    lotAllocations: [
      {
        lotId: 'lot-1',
        lot: { lotNumber: 'EW-001' },
        hours: '8.5',
      },
    ],
  };

  const plantEntry = {
    id: 'plant-entry-1',
    plant: {
      id: 'plant-1',
      type: 'Excavator',
      description: '30t excavator',
      idRego: 'EX-001',
      dryRate: '120',
      wetRate: '180',
    },
    hoursOperated: '6.5',
    wetOrDry: null,
    hourlyRate: '120',
    submittedCost: '780',
    lotAllocations: [
      {
        lotId: 'lot-1',
        lot: { lotNumber: 'EW-001' },
        hours: '6.5',
      },
    ],
  };

  it('builds a created labour entry response with running totals', () => {
    expect(
      buildDocketLabourEntryMutationResponse(labourEntry, {
        hours: 8.5,
        cost: 726.75,
      }),
    ).toEqual({
      labourEntry: {
        id: 'labour-1',
        employee: {
          id: 'employee-1',
          name: 'Jane',
          role: 'Operator',
          hourlyRate: 85.5,
        },
        startTime: '07:00',
        finishTime: '15:30',
        submittedHours: 8.5,
        hourlyRate: 85.5,
        submittedCost: 726.75,
        lotAllocations: [{ lotId: 'lot-1', lotNumber: 'EW-001', hours: 8.5 }],
      },
      runningTotal: {
        hours: 8.5,
        cost: 726.75,
      },
    });
  });

  it('builds an updated labour entry response without running totals', () => {
    expect(buildDocketLabourEntryMutationResponse(labourEntry)).toEqual({
      labourEntry: {
        id: 'labour-1',
        employee: {
          id: 'employee-1',
          name: 'Jane',
          role: 'Operator',
          hourlyRate: 85.5,
        },
        startTime: '07:00',
        finishTime: '15:30',
        submittedHours: 8.5,
        hourlyRate: 85.5,
        submittedCost: 726.75,
        lotAllocations: [{ lotId: 'lot-1', lotNumber: 'EW-001', hours: 8.5 }],
      },
    });
  });

  it('builds a created plant entry response with running totals and dry fallback', () => {
    expect(
      buildDocketPlantEntryMutationResponse(plantEntry, {
        hours: 6.5,
        cost: 780,
      }),
    ).toEqual({
      plantEntry: {
        id: 'plant-entry-1',
        plant: {
          id: 'plant-1',
          type: 'Excavator',
          description: '30t excavator',
          idRego: 'EX-001',
          dryRate: 120,
          wetRate: 180,
        },
        hoursOperated: 6.5,
        wetOrDry: 'dry',
        hourlyRate: 120,
        submittedCost: 780,
        lotAllocations: [{ lotId: 'lot-1', lotNumber: 'EW-001', hours: 6.5 }],
      },
      runningTotal: {
        hours: 6.5,
        cost: 780,
      },
    });
  });

  it('builds an updated plant entry response without running totals', () => {
    expect(buildDocketPlantEntryMutationResponse(plantEntry)).toEqual({
      plantEntry: {
        id: 'plant-entry-1',
        plant: {
          id: 'plant-1',
          type: 'Excavator',
          description: '30t excavator',
          idRego: 'EX-001',
          dryRate: 120,
          wetRate: 180,
        },
        hoursOperated: 6.5,
        wetOrDry: 'dry',
        hourlyRate: 120,
        submittedCost: 780,
        lotAllocations: [{ lotId: 'lot-1', lotNumber: 'EW-001', hours: 6.5 }],
      },
    });
  });
});
