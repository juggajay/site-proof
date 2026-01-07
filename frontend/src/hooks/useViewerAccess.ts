import { useAuth } from '@/lib/auth'

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

  // Check if user is a viewer role
  const role = user.role?.toLowerCase() || ''
  const isViewerRole = role === 'viewer'

  return {
    isViewer: isViewerRole,
    canCreate: !isViewerRole,
    canEdit: !isViewerRole,
    canDelete: !isViewerRole,
    loading: false,
  }
}
