import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { ReactNode } from 'react'
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles'

interface RoleProtectedRouteProps {
  children: ReactNode
  allowedRoles: readonly string[]
  redirectTo?: string
}

export function RoleProtectedRoute({
  children,
  allowedRoles,
  redirectTo: _redirectTo = '/dashboard'
}: RoleProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if user's role is in allowed roles
  const userRole = user.role || 'member'
  const hasAccess = allowedRoles.includes(userRole)

  if (!hasAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access this page.
          Contact your administrator if you believe this is an error.
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go Back
        </button>
      </div>
    )
  }

  return <>{children}</>
}

// Helper to check if a role has admin privileges
export function isAdminRole(role: string): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.ADMIN)
}

// Helper to check if a role can view commercial data
export function canViewCommercialData(role: string): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL)
}
