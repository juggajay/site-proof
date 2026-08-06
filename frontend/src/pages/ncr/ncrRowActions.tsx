import { Check, Link2, Printer, UserPlus } from 'lucide-react';
import type { RowAction } from '@/components/ui/RowActions';
import type { NcrAvailableActions } from './ncrActions';
import type { NCR } from './types';

export interface NcrRowActionHandlers {
  onCopyLink: (ncrId: string, ncrNumber: string) => void;
  onPrint: (ncr: NCR) => void;
  onAssign: (ncr: NCR) => void;
  onRespond: (ncr: NCR) => void;
  onReviewResponse: (ncr: NCR) => void;
  onQmApprove: (ncrId: string) => void;
  onNotifyClient: (ncr: NCR) => void;
  onRectify: (ncr: NCR) => void;
  onRejectRectification: (ncr: NCR) => void;
  onClose: (ncr: NCR) => void;
  onConcession: (ncr: NCR) => void;
}

export interface NcrRowActionOptions {
  /** Assign/reassign gate, mirroring the backend PATCH /api/ncrs/:id roles. */
  canAssign: boolean;
  actionLoading: boolean;
  /** This row's link was just copied — the menu entry says so. */
  copied: boolean;
}

export interface NcrRowActions {
  /** The row's next step, rendered as the one visible button. */
  primary?: RowAction;
  /** Everything else, behind the row's overflow menu. */
  overflow: RowAction[];
}

/**
 * Split an NCR's available actions into one promoted button plus an overflow
 * menu, so the register's actions column has a fixed width instead of a
 * status-dependent row of five-plus buttons that clipped at the viewport edge.
 *
 * Every gate here is `getAvailableNcrActions`' — this decides only WHERE a
 * control renders, never WHETHER the user may fire it. The backend enforces
 * each action independently.
 */
export function buildNcrRowActions(
  ncr: NCR,
  actions: NcrAvailableActions,
  { canAssign, actionLoading, copied }: NcrRowActionOptions,
  handlers: NcrRowActionHandlers,
): NcrRowActions {
  const closeBlocked = actions.closeBlockedPendingQmApproval || actions.closeBlockedSameQmApprover;
  const closeBlockedTitle = actions.closeBlockedPendingQmApproval
    ? 'Requires QM approval first'
    : actions.closeBlockedSameQmApprover
      ? 'A different user must close after QM approval'
      : undefined;

  // Promotion order. The first available entry becomes the row's button; the
  // rest fall into the menu in this same order. Closing out the NCR outranks
  // rejecting a rectification or chasing the client, because it is the step
  // that ends the workflow.
  const candidates: Array<[boolean, RowAction]> = [
    [
      actions.respond,
      { key: 'respond', label: 'Respond', onSelect: () => handlers.onRespond(ncr) },
    ],
    [
      actions.reviewResponse,
      {
        key: 'review-response',
        label: 'Review Response',
        title: 'Review the submitted response',
        onSelect: () => handlers.onReviewResponse(ncr),
      },
    ],
    [
      actions.rectify,
      {
        key: 'rectify',
        label: 'Submit Rectification',
        onSelect: () => handlers.onRectify(ncr),
      },
    ],
    [
      actions.qmApprove,
      { key: 'qm-approve', label: 'QM Approve', onSelect: () => handlers.onQmApprove(ncr.id) },
    ],
    [
      actions.close,
      {
        key: 'close',
        label: 'Close',
        title: closeBlockedTitle ?? 'Close NCR',
        disabled: closeBlocked,
        onSelect: () => handlers.onClose(ncr),
      },
    ],
    [
      actions.concession,
      {
        key: 'concession',
        label: 'Concession',
        title: closeBlockedTitle ?? 'Close with concession when full rectification is not possible',
        disabled: closeBlocked,
        onSelect: () => handlers.onConcession(ncr),
      },
    ],
    [
      actions.rejectRectification,
      {
        key: 'reject-rectification',
        label: 'Reject',
        title: 'Reject rectification and return to responsible party',
        destructive: true,
        onSelect: () => handlers.onRejectRectification(ncr),
      },
    ],
    [
      actions.notifyClient,
      {
        key: 'notify-client',
        label: 'Notify Client',
        title: 'Notify client about this major NCR',
        onSelect: () => handlers.onNotifyClient(ncr),
      },
    ],
  ];

  const [primary, ...rest] = candidates
    .filter(([available]) => available)
    // A workflow POST is in flight for the register: every workflow action waits.
    .map(([, action]) => ({ ...action, disabled: action.disabled || actionLoading }));

  const overflow: RowAction[] = [...rest];

  if (canAssign) {
    overflow.push({
      key: 'assign',
      label: ncr.responsibleUser || ncr.responsibleSubcontractor ? 'Reassign' : 'Assign',
      icon: <UserPlus className="h-4 w-4" />,
      title: 'Assign or reassign this NCR',
      disabled: actionLoading,
      onSelect: () => handlers.onAssign(ncr),
    });
  }

  // Available to anyone who can read the register — neither changes the NCR.
  overflow.push(
    {
      key: 'copy-link',
      label: copied ? 'Link copied' : 'Copy link',
      icon: copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />,
      onSelect: () => handlers.onCopyLink(ncr.id, ncr.ncrNumber),
    },
    {
      key: 'print',
      label: 'Print NCR',
      icon: <Printer className="h-4 w-4" />,
      title: 'Print NCR details',
      onSelect: () => handlers.onPrint(ncr),
    },
  );

  return { primary, overflow };
}
