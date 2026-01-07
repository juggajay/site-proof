import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-civil-800 to-civil-900">
      <div className="w-full max-w-md p-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">SiteProof</h1>
          <p className="text-civil-200">Civil Execution & Conformance</p>
        </div>
        <div className="rounded-lg bg-card p-8 shadow-xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
