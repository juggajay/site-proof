/**
 * Hold-point release confirmation email helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts (the authenticated POST /:id/release handler)
 * as a slice of the holdpoints route split (engineering-health Workstream 1).
 *
 * After a hold point is released, the route emails a confirmation to two groups
 * of project users: contractors (roles site_engineer / foreman / engineer) and
 * superintendents (roles superintendent / project_manager). These are the pure
 * pieces: pick the recipients by role, and build the per-recipient
 * sendHPReleaseConfirmationEmail payload — with the same recipient-name fallback
 * (contractor -> 'Site Team', superintendent -> 'Superintendent') and the same
 * field fallbacks (`holdPointDescription || 'Hold Point'`,
 * `releasedByName || 'Unknown'`, optional releasedByOrg/releaseMethod/releaseNotes
 * collapse to `undefined`) as the inline code.
 *
 * The route keeps ownership of buildFrontendUrl, the releasedAt date formatting,
 * the loop that calls sendHPReleaseConfirmationEmail, the catch/log behaviour,
 * and all DB reads/writes, audit logs, and the response shape. No DB, no request
 * here. Unit-tested DB-free in releaseConfirmationEmails.test.ts.
 *
 * Note: this covers only the authenticated release path. The secure-link/public
 * release path builds a different confirmation payload inline (no 'Unknown'
 * fallback, fixed `releaseMethod: 'secure_link'`) and is intentionally left
 * untouched.
 */

// Roles that receive the contractor-facing confirmation email.
export const HP_RELEASE_CONTRACTOR_ROLES = ['site_engineer', 'foreman', 'engineer'];
// Roles that receive the superintendent-facing confirmation email.
export const HP_RELEASE_SUPERINTENDENT_ROLES = ['superintendent', 'project_manager'];

export type HoldPointReleaseConfirmationRole = 'contractor' | 'superintendent';

// A candidate project user (only the email and full name are read here).
export type HoldPointReleaseConfirmationRecipient = {
  user: {
    email: string;
    fullName: string | null;
  };
};

// The release context shared by every confirmation email. `releasedAt` is the
// already-formatted display string and `lotUrl` the already-built frontend URL;
// both are produced by the route so this module stays DB- and config-free.
export type HoldPointReleaseConfirmationContext = {
  projectName: string;
  lotNumber: string;
  holdPointDescription: string | null;
  releasedByName: string | null | undefined;
  releasedByOrg: string | null | undefined;
  releaseMethod: string | null | undefined;
  releaseNotes: string | null | undefined;
  releasedAt: string;
  lotUrl: string;
};

// The payload accepted by sendHPReleaseConfirmationEmail.
export type HoldPointReleaseConfirmationEmail = {
  to: string;
  recipientName: string;
  recipientRole: HoldPointReleaseConfirmationRole;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  releasedByName: string;
  releasedByOrg?: string;
  releaseMethod?: string;
  releaseNotes?: string;
  releasedAt: string;
  lotUrl: string;
};

// Select the contractor recipients (site_engineer / foreman / engineer).
export function selectHoldPointReleaseContractors<T extends { role: string }>(
  projectUsers: T[],
): T[] {
  return projectUsers.filter((pu) => HP_RELEASE_CONTRACTOR_ROLES.includes(pu.role));
}

// Select the superintendent recipients (superintendent / project_manager).
export function selectHoldPointReleaseSuperintendents<T extends { role: string }>(
  projectUsers: T[],
): T[] {
  return projectUsers.filter((pu) => HP_RELEASE_SUPERINTENDENT_ROLES.includes(pu.role));
}

// Build the confirmation email payload for one recipient. The recipient-name
// fallback follows the role: contractors fall back to 'Site Team',
// superintendents to 'Superintendent'.
export function buildHoldPointReleaseConfirmationEmail(
  recipient: HoldPointReleaseConfirmationRecipient,
  recipientRole: HoldPointReleaseConfirmationRole,
  context: HoldPointReleaseConfirmationContext,
): HoldPointReleaseConfirmationEmail {
  const fallbackName = recipientRole === 'contractor' ? 'Site Team' : 'Superintendent';
  return {
    to: recipient.user.email,
    recipientName: recipient.user.fullName || fallbackName,
    recipientRole,
    projectName: context.projectName,
    lotNumber: context.lotNumber,
    holdPointDescription: context.holdPointDescription || 'Hold Point',
    releasedByName: context.releasedByName || 'Unknown',
    releasedByOrg: context.releasedByOrg || undefined,
    releaseMethod: context.releaseMethod || undefined,
    releaseNotes: context.releaseNotes || undefined,
    releasedAt: context.releasedAt,
    lotUrl: context.lotUrl,
  };
}
