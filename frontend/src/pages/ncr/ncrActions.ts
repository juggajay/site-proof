import type { NCR, UserRole } from './types';
import { canManageNcrClosure } from './ncrClosureAccess';

/**
 * Status- and role-gated NCR workflow actions, extracted as a single source of
 * truth so the desktop register (NCRTable) and the mobile detail sheet
 * (NCRMobileDetailSheet, H7) cannot drift. The gates mirror NCRTable exactly;
 * the backend independently enforces each action.
 */
export interface NcrAvailableActions {
  assign: boolean;
  respond: boolean;
  reviewResponse: boolean;
  qmApprove: boolean;
  notifyClient: boolean;
  rectify: boolean;
  rejectRectification: boolean;
  close: boolean;
  concession: boolean;
  /** Close/Concession are offered but disabled until a major NCR is QM-approved. */
  closeBlockedPendingQmApproval: boolean;
  /** Close/Concession are disabled when the current user granted the QM approval. */
  closeBlockedSameQmApprover: boolean;
}

const ASSIGN_ROLES = ['project_manager', 'admin', 'owner', 'site_manager', 'quality_manager'];
const QUALITY_MANAGEMENT_ROLES = [
  'project_manager',
  'admin',
  'owner',
  'site_manager',
  'quality_manager',
];
const QM_APPROVAL_ROLES = ['owner', 'quality_manager'];
const NOTIFY_CLIENT_ROLES = ['project_manager', 'quality_manager', 'admin', 'owner'];

function hasRole(userRole: UserRole | null, roles: string[]): boolean {
  return !!userRole && roles.includes(userRole.role);
}

function requiresQmApproval(ncr: NCR): boolean {
  return ncr.severity === 'major' && ncr.qmApprovalRequired;
}

function getCloseBlockers(ncr: NCR, currentUserId?: string | null) {
  const qmApprovalRequired = requiresQmApproval(ncr);

  return {
    closeBlockedPendingQmApproval: qmApprovalRequired && !ncr.qmApprovedAt,
    closeBlockedSameQmApprover:
      qmApprovalRequired &&
      Boolean(currentUserId) &&
      Boolean(ncr.qmApprovedBy?.id) &&
      ncr.qmApprovedBy?.id === currentUserId,
  };
}

function canApproveMajorNcr(ncr: NCR, userRole: UserRole | null, isVerification: boolean): boolean {
  return (
    requiresQmApproval(ncr) &&
    !ncr.qmApprovedAt &&
    isVerification &&
    hasRole(userRole, QM_APPROVAL_ROLES)
  );
}

function canNotifyClient(ncr: NCR, userRole: UserRole | null): boolean {
  return (
    ncr.severity === 'major' &&
    !!ncr.clientNotificationRequired &&
    !ncr.clientNotifiedAt &&
    hasRole(userRole, NOTIFY_CLIENT_ROLES)
  );
}

export function getAvailableNcrActions(
  ncr: NCR,
  userRole: UserRole | null,
  currentUserId?: string | null,
): NcrAvailableActions {
  const isQm = userRole?.isQualityManager === true;
  const isResponsibleUser = Boolean(currentUserId) && ncr.responsibleUserId === currentUserId;
  const canManageWorkflow = isQm || hasRole(userRole, QUALITY_MANAGEMENT_ROLES);
  const isVerification = ncr.status === 'verification';
  const canClose = canManageNcrClosure(userRole);
  const { closeBlockedPendingQmApproval, closeBlockedSameQmApprover } = getCloseBlockers(
    ncr,
    currentUserId,
  );

  return {
    assign: isQm || hasRole(userRole, ASSIGN_ROLES),
    respond: ncr.status === 'open' && (canManageWorkflow || isResponsibleUser),
    reviewResponse: ncr.status === 'investigating' && canManageWorkflow,
    qmApprove: canApproveMajorNcr(ncr, userRole, isVerification),
    notifyClient: canNotifyClient(ncr, userRole),
    rectify: ncr.status === 'rectification' && (canManageWorkflow || isResponsibleUser),
    rejectRectification: isVerification && canManageWorkflow,
    close: isVerification && canClose,
    concession: isVerification && canClose,
    closeBlockedPendingQmApproval,
    closeBlockedSameQmApprover,
  };
}
