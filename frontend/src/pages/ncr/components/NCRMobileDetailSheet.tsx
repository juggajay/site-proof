/**
 * H7: mobile NCR detail sheet. Tapping an NCR card on mobile opens this sheet,
 * which shows the NCR detail plus the status- and role-gated workflow actions.
 * Each action opens the corresponding desktop modal (already mounted in
 * NCRPage). Action availability comes from the shared getAvailableNcrActions
 * helper so it cannot drift from the desktop register (NCRTable).
 */
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getStatusBadgeColor } from '../constants';
import { getAvailableNcrActions } from '../ncrActions';
import type { NCR, UserRole } from '../types';

interface NCRMobileDetailSheetProps {
  isOpen: boolean;
  ncr: NCR | null;
  userRole: UserRole | null;
  actionLoading?: boolean;
  onClose: () => void;
  onAssign: (ncr: NCR) => void;
  onRespond: (ncr: NCR) => void;
  onReviewResponse: (ncr: NCR) => void;
  onQmApprove: (ncrId: string) => void;
  onNotifyClient: (ncr: NCR) => void;
  onRectify: (ncr: NCR) => void;
  onRejectRectification: (ncr: NCR) => void;
  onCloseNcr: (ncr: NCR) => void;
  onConcession: (ncr: NCR) => void;
}

const PRIMARY_BTN =
  'w-full rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50';

export function NCRMobileDetailSheet({
  isOpen,
  ncr,
  userRole,
  actionLoading = false,
  onClose,
  onAssign,
  onRespond,
  onReviewResponse,
  onQmApprove,
  onNotifyClient,
  onRectify,
  onRejectRectification,
  onCloseNcr,
  onConcession,
}: NCRMobileDetailSheetProps) {
  if (!ncr) return null;

  const actions = getAvailableNcrActions(ncr, userRole);
  const closeDisabled = actionLoading || actions.closeBlockedPendingQmApproval;
  const qmApprovalHint = actions.closeBlockedPendingQmApproval
    ? 'Requires QM approval first'
    : undefined;
  const assignedTo =
    ncr.responsibleUser?.fullName ||
    ncr.responsibleUser?.email ||
    ncr.responsibleSubcontractor?.companyName ||
    null;
  const hasAnyAction =
    actions.respond ||
    actions.reviewResponse ||
    actions.qmApprove ||
    actions.notifyClient ||
    actions.rectify ||
    actions.rejectRectification ||
    actions.close ||
    actions.concession ||
    actions.assign;

  return (
    <ResponsiveSheet isOpen={isOpen} onClose={onClose} title={`NCR ${ncr.ncrNumber}`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadgeColor(ncr.status)}`}>
            {formatStatusLabel(ncr.status)}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              ncr.severity === 'major'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {ncr.severity === 'major' ? 'Major' : 'Minor'}
          </span>
          {ncr.clientNotifiedAt && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              ✓ Client notified
            </span>
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap">{ncr.description}</p>

        <dl className="text-xs text-muted-foreground space-y-1">
          <div>
            <dt className="inline font-medium">Category: </dt>
            <dd className="inline">{ncr.category}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Raised by: </dt>
            <dd className="inline">{ncr.raisedBy.fullName || ncr.raisedBy.email}</dd>
          </div>
          {assignedTo && (
            <div>
              <dt className="inline font-medium">Assigned to: </dt>
              <dd className="inline">{assignedTo}</dd>
            </div>
          )}
          {ncr.ncrLots.length > 0 && (
            <div>
              <dt className="inline font-medium">Lots: </dt>
              <dd className="inline">{ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ')}</dd>
            </div>
          )}
          {ncr.dueDate && (
            <div>
              <dt className="inline font-medium">Due: </dt>
              <dd className="inline">{new Date(ncr.dueDate).toLocaleDateString('en-AU')}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-2 pt-3 border-t">
          {actions.respond && (
            <button
              type="button"
              onClick={() => onRespond(ncr)}
              disabled={actionLoading}
              className={PRIMARY_BTN}
            >
              Respond
            </button>
          )}
          {actions.reviewResponse && (
            <button
              type="button"
              onClick={() => onReviewResponse(ncr)}
              disabled={actionLoading}
              className={PRIMARY_BTN}
            >
              Review Response
            </button>
          )}
          {actions.qmApprove && (
            <button
              type="button"
              onClick={() => onQmApprove(ncr.id)}
              disabled={actionLoading}
              className={PRIMARY_BTN}
            >
              QM Approve
            </button>
          )}
          {actions.notifyClient && (
            <button
              type="button"
              onClick={() => onNotifyClient(ncr)}
              disabled={actionLoading}
              className={PRIMARY_BTN}
            >
              Notify Client
            </button>
          )}
          {actions.rectify && (
            <button
              type="button"
              onClick={() => onRectify(ncr)}
              disabled={actionLoading}
              className={PRIMARY_BTN}
            >
              Submit Rectification
            </button>
          )}
          {actions.rejectRectification && (
            <button
              type="button"
              onClick={() => onRejectRectification(ncr)}
              disabled={actionLoading}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Reject Rectification
            </button>
          )}
          {actions.close && (
            <button
              type="button"
              onClick={() => onCloseNcr(ncr)}
              disabled={closeDisabled}
              title={qmApprovalHint}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium bg-success text-success-foreground hover:bg-success/90 disabled:opacity-50"
            >
              Close NCR
            </button>
          )}
          {actions.concession && (
            <button
              type="button"
              onClick={() => onConcession(ncr)}
              disabled={closeDisabled}
              title={qmApprovalHint}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
            >
              Close with Concession
            </button>
          )}
          {actions.assign && (
            <button
              type="button"
              onClick={() => onAssign(ncr)}
              disabled={actionLoading}
              className="w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              {ncr.responsibleUser || ncr.responsibleSubcontractor ? 'Reassign' : 'Assign'}
            </button>
          )}
          {!hasAnyAction && (
            <p className="text-xs text-muted-foreground">
              No actions are available for this NCR in its current status.
            </p>
          )}
        </div>
      </div>
    </ResponsiveSheet>
  );
}
