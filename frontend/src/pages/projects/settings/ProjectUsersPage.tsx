import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { apiFetch } from '@/lib/api'
import { UserPlus, Trash2, Edit2, X, Check, Mail, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

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
  inactive: 'bg-muted text-foreground',
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
      if (!projectId) return

      try {
        const data = await apiFetch<{ users: ProjectUser[] }>(`/api/projects/${projectId}/users`)
        setUsers(data.users || [])
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

    try {
      const data = await apiFetch<{ projectUser: ProjectUser }>(`/api/projects/${projectId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      toast({
        title: 'User invited',
        description: `${inviteEmail} has been added to the project.`,
      })
      setUsers(prev => [...prev, data.projectUser])
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('viewer')
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

    try {
      await apiFetch(`/api/projects/${projectId}/users/${editingUser.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: editRole }),
      })
      toast({
        title: 'Role updated',
        description: `${editingUser.fullName || editingUser.email}'s role has been updated.`,
      })
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role: editRole } : u))
      setEditingUser(null)
      setEditRole('')
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

    try {
      await apiFetch(`/api/projects/${projectId}/users/${user.userId}`, {
        method: 'DELETE',
      })
      toast({
        title: 'User removed',
        description: `${user.fullName || user.email} has been removed from the project.`,
      })
      setUsers(prev => prev.filter(u => u.id !== user.id))
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
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
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
          <Button onClick={() => setShowInviteModal(true)} className="mt-4">
            Invite First User
          </Button>
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
                      <NativeSelect
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-auto"
                      >
                        {ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </NativeSelect>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleUpdateRole}
                              disabled={saving}
                              className="text-green-600 hover:bg-green-50"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={cancelEditing}
                              className="text-muted-foreground hover:bg-muted/50"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(user)}
                              className="text-primary hover:bg-primary/5"
                              title="Change role"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveUser(user)}
                              disabled={removingUserId === user.id}
                              className="text-red-600 hover:bg-red-50"
                              title="Remove from project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
        <Modal onClose={() => setShowInviteModal(false)}>
          <ModalHeader>Invite User</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label className="mb-1">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1">Role</Label>
                <NativeSelect
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
