import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Download } from 'lucide-react';
import { BarChart3 } from 'lucide-react';

interface ChartDataPoint {
  name: string;
  claimNumber: number;
  claimed: number;
  certified: number;
  paid: number;
  claimAmount?: number;
  certifiedAmount?: number | null;
  paidAmount?: number | null;
  status?: string;
}

interface ClaimsChartsProps {
  cumulativeChartData: ChartDataPoint[];
  monthlyBreakdownData: ChartDataPoint[];
  formatCurrency: (amount: number | null) => string;
  onExportCumulativeData: () => void;
  onExportMonthlyData: () => void;
}

interface ClaimsTooltipPayload {
  payload: ChartDataPoint;
}

interface ClaimsTooltipProps {
  active?: boolean;
  payload?: ClaimsTooltipPayload[];
  label?: string | number;
  formatCurrency: (amount: number | null) => string;
}

// Custom tooltip for the cumulative chart
function CumulativeTooltip({ active, payload, label, formatCurrency }: ClaimsTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">
          Claim {data.claimNumber} ({label})
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Cumulative Claimed: {formatCurrency(data.claimed)}
          </p>
          <p className="text-brand">Cumulative Certified: {formatCurrency(data.certified)}</p>
          <p className="text-foreground">Cumulative Paid: {formatCurrency(data.paid)}</p>
        </div>
        <div className="border-t mt-2 pt-2 text-xs text-muted-foreground">
          <p>This claim: {formatCurrency(data.claimAmount ?? null)}</p>
        </div>
      </div>
    );
  }
  return null;
}

// Custom tooltip for monthly breakdown chart
function MonthlyTooltip({ active, payload, label, formatCurrency }: ClaimsTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const statusColors: Record<string, string> = {
      draft: 'text-muted-foreground',
      submitted: 'text-muted-foreground',
      certified: 'text-foreground',
      paid: 'text-foreground',
      disputed: 'text-destructive',
    };
    const status = data.status || 'unknown';
    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">
          Claim {data.claimNumber} ({label})
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Claimed: {formatCurrency(data.claimed)}</p>
          <p className="text-brand">Certified: {formatCurrency(data.certified)}</p>
          <p className="text-foreground">Paid: {formatCurrency(data.paid)}</p>
        </div>
        <div className="border-t mt-2 pt-2 text-xs">
          <p className={statusColors[status] || 'text-muted-foreground'}>
            Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export function CumulativeClaimsChart({
  data,
  formatCurrency,
  onExport,
}: {
  data: ChartDataPoint[];
  formatCurrency: (amount: number | null) => string;
  onExport: () => void;
}) {
  if (data.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Cumulative Claims Over Time</h2>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
          title="Export chart data as CSV"
        >
          <Download className="h-3 w-3" />
          Export Data
        </button>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorClaimed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCertified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CumulativeTooltip formatCurrency={formatCurrency} />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="claimed"
              name="Claimed"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorClaimed)"
            />
            <Area
              type="monotone"
              dataKey="certified"
              name="Certified"
              stroke="hsl(var(--brand))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCertified)"
            />
            <Area
              type="monotone"
              dataKey="paid"
              name="Paid"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPaid)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Showing cumulative totals across {data.length} claims
      </p>
    </div>
  );
}

export function MonthlyBreakdownChart({
  data,
  formatCurrency,
  onExport,
}: {
  data: ChartDataPoint[];
  formatCurrency: (amount: number | null) => string;
  onExport: () => void;
}) {
  if (data.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Monthly Claim Breakdown</h2>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
          title="Export chart data as CSV"
        >
          <Download className="h-3 w-3" />
          Export Data
        </button>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<MonthlyTooltip formatCurrency={formatCurrency} />} />
            <Legend />
            <Bar
              dataKey="claimed"
              name="Claimed"
              fill="hsl(var(--muted-foreground))"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="certified"
              name="Certified"
              fill="hsl(var(--brand))"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="paid" name="Paid" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Individual claim amounts per month
      </p>
    </div>
  );
}

// Combined export for convenience
export function ClaimsCharts({
  cumulativeChartData,
  monthlyBreakdownData,
  formatCurrency,
  onExportCumulativeData,
  onExportMonthlyData,
}: ClaimsChartsProps) {
  return (
    <>
      <CumulativeClaimsChart
        data={cumulativeChartData}
        formatCurrency={formatCurrency}
        onExport={onExportCumulativeData}
      />
      <MonthlyBreakdownChart
        data={monthlyBreakdownData}
        formatCurrency={formatCurrency}
        onExport={onExportMonthlyData}
      />
    </>
  );
}
