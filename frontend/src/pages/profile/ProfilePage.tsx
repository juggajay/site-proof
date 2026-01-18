import { useState, useEffect } from 'react'
import { useAuth, getAuthToken } from '@/lib/auth'
import { User, Mail, Shield, Calendar, Building2, Phone, X, Lock, LogOut } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export function ProfilePage() {
  const { user, refreshUser, signOut } = useAuth()

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
  })

  // Password change modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')

  // Logout all devices state
  const [loggingOutAll, setLoggingOutAll] = useState(false)

  // Initialize form data when modal opens
  useEffect(() => {
    if (editModalOpen && user) {
      setFormData({
        fullName: user.name || user.fullName || '',
        phone: user.phone || '',
      })
    }
  }, [editModalOpen, user])

  // Reset password form when modal opens
  useEffect(() => {
    if (passwordModalOpen) {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordError('')
    }
  }, [passwordModalOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editModalOpen) setEditModalOpen(false)
        if (passwordModalOpen) setPasswordModalOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [editModalOpen, passwordModalOpen])

  // Format the role for display
  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Handle profile update
  const handleSaveProfile = async () => {
    setSaving(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
        }),
      })

      if (response.ok) {
        // Refresh user data
        if (refreshUser) {
          await refreshUser()
        }
        setEditModalOpen(false)
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been updated successfully.',
          variant: 'success',
        })
      } else {
        const data = await response.json()
        toast({
          title: 'Update Failed',
          description: data.message || 'Failed to update profile',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle password change
  const handleChangePassword = async () => {
    // Validate input
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirm password do not match')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      return
    }

    setPasswordError('')
    setChangingPassword(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword,
        }),
      })

      if (response.ok) {
        setPasswordModalOpen(false)
        toast({
          title: 'Password Changed',
          description: 'Your password has been changed successfully.',
          variant: 'success',
        })
      } else {
        const data = await response.json()
        setPasswordError(data.message || 'Failed to change password')
      }
    } catch (err) {
      setPasswordError('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  // Handle logout all devices
  const handleLogoutAllDevices = async () => {
    if (!confirm('This will log you out from all devices including this one. Continue?')) {
      return
    }

    setLoggingOutAll(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/logout-all-devices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        toast({
          title: 'Logged Out',
          description: 'You have been logged out from all devices.',
          variant: 'success',
        })
        // Sign out from current session
        await signOut()
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.message || 'Failed to logout from all devices',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to logout from all devices',
        variant: 'destructive',
      })
    } finally {
      setLoggingOutAll(false)
    }
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
                {user?.name || user?.fullName || user?.email?.split('@')[0]}
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
                <Phone className="h-4 w-4" />
                Phone
              </dt>
              <dd className="text-sm">{user?.phone || 'Not set'}</dd>
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
          <button
            onClick={() => setPasswordModalOpen(true)}
            className="w-full sm:w-auto rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Change Password
          </button>
          <button
            onClick={() => setEditModalOpen(true)}
            className="w-full sm:w-auto rounded-lg border px-4 py-2 text-sm hover:bg-muted ml-0 sm:ml-3"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogoutAllDevices}
            disabled={loggingOutAll}
            className="w-full sm:w-auto rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 ml-0 sm:ml-3 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              {loggingOutAll ? 'Logging out...' : 'Logout All Devices'}
            </span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditModalOpen(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +61 400 000 000"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPasswordModalOpen(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPasswordModalOpen(false)}
                disabled={changingPassword}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
