import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthToken, useAuth } from '@/lib/auth'
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ClipboardCheck,
  Settings2,
  Check,
  Activity,
  ListChecks,
  DollarSign,
  Users,
  Download,
  AlertCircle,
  ChevronRight,
  Calendar,
  ChevronDown,
  RefreshCw
} from 'lucide-react'

// Date range presets
type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'custom'

interface DateRange {
  preset: DateRangePreset
  startDate: string
  endDate: string
  label: string
}

const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string; getRange: () => { start: Date; end: Date } }[] = [
  {
    value: 'today',
    label: 'Today',
    getRange: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      return { start: today, end }
    }
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)
      const end = new Date(yesterday)
      end.setHours(23, 59, 59, 999)
      return { start: yesterday, end }
    }
  },
  {
    value: 'last7days',
    label: 'Last 7 Days',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
  },
  {
    value: 'last30days',
    label: 'Last 30 Days',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
  },
  {
    value: 'thisMonth',
    label: 'This Month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date()
      return { start, end }
    }
  },
  {
    value: 'lastMonth',
    label: 'Last Month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  },
  {
    value: 'thisQuarter',
    label: 'This Quarter',
    getRange: () => {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), quarter * 3, 1)
      const end = new Date()
      return { start, end }
    }
  },
]

const formatDateForApi = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

// Widget configuration
const WIDGET_CONFIG = [
  { id: 'attentionItems', label: 'Items Requiring Attention', required: false },
  { id: 'projectSummary', label: 'Project Summary', required: false },
  { id: 'recentActivity', label: 'Recent Activity', required: false },
  { id: 'lotStatus', label: 'Lot Status', required: false },
  { id: 'holdPoints', label: 'Hold Points', required: false },
  { id: 'ncrs', label: 'NCRs', required: false },
  { id: 'quickLinks', label: 'Quick Links', required: false },
] as const

type WidgetId = typeof WIDGET_CONFIG[number]['id']

const DEFAULT_VISIBLE_WIDGETS: WidgetId[] = ['attentionItems', 'projectSummary', 'recentActivity', 'lotStatus', 'holdPoints', 'ncrs', 'quickLinks']

const WIDGET_STORAGE_KEY = 'siteproof_dashboard_widgets'

interface Project {
  id: string
  name: string
  projectNumber: string
  status: string
}

interface AttentionItem {
  id: string
  type: 'ncr' | 'holdpoint'
  title: string
  description: string
  status: string
  daysOverdue?: number
  daysStale?: number
  dueDate?: string
  project: {
    id: string
    name: string
    projectNumber: string
  }
  link: string
}

