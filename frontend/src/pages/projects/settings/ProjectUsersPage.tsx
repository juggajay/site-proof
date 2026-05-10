import { useCallback, useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { UserPlus, Trash2, Edit2, X, Check, Mail, Shield } from 'lucide-react';
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

interface ProjectUser {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full project access' },
  {
    value: 'project_manager',
    label: 'Project Manager',
    description: 'Manage project settings and team',
  },
  { value: 'quality_manager', label: 'Quality Manager', description: 'Manage quality, ITPs, NCRs' },
  { value: 'site_engineer', label: 'Site Engineer', description: 'Field quality and testing' },
  { value: 'foreman', label: 'Foreman', description: 'Manage lots and daily activities' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  inactive: 'bg-muted text-foreground',
};

function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ProjectUsersPage() {
  const { projectId } = useParams();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<ProjectUser | null>(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [userPendingRemove, setUserPendingRemove] = useState<ProjectUser | null>(null);
  const invitingRef = useRef(false);
  const savingRolesRef = useRef(new Set<string>());
  const removingUsersRef = useRef(new Set<string>());

  // Fetch project users
  const fetchUsers = useCallback(async () => {
    if (!projectId) {
      setUsers([]);
      setLoading(false);
      setLoadError('Project not found');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const data = await apiFetch<{ users: ProjectUser[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/users`,
      );
      setUsers(data.users || []);
    } catch (err) {
      logError('Failed to fetch project users:', err);
      setUsers([]);
      setLoadError(extractErrorMessage(err, 'Could not load project team. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Invite user
  const handleInvite = async () => {
    const email = normalizeInviteEmail(inviteEmail);
    if (!projectId || !email || invitingRef.current) return;

    invitingRef.current = true;
    setInviting(true);

    try {
      const data = await apiFetch<{ projectUser: ProjectUser }>(
        `/api/projects/${encodeURIComponent(projectId)}/users`,
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            role: inviteRole,
          }),
        },
      );
      toast({
        title: 'User invited',
        description: `${email} has been added to the project.`,
      });
      setUsers((prev) =>
        prev.some(
          (user) => user.id === data.projectUser.id || user.userId === data.projectUser.userId,
        )
          ? prev
          : [...prev, data.projectUser],
      );
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (error) {
      logError('Failed to invite project user:', error);
      toast({
        title: 'Failed to invite user',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  };

  // Update user role
  const handleUpdateRole = async () => {
    if (!editingUser || !editRole || !projectId) return;

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
    if (!projectId || removingUsersRef.current.has(user.id)) return;

    removingUsersRef.current.add(user.id);
    setRemovingUserId(user.id);

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
    } catch (error) {
      logError('Failed to remove project user:', error);
      toast({
        title: 'Failed to remove user',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      removingUsersRef.current.delete(user.id);
      setRemovingUserId(null);
      setUserPendingRemove(null);
    }
  };

  const startEditing = (user: ProjectUser) => {
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
        <Button type="button" onClick={() => setShowInviteModal(true)}>
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {loadError && (
        <div
          className="mb-6 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchUsers()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : loadError ? null : users.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No team members yet</h3>
          <p className="mt-2 text-muted-foreground">Invite users to collaborate on this project.</p>
          <Button type="button" onClick={() => setShowInviteModal(true)} className="mt-4">
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
                        aria-label={`Role for ${user.fullName || user.email}`}
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
                        {ROLES.find((r) => r.value === user.role)?.label ||
                          user.role.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${statusColors[user.status] || statusColors.inactive}`}
                    >
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
                              aria-label={`Save role for ${user.fullName || user.email}`}
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={cancelEditing}
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
                              onClick={() => startEditing(user)}
                              className="text-primary hover:bg-primary/5"
                              aria-label={`Change role for ${user.fullName || user.email}`}
                              title="Change role"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUserPendingRemove(user)}
                              disabled={removingUserId === user.id}
                              className="text-red-600 hover:bg-red-50"
                              aria-label={`Remove ${user.fullName || user.email} from project`}
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
        <Modal
          onClose={() => {
            if (!inviting) setShowInviteModal(false);
          }}
        >
          <ModalHeader>Invite User</ModalHeader>
          <ModalDescription>
            Add an existing company user to this project and choose their project role.
          </ModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-user-invite-email" className="mb-1">
                  Email Address
                </Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="project-user-invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="project-user-invite-role" className="mb-1">
                  Role
                </Label>
                <NativeSelect
                  id="project-user-invite-role"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteModal(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !normalizeInviteEmail(inviteEmail)}
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
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
          </>
        }
        confirmLabel="Remove"
        variant="destructive"
        onCancel={() => setUserPendingRemove(null)}
        onConfirm={() => {
          if (userPendingRemove) void handleRemoveUser(userPendingRemove);
        }}
      />
    </div>
  );
}
