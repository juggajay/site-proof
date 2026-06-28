import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type AuditLog,
  auditChangeSummary,
  formatAuditAction,
  formatDateTime,
  getActionColor,
} from '../auditLogDisplay';

interface AuditLogTableProps {
  logs: AuditLog[];
  onViewDetails: (log: AuditLog) => void;
}

export function AuditLogTable({ logs, onViewDetails }: AuditLogTableProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto" data-testid="audit-log-table-scroll">
        <table className="w-full min-w-[960px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Date/Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Action</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Entity</th>
              <th className="px-4 py-3 text-left text-sm font-medium">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Project</th>
              <th className="px-4 py-3 text-left text-sm font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => {
              const changeSummary = auditChangeSummary(log);

              return (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                        log.action,
                      )}`}
                    >
                      {formatAuditAction(log.action)}
                    </span>
                    {changeSummary && (
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{changeSummary}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium">{log.entityType}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      #{log.entityId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.user ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{log.user.fullName || log.user.email}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.project ? (
                      <span className="text-muted-foreground">{log.project.name}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => onViewDetails(log)}
                      className="text-xs p-0 h-auto whitespace-nowrap"
                      aria-label={`View details for ${formatAuditAction(log.action)} ${log.entityType} ${log.entityId.slice(0, 8)}`}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
