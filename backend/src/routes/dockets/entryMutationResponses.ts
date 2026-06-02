type NumericLike = number | string | { toString(): string } | null | undefined;

type DocketRunningTotal = {
  hours: number;
  cost: number;
};

type DocketLabourEntryMutationSource = {
  id: string;
  employee: {
    id: string;
    name: string;
    role: string | null;
    hourlyRate: NumericLike;
  };
  startTime: string | null;
  finishTime: string | null;
  submittedHours: NumericLike;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
  lotAllocations: Array<{
    lotId: string;
    lot: { lotNumber: string };
    hours: NumericLike;
  }>;
};

type DocketPlantEntryMutationSource = {
  id: string;
  plant: {
    id: string;
    type: string;
    description: string | null;
    idRego: string | null;
    dryRate: NumericLike;
    wetRate: NumericLike;
  };
  hoursOperated: NumericLike;
  wetOrDry: string | null;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
};

export function buildDocketLabourEntryMutationResponse(
  entry: DocketLabourEntryMutationSource,
  runningTotal?: DocketRunningTotal,
) {
  const response = {
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
  };

  if (!runningTotal) {
    return response;
  }

  return {
    ...response,
    runningTotal: {
      hours: runningTotal.hours,
      cost: runningTotal.cost,
    },
  };
}

export function buildDocketPlantEntryMutationResponse(
  entry: DocketPlantEntryMutationSource,
  runningTotal?: DocketRunningTotal,
) {
  const response = {
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
  };

  if (!runningTotal) {
    return response;
  }

  return {
    ...response,
    runningTotal: {
      hours: runningTotal.hours,
      cost: runningTotal.cost,
    },
  };
}
