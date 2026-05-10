import { useState, useCallback, useEffect, useRef } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import type { TeamMember } from '../types';
import { ROLE_OPTIONS } from '../types';
import { logError } from '@/lib/logger';

interface TeamTabProps {
  projectId: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeamTab({ projectId }: TeamTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('site_engineer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const invitingRef = useRef(false);
  const inviteCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    if (!projectId) {
      setTeamMembers([]);
      setTeamError('Project not found');
      setLoadingTeam(false);
      return;
    }

    setLoadingTeam(true);
    setTeamError('');

    try {
      const data = await apiFetch<{ users: TeamMember[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/users`,
      );
      setTeamMembers(data.users || []);
    } catch (error) {
      logError('Failed to fetch team members:', error);
      setTeamMembers([]);
      setTeamError(extractErrorMessage(error, 'Could not load project team. Please try again.'));
    } finally {
      setLoadingTeam(false);
    }
  }, [projectId]);

  // Fetch team members on mount
  useEffect(() => {
    void fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    return () => {
      if (inviteCloseTimeoutRef.current) {
        clearTimeout(inviteCloseTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenInviteModal = () => {
    if (inviteCloseTimeoutRef.current) {
      clearTimeout(inviteCloseTimeoutRef.current);
      inviteCloseTimeoutRef.current = null;
    }
    setShowInviteModal(true);
    setInviteEmail('');
    setInviteRole('site_engineer');
    setInviteError('');
    setInviteSuccess('');
  };

  const handleCloseInviteModal = () => {
    if (inviting) return;
    if (inviteCloseTimeoutRef.current) {
      clearTimeout(inviteCloseTimeoutRef.current);
      inviteCloseTimeoutRef.current = null;
    }
    setShowInviteModal(false);
    setInviteError('');
    setInviteSuccess('');
  };

  const handleInviteTeamMember = async () => {
    if (invitingRef.current) return;

    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setInviteError('Email is required');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setInviteError('Enter a valid email address');
      return;
    }

    if (!projectId) {
      setInviteError('Project not found');
      return;
    }

    invitingRef.current = true;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          role: inviteRole,
        }),
      });

      setInviteSuccess(`Invitation sent to ${email}`);
      // Refresh team members list
      await fetchTeamMembers();
      // Close modal after short delay
      inviteCloseTimeoutRef.current = setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
      }, 2000);
    } catch (error) {
      logError('Failed to invite team member:', error);
      setInviteError(extractErrorMessage(error, 'Failed to invite team member'));
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  };

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
          ) : teamError ? (
            <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <p>{teamError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void fetchTeamMembers()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No team members yet.
                </p>
              ) : (
                teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          member.role === 'admin' ? 'bg-primary/20' : 'bg-green-100'
                        }`}
                      >
                        <Users
                          className={`h-5 w-5 ${
                            member.role === 'admin' ? 'text-primary' : 'text-green-600'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{member.fullName || 'Team Member'}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === 'pending' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          member.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {ROLE_OPTIONS.find((r) => r.value === member.role)?.label || member.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <Button variant="outline" onClick={handleOpenInviteModal} className="mt-4">
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </Button>
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
        <Modal onClose={handleCloseInviteModal}>
          <ModalHeader>Invite Team Member</ModalHeader>
          <ModalBody>
            {inviteError && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4"
              >
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div
                role="status"
                className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4"
              >
                {inviteSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="project-settings-invite-email" className="mb-1">
                  Email Address
                </Label>
                <Input
                  id="project-settings-invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team.member@example.com"
                  disabled={inviting}
                />
              </div>

              <div>
                <Label htmlFor="project-settings-invite-role" className="mb-1">
                  Role
                </Label>
                <NativeSelect
                  id="project-settings-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={inviting}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={handleCloseInviteModal} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={handleInviteTeamMember} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
