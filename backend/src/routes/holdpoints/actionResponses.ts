type ProjectUserNotification = {
  user: {
    email: string;
    fullName: string | null;
  };
};

type ProjectUserRoleNotification = ProjectUserNotification & {
  role: string;
};

function mapNotifiedUsers(projectUsers: ProjectUserNotification[]) {
  return projectUsers.map((pu) => ({
    email: pu.user.email,
    fullName: pu.user.fullName,
  }));
}

export function buildHoldPointReleaseRequestedResponse<THoldPoint>(holdPoint: THoldPoint) {
  return {
    success: true,
    message: 'Hold point release requested successfully',
    holdPoint,
  };
}

export function buildHoldPointReleasedResponse<THoldPoint>(
  holdPoint: THoldPoint,
  projectUsers: ProjectUserNotification[],
) {
  return {
    success: true,
    message: 'Hold point released successfully',
    holdPoint,
    notifiedUsers: mapNotifiedUsers(projectUsers),
  };
}

export function buildHoldPointChaseResponse<THoldPoint>(holdPoint: THoldPoint) {
  return {
    success: true,
    message: 'Chase notification sent',
    holdPoint,
  };
}

export function buildHoldPointEscalatedResponse<THoldPoint>(
  holdPoint: THoldPoint,
  projectUsers: ProjectUserRoleNotification[],
) {
  return {
    success: true,
    message: 'Hold point escalated successfully',
    holdPoint,
    notifiedUsers: projectUsers.map((pu) => ({
      email: pu.user.email,
      fullName: pu.user.fullName,
      role: pu.role,
    })),
  };
}

export function buildHoldPointEscalationResolvedResponse<THoldPoint>(holdPoint: THoldPoint) {
  return {
    success: true,
    message: 'Escalation resolved',
    holdPoint,
  };
}

type PublicReleasedHoldPoint = {
  id: string;
  description: string | null;
  status: string;
  releasedAt: Date | null;
  releasedByName: string | null;
  releasedByOrg: string | null;
  releaseMethod: string | null;
  releaseNotes: string | null;
  lot: {
    id: string;
    lotNumber: string;
  };
};

export function buildPublicHoldPointReleasedResponse(holdPoint: PublicReleasedHoldPoint) {
  return {
    success: true,
    message: 'Hold point released successfully via secure link',
    holdPoint: {
      id: holdPoint.id,
      description: holdPoint.description,
      status: holdPoint.status,
      releasedAt: holdPoint.releasedAt,
      releasedByName: holdPoint.releasedByName,
      releasedByOrg: holdPoint.releasedByOrg,
      releaseMethod: holdPoint.releaseMethod,
      releaseNotes: holdPoint.releaseNotes,
    },
    lot: {
      id: holdPoint.lot.id,
      lotNumber: holdPoint.lot.lotNumber,
    },
  };
}