interface DashboardStats {
  totalProjects: number
  activeProjects: number
  totalLots: number
  openHoldPoints: number
  openNCRs: number
  attentionItems: {
    overdueNCRs: AttentionItem[]
    staleHoldPoints: AttentionItem[]
    total: number
  }
  recentActivities: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    link?: string
  }>
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Date range filter state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('last30days')
  const [showDateRangeDropdown, setShowDateRangeDropdown] = useState(false)

  // Get current date range based on preset
  const currentDateRange = useMemo(() => {
    const preset = DATE_RANGE_PRESETS.find(p => p.value === dateRangePreset)
    if (preset) {
      const range = preset.getRange()
      return {
        preset: dateRangePreset,
        startDate: formatDateForApi(range.start),
        endDate: formatDateForApi(range.end),
        label: preset.label
      }
    }
    // Default to last 30 days
    const defaultPreset = DATE_RANGE_PRESETS.find(p => p.value === 'last30days')!
    const range = defaultPreset.getRange()
    return {
      preset: 'last30days' as DateRangePreset,
      startDate: formatDateForApi(range.start),
      endDate: formatDateForApi(range.end),
      label: defaultPreset.label
    }
  }, [dateRangePreset])

  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalLots: 0,
    openHoldPoints: 0,
    openNCRs: 0,
    attentionItems: {
      overdueNCRs: [],
      staleHoldPoints: [],
      total: 0
    },
    recentActivities: [],
  })

  // Widget visibility state with localStorage persistence
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>(() => {
    try {
      const stored = localStorage.getItem(WIDGET_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as WidgetId[]
      }
    } catch (e) {
      console.error('Error loading widget preferences:', e)
    }
    return DEFAULT_VISIBLE_WIDGETS
  })

  const [showWidgetSettings, setShowWidgetSettings] = useState(false)

  // Refresh trigger - increment to force data refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    setRefreshTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      try {
        // Build URL with date range parameters
        const params = new URLSearchParams({
          startDate: currentDateRange.startDate,
          endDate: currentDateRange.endDate,
        })

        // Fetch dashboard stats from new endpoint with date range
        const statsResponse = await fetch(`${API_URL}/api/dashboard/stats?${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats({
            totalProjects: statsData.totalProjects || 0,
            activeProjects: statsData.activeProjects || 0,
            totalLots: statsData.totalLots || 0,
            openHoldPoints: statsData.openHoldPoints || 0,
            openNCRs: statsData.openNCRs || 0,
            attentionItems: statsData.attentionItems || {
              overdueNCRs: [],
              staleHoldPoints: [],
              total: 0
            },
            recentActivities: statsData.recentActivities || [],
          })
        } else {
          // Fallback to projects endpoint if dashboard stats fails
          const response = await fetch(`${API_URL}/api/projects`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            const projectList = data.projects || []
            setProjects(projectList)

            setStats({
              totalProjects: projectList.length,
              activeProjects: projectList.filter((p: Project) => p.status === 'active').length,
              totalLots: 0,
              openHoldPoints: 0,
              openNCRs: 0,
              attentionItems: {
                overdueNCRs: [],
                staleHoldPoints: [],
                total: 0
              },
              recentActivities: [
                { id: '1', type: 'lot', description: 'Lot LOT-001 status changed to completed', timestamp: new Date().toISOString() },
                { id: '2', type: 'ncr', description: 'New NCR raised: NCR-2024-001', timestamp: new Date(Date.now() - 3600000).toISOString() },
                { id: '3', type: 'holdpoint', description: 'Hold point released for concrete pour', timestamp: new Date(Date.now() - 7200000).toISOString() },
              ],
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    }

    fetchDashboardData()
  }, [currentDateRange, refreshTrigger])

  const isWidgetVisible = (widgetId: WidgetId) => visibleWidgets.includes(widgetId)

  const toggleWidget = (widgetId: WidgetId) => {
    setVisibleWidgets(prev => {
      let newWidgets: WidgetId[]
      if (prev.includes(widgetId)) {
        newWidgets = prev.filter(w => w !== widgetId)
      } else {
        newWidgets = [...prev, widgetId]
      }
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(newWidgets))
      return newWidgets
    })
  }

  // Export dashboard to PDF using browser print
  const handleExportPDF = () => {
    // Add print class to body for styling
    document.body.classList.add('printing-dashboard')

    // Create a style element for print-specific styles
    const printStyles = document.createElement('style')
    printStyles.id = 'dashboard-print-styles'
    printStyles.innerHTML = `
      @media print {
        body.printing-dashboard * {
          visibility: hidden;
        }
        body.printing-dashboard .dashboard-content,
        body.printing-dashboard .dashboard-content * {
          visibility: visible;
        }
        body.printing-dashboard .dashboard-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 20px;
        }
        body.printing-dashboard .no-print {
          display: none !important;
        }
        body.printing-dashboard .bg-card {
          background: white !important;
          border: 1px solid #ddd !important;
        }
        body.printing-dashboard h1 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
      }
    `
    document.head.appendChild(printStyles)

    // Trigger print dialog
    window.print()

    // Cleanup after print
    setTimeout(() => {
      document.body.classList.remove('printing-dashboard')
      const styleEl = document.getElementById('dashboard-print-styles')
      if (styleEl) styleEl.remove()
    }, 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 dashboard-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! Here's an overview of your projects.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          {/* Date Range Filter */}
          <div className="relative">
            <button
              onClick={() => setShowDateRangeDropdown(!showDateRangeDropdown)}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
              title="Filter by date range"
            >
              <Calendar className="h-4 w-4" />
              <span>{currentDateRange.label}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showDateRangeDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDateRangeDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-lg shadow-lg z-20 p-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
                    Select Date Range
                  </div>
                  {DATE_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setDateRangePreset(preset.value)
                        setShowDateRangeDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted rounded ${
                        dateRangePreset === preset.value ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      <span>{preset.label}</span>
                      {dateRangePreset === preset.value && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
            title="Export to PDF"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>

          {/* Widget Settings Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowWidgetSettings(!showWidgetSettings)}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
              title="Customize widgets"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </button>

          {showWidgetSettings && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowWidgetSettings(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-card border rounded-lg shadow-lg z-20 p-2">
                <div className="px-2 py-1.5 text-sm font-medium border-b mb-2">
                  Dashboard Widgets
                </div>
                {WIDGET_CONFIG.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleWidget(widget.id)
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted rounded"
                  >
                    <span>{widget.label}</span>
                    {isWidgetVisible(widget.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Date Range Indicator */}
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        <span>Showing data from {currentDateRange.startDate} to {currentDateRange.endDate}</span>
      </div>

      {/* Items Requiring Attention Widget */}
      {isWidgetVisible('attentionItems') && stats.attentionItems.total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg">
          <div className="p-4 border-b border-red-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-700">Items Requiring Attention</h2>
            <span className="ml-auto bg-red-100 text-red-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {stats.attentionItems.total}
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {/* Overdue NCRs */}
            {stats.attentionItems.overdueNCRs.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue NCRs ({stats.attentionItems.overdueNCRs.length})
                </h3>
                <div className="space-y-2">
                  {stats.attentionItems.overdueNCRs.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.link)}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                            {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''} overdue
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {item.project.name} • {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stale Hold Points */}
            {stats.attentionItems.staleHoldPoints.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Stale Hold Points ({stats.attentionItems.staleHoldPoints.length})
                </h3>
                <div className="space-y-2">
                  {stats.attentionItems.staleHoldPoints.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.link)}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                            {item.daysStale} day{item.daysStale !== 1 ? 's' : ''} waiting
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {item.project.name} • {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Summary Widget */}
      {isWidgetVisible('projectSummary') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderKanban className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">{stats.activeProjects}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ListChecks className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Lots</p>
                <p className="text-2xl font-bold">{stats.totalLots}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Widget */}
        {isWidgetVisible('recentActivity') && (
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Recent Activity</h2>
            </div>
            <div className="divide-y">
              {stats.recentActivities.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="p-4">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Lot Status Widget */}
        {isWidgetVisible('lotStatus') && (
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Lot Status Overview</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-sm">Draft</span>
                </div>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm">On Hold</span>
                </div>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Completed</span>
                </div>
                <span className="font-medium">0</span>
              </div>
            </div>
          </div>
        )}

        {/* Hold Points Widget */}
        {isWidgetVisible('holdPoints') && (
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Hold Points</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <span>Open Hold Points</span>
                </div>
                <span className="text-2xl font-bold">{stats.openHoldPoints}</span>
              </div>
              <Link
                to="/projects"
                className="text-sm text-primary hover:underline"
              >
                View all hold points →
              </Link>
            </div>
          </div>
        )}

        {/* NCRs Widget */}
        {isWidgetVisible('ncrs') && (
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Non-Conformance Reports</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span>Open NCRs</span>
                </div>
                <span className="text-2xl font-bold">{stats.openNCRs}</span>
              </div>
              <Link
                to="/projects"
                className="text-sm text-primary hover:underline"
              >
                View all NCRs →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links Widget */}
      {isWidgetVisible('quickLinks') && (
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Quick Links</h2>
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Link
              to="/projects"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FolderKanban className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Projects</span>
            </Link>
            <Link
              to="/portfolio"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Portfolio</span>
            </Link>
            <Link
              to="/reports"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-green-600" />
              <span className="font-medium">Reports</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Settings2 className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Settings</span>
            </Link>
          </div>
        </div>
      )}

      {/* No widgets visible message */}
      {visibleWidgets.length === 0 && (
        <div className="bg-muted/50 rounded-lg border-2 border-dashed p-8 text-center">
          <Settings2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            No widgets visible. Click "Customize" above to add widgets to your dashboard.
          </p>
        </div>
      )}
    </div>
  )
}
