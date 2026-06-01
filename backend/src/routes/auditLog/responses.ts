type AuditLogUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export function buildAuditLogListResponse(
  logs: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export function buildAuditActionsResponse(actions: string[]) {
  return { actions };
}

export function buildAuditEntityTypesResponse(entityTypes: string[]) {
  return { entityTypes };
}

export function buildAuditUsersResponse(users: AuditLogUser[]) {
  return { users };
}
