import { useAuth, getAuthToken } from '@/lib/auth'
import { Bell, LogOut, User, ChevronDown, FolderKanban, AlertCircle, CheckCircle, Clock, Settings, UserCircle, Search } from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Breadcrumbs } from './Breadcrumbs'

interface Project {
  id: string
  name: string
  projectNumber: string
}

interface Notification {
  id: string
  type: 'info' | 'warning' | 'success'
  title: string
  message: string
  timestamp: string
  read: boolean
}

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)
  const [projectSearchTerm, setProjectSearchTerm] = useState('')
  const projectSelectorRef = useRef<HTMLDivElement>(null)
  const projectSearchInputRef = useRef<HTMLInputElement>(null)

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'info' | 'warning' | 'success'>('all')
  const notificationRef = useRef<HTMLDivElement>(null)

  // User menu state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Find the current project from the list
  const currentProject = projects.find(p => p.id === projectId)

  // Filter projects by search term
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
    p.projectNumber.toLowerCase().includes(projectSearchTerm.toLowerCase())
  )

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // Focus search input when project selector opens and reset search when closing
  useEffect(() => {
    if (isProjectSelectorOpen) {
      setTimeout(() => projectSearchInputRef.current?.focus(), 100)
    } else {
      setProjectSearchTerm('')
    }
  }, [isProjectSelectorOpen])

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

  // Fetch notifications (mock data for now - will be replaced with API)
  useEffect(() => {
    // Mock notifications for demonstration
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'warning',
        title: 'Hold Point Pending',
        message: 'LOT-001 requires inspector sign-off',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        read: false,
      },
      {
        id: '2',
        type: 'success',
        title: 'Test Results Uploaded',
        message: 'Compaction test results for LOT-003 uploaded',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        read: false,
      },
      {
        id: '3',
        type: 'info',
        title: 'NCR Assigned',
        message: 'NCR-2024-001 has been assigned to you',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        read: true,
      },
      {
        id: '4',
        type: 'info',
        title: 'NCR Response Required',
        message: 'NCR-2024-002 awaiting your response',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        read: false,
      },
      {
        id: '5',
        type: 'warning',
        title: 'ITP Overdue',
        message: 'ITP checklist for LOT-005 is 3 days overdue',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
        read: true,
      },
      {
        id: '6',
        type: 'info',
        title: 'Old NCR Closed',
        message: 'NCR-2023-089 has been closed',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
        read: true,
      },
      {
        id: '7',
        type: 'success',
        title: 'Old Test Complete',
        message: 'Soil testing for Section B completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days ago
        read: true,
      },
    ]
    setNotifications(mockNotifications)
  }, [])

  // Filter notifications by type
  const filteredNotifications = notificationFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === notificationFilter)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) {
        setIsProjectSelectorOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdowns on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectSelectorOpen(false)
        setIsNotificationOpen(false)
        setIsUserMenuOpen(false)
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

  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // Check if notification is old (more than 7 days)
  const isOldNotification = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = diffMs / 86400000
    return diffDays > 7
  }

  // Count old notifications
  const oldNotificationCount = notifications.filter(n => isOldNotification(n.timestamp)).length

  // Clear old notifications
  const clearOldNotifications = () => {
    setNotifications(prev => prev.filter(n => !isOldNotification(n.timestamp)))
  }

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get notification icon by type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Clock className="h-4 w-4 text-blue-500" />
    }
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
              <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-[150px] truncate font-medium">
                {currentProject?.name || 'Select Project'}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isProjectSelectorOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isProjectSelectorOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[260px] rounded-lg border bg-card shadow-lg">
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Switch Project
                  </div>
                  {/* Search input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={projectSearchInputRef}
                      type="text"
                      placeholder="Search projects..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full rounded border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      aria-label="Search projects"
                    />
                  </div>
                  <ul role="listbox" className="max-h-[300px] overflow-auto">
                    {filteredProjects.length === 0 ? (
                      <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No projects found
                      </li>
                    ) : (
                      filteredProjects.map((project) => (
                        <li key={project.id}>
                          <button
                            onClick={() => handleProjectSelect(project)}
                            className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                              project.id === projectId ? 'bg-primary/10 text-primary' : ''
                            }`}
                            role="option"
                            aria-selected={project.id === projectId}
                          >
                            <FolderKanban className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
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
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <div ref={notificationRef} className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative rounded-full p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
            aria-label="Notifications"
            aria-expanded={isNotificationOpen}
            aria-haspopup="true"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-medium text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {oldNotificationCount > 0 && (
                    <button
                      onClick={clearOldNotifications}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Clear old
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>
              {/* Filter tabs */}
              <div className="flex border-b px-2">
                {(['all', 'info', 'warning', 'success'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setNotificationFilter(filter)}
                    className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                      notificationFilter === filter
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter === 'info' ? 'NCR' : filter === 'warning' ? 'Alerts' : filter === 'success' ? 'Updates' : 'All'}
                  </button>
                ))}
              </div>
              <div className="max-h-[350px] overflow-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No {notificationFilter === 'all' ? '' : notificationFilter} notifications
                  </div>
                ) : (
                  <ul>
                    {filteredNotifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`border-b last:border-0 ${!notification.read ? 'bg-primary/5' : ''}`}
                      >
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{notification.title}</span>
                              {!notification.read && (
                                <span className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <span className="mt-1 text-xs text-muted-foreground">
                              {formatRelativeTime(notification.timestamp)}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t p-2">
                <button className="w-full rounded px-3 py-2 text-sm text-primary hover:bg-muted">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
        {/* User Profile Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
            aria-label="User menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium max-w-[150px] truncate hidden sm:block">{user?.email}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform hidden sm:block ${isUserMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border bg-card shadow-lg">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">{user?.name || user?.email?.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    navigate('/profile')
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    navigate('/settings')
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </button>
              </div>
              <div className="border-t p-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    handleSignOut()
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
