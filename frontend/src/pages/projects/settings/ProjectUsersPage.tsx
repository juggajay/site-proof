import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { UserPlus, Trash2, Edit2, X, Check, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatProjectUserJoinedDate } from './projectUserDateFormatting';
import {
  canAssignProjectRole,
  canRemoveProjectUser,
  isLastActiveProjectTeamLead,
} from './projectUsersGuards';
import {
  ProjectAdminLoadError,
  ProjectAdminResourceGate,
  ProjectAdminStatusBanners,
} from './ProjectAdminPageState';
import {
  canGrantProjectAdminRole,
  isProtectedProjectManagementRole,
  useProjectAdminResource,
} from './projectPageAccess';

interface ProjectUser {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  joinedAt?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
}

interface AssignableProjectUser {
  id: string;
  email: string;
  fullName?: string | null;
  roleInCompany?: string | null;
}

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full project access' },
  {
    value: 'project_manager',
    label: 'Project Manager',
    description: 'Manage project settings and team',
  },
  { value: 'quality_manager', label: 'Quality Manager', description: 'Manage quality, ITPs, NCRs' },
  { value: 'site_manager', label: 'Site Manager', description: 'Coordinate site operations' },
  { value: 'site_engineer', label: 'Site Engineer', description: 'Field quality and testing' },
  { value: 'foreman', label: 'Foreman', description: 'Manage lots and daily activities' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

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

function getProjectUserInviteErrorMessage(error: unknown): string {
  const message = extractErrorMessage(error, 'Please try again.');
  if (
    message.includes('must belong to this company') ||
    message.toLowerCase().includes('user not found')
  ) {
    return 'Invite this person to your company in Company Settings → Team Members first, then add them to this project.';
  }
  return message;
}

function ProjectUsersEmptyState({
  readOnly,
  onInvite,
}: {
  readOnly: boolean;
  onInvite: () => void;
}) {
  return (
    <div className="rounded-lg border p-12 text-center">
      <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No team members yet</h3>
      <p className="mt-2 text-muted-foreground">Invite users to collaborate on this project.</p>
      <Button type="button" onClick={onInvite} className="mt-4" disabled={readOnly}>
        Add First Team Member
      </Button>
    </div>
  );
}

function ProjectUsersTable({
  users,
  currentUserId,
  editingUser,
  editRole,
  saving,
  removingUserId,
  readOnly,
  canManageProtectedProjectRoles,
  onEditRoleChange,
  onStartEditing,
  onSaveRole,
  onCancelEditing,
  onRequestRemove,
}: {
  users: ProjectUser[];
  currentUserId: string | undefined;
  editingUser: ProjectUser | null;
  editRole: string;
  saving: boolean;
  removingUserId: string | null;
  readOnly: boolean;
  canManageProtectedProjectRoles: boolean;
  onEditRoleChange: (role: string) => void;
  onStartEditing: (user: ProjectUser) => void;
  onSaveRole: () => void;
  onCancelEditing: () => void;
  onRequestRemove: (user: ProjectUser) => void;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border"
      role="region"
      aria-label="Project users table"
    >
      <table className="w-full min-w-[760px]">
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
          {users.map((user) => {
            const lastActiveTeamLead = isLastActiveProjectTeamLead(user, users);
            const canManageThisUser =
              canManageProtectedProjectRoles || !isProtectedProjectManagementRole(user.role);
            const roleOptions = ROLES.filter(
              (role) =>
                canAssignProjectRole(user, role.value, users) &&
                (canManageProtectedProjectRoles || !isProtectedProjectManagementRole(role.value)),
            );
            const canRemove = canRemoveProjectUser(user, users);
            const teamLeadGuardCopy =
              'Add another active admin or project manager before changing this role.';

            return (
              <tr key={user.id} className="hover:bg-muted/25">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">
                      {user.fullName || 'No name'}
                      {user.userId === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingUser?.id === user.id ? (
                    <>
                      <NativeSelect
                        aria-label={`Role for ${user.fullName || user.email}`}
                        value={editRole}
                        onChange={(e) => onEditRoleChange(e.target.value)}
                        className="w-auto"
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </NativeSelect>
                      {lastActiveTeamLead ? (
                        <p className="mt-1 text-xs text-muted-foreground">{teamLeadGuardCopy}</p>
                      ) : null}
                    </>
                  ) : (
                    <span className="capitalize">
                      {ROLES.find((r) => r.value === user.role)?.label ||
                        user.role.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      statusColors[user.status] || statusColors.inactive
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatProjectUserJoinedDate(user)}
                </td>
                <td className="px-4 py-3">
                  {user.userId !== currentUserId && !readOnly && canManageThisUser && (
                    <div className="flex items-center gap-2">
                      {editingUser?.id === user.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSaveRole}
                            disabled={saving}
                            className="text-primary hover:bg-primary/5"
                            aria-label={`Save role for ${user.fullName || user.email}`}
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancelEditing}
                            className="text-muted-foreground hover:bg-muted/50"
                            aria-label={`Cancel role edit for ${user.fullName || user.email}`}
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
                            onClick={() => onStartEditing(user)}
                            className="text-primary hover:bg-primary/5"
                            aria-label={`Change role for ${user.fullName || user.email}`}
                            title="Change role"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRequestRemove(user)}
                            disabled={removingUserId === user.id || !canRemove}
                            className="text-destructive hover:bg-destructive/10"
                            aria-label={`Remove ${user.fullName || user.email} from project`}
                            title={
                              canRemove
                                ? 'Remove from project'
                                : 'Add another active admin or project manager before removing this user'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectUsersPage() {
  const { projectId } = useParams();
  const { user: currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableProjectUser[]>([]);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [assignableUsersError, setAssignableUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<ProjectUser | null>(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [userPendingRemove, setUserPendingRemove] = useState<ProjectUser | null>(null);
  const [removeError, setRemoveError] = useState('');
  const invitingRef = useRef(false);
  const savingRolesRef = useRef(new Set<string>());
  const removingUsersRef = useRef(new Set<string>());

  const loadProjectUsers = useCallback(async (id: string) => {
    const data = await apiFetch<{ users: ProjectUser[] }>(
      `/api/projects/${encodeURIComponent(id)}/users`,
    );
    return data.users || [];
  }, []);

  const {
    project,
    items: users,
    setItems: setUsers,
    loading,
    loadError,
    reload,
    canManageProject: canManageUsers,
    readOnly,
  } = useProjectAdminResource<ProjectUser>({
    projectId,
    resourceLabel: 'project team',
    loadItems: loadProjectUsers,
  });
  const canManageProtectedProjectRoles = canGrantProjectAdminRole(
    currentUser?.roleInCompany || currentUser?.role,
    project?.currentUserRole,
  );
  const assignableRoleOptions = ROLES.filter(
    (role) => canManageProtectedProjectRoles || !isProtectedProjectManagementRole(role.value),
  );

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

  const openInviteModal = () => {
    if (readOnly) return;
    setShowInviteModal(true);
    setAssignableUsers([]);
    setAssignableUsersError('');
    setSelectedUserId('');
    setUserSearch('');
    setInviteRole('viewer');
    void fetchAssignableUsers();
  };

  const closeInviteModal = () => {
    if (inviting) return;
    setShowInviteModal(false);
    setAssignableUsersError('');
  };

  // Add existing company user to the project
  const handleInvite = async () => {
    if (readOnly) return;
    if (!projectId || !selectedUserId || invitingRef.current) return;
    if (!canManageProtectedProjectRoles && isProtectedProjectManagementRole(inviteRole)) return;

    invitingRef.current = true;
    setInviting(true);

    try {
      const selectedUser = assignableUsers.find((user) => user.id === selectedUserId);
      const data = await apiFetch<{ projectUser: ProjectUser }>(
        `/api/projects/${encodeURIComponent(projectId)}/users`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: selectedUserId,
            role: inviteRole,
          }),
        },
      );
      toast({
        title: 'User added',
        description: `${selectedUser?.fullName || selectedUser?.email || 'User'} has been added to the project.`,
      });
      setUsers((prev) =>
        prev.some(
          (user) => user.id === data.projectUser.id || user.userId === data.projectUser.userId,
        )
          ? prev
          : [...prev, data.projectUser],
      );
      setAssignableUsers((current) => current.filter((user) => user.id !== selectedUserId));
      setShowInviteModal(false);
      setSelectedUserId('');
      setUserSearch('');
      setInviteRole('viewer');
    } catch (error) {
      logError('Failed to invite project user:', error);
      toast({
        title: 'Failed to add user',
        description: getProjectUserInviteErrorMessage(error),
        variant: 'error',
      });
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  };

  // Update user role
  const handleUpdateRole = async () => {
    if (readOnly) return;
    if (!editingUser || !editRole || !projectId) return;
    if (
      !canManageProtectedProjectRoles &&
      (isProtectedProjectManagementRole(editingUser.role) ||
        isProtectedProjectManagementRole(editRole))
    ) {
      return;
    }

    const updateKey = `${editingUser.userId}:${editRole}`;
    if (savingRolesRef.current.has(updateKey)) return;

    savingRolesRef.current.add(updateKey);
    setSaving(true);

    try {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(editingUser.userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: editRole }),
        },
      );
      toast({
        title: 'Role updated',
        description: `${editingUser.fullName || editingUser.email}'s role has been updated.`,
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, role: editRole } : u)));
      setEditingUser(null);
      setEditRole('');
    } catch (error) {
      logError('Failed to update project user role:', error);
      toast({
        title: 'Failed to update role',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      savingRolesRef.current.delete(updateKey);
      setSaving(false);
    }
  };

  // Remove user
  const handleRemoveUser = async (user: ProjectUser) => {
    if (readOnly) return;
    if (!projectId || removingUsersRef.current.has(user.id)) return;

    removingUsersRef.current.add(user.id);
    setRemovingUserId(user.id);
    setRemoveError('');

    try {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(user.userId)}`,
        {
          method: 'DELETE',
        },
      );
      toast({
        title: 'User removed',
        description: `${user.fullName || user.email} has been removed from the project.`,
      });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setUserPendingRemove(null);
      setRemoveError('');
    } catch (error) {
      const message = extractErrorMessage(error, 'Please try again.');
      logError('Failed to remove project user:', error);
      setRemoveError(message);
      toast({
        title: 'Failed to remove user',
        description: message,
        variant: 'error',
      });
    } finally {
      removingUsersRef.current.delete(user.id);
      setRemovingUserId(null);
    }
  };

  const requestRemoveUser = (user: ProjectUser) => {
    if (readOnly) return;
    setRemoveError('');
    setUserPendingRemove(user);
  };

  const startEditing = (user: ProjectUser) => {
    if (readOnly) return;
    setEditingUser(user);
    setEditRole(user.role);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditRole('');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Project Team</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        {canManageUsers && (
          <Button type="button" onClick={openInviteModal} disabled={readOnly}>
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </Button>
        )}
      </div>

      <ProjectAdminStatusBanners
        project={project}
        canManage={canManageUsers}
        readOnly={readOnly}
        deniedMessage="You don't have permission to manage users for this project."
        archivedMessage="Archived projects are read-only. Restore the project before editing team members."
      />

      <ProjectAdminLoadError message={loadError} onRetry={() => void reload()} />

      <ProjectAdminResourceGate loading={loading} loadError={loadError} canManage={canManageUsers}>
        {users.length === 0 ? (
          <ProjectUsersEmptyState readOnly={readOnly} onInvite={openInviteModal} />
        ) : (
          <ProjectUsersTable
            users={users}
            currentUserId={currentUser?.id}
            editingUser={editingUser}
            editRole={editRole}
            saving={saving}
            removingUserId={removingUserId}
            readOnly={readOnly}
            canManageProtectedProjectRoles={canManageProtectedProjectRoles}
            onEditRoleChange={setEditRole}
            onStartEditing={startEditing}
            onSaveRole={handleUpdateRole}
            onCancelEditing={cancelEditing}
            onRequestRemove={requestRemoveUser}
          />
        )}
      </ProjectAdminResourceGate>

      {/* Add Team Member Modal */}
      {showInviteModal && (
        <Modal
          onClose={() => {
            closeInviteModal();
          }}
        >
          <ModalHeader>Add Team Member</ModalHeader>
          <ModalDescription>
            Select an existing company user to add to this project and choose their project role.
          </ModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-user-search" className="mb-1">
                  Search company users
                </Label>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="project-user-search"
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or company role"
                    className="flex-1"
                    disabled={inviting || loadingAssignableUsers}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="project-user-assignable-user" className="mb-1">
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
                    id="project-user-assignable-user"
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
                <Label htmlFor="project-user-invite-role" className="mb-1">
                  Role
                </Label>
                <NativeSelect
                  id="project-user-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={inviting}
                >
                  {assignableRoleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeInviteModal}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviting || loadingAssignableUsers || !selectedUserId}
            >
              {inviting ? 'Adding...' : 'Add to Project'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(userPendingRemove)}
        title="Remove Project User"
        description={
          <>
            <p>
              Remove {userPendingRemove?.fullName || userPendingRemove?.email || 'this user'} from
              this project?
            </p>
            <p>They will lose access to this project immediately.</p>
            {removeError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                {removeError}
              </div>
            )}
          </>
        }
        confirmLabel={removingUserId === userPendingRemove?.id ? 'Removing...' : 'Remove'}
        variant="destructive"
        confirmDisabled={removingUserId === userPendingRemove?.id}
        cancelDisabled={removingUserId === userPendingRemove?.id}
        onCancel={() => {
          setRemoveError('');
          setUserPendingRemove(null);
        }}
        onConfirm={() => {
          if (userPendingRemove) void handleRemoveUser(userPendingRemove);
        }}
      />
    </div>
  );
}
