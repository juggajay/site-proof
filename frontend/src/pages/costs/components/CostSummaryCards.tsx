import { DollarSign, TrendingUp, Users, Truck } from 'lucide-react';
import { formatCurrency, type CostSummary } from '../costsPageHelpers';

interface CostSummaryCardsProps {
  summary: CostSummary;
  isMobile: boolean;
}

export function CostSummaryCards({ summary, isMobile }: CostSummaryCardsProps) {
  return (
    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
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

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <TrendingUp className="h-5 w-5" />
          <span className="font-medium">Budget Status</span>
        </div>
        <div className="text-3xl font-bold">{formatCurrency(summary.budgetTotal)}</div>
        <p
          className={`text-sm mt-1 font-medium ${summary.budgetVariance >= 0 ? 'text-success' : 'text-destructive'}`}
        >
          {summary.budgetVariance >= 0 ? 'Under budget by ' : 'Over budget by '}
          {formatCurrency(Math.abs(summary.budgetVariance))}
        </p>
        {isMobile && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4">
            <div>
              <span className="text-2xl font-bold text-success">{summary.approvedDockets}</span>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div>
              <span className="text-2xl font-bold text-warning">{summary.pendingDockets}</span>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-5 w-5" />
            <span className="font-medium">Labour Cost</span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(summary.totalLabourCost)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.totalCost > 0
              ? Math.round((summary.totalLabourCost / summary.totalCost) * 100)
              : 0}
            % of total
          </p>
        </div>
      )}

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
  );
}

export function DocketStatusSummary({ summary }: { summary: CostSummary }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Docket Status</h3>
      <div className="flex gap-8">
        <div>
          <span className="text-2xl font-bold text-success">{summary.approvedDockets}</span>
          <p className="text-sm text-muted-foreground">Approved Dockets</p>
        </div>
        <div>
          <span className="text-2xl font-bold text-warning">{summary.pendingDockets}</span>
          <p className="text-sm text-muted-foreground">Pending Approval</p>
        </div>
      </div>
    </div>
  );
}
