import { parseAuditLogChanges } from '../../lib/auditLog.js';

type ProjectAuditLogRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: string | null;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    email: string;
    fullName: string | null;
  } | null;
};

export function buildProjectAuditLogsResponse(auditLogs: ProjectAuditLogRecord[]) {
  return {
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: parseAuditLogChanges(log.changes),
      performedBy: log.user
        ? {
            email: log.user.email,
            fullName: log.user.fullName,
          }
        : null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
  };
}
