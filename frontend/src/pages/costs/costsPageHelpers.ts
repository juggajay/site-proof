// Pure data/presentation helpers for CostsPage, moved verbatim from
// CostsPage.tsx: the cost report types, the empty-summary default, AUD
// currency formatting, search/over-budget filtering, the subcontractor totals
// reducer, and the CSV row builder for the export report. The downloadCsv
// side effect (and its dated filename) stays in the page.

export interface CostSummary {
  totalLabourCost: number;
  totalPlantCost: number;
  totalCost: number;
  budgetTotal: number;
  budgetVariance: number;
  approvedDockets: number;
  pendingDockets: number;
}

export interface SubcontractorCost {
  id: string;
  companyName: string;
  labourCost: number;
  plantCost: number;
  totalCost: number;
  approvedDockets: number;
}

export interface LotCost {
  id: string;
  lotNumber: string;
  activity: string;
  budgetAmount: number;
  actualCost: number;
  variance: number;
}

export interface CostData {
  summary?: CostSummary | null;
  subcontractorCosts?: SubcontractorCost[];
  lotCosts?: LotCost[];
}

export interface SubcontractorCostTotals {
  labourCost: number;
  plantCost: number;
  totalCost: number;
  approvedDockets: number;
}

export function createEmptyCostSummary(): CostSummary {
  return {
    totalLabourCost: 0,
    totalPlantCost: 0,
    totalCost: 0,
    budgetTotal: 0,
    budgetVariance: 0,
    approvedDockets: 0,
    pendingDockets: 0,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Returns the input array untouched when there is no search so memoized
// callers keep their referential identity, matching the previous inline memo.
export function filterSubcontractorCosts(
  subcontractorCosts: SubcontractorCost[],
  normalizedSearch: string,
): SubcontractorCost[] {
  if (!normalizedSearch) return subcontractorCosts;
  return subcontractorCosts.filter((sub) =>
    sub.companyName.toLowerCase().includes(normalizedSearch),
  );
}

export function filterLotCosts(
  lotCosts: LotCost[],
  normalizedSearch: string,
  showOverBudgetOnly: boolean,
): LotCost[] {
  return lotCosts.filter((lot) => {
    const matchesSearch =
      !normalizedSearch ||
      lot.lotNumber.toLowerCase().includes(normalizedSearch) ||
      lot.activity.toLowerCase().includes(normalizedSearch);
    const matchesBudget = !showOverBudgetOnly || lot.variance < 0;
    return matchesSearch && matchesBudget;
  });
}

export function sumSubcontractorCosts(
  subcontractorCosts: SubcontractorCost[],
): SubcontractorCostTotals {
  return subcontractorCosts.reduce(
    (totals, sub) => ({
      labourCost: totals.labourCost + sub.labourCost,
      plantCost: totals.plantCost + sub.plantCost,
      totalCost: totals.totalCost + sub.totalCost,
      approvedDockets: totals.approvedDockets + sub.approvedDockets,
    }),
    { labourCost: 0, plantCost: 0, totalCost: 0, approvedDockets: 0 },
  );
}

export function buildCostReportRows(
  summary: CostSummary,
  subcontractorCosts: SubcontractorCost[],
  lotCosts: LotCost[],
): string[][] {
  const rows: string[][] = [];

  // Header
  rows.push(['Project Cost Report']);
  rows.push([`Generated: ${new Date().toLocaleDateString('en-AU')}`]);
  rows.push([]);

  // Summary section
  rows.push(['COST SUMMARY']);
  rows.push(['Metric', 'Value']);
  rows.push(['Total Cost', formatCurrency(summary.totalCost)]);
  rows.push(['Labour Cost', formatCurrency(summary.totalLabourCost)]);
  rows.push(['Plant Cost', formatCurrency(summary.totalPlantCost)]);
  rows.push(['Budget Total', formatCurrency(summary.budgetTotal)]);
  rows.push(['Budget Variance', formatCurrency(summary.budgetVariance)]);
  rows.push(['Approved Dockets', summary.approvedDockets.toString()]);
  rows.push(['Pending Dockets', summary.pendingDockets.toString()]);
  rows.push([]);

  // Subcontractor costs section
  rows.push(['COSTS BY SUBCONTRACTOR']);
  rows.push(['Subcontractor', 'Labour Cost', 'Plant Cost', 'Total Cost', 'Approved Dockets']);
  subcontractorCosts.forEach((sub) => {
    rows.push([
      sub.companyName,
      formatCurrency(sub.labourCost),
      formatCurrency(sub.plantCost),
      formatCurrency(sub.totalCost),
      sub.approvedDockets.toString(),
    ]);
  });
  rows.push([]);

  // Lot costs section
  rows.push(['COSTS BY LOT']);
  rows.push(['Lot', 'Activity', 'Budget', 'Actual Cost', 'Variance']);
  lotCosts.forEach((lot) => {
    rows.push([
      lot.lotNumber,
      lot.activity,
      formatCurrency(lot.budgetAmount),
      formatCurrency(lot.actualCost),
      (lot.variance >= 0 ? '+' : '') + formatCurrency(lot.variance),
    ]);
  });

  return rows;
}
