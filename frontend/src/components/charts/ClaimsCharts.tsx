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
} from 'recharts'
import { TrendingUp, Download } from 'lucide-react'
import { BarChart3 } from 'lucide-react'

interface ChartDataPoint {
  name: string
  claimNumber: number
  claimed: number
  certified: number
  paid: number
  claimAmount?: number
  certifiedAmount?: number | null
  paidAmount?: number | null
  status?: string
}

interface ClaimsChartsProps {
  cumulativeChartData: ChartDataPoint[]
  monthlyBreakdownData: ChartDataPoint[]
  formatCurrency: (amount: number | null) => string
  onExportCumulativeData: () => void
  onExportMonthlyData: () => void
}

// Custom tooltip for the cumulative chart
function CumulativeTooltip({ active, payload, label, formatCurrency }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">Claim {data.claimNumber} ({label})</p>
        <div className="space-y-1 text-sm">
          <p className="text-blue-600">
            Cumulative Claimed: {formatCurrency(data.claimed)}
          </p>
          <p className="text-amber-600">
            Cumulative Certified: {formatCurrency(data.certified)}
          </p>
          <p className="text-green-600">
            Cumulative Paid: {formatCurrency(data.paid)}
          </p>
        </div>
        <div className="border-t mt-2 pt-2 text-xs text-muted-foreground">
          <p>This claim: {formatCurrency(data.claimAmount)}</p>
        </div>
      </div>
    )
  }
  return null
}

// Custom tooltip for monthly breakdown chart
function MonthlyTooltip({ active, payload, label, formatCurrency }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const statusColors: Record<string, string> = {
      draft: 'text-gray-600',
      submitted: 'text-blue-600',
      certified: 'text-amber-600',
      paid: 'text-green-600',
      disputed: 'text-red-600'
    }
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">Claim {data.claimNumber} ({label})</p>
        <div className="space-y-1 text-sm">
          <p className="text-blue-600">
            Claimed: {formatCurrency(data.claimed)}
          </p>
          <p className="text-amber-600">
            Certified: {formatCurrency(data.certified)}
          </p>
          <p className="text-green-600">
            Paid: {formatCurrency(data.paid)}
          </p>
        </div>
        <div className="border-t mt-2 pt-2 text-xs">
          <p className={statusColors[data.status] || 'text-gray-600'}>
            Status: {data.status?.charAt(0).toUpperCase() + data.status?.slice(1)}
          </p>
        </div>
      </div>
    )
  }
  return null
}

export function CumulativeClaimsChart({
  data,
  formatCurrency,
  onExport
}: {
  data: ChartDataPoint[]
  formatCurrency: (amount: number | null) => string
  onExport: () => void
}) {
  if (data.length < 2) return null

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
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCertified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip content={<CumulativeTooltip formatCurrency={formatCurrency} />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="claimed"
              name="Claimed"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorClaimed)"
            />
            <Area
              type="monotone"
              dataKey="certified"
              name="Certified"
              stroke="#f59e0b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCertified)"
            />
            <Area
              type="monotone"
              dataKey="paid"
              name="Paid"
              stroke="#22c55e"
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
  )
}

export function MonthlyBreakdownChart({
  data,
  formatCurrency,
  onExport
}: {
  data: ChartDataPoint[]
  formatCurrency: (amount: number | null) => string
  onExport: () => void
}) {
  if (data.length < 2) return null

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
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip content={<MonthlyTooltip formatCurrency={formatCurrency} />} />
            <Legend />
            <Bar
              dataKey="claimed"
              name="Claimed"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="certified"
              name="Certified"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="paid"
              name="Paid"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Individual claim amounts per month
      </p>
    </div>
  )
}

// Combined export for convenience
export function ClaimsCharts({
  cumulativeChartData,
  monthlyBreakdownData,
  formatCurrency,
  onExportCumulativeData,
  onExportMonthlyData
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
  )
}
