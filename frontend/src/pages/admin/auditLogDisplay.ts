// Shared audit-log display helpers and types used by AuditLogPage and its
// extracted components (AuditLogTable, AuditLogDetailsModal). Pure
// presentation logic only — no state, queries, or side effects.

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
}

const ACTION_LABELS: Record<string, string> = {
  account_deletion_requested: 'Account deletion requested',
  api_key_created: 'API key created',
  api_key_revoked: 'API key revoked',
  claim_certified: 'Claim certified',
  claim_created: 'Claim created',
  claim_payment_recorded: 'Claim payment recorded',
  claim_status_changed: 'Claim status changed',
  company_logo_updated: 'Company logo updated',
  company_member_left: 'Company member left',
  company_ownership_transferred: 'Company ownership transferred',
  company_updated: 'Company updated',
  company_created: 'Company created',
  diary_addendum_added: 'Diary addendum added',
  diary_submitted: 'Diary submitted',
  docket_approved: 'Docket approved',
  docket_queried: 'Docket queried',
  docket_query_responded: 'Docket query responded',
  docket_rejected: 'Docket rejected',
  docket_submitted: 'Docket submitted',
  document_deleted: 'Document deleted',
  hp_chased: 'Hold point chased',
  hp_escalated: 'Hold point escalated',
  hp_escalation_resolved: 'Hold point escalation resolved',
  hp_public_released: 'Hold point publicly released',
  hp_release_requested: 'Hold point release requested',
  hp_released: 'Hold point released',
  itp_item_completed: 'ITP item completed',
  itp_item_rejected: 'ITP item rejected',
  itp_item_updated: 'ITP item updated',
  itp_item_verified: 'ITP item verified',
  lot_created: 'Lot created',
  lot_force_conformed: 'Lot force conformed',
  lot_status_changed: 'Lot status changed',
  lot_updated: 'Lot updated',
  lot_subcontractor_assigned: 'Lot subcontractor assigned',
  lot_subcontractor_assignment_updated: 'Lot subcontractor assignment updated',
  lot_subcontractor_assignment_removed: 'Lot subcontractor assignment removed',
  magic_link_requested: 'Magic link requested',
  mfa_disabled: 'MFA disabled',
  mfa_enabled: 'MFA enabled',
  ncr_client_notified: 'NCR client notified',
  ncr_created: 'NCR created',
  ncr_evidence_added: 'NCR evidence added',
  ncr_evidence_removed: 'NCR evidence removed',
  ncr_qm_approved: 'NCR QM approved',
  ncr_status_changed: 'NCR status changed',
  password_changed: 'Password changed',
  password_reset_requested: 'Password reset requested',
  project_created: 'Project created',
  project_updated: 'Project updated',
  project_deleted: 'Project deleted',
  subcontractor_invitation_accepted: 'Subcontractor invitation accepted',
  subcontractor_invited: 'Subcontractor invited',
  subcontractor_portal_access_changed: 'Subcontractor portal access changed',
  subcontractor_employee_rate_approved: 'Subcontractor employee rate approved',
  subcontractor_plant_rate_approved: 'Subcontractor plant rate approved',
  subcontractor_status_changed: 'Subcontractor status changed',
  test_result_created: 'Test result created',
  test_result_deleted: 'Test result deleted',
  test_result_rejected: 'Test result rejected',
  test_result_status_changed: 'Test result status changed',
  test_result_updated: 'Test result updated',
  test_result_verified: 'Test result verified',
  user_approved: 'User approved',
  user_avatar_removed: 'User avatar removed',
  user_avatar_updated: 'User avatar updated',
  user_email_verified: 'User email verified',
  user_invited: 'User invited',
  user_login: 'User login',
  user_login_failed: 'User login failed',
  user_logout: 'User logout',
  user_profile_updated: 'User profile updated',
  user_registered: 'User registered',
  user_removed: 'User removed',
  user_role_changed: 'User role changed',
  user_suspended: 'User suspended',
  webhook_created: 'Webhook created',
  webhook_deleted: 'Webhook deleted',
  webhook_secret_regenerated: 'Webhook secret regenerated',
  webhook_updated: 'Webhook updated',
};

export function formatAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  return action
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase());
}

function asAuditChangeRecord(changes: unknown): Record<string, unknown> | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
  return changes as Record<string, unknown>;
}

function stringChangeValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function auditChangeSummary(log: AuditLog): string | null {
  const changes = asAuditChangeRecord(log.changes);
  if (!changes) return null;

  if (log.action === 'lot_force_conformed') {
    const reason = stringChangeValue(changes.reason);
    return reason ? `Reason: ${reason}` : 'Force conform recorded without a reason payload.';
  }

  const reason = stringChangeValue(changes.reason);
  if (reason) return `Reason: ${reason}`;

  return null;
}

export const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatChanges = (changes: unknown) => {
  if (changes == null) return '';
  const formatted = JSON.stringify(changes, null, 2);
  return formatted ?? String(changes);
};

export const getActionColor = (action: string) => {
  if (action.includes('create') || action.includes('add')) return 'text-green-600 bg-green-50';
  if (action.includes('delete') || action.includes('remove')) return 'text-red-600 bg-red-50';
  if (action.includes('update') || action.includes('edit')) return 'text-primary bg-primary/5';
  return 'text-muted-foreground bg-muted/50';
};
