type ProjectUserListRecord = {
  id: string;
  userId: string;
  role: string;
  status: string;
  invitedAt: Date | null;
  acceptedAt: Date | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type InvitedProjectUser = {
  id: string;
  invitedAt?: Date | null;
  acceptedAt?: Date | null;
};

type InvitedUser = {
  id: string;
  email: string;
  fullName: string | null;
};

type UpdatedProjectUser = {
  id: string;
  role: string;
};

type RemovedProjectUser = {
  user: {
    email: string;
  };
};

export function buildProjectUsersResponse(projectUsers: ProjectUserListRecord[]) {
  return {
    users: projectUsers.map((pu) => ({
      id: pu.id,
      userId: pu.userId,
      email: pu.user.email,
      fullName: pu.user.fullName,
      role: pu.role,
      status: pu.status,
      invitedAt: pu.invitedAt,
      acceptedAt: pu.acceptedAt,
      joinedAt: pu.acceptedAt ?? pu.invitedAt,
    })),
  };
}

export function buildProjectUserInvitedResponse(
  newProjectUser: InvitedProjectUser,
  invitedUser: InvitedUser,
  role: string,
) {
  return {
    message: 'User invited successfully',
    projectUser: {
      id: newProjectUser.id,
      userId: invitedUser.id,
      email: invitedUser.email,
      fullName: invitedUser.fullName,
      role,
      invitedAt: newProjectUser.invitedAt ?? null,
      acceptedAt: newProjectUser.acceptedAt ?? null,
      joinedAt: newProjectUser.acceptedAt ?? newProjectUser.invitedAt ?? null,
    },
  };
}

export function buildProjectUserRoleUpdatedResponse(
  updated: UpdatedProjectUser,
  targetUserId: string,
  email: string,
) {
  return {
    message: 'User role updated successfully',
    projectUser: {
      id: updated.id,
      userId: targetUserId,
      email,
      role: updated.role,
    },
  };
}

export function buildProjectUserRemovedResponse(
  removedProjectUser: RemovedProjectUser,
  targetUserId: string,
) {
  return {
    message: 'User removed successfully',
    removedUser: {
      userId: targetUserId,
      email: removedProjectUser.user.email,
    },
  };
}
