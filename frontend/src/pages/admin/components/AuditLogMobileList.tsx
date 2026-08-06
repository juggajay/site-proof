import { MobileDataCard } from '@/components/ui/MobileDataCard';
import {
  type AuditLog,
  auditChangeSummary,
  formatAuditAction,
  formatDateTime,
} from '../auditLogDisplay';

interface AuditLogMobileListProps {
  logs: AuditLog[];
  onViewDetails: (log: AuditLog) => void;
}

/** Phone rendering of the audit log — the desktop table's columns do not fit. */
export function AuditLogMobileList({ logs, onViewDetails }: AuditLogMobileListProps) {
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <MobileDataCard
          key={log.id}
          title={formatAuditAction(log.action)}
          subtitle={auditChangeSummary(log) ?? undefined}
          fields={[
            {
              label: 'Entity',
              value: `${log.entityType} #${log.entityId.slice(0, 8)}`,
              priority: 'primary',
            },
            {
              label: 'User',
              value: log.user ? log.user.fullName || log.user.email : 'System',
              priority: 'primary',
            },
            { label: 'Project', value: log.project?.name ?? '-', priority: 'secondary' },
            { label: 'When', value: formatDateTime(log.createdAt), priority: 'secondary' },
          ]}
          onClick={() => onViewDetails(log)}
        />
      ))}
    </div>
  );
}
