import { useState, useEffect } from 'react'
import { Users, UserPlus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { TeamMember } from '../types'
import { ROLE_OPTIONS } from '../types'

interface TeamTabProps {
  projectId: string
}

export function TeamTab({ projectId }: TeamTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('site_engineer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Fetch team members on mount
  useEffect(() => {
    async function fetchTeamMembers() {
      if (!projectId) return

      setLoadingTeam(true)

      try {
        const data = await apiFetch<{ users: TeamMember[] }>(`/api/projects/${projectId}/users`)
        setTeamMembers(data.users || [])
      } catch (error) {
        console.error('Failed to fetch team members:', error)
      } finally {
        setLoadingTeam(false)
      }
    }

    fetchTeamMembers()
  }, [projectId])

  const handleOpenInviteModal = () => {
    setShowInviteModal(true)
    setInviteEmail('')
    setInviteRole('site_engineer')
    setInviteError('')
    setInviteSuccess('')
  }

  const handleInviteTeamMember = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      await apiFetch(`/api/projects/${projectId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      // Refresh team members list
      try {
        const refreshData = await apiFetch<{ users: TeamMember[] }>(`/api/projects/${projectId}/users`)
        setTeamMembers(refreshData.users || [])
      } catch { /* ignore refresh failure */ }
      // Close modal after short delay
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteSuccess('')
      }, 2000)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to invite team member')
    } finally {
      setInviting(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Team Members</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manage team members and their roles on this project.
          </p>
          {loadingTeam ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No team members yet.</p>
              ) : (
                teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        member.role === 'admin' ? 'bg-primary/20' : 'bg-green-100'
                      }`}>
                        <Users className={`h-5 w-5 ${
                          member.role === 'admin' ? 'text-primary' : 'text-green-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{member.fullName || 'Team Member'}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === 'pending' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">Pending</span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        member.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
                      }`}>
                        {ROLE_OPTIONS.find(r => r.value === member.role)?.label || member.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <button
            onClick={handleOpenInviteModal}
            className="mt-4 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </button>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Role Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Configure what each role can access and modify in this project.
          </p>
        </div>
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-muted rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4">
                {inviteSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team.member@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  disabled={inviting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  disabled={inviting}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                disabled={inviting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteTeamMember}
                disabled={inviting || !inviteEmail.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
