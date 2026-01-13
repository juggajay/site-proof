import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAuthToken } from '@/lib/auth'

interface BreadcrumbItem {
  label: string
  path: string
  isLast: boolean
}

interface LocationState {
  returnFilters?: string
}

export function Breadcrumbs() {
  const location = useLocation()
  const { projectId, lotId } = useParams()
  const [lotNumber, setLotNumber] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)

  // Get return filters from navigation state (passed from LotsPage)
  const locationState = location.state as LocationState | null
  const returnFilters = locationState?.returnFilters || ''

  // Fetch lot number if we're on a lot detail page
  useEffect(() => {
    async function fetchLotInfo() {
      if (!lotId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setLotNumber(data.lot?.lotNumber || null)
        }
      } catch (err) {
        console.error('Failed to fetch lot info for breadcrumb:', err)
      }
    }

    fetchLotInfo()
  }, [lotId])

  // Fetch project name if we have a projectId
  useEffect(() => {
    async function fetchProjectInfo() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setProjectName(data.project?.name || null)
        }
      } catch (err) {
        console.error('Failed to fetch project info for breadcrumb:', err)
      }
    }

    fetchProjectInfo()
  }, [projectId])

  const pathSegments = location.pathname.split('/').filter(Boolean)

  // Build breadcrumbs based on path
  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with Dashboard
  breadcrumbs.push({
    label: 'Dashboard',
    path: '/dashboard',
    isLast: pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard'),
  })

  if (pathSegments[0] === 'projects') {
    // Add Projects breadcrumb
    breadcrumbs.push({
      label: 'Projects',
      path: '/projects',
      isLast: pathSegments.length === 1,
    })

    // If we have a project ID
    if (projectId && pathSegments.length > 1) {
      // Check what subpage we're on within a project
      const subPage = pathSegments[2] // e.g., 'lots', 'ncr', 'itp', etc.

      // Project-level navigation items
      if (subPage === 'lots') {
        // Include returnFilters in Lots path if we're on a lot detail page
        const lotsPath = returnFilters && lotId
          ? `/projects/${projectId}/lots?${returnFilters}`
          : `/projects/${projectId}/lots`
        breadcrumbs.push({
          label: 'Lots',
          path: lotsPath,
          isLast: pathSegments.length === 3,
        })

        // If we're on a lot detail page
        if (lotId && pathSegments.length >= 4) {
          // Check if it's an edit page
          if (pathSegments[4] === 'edit') {
            breadcrumbs.push({
              label: lotNumber || `Lot ${lotId.substring(0, 8)}...`,
              path: `/projects/${projectId}/lots/${lotId}`,
              isLast: false,
            })
            breadcrumbs.push({
              label: 'Edit',
              path: `/projects/${projectId}/lots/${lotId}/edit`,
              isLast: true,
            })
          } else {
            breadcrumbs.push({
              label: lotNumber || `Lot ${lotId.substring(0, 8)}...`,
              path: `/projects/${projectId}/lots/${lotId}`,
              isLast: true,
            })
          }
        }
      } else if (subPage === 'ncr') {
        breadcrumbs.push({
          label: 'NCRs',
          path: `/projects/${projectId}/ncr`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'itp') {
        breadcrumbs.push({
          label: 'ITPs',
          path: `/projects/${projectId}/itp`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'hold-points') {
        breadcrumbs.push({
          label: 'Hold Points',
          path: `/projects/${projectId}/hold-points`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'tests') {
        breadcrumbs.push({
          label: 'Test Results',
          path: `/projects/${projectId}/tests`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'diary') {
        breadcrumbs.push({
          label: 'Daily Diary',
          path: `/projects/${projectId}/diary`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'claims') {
        breadcrumbs.push({
          label: 'Progress Claims',
          path: `/projects/${projectId}/claims`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'costs') {
        breadcrumbs.push({
          label: 'Costs',
          path: `/projects/${projectId}/costs`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'documents') {
        breadcrumbs.push({
          label: 'Documents',
          path: `/projects/${projectId}/documents`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'subcontractors') {
        breadcrumbs.push({
          label: 'Subcontractors',
          path: `/projects/${projectId}/subcontractors`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'dockets') {
        breadcrumbs.push({
          label: 'Docket Approvals',
          path: `/projects/${projectId}/dockets`,
          isLast: pathSegments.length === 3,
        })
      } else if (subPage === 'reports') {
        breadcrumbs.push({
          label: 'Reports',
          path: `/projects/${projectId}/reports`,
          isLast: pathSegments.length === 3,
        })
      }
    }
  } else if (pathSegments[0] === 'settings') {
    breadcrumbs.push({
      label: 'Settings',
      path: '/settings',
      isLast: true,
    })
  } else if (pathSegments[0] === 'my-company') {
    breadcrumbs.push({
      label: 'My Company',
      path: '/my-company',
      isLast: true,
    })
  }

  // Update isLast for all items
  breadcrumbs.forEach((item, index) => {
    item.isLast = index === breadcrumbs.length - 1
  })

  // Don't show breadcrumbs if we're on dashboard only
  if (breadcrumbs.length === 1 && breadcrumbs[0].path === '/dashboard') {
    return null
  }

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
      </Link>
      {breadcrumbs.slice(1).map((item, index) => (
        <div key={item.path} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {item.isLast ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              to={item.path}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
