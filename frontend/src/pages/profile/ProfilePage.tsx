import { useAuth } from '@/lib/auth'
import { User, Mail, Shield, Calendar, Building2 } from 'lucide-react'

export function ProfilePage() {
  const { user } = useAuth()

  // Format the role for display
  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          View and manage your account information
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-10 w-10" />
            </div>

            {/* User Info */}
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-semibold">
                {user?.name || user?.email?.split('@')[0]}
              </h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                <Shield className="h-3 w-3" />
                {user?.role ? formatRole(user.role) : 'User'}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="border-t">
          <dl className="divide-y">
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Mail className="h-4 w-4" />
                Email
              </dt>
              <dd className="text-sm">{user?.email}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Shield className="h-4 w-4" />
                Role
              </dt>
              <dd className="text-sm">{user?.role ? formatRole(user.role) : 'User'}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Building2 className="h-4 w-4" />
                Company
              </dt>
              <dd className="text-sm">{user?.companyId ? 'Company assigned' : 'No company assigned'}</dd>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-32">
                <Calendar className="h-4 w-4" />
                Member since
              </dt>
              <dd className="text-sm">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-AU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Unknown'
                }
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
        <div className="space-y-3">
          <button className="w-full sm:w-auto rounded-lg border px-4 py-2 text-sm hover:bg-muted">
            Change Password
          </button>
          <button className="w-full sm:w-auto rounded-lg border px-4 py-2 text-sm hover:bg-muted ml-0 sm:ml-3">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  )
}
