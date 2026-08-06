import { Check, Edit2, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { NativeSelect } from '@/components/ui/native-select';
import { formatProjectUserJoinedDate } from './projectUserDateFormatting';
import {
  PROJECT_TEAM_LEAD_GUARD_COPY,
  projectUserRoleLabel,
  projectUserRowState,
} from './projectUserRoles';
import type { ProjectUser } from './types';

const statusVariants: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  pending: 'warning',
  inactive: 'default',
};

function ProjectUserCardActions({
  user,
  isEditing,
  lastActiveTeamLead,
  canRemove,
  saving,
  removingUserId,
  onStartEditing,
  onSaveRole,
  onCancelEditing,
  onRequestRemove,
}: {
  user: ProjectUser;
  isEditing: boolean;
  lastActiveTeamLead: boolean;
  canRemove: boolean;
  saving: boolean;
  removingUserId: string | null;
  onStartEditing: (user: ProjectUser) => void;
  onSaveRole: () => void;
  onCancelEditing: () => void;
  onRequestRemove: (user: ProjectUser) => void;
}) {
  const who = user.fullName || user.email;

  return (
    <div className="w-full space-y-2">
      {isEditing && lastActiveTeamLead && (
        <p className="text-xs text-muted-foreground">{PROJECT_TEAM_LEAD_GUARD_COPY}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveRole}
              disabled={saving}
              aria-label={`Save role for ${who}`}
            >
              <Check className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEditing}
              aria-label={`Cancel role edit for ${who}`}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStartEditing(user)}
              aria-label={`Change role for ${who}`}
            >
              <Edit2 className="h-4 w-4" />
              Change role
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestRemove(user)}
              disabled={removingUserId === user.id || !canRemove}
              className="text-destructive hover:bg-destructive/10"
              aria-label={`Remove ${who} from project`}
              title={
                canRemove
                  ? 'Remove from project'
                  : 'Add another active admin or project manager before removing this user'
              }
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

interface ProjectUsersMobileListProps {
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
}

/** Phone rendering of the project team table — Role/Status/Joined/Actions do not fit at 390px. */
export function ProjectUsersMobileList({
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
}: ProjectUsersMobileListProps) {
  return (
    <div className="space-y-3">
      {users.map((user) => {
        const { lastActiveTeamLead, canManageThisUser, roleOptions, canRemove } =
          projectUserRowState(user, users, canManageProtectedProjectRoles);
        const isEditing = editingUser?.id === user.id;
        const displayName = user.fullName || 'No name';
        const showActions = user.userId !== currentUserId && !readOnly && canManageThisUser;

        return (
          <MobileDataCard
            key={user.id}
            title={user.userId === currentUserId ? `${displayName} (You)` : displayName}
            subtitle={user.email}
            status={{
              label: user.status,
              variant: statusVariants[user.status] ?? 'default',
            }}
            fields={[
              {
                label: 'Role',
                value: isEditing ? (
                  <NativeSelect
                    aria-label={`Role for ${user.fullName || user.email}`}
                    value={editRole}
                    onChange={(e) => onEditRoleChange(e.target.value)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  projectUserRoleLabel(user.role)
                ),
                priority: 'primary',
              },
              {
                label: 'Joined',
                value: formatProjectUserJoinedDate(user),
                priority: 'secondary',
              },
            ]}
            actions={
              showActions ? (
                <ProjectUserCardActions
                  user={user}
                  isEditing={isEditing}
                  lastActiveTeamLead={lastActiveTeamLead}
                  canRemove={canRemove}
                  saving={saving}
                  removingUserId={removingUserId}
                  onStartEditing={onStartEditing}
                  onSaveRole={onSaveRole}
                  onCancelEditing={onCancelEditing}
                  onRequestRemove={onRequestRemove}
                />
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
