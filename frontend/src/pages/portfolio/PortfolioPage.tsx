import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

interface Project {
  id: string
  name: string
  projectNumber: string
  status: string
  startDate?: string
  targetCompletion?: string
  contractValue?: number
}

interface PortfolioStats {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  archivedProjects: number
  totalContractValue: number
  projectsOnTrack: number
  projectsAtRisk: number
}

export function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
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

        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }

        const data = await response.json()
        setProjects(data.projects || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  // Calculate aggregate metrics
  const stats: PortfolioStats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    completedProjects: projects.filter(p => p.status === 'completed').length,
    archivedProjects: projects.filter(p => p.status === 'archived').length,
    totalContractValue: projects.reduce((sum, p) => sum + (Number(p.contractValue) || 0), 0),
    projectsOnTrack: projects.filter(p => {
      if (p.status !== 'active' || !p.targetCompletion) return false
      return new Date(p.targetCompletion) > new Date()
    }).length,
    projectsAtRisk: projects.filter(p => {
      if (p.status !== 'active' || !p.targetCompletion) return false
      const daysUntilTarget = (new Date(p.targetCompletion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return daysUntilTarget < 30 && daysUntilTarget > 0
    }).length,
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
      <div>
        <h1 className="text-3xl font-bold">Portfolio Overview</h1>
        <p className="text-muted-foreground mt-1">
          Multi-project view across all company projects
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Aggregate Metrics */}
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
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completedProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contract Value</p>
              <p className="text-2xl font-bold">
                ${stats.totalContractValue.toLocaleString('en-AU', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Project Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Active</span>
              </div>
              <span className="font-medium">{stats.activeProjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="font-medium">{stats.completedProjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-sm">Archived</span>
              </div>
              <span className="font-medium">{stats.archivedProjects}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Timeline Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">On Track</span>
              </div>
              <span className="font-medium">{stats.projectsOnTrack}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm">At Risk (due within 30 days)</span>
              </div>
              <span className="font-medium">{stats.projectsAtRisk}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm">No Target Date</span>
              </div>
              <span className="font-medium">
                {projects.filter(p => p.status === 'active' && !p.targetCompletion).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* All Projects List */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">All Company Projects</h2>
        </div>
        {projects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No projects found. Create your first project to get started.
          </div>
        ) : (
          <div className="divide-y">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}/ncr`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-10 rounded-full ${
                    project.status === 'active' ? 'bg-green-500' :
                    project.status === 'completed' ? 'bg-purple-500' :
                    'bg-gray-400'
                  }`}></div>
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.projectNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {project.contractValue && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Contract Value</p>
                      <p className="font-medium">
                        ${Number(project.contractValue).toLocaleString('en-AU', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                  )}
                  {project.targetCompletion && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Target Completion</p>
                      <p className="font-medium">
                        {new Date(project.targetCompletion).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    project.status === 'active' ? 'bg-green-100 text-green-800' :
                    project.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
