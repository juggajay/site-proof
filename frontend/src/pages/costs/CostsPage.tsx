import { useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  AlertCircle,
  DollarSign,
  TrendingUp,
  Users,
  Truck,
  Download,
  Filter,
  FolderOpen,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadCsv } from '@/lib/csv';
import { extractErrorMessage } from '@/lib/errorHandling';

interface CostSummary {
  totalLabourCost: number;
  totalPlantCost: number;
  totalCost: number;
  budgetTotal: number;
  budgetVariance: number;
  approvedDockets: number;
  pendingDockets: number;
}

interface SubcontractorCost {
  id: string;
  companyName: string;
  labourCost: number;
  plantCost: number;
  totalCost: number;
  approvedDockets: number;
}

interface LotCost {
  id: string;
  lotNumber: string;
  activity: string;
  budgetAmount: number;
  actualCost: number;
  variance: number;
}

interface CostData {
  summary?: CostSummary | null;
  subcontractorCosts?: SubcontractorCost[];
  lotCosts?: LotCost[];
}

export function CostsPage() {
  const { projectId } = useParams();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'summary' | 'subcontractors' | 'lots'>('summary');
  const [showFilters, setShowFilters] = useState(false);
  const [costSearch, setCostSearch] = useState('');
  const [showOverBudgetOnly, setShowOverBudgetOnly] = useState(false);

  const {
    data: costData,
    isLoading: loading,
    error: costsError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.costs(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('Project not found');
      return apiFetch<CostData>(`/api/projects/${encodeURIComponent(projectId)}/costs`);
    },
    enabled: !!projectId,
  });

  const loadError = !projectId
    ? 'Project not found'
    : costsError
      ? extractErrorMessage(costsError, 'Could not load project costs. Please try again.')
      : null;
  const hasNoLoadedCostData = Boolean(loadError && !costData);
  const summary: CostSummary | null = hasNoLoadedCostData
    ? null
    : (costData?.summary ?? {
        totalLabourCost: 0,
        totalPlantCost: 0,
        totalCost: 0,
        budgetTotal: 0,
        budgetVariance: 0,
        approvedDockets: 0,
        pendingDockets: 0,
      });
  const subcontractorCosts: SubcontractorCost[] = useMemo(
    () => (hasNoLoadedCostData ? [] : costData?.subcontractorCosts || []),
    [costData?.subcontractorCosts, hasNoLoadedCostData],
  );
  const lotCosts: LotCost[] = useMemo(
    () => (hasNoLoadedCostData ? [] : costData?.lotCosts || []),
    [costData?.lotCosts, hasNoLoadedCostData],
  );
  const normalizedCostSearch = costSearch.trim().toLowerCase();

  const filteredSubcontractorCosts = useMemo(() => {
    if (!normalizedCostSearch) return subcontractorCosts;
    return subcontractorCosts.filter((sub) =>
      sub.companyName.toLowerCase().includes(normalizedCostSearch),
    );
  }, [subcontractorCosts, normalizedCostSearch]);

  const filteredLotCosts = useMemo(() => {
    return lotCosts.filter((lot) => {
      const matchesSearch =
        !normalizedCostSearch ||
        lot.lotNumber.toLowerCase().includes(normalizedCostSearch) ||
        lot.activity.toLowerCase().includes(normalizedCostSearch);
      const matchesBudget = !showOverBudgetOnly || lot.variance < 0;
      return matchesSearch && matchesBudget;
    });
  }, [lotCosts, normalizedCostSearch, showOverBudgetOnly]);

  const filteredSubcontractorTotals = useMemo(() => {
    return filteredSubcontractorCosts.reduce(
      (totals, sub) => ({
        labourCost: totals.labourCost + sub.labourCost,
        plantCost: totals.plantCost + sub.plantCost,
        totalCost: totals.totalCost + sub.totalCost,
        approvedDockets: totals.approvedDockets + sub.approvedDockets,
      }),
      { labourCost: 0, plantCost: 0, totalCost: 0, approvedDockets: 0 },
    );
  }, [filteredSubcontractorCosts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToExcel = () => {
    if (!summary) return;

    // Build CSV data
    const rows: string[][] = [];

    // Header
    rows.push(['Project Cost Report']);
    rows.push([`Generated: ${new Date().toLocaleDateString('en-AU')}`]);
    rows.push([]);

    // Summary section
    rows.push(['COST SUMMARY']);
    rows.push(['Metric', 'Value']);
    if (summary) {
      rows.push(['Total Cost', formatCurrency(summary.totalCost)]);
      rows.push(['Labour Cost', formatCurrency(summary.totalLabourCost)]);
      rows.push(['Plant Cost', formatCurrency(summary.totalPlantCost)]);
      rows.push(['Budget Total', formatCurrency(summary.budgetTotal)]);
      rows.push(['Budget Variance', formatCurrency(summary.budgetVariance)]);
      rows.push(['Approved Dockets', summary.approvedDockets.toString()]);
      rows.push(['Pending Dockets', summary.pendingDockets.toString()]);
    }
    rows.push([]);

    // Subcontractor costs section
    rows.push(['COSTS BY SUBCONTRACTOR']);
    rows.push(['Subcontractor', 'Labour Cost', 'Plant Cost', 'Total Cost', 'Approved Dockets']);
    filteredSubcontractorCosts.forEach((sub) => {
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
    filteredLotCosts.forEach((lot) => {
      rows.push([
        lot.lotNumber,
        lot.activity,
        formatCurrency(lot.budgetAmount),
        formatCurrency(lot.actualCost),
        (lot.variance >= 0 ? '+' : '') + formatCurrency(lot.variance),
      ]);
    });

    downloadCsv(`cost-report-${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Costs</h1>
          <p className="text-muted-foreground mt-1">
            Track labour, plant, and budget across all subcontractors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
            aria-controls="cost-filters"
            disabled={hasNoLoadedCostData}
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button type="button" onClick={exportToExcel} disabled={!summary}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">{loadError}</p>
              {!hasNoLoadedCostData && <p>Refresh the data before relying on the cost report.</p>}
            </div>
          </div>
          {projectId && (
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          )}
        </div>
      )}

      {showFilters && !hasNoLoadedCostData && (
        <div id="cost-filters" className="rounded-lg border bg-card p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <Label htmlFor="cost-search" className="mb-1">
                Search costs
              </Label>
              <Input
                id="cost-search"
                value={costSearch}
                onChange={(e) => setCostSearch(e.target.value)}
                placeholder="Search subcontractors, lots, or activities..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOverBudgetOnly}
                onChange={(e) => setShowOverBudgetOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Over-budget lots only
            </label>
          </div>
        </div>
      )}

      {!hasNoLoadedCostData && (
        <>
          {/* Summary Cards - Consolidated on mobile */}
          {summary && (
            <div
              className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}
            >
              {/* Total Cost - On mobile, includes Labour/Plant breakdown inline */}
              <div className={`rounded-xl border bg-card p-5 ${isMobile ? '' : ''}`}>
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-medium">Total Cost</span>
                </div>
                <div className="text-3xl font-bold">{formatCurrency(summary.totalCost)}</div>
                {isMobile ? (
                  <div className="mt-3 grid grid-cols-2 gap-4 pt-3 border-t">
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-xs">Labour</span>
                      </div>
                      <p className="font-semibold">{formatCurrency(summary.totalLabourCost)}</p>
                      <p className="text-xs text-muted-foreground">
                        {summary.totalCost > 0
                          ? Math.round((summary.totalLabourCost / summary.totalCost) * 100)
                          : 0}
                        % of total
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Truck className="h-3.5 w-3.5" />
                        <span className="text-xs">Plant</span>
                      </div>
                      <p className="font-semibold">{formatCurrency(summary.totalPlantCost)}</p>
                      <p className="text-xs text-muted-foreground">
                        {summary.totalCost > 0
                          ? Math.round((summary.totalPlantCost / summary.totalCost) * 100)
                          : 0}
                        % of total
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Labour: {formatCurrency(summary.totalLabourCost)} | Plant:{' '}
                    {formatCurrency(summary.totalPlantCost)}
                  </p>
                )}
              </div>

              {/* Budget Status */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-medium">Budget Status</span>
                </div>
                <div className="text-3xl font-bold">{formatCurrency(summary.budgetTotal)}</div>
                <p
                  className={`text-sm mt-1 font-medium ${summary.budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {summary.budgetVariance >= 0 ? 'Under budget by ' : 'Over budget by '}
                  {formatCurrency(Math.abs(summary.budgetVariance))}
                </p>
                {isMobile && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-2xl font-bold text-green-600">
                        {summary.approvedDockets}
                      </span>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-amber-600">
                        {summary.pendingDockets}
                      </span>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Labour Cost - Desktop only */}
              {!isMobile && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Labour Cost</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(summary.totalLabourCost)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.totalCost > 0
                      ? Math.round((summary.totalLabourCost / summary.totalCost) * 100)
                      : 0}
                    % of total
                  </p>
                </div>
              )}

              {/* Plant Cost - Desktop only */}
              {!isMobile && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Truck className="h-5 w-5" />
                    <span className="font-medium">Plant Cost</span>
                  </div>
                  <div className="text-3xl font-bold">{formatCurrency(summary.totalPlantCost)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.totalCost > 0
                      ? Math.round((summary.totalPlantCost / summary.totalCost) * 100)
                      : 0}
                    % of total
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Docket Status - Hidden on mobile (integrated into Budget Status card) */}
          {summary && !isMobile && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Docket Status</h3>
              <div className="flex gap-8">
                <div>
                  <span className="text-2xl font-bold text-green-600">
                    {summary.approvedDockets}
                  </span>
                  <p className="text-sm text-muted-foreground">Approved Dockets</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-amber-600">
                    {summary.pendingDockets}
                  </span>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-4" role="tablist" aria-label="Cost views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'summary'}
                aria-controls="cost-panel-summary"
                onClick={() => setActiveTab('summary')}
                className={`pb-2 px-1 border-b-2 transition-colors ${
                  activeTab === 'summary'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'subcontractors'}
                aria-controls="cost-panel-subcontractors"
                onClick={() => setActiveTab('subcontractors')}
                className={`pb-2 px-1 border-b-2 transition-colors ${
                  activeTab === 'subcontractors'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                By Subcontractor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'lots'}
                aria-controls="cost-panel-lots"
                onClick={() => setActiveTab('lots')}
                className={`pb-2 px-1 border-b-2 transition-colors ${
                  activeTab === 'lots'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                By Lot
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'subcontractors' && (
            <div
              id="cost-panel-subcontractors"
              role="tabpanel"
              className={isMobile ? 'space-y-3' : 'rounded-lg border'}
            >
              {filteredSubcontractorCosts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground rounded-lg border">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No subcontractor costs found</p>
                  <p className="text-sm mt-1">
                    Adjust filters or approve dockets to populate subcontractor costs.
                  </p>
                </div>
              ) : isMobile ? (
                /* Mobile Card View for Subcontractors */
                <>
                  {filteredSubcontractorCosts.map((sub) => (
                    <MobileDataCard
                      key={sub.id}
                      title={sub.companyName}
                      subtitle={`${sub.approvedDockets} approved dockets`}
                      fields={[
                        {
                          label: 'Total',
                          value: formatCurrency(sub.totalCost),
                          priority: 'primary',
                        },
                        {
                          label: 'Labour',
                          value: formatCurrency(sub.labourCost),
                          priority: 'primary',
                        },
                        {
                          label: 'Plant',
                          value: formatCurrency(sub.plantCost),
                          priority: 'secondary',
                        },
                      ]}
                    />
                  ))}
                  {/* Totals Card */}
                  <div className="rounded-xl border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-lg">
                        {formatCurrency(filteredSubcontractorTotals.totalCost)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Desktop Table View */
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Subcontractor</th>
                      <th className="text-right p-4 font-medium">Labour Cost</th>
                      <th className="text-right p-4 font-medium">Plant Cost</th>
                      <th className="text-right p-4 font-medium">Total Cost</th>
                      <th className="text-right p-4 font-medium">Dockets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubcontractorCosts.map((sub) => (
                      <tr key={sub.id} className="border-t hover:bg-muted/30">
                        <td className="p-4 font-medium">{sub.companyName}</td>
                        <td className="p-4 text-right">{formatCurrency(sub.labourCost)}</td>
                        <td className="p-4 text-right">{formatCurrency(sub.plantCost)}</td>
                        <td className="p-4 text-right font-semibold">
                          {formatCurrency(sub.totalCost)}
                        </td>
                        <td className="p-4 text-right">{sub.approvedDockets}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 font-semibold">
                    <tr className="border-t">
                      <td className="p-4">Total</td>
                      <td className="p-4 text-right">
                        {formatCurrency(filteredSubcontractorTotals.labourCost)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(filteredSubcontractorTotals.plantCost)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(filteredSubcontractorTotals.totalCost)}
                      </td>
                      <td className="p-4 text-right">
                        {filteredSubcontractorTotals.approvedDockets}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {activeTab === 'lots' && (
            <div
              id="cost-panel-lots"
              role="tabpanel"
              className={isMobile ? 'space-y-3' : 'rounded-lg border'}
            >
              {filteredLotCosts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground rounded-lg border">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No lot cost data found</p>
                  <p className="text-sm mt-1">
                    Adjust filters or create lots and assign budgets to track costs by lot.
                  </p>
                </div>
              ) : isMobile ? (
                /* Mobile Card View for Lots */
                filteredLotCosts.map((lot) => (
                  <MobileDataCard
                    key={lot.id}
                    title={lot.lotNumber}
                    subtitle={lot.activity}
                    status={{
                      label:
                        lot.variance >= 0
                          ? `+${formatCurrency(lot.variance)}`
                          : formatCurrency(lot.variance),
                      variant: lot.variance >= 0 ? 'success' : 'error',
                    }}
                    fields={[
                      {
                        label: 'Budget',
                        value: formatCurrency(lot.budgetAmount),
                        priority: 'primary',
                      },
                      {
                        label: 'Actual',
                        value: formatCurrency(lot.actualCost),
                        priority: 'primary',
                      },
                    ]}
                  />
                ))
              ) : (
                /* Desktop Table View */
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Lot</th>
                      <th className="text-left p-4 font-medium">Activity</th>
                      <th className="text-right p-4 font-medium">Budget</th>
                      <th className="text-right p-4 font-medium">Actual Cost</th>
                      <th className="text-right p-4 font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLotCosts.map((lot) => (
                      <tr key={lot.id} className="border-t hover:bg-muted/30">
                        <td className="p-4 font-medium">{lot.lotNumber}</td>
                        <td className="p-4">{lot.activity}</td>
                        <td className="p-4 text-right">{formatCurrency(lot.budgetAmount)}</td>
                        <td className="p-4 text-right">{formatCurrency(lot.actualCost)}</td>
                        <td
                          className={`p-4 text-right font-semibold ${lot.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {lot.variance >= 0 ? '+' : ''}
                          {formatCurrency(lot.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div id="cost-panel-summary" role="tabpanel" className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-4">Cost Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      Labour (
                      {Math.round(
                        ((summary?.totalLabourCost || 0) / (summary?.totalCost || 1)) * 100,
                      )}
                      %)
                    </span>
                    <span>{formatCurrency(summary?.totalLabourCost || 0)}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(100, ((summary?.totalLabourCost || 0) / (summary?.totalCost || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      Plant (
                      {Math.round(
                        ((summary?.totalPlantCost || 0) / (summary?.totalCost || 1)) * 100,
                      )}
                      %)
                    </span>
                    <span>{formatCurrency(summary?.totalPlantCost || 0)}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${Math.min(100, ((summary?.totalPlantCost || 0) / (summary?.totalCost || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">Budget vs Actual</h4>
                <div className="flex items-end gap-4 h-32">
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full max-w-24 bg-primary/20 rounded-t"
                      style={{
                        height: `${Math.min(100, ((summary?.budgetTotal || 0) / (summary?.budgetTotal || 1)) * 100)}%`,
                      }}
                    />
                    <span className="text-xs mt-2">Budget</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(summary?.budgetTotal || 0)}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full max-w-24 bg-green-500 rounded-t"
                      style={{
                        height: `${Math.min(100, ((summary?.totalCost || 0) / (summary?.budgetTotal || 1)) * 100)}%`,
                      }}
                    />
                    <span className="text-xs mt-2">Actual</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(summary?.totalCost || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
