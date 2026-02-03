// Re-export recharts components for lazy loading
// Import from this barrel file instead of directly from recharts
// to enable better code splitting

// Direct exports for components that need immediate access
export {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from 'recharts'

// Lazy-loaded chart components - use these for better code splitting
export {
  LazyCumulativeChart,
  LazyMonthlyChart,
  LazyHoldPointsChart,
} from './LazyCharts'

// Specific chart components (internally use recharts, can be lazy loaded)
export { CumulativeClaimsChart, MonthlyBreakdownChart, ClaimsCharts } from './ClaimsCharts'
export { HoldPointsReleasesChart } from './HoldPointsChart'
