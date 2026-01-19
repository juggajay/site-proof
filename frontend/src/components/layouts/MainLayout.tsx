import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'

export function MainLayout() {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Add subtle fade transition when navigating between pages
  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => setIsTransitioning(false), 150)
    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className={`flex-1 overflow-auto p-6 pb-20 md:pb-6 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
