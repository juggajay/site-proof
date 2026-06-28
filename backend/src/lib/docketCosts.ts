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
    return allocations.map((allocation) => ({
      lotId: allocation.lotId,
      cost: totalCost * (Math.max(0, numericValue(allocation.hours)) / totalAllocatedHours),
    }));
  }

  const equalShare = totalCost / allocations.length;
  return allocations.map((allocation) => ({
    lotId: allocation.lotId,
    cost: equalShare,
  }));
}
