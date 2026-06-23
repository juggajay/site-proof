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
}

const ASSIGN_ROLES = ['project_manager', 'admin', 'owner', 'site_manager', 'quality_manager'];
const RESPONSE_REVIEW_ROLES = ['project_manager', 'admin'];
const NOTIFY_CLIENT_ROLES = ['project_manager', 'quality_manager', 'admin', 'owner'];

function hasRole(userRole: UserRole | null, roles: string[]): boolean {
  return !!userRole && roles.includes(userRole.role);
}

export function getAvailableNcrActions(ncr: NCR, userRole: UserRole | null): NcrAvailableActions {
  const isQm = userRole?.isQualityManager === true;
  const isVerification = ncr.status === 'verification';
  const canClose = canManageNcrClosure(userRole);
  // H8: a major NCR cannot be closed/conceded until the QM has approved it.
  const closeBlockedPendingQmApproval = ncr.severity === 'major' && !ncr.qmApprovedAt;

  return {
    assign: isQm || hasRole(userRole, ASSIGN_ROLES),
    // M24: Respond/Rectify are status-gated on the desktop (open / in-progress);
    // the backend enforces the open-only foreman permission.
    respond: ncr.status === 'open',
    reviewResponse:
      ncr.status === 'investigating' && (isQm || hasRole(userRole, RESPONSE_REVIEW_ROLES)),
    qmApprove: ncr.severity === 'major' && !ncr.qmApprovedAt && isVerification && isQm,
    notifyClient:
      ncr.severity === 'major' &&
      !!ncr.clientNotificationRequired &&
      !ncr.clientNotifiedAt &&
      hasRole(userRole, NOTIFY_CLIENT_ROLES),
    rectify: ncr.status === 'investigating' || ncr.status === 'rectification',
    rejectRectification: isVerification && (isQm || hasRole(userRole, RESPONSE_REVIEW_ROLES)),
    close: isVerification && canClose,
    concession: isVerification && canClose,
    closeBlockedPendingQmApproval,
  };
}
