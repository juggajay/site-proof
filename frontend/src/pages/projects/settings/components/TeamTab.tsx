import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, UserPlus } from 'lucide-react';
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
import { isProtectedProjectManagementRole } from '../projectPageAccess';

interface TeamTabProps {
  projectId: string;
  readOnly?: boolean;
  canGrantProjectAdmin?: boolean;
}

interface AssignableProjectUser {
  id: string;
  email: string;
  fullName?: string | null;
  roleInCompany?: string | null;
}

function formatCompanyRole(role?: string | null): string {
  if (!role) return 'Member';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatAssignableUserOption(user: AssignableProjectUser): string {
  const displayName = user.fullName?.trim();
  const role = formatCompanyRole(user.roleInCompany);
  return displayName ? `${displayName} - ${user.email} - ${role}` : `${user.email} - ${role}`;
}

function getProjectInviteErrorMessage(error: unknown): string {
  const message = extractErrorMessage(error, 'Failed to invite team member');
  if (
    message.includes('must belong to this company') ||
    message.toLowerCase().includes('user not found')
  ) {
    return 'Invite this person to your company in Company Settings → Team Members first, then add them to this project.';
  }
  return message;
}

export function TeamTab({
  projectId,
  readOnly = false,
  canGrantProjectAdmin = true,
}: TeamTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableProjectUser[]>([]);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [assignableUsersError, setAssignableUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [inviteRole, setInviteRole] = useState('site_engineer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const invitingRef = useRef(false);
  const inviteCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignableRoleOptions = canGrantProjectAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((role) => !isProtectedProjectManagementRole(role.value));

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

  const fetchAssignableUsers = useCallback(async () => {
    if (!projectId) {
      setAssignableUsers([]);
      setSelectedUserId('');
      setAssignableUsersError('Project not found');
      return;
    }

    setLoadingAssignableUsers(true);
    setAssignableUsersError('');

    try {
      const data = await apiFetch<{ users: AssignableProjectUser[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/assignable-users`,
      );
      const users = data.users || [];
      setAssignableUsers(users);
      setSelectedUserId((current) =>
        current && users.some((user) => user.id === current) ? current : users[0]?.id || '',
      );
    } catch (error) {
      logError('Failed to fetch assignable project users:', error);
      setAssignableUsers([]);
      setSelectedUserId('');
      setAssignableUsersError(
        extractErrorMessage(error, 'Could not load company users. Please try again.'),
      );
    } finally {
      setLoadingAssignableUsers(false);
    }
  }, [projectId]);

  const filteredAssignableUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return assignableUsers;

    return assignableUsers.filter((user) =>
      [user.fullName, user.email, user.roleInCompany].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [assignableUsers, userSearch]);

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

  useEffect(() => {
    if (!showInviteModal) return;

    if (filteredAssignableUsers.length === 0) {
      setSelectedUserId('');
      return;
    }

    if (!filteredAssignableUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(filteredAssignableUsers[0].id);
    }
  }, [filteredAssignableUsers, selectedUserId, showInviteModal]);

  const handleOpenInviteModal = () => {
    if (readOnly) return;

    if (inviteCloseTimeoutRef.current) {
      clearTimeout(inviteCloseTimeoutRef.current);
      inviteCloseTimeoutRef.current = null;
    }
    setShowInviteModal(true);
    setAssignableUsers([]);
    setSelectedUserId('');
    setUserSearch('');
    setInviteRole('site_engineer');
    setInviteError('');
    setInviteSuccess('');
    setAssignableUsersError('');
    void fetchAssignableUsers();
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
    setAssignableUsersError('');
  };

  const handleInviteTeamMember = async () => {
    if (readOnly) return;
    if (invitingRef.current) return;

    if (!selectedUserId) {
      setInviteError('Select a company user to add to this project');
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
          userId: selectedUserId,
          role: inviteRole,
        }),
      });

      const selectedUser = assignableUsers.find((user) => user.id === selectedUserId);
      setInviteSuccess(`Added ${selectedUser?.fullName || selectedUser?.email || 'team member'}`);
      setAssignableUsers((current) => current.filter((user) => user.id !== selectedUserId));
      // Refresh team members list
      await fetchTeamMembers();
      // Close modal after short delay
      inviteCloseTimeoutRef.current = setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
      }, 2000);
    } catch (error) {
      logError('Failed to invite team member:', error);
      setInviteError(getProjectInviteErrorMessage(error));
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">Team Members</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Review this project team. Use Project Users for role changes and removals.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/projects/${encodeURIComponent(projectId)}/users`}>
                Manage project team
              </Link>
            </Button>
          </div>
          {readOnly && (
            <div role="status" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              Team membership is read-only while this project is archived.
            </div>
          )}
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
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{member.fullName || 'Team Member'}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === 'pending' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-warning/10 text-warning">
                          Pending
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          member.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
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
          <Button
            variant="outline"
            onClick={handleOpenInviteModal}
            className="mt-4"
            disabled={readOnly}
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </Button>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Role Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Project role permissions are fixed by role. Change a person's project role from Project
            Users.
          </p>
        </div>
      </div>

      {/* Add Team Member Modal */}
      {showInviteModal && (
        <Modal onClose={handleCloseInviteModal}>
          <ModalHeader>Add Team Member</ModalHeader>
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
              <div role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success mb-4">
                {inviteSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="project-settings-user-search" className="mb-1">
                  Search company users
                </Label>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="project-settings-user-search"
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or company role"
                    disabled={inviting || loadingAssignableUsers}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="project-settings-assignable-user" className="mb-1">
                  Project member
                </Label>
                {loadingAssignableUsers ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Loading company users...
                  </div>
                ) : assignableUsersError ? (
                  <div
                    role="alert"
                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    <p>{assignableUsersError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void fetchAssignableUsers()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : assignableUsers.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    All company users are already on this project.
                  </div>
                ) : filteredAssignableUsers.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No company users match your search.
                  </div>
                ) : (
                  <NativeSelect
                    id="project-settings-assignable-user"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={inviting}
                  >
                    {filteredAssignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {formatAssignableUserOption(user)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
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
                  {assignableRoleOptions.map((role) => (
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
            <Button
              onClick={handleInviteTeamMember}
              disabled={inviting || loadingAssignableUsers || !selectedUserId}
            >
              {inviting ? 'Adding...' : 'Add to Project'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
