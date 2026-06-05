import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import {
  type AuditLog,
  auditChangeSummary,
  formatAuditAction,
  formatChanges,
  formatDateTime,
  getActionColor,
} from '../auditLogDisplay';

interface AuditLogDetailsModalProps {
  log: AuditLog;
  onClose: () => void;
}

export function AuditLogDetailsModal({ log, onClose }: AuditLogDetailsModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Audit Log Details</ModalHeader>
      <ModalDescription>
        Review the selected activity record and captured change payload.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Date/Time</Label>
              <p>{formatDateTime(log.createdAt)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Action</Label>
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                  log.action,
                )}`}
              >
                {formatAuditAction(log.action)}
              </span>
            </div>
            <div>
              <Label className="text-muted-foreground">Entity Type</Label>
              <p>{log.entityType}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Entity ID</Label>
              <p className="font-mono text-sm">{log.entityId}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">User</Label>
              <p>{log.user?.fullName || log.user?.email || 'System'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Project</Label>
              <p>{log.project?.name || '-'}</p>
            </div>
          </div>

          {log.ipAddress && (
            <div>
              <Label className="text-muted-foreground">IP Address</Label>
              <p className="font-mono text-sm">{log.ipAddress}</p>
            </div>
          )}

          {auditChangeSummary(log) && (
            <div>
              <Label className="text-muted-foreground">Audit Summary</Label>
              <p>{auditChangeSummary(log)}</p>
            </div>
          )}

          {log.changes != null && (
            <div>
              <Label className="text-muted-foreground mb-2">Changes</Label>
              <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-64">
                {formatChanges(log.changes)}
              </pre>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
