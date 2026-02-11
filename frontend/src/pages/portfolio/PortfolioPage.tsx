import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage } from '@/lib/errorHandling'
import { FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, Clock, DollarSign, AlertCircle, ExternalLink } from 'lucide-react'

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

interface CashFlowSummary {
  totalClaimed: number
  totalCertified: number
  totalPaid: number
  outstanding: number
}

interface CriticalNCR {
  id: string
  ncrNumber: string
  description: string
  category: string
  status: string
  dueDate?: string
  isOverdue: boolean
  daysUntilDue: number | null
  project: {
    id: string
    name: string
    projectNumber: string
  }
  link: string
}

interface RiskIndicator {
  type: string
  severity: 'critical' | 'warning'
  message: string
  explanation: string
}

interface ProjectAtRisk {
  id: string
  name: string
  projectNumber: string
  riskIndicators: RiskIndicator[]
  riskLevel: 'critical' | 'warning'
  link: string
}

export function PortfolioPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowSummary>({
    totalClaimed: 0,
    totalCertified: 0,
    totalPaid: 0,
    outstanding: 0
  })
  const [criticalNCRs, setCriticalNCRs] = useState<CriticalNCR[]>([])
  const [projectsAtRisk, setProjectsAtRisk] = useState<ProjectAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects (required) and supplementary data in parallel
        const [projectsResult, cashFlowResult, ncrsResult, risksResult] = await Promise.allSettled([
          apiFetch<{ projects: Project[] }>('/api/projects'),
          apiFetch<CashFlowSummary>('/api/dashboard/portfolio-cashflow'),
          apiFetch<{ ncrs: CriticalNCR[] }>('/api/dashboard/portfolio-ncrs'),
          apiFetch<{ projectsAtRisk: ProjectAtRisk[] }>('/api/dashboard/portfolio-risks'),
        ])

        if (projectsResult.status === 'rejected') {
          throw new Error('Failed to fetch projects')
        }

        setProjects(projectsResult.value.projects || [])

        if (cashFlowResult.status === 'fulfilled') {
          setCashFlow(cashFlowResult.value)
        }

        if (ncrsResult.status === 'fulfilled') {
          setCriticalNCRs(ncrsResult.value.ncrs || [])
        }

        if (risksResult.status === 'fulfilled') {
          setProjectsAtRisk(risksResult.value.projectsAtRisk || [])
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load projects'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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

      {/* Cash Flow Summary */}
      <div className="bg-card rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Cash Flow Summary</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Claimed</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              ${cashFlow.totalClaimed.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Certified</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              ${cashFlow.totalCertified.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              ${cashFlow.totalPaid.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
              ${cashFlow.outstanding.toLocaleString('en-AU', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Critical NCRs Section */}
      {criticalNCRs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="p-4 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Critical NCRs Across Projects</h2>
            <span className="ml-auto bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {criticalNCRs.length}
            </span>
          </div>
          <div className="divide-y divide-red-200 dark:divide-red-800">
            {criticalNCRs.map((ncr) => (
              <div
                key={ncr.id}
                className="p-4 hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                onClick={() => navigate(ncr.link)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-red-700 dark:text-red-400">{ncr.ncrNumber}</span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded">
                        {ncr.status}
                      </span>
                      {ncr.isOverdue && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1">{ncr.description}</p>
                    <p className="text-xs text-red-500/70 dark:text-red-400/70 mt-1">
                      {ncr.project.name} ({ncr.project.projectNumber})
                      {ncr.dueDate && ` • Due: ${new Date(ncr.dueDate).toLocaleDateString('en-AU')}`}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-red-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects at Risk Section */}
      {projectsAtRisk.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="p-4 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">Projects at Risk</h2>
            <span className="ml-auto bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {projectsAtRisk.length}
            </span>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800">
            {projectsAtRisk.map((project) => (
              <div
                key={project.id}
                className="p-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
                onClick={() => navigate(project.link)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700 dark:text-amber-400">{project.name}</span>
                      <span className="text-xs text-amber-600/70 dark:text-amber-400/70">({project.projectNumber})</span>
                      {project.riskLevel === 'critical' && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {project.riskIndicators.map((indicator, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            indicator.severity === 'critical'
                              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                          }`}>
                            {indicator.message}
                          </span>
                          <span className="text-xs text-amber-500/70 dark:text-amber-400/70 italic">
                            {indicator.explanation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-amber-400 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
