import { useAuth, getAuthToken } from '@/lib/auth'
import { Bell, LogOut, User, ChevronDown, FolderKanban } from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Breadcrumbs } from './Breadcrumbs'

interface Project {
  id: string
  name: string
  projectNumber: string
}

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)
  const projectSelectorRef = useRef<HTMLDivElement>(null)

  // Find the current project from the list
  const currentProject = projects.find(p => p.id === projectId)

  // Fetch user's projects
  useEffect(() => {
    async function fetchProjects() {
      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      try {
        const response = await fetch(`${apiUrl}/api/projects`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setProjects(data.projects || [])
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      }
    }
    fetchProjects()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) {
        setIsProjectSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectSelectorOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleProjectSelect = (project: Project) => {
    setIsProjectSelectorOpen(false)
    // Extract the current path segment after projectId (e.g., /lots, /ncr)
    const pathParts = location.pathname.split('/')
    const projectIndex = pathParts.indexOf(projectId || '')
    let targetPath = `/projects/${project.id}/lots` // Default to lots page

    if (projectIndex !== -1 && pathParts.length > projectIndex + 1) {
      // Navigate to the same module in the new project
      const modulePath = pathParts.slice(projectIndex + 1).join('/')
      targetPath = `/projects/${project.id}/${modulePath}`
    }

    navigate(targetPath)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-4">
        {/* Project Selector - only show when in a project context */}
        {projectId && projects.length > 0 && (
          <div ref={projectSelectorRef} className="relative">
            <button
              onClick={() => setIsProjectSelectorOpen(!isProjectSelectorOpen)}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              aria-label="Select project"
              aria-expanded={isProjectSelectorOpen}
              aria-haspopup="listbox"
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate font-medium">
                {currentProject?.name || 'Select Project'}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isProjectSelectorOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProjectSelectorOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border bg-card shadow-lg">
                <div className="p-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Switch Project
                  </div>
                  <ul role="listbox" className="max-h-[300px] overflow-auto">
                    {projects.map((project) => (
                      <li key={project.id}>
                        <button
                          onClick={() => handleProjectSelect(project)}
                          className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                            project.id === projectId ? 'bg-primary/10 text-primary' : ''
                          }`}
                          role="option"
                          aria-selected={project.id === projectId}
                        >
                          <FolderKanban className="h-4 w-4 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{project.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {project.projectNumber}
                            </div>
                          </div>
                          {project.id === projectId && (
                            <span className="ml-auto text-xs text-primary">Current</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{user?.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
