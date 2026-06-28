export type DocketNumericLike = number | string | { toString(): string } | null | undefined;

type ApprovedCostSource = {
  approvedCost?: DocketNumericLike;
  submittedCost: DocketNumericLike;
};

type DocketCostSource = {
  totalLabourSubmitted: DocketNumericLike;
  totalPlantSubmitted: DocketNumericLike;
  totalLabourApprovedCost?: DocketNumericLike;
  totalPlantApprovedCost?: DocketNumericLike;
};

type LotAllocationSource = {
  lotId: string;
  hours?: DocketNumericLike;
};

function numericValue(value: DocketNumericLike): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasNumericValue(value: DocketNumericLike): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return Number.isFinite(Number(value));
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function splitCostToCents(
  totalCost: number,
  allocations: LotAllocationSource[],
  allocationWeight: (allocation: LotAllocationSource) => number,
): Array<{ lotId: string; cost: number }> {
  const totalCents = toCents(totalCost);
  let assignedCents = 0;
  const baseSplits = allocations.map((allocation) => {
    const cents = Math.floor(allocationWeight(allocation) * totalCents);
    assignedCents += cents;
    return { lotId: allocation.lotId, cents };
  });

  let residualCents = totalCents - assignedCents;
  return baseSplits.map((split) => {
    const residual = residualCents > 0 ? 1 : 0;
    residualCents -= residual;
    return {
      lotId: split.lotId,
      cost: fromCents(split.cents + residual),
    };
  });
}

export function getApprovedOrSubmittedCost({
  approvedCost,
  submittedCost,
}: ApprovedCostSource): number {
  return hasNumericValue(approvedCost) ? numericValue(approvedCost) : numericValue(submittedCost);
}

export function getDocketCommercialCosts(docket: DocketCostSource): {
  labourCost: number;
  plantCost: number;
} {
  return {
    labourCost: getApprovedOrSubmittedCost({
      approvedCost: docket.totalLabourApprovedCost,
      submittedCost: docket.totalLabourSubmitted,
    }),
    plantCost: getApprovedOrSubmittedCost({
      approvedCost: docket.totalPlantApprovedCost,
      submittedCost: docket.totalPlantSubmitted,
    }),
  };
}

export function splitCostByLotAllocations({
  cost,
  allocations,
}: {
  cost: DocketNumericLike;
  allocations: LotAllocationSource[];
}): Array<{ lotId: string; cost: number }> {
  const totalCost = numericValue(cost);
  if (totalCost === 0 || allocations.length === 0) {
    return [];
  }

  const totalAllocatedHours = allocations.reduce(
    (sum, allocation) => sum + Math.max(0, numericValue(allocation.hours)),
    0,
  );

  if (totalAllocatedHours > 0) {
    return splitCostToCents(
      totalCost,
      allocations,
      (allocation) => Math.max(0, numericValue(allocation.hours)) / totalAllocatedHours,
    );
  }

  const equalWeight = 1 / allocations.length;
  return splitCostToCents(totalCost, allocations, () => equalWeight);
}
