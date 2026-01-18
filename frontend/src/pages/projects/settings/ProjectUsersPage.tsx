import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken, useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { UserPlus, Trash2, Edit2, X, Check, Mail, Shield } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ProjectUser {
  id: string
  userId: string
  email: string
  fullName: string | null
  role: string
  status: string
  joinedAt: string
}

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full project access' },
  { value: 'project_manager', label: 'Project Manager', description: 'Manage project settings and team' },
  { value: 'quality_manager', label: 'Quality Manager', description: 'Manage quality, ITPs, NCRs' },
  { value: 'site_engineer', label: 'Site Engineer', description: 'Field quality and testing' },
  { value: 'foreman', label: 'Foreman', description: 'Manage lots and daily activities' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
]

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  inactive: 'bg-gray-100 text-gray-700',
}

export function ProjectUsersPage() {
  const { projectId } = useParams()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [editingUser, setEditingUser] = useState<ProjectUser | null>(null)
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  // Fetch project users
  useEffect(() => {
    async function fetchUsers() {
      const token = getAuthToken()
      if (!token || !projectId) return

      try {
        const response = await fetch(`${API_URL}/api/projects/${projectId}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setUsers(data.users || [])
        }
      } catch (err) {
        console.error('Failed to fetch project users:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [projectId])

  // Invite user
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return

    setInviting(true)
    const token = getAuthToken()

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'User invited',
          description: `${inviteEmail} has been added to the project.`,
        })
        setUsers(prev => [...prev, data.projectUser])
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole('viewer')
      } else {
        toast({
          title: 'Failed to invite user',
          description: data.message || 'An error occurred',
          variant: 'error',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to invite user',
        variant: 'error',
      })
    } finally {
      setInviting(false)
    }
  }

  // Update user role
  const handleUpdateRole = async () => {
    if (!editingUser || !editRole) return

    setSaving(true)
    const token = getAuthToken()

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/users/${editingUser.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: editRole }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Role updated',
          description: `${editingUser.fullName || editingUser.email}'s role has been updated.`,
        })
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role: editRole } : u))
        setEditingUser(null)
        setEditRole('')
      } else {
        toast({
          title: 'Failed to update role',
          description: data.message || 'An error occurred',
          variant: 'error',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Remove user
  const handleRemoveUser = async (user: ProjectUser) => {
    if (!confirm(`Are you sure you want to remove ${user.fullName || user.email} from this project?`)) {
      return
    }

    setRemovingUserId(user.id)
    const token = getAuthToken()

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/users/${user.userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        toast({
          title: 'User removed',
          description: `${user.fullName || user.email} has been removed from the project.`,
        })
        setUsers(prev => prev.filter(u => u.id !== user.id))
      } else {
        const data = await response.json()
        toast({
          title: 'Failed to remove user',
          description: data.message || 'An error occurred',
          variant: 'error',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove user',
        variant: 'error',
      })
    } finally {
      setRemovingUserId(null)
    }
  }

  const startEditing = (user: ProjectUser) => {
    setEditingUser(user)
    setEditRole(user.role)
  }

  const cancelEditing = () => {
    setEditingUser(null)
    setEditRole('')
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Project Team</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No team members yet</h3>
          <p className="mt-2 text-muted-foreground">
            Invite users to collaborate on this project.
          </p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Invite First User
          </button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Role</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Joined</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/25">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">
                        {user.fullName || 'No name'}
                        {user.userId === currentUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.id === user.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize">
                        {ROLES.find(r => r.value === user.role)?.label || user.role.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[user.status] || statusColors.inactive}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {user.userId !== currentUser?.id && (
                      <div className="flex items-center gap-2">
                        {editingUser?.id === user.id ? (
                          <>
                            <button
                              onClick={handleUpdateRole}
                              disabled={saving}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(user)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Change role"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveUser(user)}
                              disabled={removingUserId === user.id}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Remove from project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-background rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Invite User</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 rounded border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-sm border rounded hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
