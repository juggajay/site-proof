// RoleSwitcher - Dev tool to test different user roles
// Only visible to admin/owner users
import { useState } from 'react'
import { UserCog, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth, getRoleOverride } from '@/lib/auth'

const ROLE_OVERRIDE_KEY = 'siteproof_role_override'

const AVAILABLE_ROLES = [
  { id: 'owner', label: 'Owner', description: 'Full system access' },
  { id: 'admin', label: 'Admin', description: 'Administrative access' },
  { id: 'project_manager', label: 'Project Manager', description: 'Manage projects & teams' },
  { id: 'site_manager', label: 'Site Manager', description: 'Manage site operations' },
  { id: 'foreman', label: 'Foreman', description: 'Field supervision' },
  { id: 'subcontractor', label: 'Subcontractor', description: 'Subcontractor portal' },
]

// Helper to set role override
function setRoleOverride(role: string | null) {
  if (role) {
    localStorage.setItem(ROLE_OVERRIDE_KEY, role)
  } else {
    localStorage.removeItem(ROLE_OVERRIDE_KEY)
  }
  // Trigger a page reload to apply the change
  window.location.reload()
}

export function RoleSwitcher() {
  const { user, actualRole: authActualRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const actualRole = authActualRole || ''
  const currentOverride = getRoleOverride()
  const effectiveRole = user?.role || actualRole

  // Only show for admin/owner users (based on actual role, not override)
  if (!['admin', 'owner'].includes(actualRole)) {
    return null
  }

  const handleRoleSelect = (roleId: string) => {
    if (roleId === actualRole) {
      // Selecting actual role clears the override
      setRoleOverride(null)
    } else {
      setRoleOverride(roleId)
    }
  }

  const handleClearOverride = () => {
    setRoleOverride(null)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-20 right-4 z-50 md:bottom-4',
          'flex items-center gap-2 px-3 py-2 rounded-full shadow-lg',
          'text-sm font-medium transition-all',
          'touch-manipulation',
          currentOverride
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-gray-800 text-white hover:bg-gray-700'
        )}
      >
        <UserCog className="h-4 w-4" />
        <span className="hidden sm:inline">
          {currentOverride ? `Viewing as: ${effectiveRole}` : 'Switch Role'}
        </span>
        <span className="sm:hidden">
          {currentOverride ? effectiveRole.slice(0, 3).toUpperCase() : 'Role'}
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-x-4 bottom-4 md:inset-auto md:right-4 md:bottom-4 md:w-80 bg-card rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/50">
              <div>
                <h3 className="font-semibold">Role Switcher</h3>
                <p className="text-xs text-muted-foreground">Test different user views</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current status */}
            {currentOverride && (
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Role Override Active
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Your actual role: {actualRole}
                    </p>
                  </div>
                  <button
                    onClick={handleClearOverride}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-300 dark:hover:bg-amber-700"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Role list */}
            <div className="p-2 max-h-[50vh] overflow-y-auto">
              {AVAILABLE_ROLES.map((role) => {
                const isActual = role.id === actualRole
                const isSelected = role.id === effectiveRole

                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {role.id.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.label}</span>
                        {isActual && (
                          <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                            Your role
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {role.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                Dev tool - changes apply after page reload
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
