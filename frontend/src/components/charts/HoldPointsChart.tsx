import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ReleasesOverTimeData {
  date: string
  releases: number
}

interface HoldPointsChartProps {
  releasesOverTime: ReleasesOverTimeData[]
  avgTimeToRelease: number
  releasedCount: number
}

export function HoldPointsReleasesChart({
  releasesOverTime,
  avgTimeToRelease,
  releasedCount
}: HoldPointsChartProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* HP Releases Over Time Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">HP Releases - Last 7 Days</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={releasesOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="releases" fill="#22c55e" radius={[4, 4, 0, 0]} name="Releases" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Average Time to Release */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">Average Time: Notification to Release</h3>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">
              {avgTimeToRelease > 24
                ? `${Math.round(avgTimeToRelease / 24)}d`
                : `${avgTimeToRelease}h`
              }
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {avgTimeToRelease > 24
                ? `${avgTimeToRelease} hours total`
                : 'hours on average'
              }
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Based on {releasedCount} released hold points
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
