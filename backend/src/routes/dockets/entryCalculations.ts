export type DocketLotAllocationInput = {
  lotId: string;
  hours: number;
};

export function calculateHoursFromTimeRange(
  startTime: string | null | undefined,
  finishTime: string | null | undefined,
  fallbackHours = 0,
): number {
  if (!startTime || !finishTime) {
    return fallbackHours;
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [finishH, finishM] = finishTime.split(':').map(Number);
  let hours = finishH + finishM / 60 - (startH + startM / 60);
  if (hours < 0) hours += 24; // Handle overnight shifts
  return hours;
}

export function calculateLabourEntryCost(hours: number, hourlyRate: unknown): number {
  return roundDocketAmountToCents(hours * (Number(hourlyRate) || 0));
}

/** Round docket money to cents before writing to DECIMAL columns. */
export function roundDocketAmountToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(`${Math.round(Number(`${value}e2`))}e-2`);
}

export function buildLabourLotAllocationCreate(lotAllocations?: DocketLotAllocationInput[]):
  | {
      create: DocketLotAllocationInput[];
    }
  | undefined {
  return lotAllocations?.length ? { create: lotAllocations } : undefined;
}

export function buildLabourLotAllocationRows(
  docketLabourId: string,
  lotAllocations: DocketLotAllocationInput[],
): Array<DocketLotAllocationInput & { docketLabourId: string }> {
  return lotAllocations.map((alloc) => ({
    docketLabourId,
    lotId: alloc.lotId,
    hours: alloc.hours,
  }));
}

export function selectPlantHourlyRate(
  wetOrDry: string | null | undefined,
  rates: { dryRate: unknown; wetRate: unknown },
): number {
  return wetOrDry === 'wet'
    ? Number(rates.wetRate) || Number(rates.dryRate) || 0
    : Number(rates.dryRate) || 0;
}

export function calculatePlantEntryCost(
  hoursOperated: unknown,
  wetOrDry: string | null | undefined,
  rates: { dryRate: unknown; wetRate: unknown },
): { hours: number; hourlyRate: number; cost: number } {
  const hours = Number(hoursOperated);
  const hourlyRate = selectPlantHourlyRate(wetOrDry, rates);
  return {
    hours,
    hourlyRate,
    cost: roundDocketAmountToCents(hours * hourlyRate),
  };
}
