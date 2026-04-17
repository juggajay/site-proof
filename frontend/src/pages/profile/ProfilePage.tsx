import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth, getAuthToken } from '@/lib/auth'
import { Mail, Shield, Calendar, Building2, Phone, Lock, LogOut, Camera, Trash2 } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { apiFetch, apiUrl } from '@/lib/api'
import { createMutationErrorHandler } from '@/lib/errorHandling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

export function ProfilePage() {
  const { user, refreshUser, signOut } = useAuth()

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
  })

  // Password change modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Initialize form data when modal opens
  useEffect(() => {
    if (editModalOpen && user) {
      setFormData({
        fullName: user.name || user.fullName || '',
        phone: user.phone || '',
      })
      setAvatarPreview(null) // Reset preview
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

  // Profile update mutation
  const saveProfileMutation = useMutation({
    mutationFn: (data: { fullName: string; phone: string }) =>
      apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      if (refreshUser) await refreshUser()
      setEditModalOpen(false)
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
        variant: 'success',
      })
    },
    onError: createMutationErrorHandler('Failed to update profile'),
  })

  const saving = saveProfileMutation.isPending

  const handleSaveProfile = () => {
    saveProfileMutation.mutate({
      fullName: formData.fullName,
      phone: formData.phone,
    })
  }

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setPasswordModalOpen(false)
      toast({
        title: 'Password Changed',
        description: 'Your password has been changed successfully.',
        variant: 'success',
      })
    },
    onError: () => {
      setPasswordError('Failed to change password')
    },
  })

  const changingPassword = changePasswordMutation.isPending

  const handleChangePassword = () => {
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
    changePasswordMutation.mutate(passwordData)
  }

  // Logout all devices mutation
  const logoutAllMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/auth/logout-all-devices', { method: 'POST' }),
    onSuccess: async () => {
      toast({
        title: 'Logged Out',
        description: 'You have been logged out from all devices.',
        variant: 'success',
      })
      await signOut()
    },
    onError: createMutationErrorHandler('Failed to logout from all devices'),
  })

  const loggingOutAll = logoutAllMutation.isPending

  const handleLogoutAllDevices = () => {
    if (!confirm('This will log you out from all devices including this one. Continue?')) {
      return
    }
    logoutAllMutation.mutate()
  }

  // Avatar upload mutation (FormData - cannot use apiFetch)
  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = getAuthToken()
      const fd = new FormData()
      fd.append('avatar', file)

      const response = await fetch(apiUrl('/api/auth/avatar'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to upload avatar')
      }
      return response.json()
    },
    onSuccess: async () => {
      if (refreshUser) await refreshUser()
      setAvatarPreview(null)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
      toast({
        title: 'Avatar Updated',
        description: 'Your avatar has been updated successfully.',
        variant: 'success',
      })
    },
    onError: createMutationErrorHandler('Failed to upload avatar'),
  })

  // Avatar delete mutation
  const avatarDeleteMutation = useMutation({
    mutationFn: () => apiFetch('/api/auth/avatar', { method: 'DELETE' }),
    onSuccess: async () => {
      if (refreshUser) await refreshUser()
      toast({
        title: 'Avatar Removed',
        description: 'Your avatar has been removed.',
        variant: 'success',
      })
    },
    onError: createMutationErrorHandler('Failed to remove avatar'),
  })

  const uploadingAvatar = avatarUploadMutation.isPending || avatarDeleteMutation.isPending

  // Handle avatar file selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a JPEG, PNG, GIF, or WebP image.',
        variant: 'error',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select an image under 5MB.',
        variant: 'error',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = () => {
    const file = avatarInputRef.current?.files?.[0]
    if (!file) {
      toast({
        title: 'No Image Selected',
        description: 'Please select an image to upload.',
        variant: 'error',
      })
      return
    }
    avatarUploadMutation.mutate(file)
  }

  const handleRemoveAvatar = () => {
    if (!confirm('Are you sure you want to remove your avatar?')) return
    avatarDeleteMutation.mutate()
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
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-3xl font-bold">
                  {(user?.fullName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}

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
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setPasswordModalOpen(true)}>
            Change Password
          </Button>
          <Button variant="outline" onClick={() => setEditModalOpen(true)}>
            Edit Profile
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogoutAllDevices}
            disabled={loggingOutAll}
          >
            <LogOut className="h-4 w-4" />
            {loggingOutAll ? 'Logging out...' : 'Logout All Devices'}
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Modal onClose={() => setEditModalOpen(false)} className="max-w-md">
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalBody>
            {/* Avatar Upload Section */}
            <div className="mb-6">
              <Label className="mb-3">Profile Picture</Label>
              <div className="flex items-center gap-4">
                {/* Avatar Preview */}
                <div className="relative">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Current avatar"
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-border">
                      <span className="text-2xl font-bold">
                        {(user?.fullName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 rounded-full h-7 w-7"
                    title="Change avatar"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />

                <div className="flex flex-col gap-2">
                  {avatarPreview && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Save Avatar'}
                    </Button>
                  )}
                  {user?.avatarUrl && !avatarPreview && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    JPEG, PNG, GIF or WebP. Max 5MB.
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="mb-1">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="mb-1">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +61 400 000 000"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <Modal onClose={() => setPasswordModalOpen(false)} className="max-w-md">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Change Password
            </div>
          </ModalHeader>
          <ModalBody>
            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className="mb-1">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <Label htmlFor="newPassword" className="mb-1">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="mb-1">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)} disabled={changingPassword}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
