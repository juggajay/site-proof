export function buildProjectCostsResponse<TSubcontractorCost, TLotCost>({
  totalLabourCost,
  totalPlantCost,
  totalCost,
  budgetTotal,
  budgetVariance,
  approvedDockets,
  pendingDockets,
  subcontractorCosts,
  lotCosts,
}: {
  totalLabourCost: number;
  totalPlantCost: number;
  totalCost: number;
  budgetTotal: number;
  budgetVariance: number;
  approvedDockets: number;
  pendingDockets: number;
  subcontractorCosts: TSubcontractorCost[];
  lotCosts: TLotCost[];
}) {
  return {
    summary: {
      totalLabourCost,
      totalPlantCost,
      totalCost,
      budgetTotal,
      budgetVariance,
      approvedDockets,
      pendingDockets,
    },
    subcontractorCosts,
    lotCosts,
  };
}

export function buildProjectCreatedResponse<TProject>(project: TProject) {
  return { project };
}
