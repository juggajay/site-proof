import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  Users
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

// Widget configuration
const WIDGET_CONFIG = [
  { id: 'projectSummary', label: 'Project Summary', required: false },
  { id: 'recentActivity', label: 'Recent Activity', required: false },
  { id: 'lotStatus', label: 'Lot Status', required: false },
  { id: 'holdPoints', label: 'Hold Points', required: false },
  { id: 'ncrs', label: 'NCRs', required: false },
  { id: 'quickLinks', label: 'Quick Links', required: false },
] as const

type WidgetId = typeof WIDGET_CONFIG[number]['id']

const DEFAULT_VISIBLE_WIDGETS: WidgetId[] = ['projectSummary', 'recentActivity', 'lotStatus', 'holdPoints', 'ncrs', 'quickLinks']

const WIDGET_STORAGE_KEY = 'siteproof_dashboard_widgets'

interface Project {
  id: string
  name: string
  projectNumber: string
  status: string
}

interface DashboardStats {
  totalProjects: number
  activeProjects: number
  totalLots: number
  openHoldPoints: number
  openNCRs: number
  recentActivities: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
}

export function DashboardPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalLots: 0,
    openHoldPoints: 0,
    openNCRs: 0,
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/projects`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const projectList = data.projects || []
          setProjects(projectList)

          // Calculate stats from projects
          setStats({
            totalProjects: projectList.length,
            activeProjects: projectList.filter((p: Project) => p.status === 'active').length,
            totalLots: 0, // Would come from API
            openHoldPoints: 0, // Would come from API
            openNCRs: 0, // Would come from API
            recentActivities: [
              { id: '1', type: 'lot', description: 'Lot LOT-001 status changed to completed', timestamp: new Date().toISOString() },
              { id: '2', type: 'ncr', description: 'New NCR raised: NCR-2024-001', timestamp: new Date(Date.now() - 3600000).toISOString() },
              { id: '3', type: 'holdpoint', description: 'Hold point released for concrete pour', timestamp: new Date(Date.now() - 7200000).toISOString() },
            ],
          })
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! Here's an overview of your projects.
          </p>
        </div>

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
