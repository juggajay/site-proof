import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { Settings, Users, ClipboardList, Bell, MapPin, Puzzle } from 'lucide-react'
import type { Project, SettingsTab, HpRecipient, EnabledModules } from './types'
import { DEFAULT_ENABLED_MODULES } from './types'

// Lazy-loaded tab components
const GeneralSettingsTab = lazy(() => import('./components/GeneralSettingsTab').then(m => ({ default: m.GeneralSettingsTab })))
const DangerZone = lazy(() => import('./components/DangerZone').then(m => ({ default: m.DangerZone })))
const TeamTab = lazy(() => import('./components/TeamTab').then(m => ({ default: m.TeamTab })))
const AreasTab = lazy(() => import('./components/AreasTab').then(m => ({ default: m.AreasTab })))
const ITPTemplatesTab = lazy(() => import('./components/ITPTemplatesTab').then(m => ({ default: m.ITPTemplatesTab })))
const NotificationsTab = lazy(() => import('./components/NotificationsTab').then(m => ({ default: m.NotificationsTab })))
const ModulesTab = lazy(() => import('./components/ModulesTab').then(m => ({ default: m.ModulesTab })))

const TABS = [
  { id: 'general' as SettingsTab, label: 'General', icon: Settings },
  { id: 'team' as SettingsTab, label: 'Team', icon: Users },
  { id: 'areas' as SettingsTab, label: 'Areas', icon: MapPin },
  { id: 'itp-templates' as SettingsTab, label: 'ITP Templates', icon: ClipboardList },
  { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
  { id: 'modules' as SettingsTab, label: 'Modules', icon: Puzzle },
]

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export function ProjectSettingsPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Settings parsed from project data for child components
  const [hpRecipients, setHpRecipients] = useState<HpRecipient[]>([])
  const [hpApprovalRequirement, setHpApprovalRequirement] = useState<'any' | 'superintendent'>('any')
  const [requireSubcontractorVerification, setRequireSubcontractorVerification] = useState(false)
  const [enabledModules, setEnabledModules] = useState<EnabledModules>({ ...DEFAULT_ENABLED_MODULES })

  const canViewContractValue = user && ['admin', 'owner', 'project_manager'].includes(user.role || (user as any)?.roleInCompany || '')
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'general'

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab })
  }

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      if (!projectId) return

      try {
        const data = await apiFetch<{ project: any }>(`/api/projects/${projectId}`)
        setProject(data.project)

        // Parse settings JSON for child components
        if (data.project.settings) {
          try {
            const settings = typeof data.project.settings === 'string'
              ? JSON.parse(data.project.settings)
              : data.project.settings
            if (settings.hpRecipients && Array.isArray(settings.hpRecipients)) {
              setHpRecipients(settings.hpRecipients)
            }
            if (settings.hpApprovalRequirement) {
              setHpApprovalRequirement(settings.hpApprovalRequirement)
            }
            if (settings.enabledModules) {
              setEnabledModules(prev => ({ ...prev, ...settings.enabledModules }))
            }
            if (typeof settings.requireSubcontractorVerification === 'boolean') {
              setRequireSubcontractorVerification(settings.requireSubcontractorVerification)
            }
          } catch (e) {
            // Invalid JSON, use defaults
          }
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId])

  const handleProjectUpdate = (updatedProject: Project) => {
    setProject(updatedProject)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Project Settings</h1>
      <p className="text-muted-foreground mb-6">
        {project ? project.name : `Project ID: ${projectId}`}
      </p>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="flex gap-4" aria-label="Settings sections">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6" role="tabpanel">
        <Suspense fallback={<TabSpinner />}>
          {activeTab === 'general' && project && projectId && (
            <>
              <GeneralSettingsTab
                projectId={projectId}
                project={project}
                canViewContractValue={!!canViewContractValue}
                onProjectUpdate={handleProjectUpdate}
              />
              <DangerZone
                projectId={projectId}
                project={project}
                onProjectUpdate={handleProjectUpdate}
              />
            </>
          )}

          {activeTab === 'team' && projectId && (
            <TeamTab projectId={projectId} />
          )}

          {activeTab === 'areas' && projectId && (
            <AreasTab projectId={projectId} />
          )}

          {activeTab === 'itp-templates' && projectId && (
            <ITPTemplatesTab projectId={projectId} />
          )}

          {activeTab === 'notifications' && projectId && (
            <NotificationsTab
              projectId={projectId}
              initialHpRecipients={hpRecipients}
              initialHpApprovalRequirement={hpApprovalRequirement}
              initialRequireSubcontractorVerification={requireSubcontractorVerification}
            />
          )}

          {activeTab === 'modules' && projectId && (
            <ModulesTab
              projectId={projectId}
              initialEnabledModules={enabledModules}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}
