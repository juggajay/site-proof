import { lazy, Suspense } from 'react'

// Loading fallback for charts
function ChartLoadingFallback({ height = 300 }: { height?: number | string }) {
  return (
    <div
      className="flex items-center justify-center bg-muted/30 rounded-lg border animate-pulse"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading chart...</span>
      </div>
    </div>
  )
}

// Lazy load ClaimsCharts component
const LazyCumulativeClaimsChart = lazy(() =>
  import('./ClaimsCharts').then(m => ({ default: m.CumulativeClaimsChart }))
)

const LazyMonthlyBreakdownChart = lazy(() =>
  import('./ClaimsCharts').then(m => ({ default: m.MonthlyBreakdownChart }))
)

// Lazy load HoldPointsChart component
const LazyHoldPointsReleasesChart = lazy(() =>
  import('./HoldPointsChart').then(m => ({ default: m.HoldPointsReleasesChart }))
)

// Types
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

interface ReleasesOverTimeData {
  date: string
  releases: number
}

// Lazy Claims Charts
export function LazyCumulativeChart({
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
    <Suspense fallback={<ChartLoadingFallback height={400} />}>
      <LazyCumulativeClaimsChart
        data={data}
        formatCurrency={formatCurrency}
        onExport={onExport}
      />
    </Suspense>
  )
}

export function LazyMonthlyChart({
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
    <Suspense fallback={<ChartLoadingFallback height={400} />}>
      <LazyMonthlyBreakdownChart
        data={data}
        formatCurrency={formatCurrency}
        onExport={onExport}
      />
    </Suspense>
  )
}

// Lazy Hold Points Chart
export function LazyHoldPointsChart({
  releasesOverTime,
  avgTimeToRelease,
  releasedCount
}: {
  releasesOverTime: ReleasesOverTimeData[]
  avgTimeToRelease: number
  releasedCount: number
}) {
  return (
    <Suspense fallback={<ChartLoadingFallback height={250} />}>
      <LazyHoldPointsReleasesChart
        releasesOverTime={releasesOverTime}
        avgTimeToRelease={avgTimeToRelease}
        releasedCount={releasedCount}
      />
    </Suspense>
  )
}
