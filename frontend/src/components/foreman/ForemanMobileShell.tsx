// ForemanMobileShell - Thin wrapper for foreman-specific routes (e.g. /foreman/today)
// Navigation and capture modal are now handled at the MainLayout level via MobileNav
// and ForemanBottomNavV2, so this shell only provides the Outlet for child routes.
import { Outlet } from 'react-router-dom'

export function ForemanMobileShell() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  )
}

export default ForemanMobileShell
