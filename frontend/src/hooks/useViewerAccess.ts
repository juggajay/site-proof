import { useAuth } from '@/lib/auth'
import { isViewerRole } from '@/lib/roles'

interface ViewerAccessState {
  isViewer: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  loading: boolean
}

/**
 * Hook to check if the current user has viewer (read-only) access.
 * Viewers can see everything but cannot create, edit, or delete anything.
 */
export function useViewerAccess(): ViewerAccessState {
  const { user, loading } = useAuth()

  if (loading) {
    return {
      isViewer: false,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      loading: true,
    }
  }

  if (!user) {
    return {
      isViewer: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      loading: false,
    }
  }

  const isViewer = isViewerRole(user.role)

  return {
    isViewer,
    canCreate: !isViewer,
    canEdit: !isViewer,
    canDelete: !isViewer,
    loading: false,
  }
}
