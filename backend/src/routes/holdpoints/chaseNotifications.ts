/**
 * Hold-point chase email helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts (the POST /:id/chase handler) as a slice of
 * the holdpoints route split (engineering-health Workstream 1).
 *
 * Chasing a hold point sends a reminder email to the project's superintendents,
 * or — when there are none — to the project managers. These are the pure pieces:
 * pick the recipients (superintendents win when present), and build the
 * sendHPChaseEmail payload for each one, with the same fallbacks
 * (recipient name -> 'Superintendent', hold point description -> 'Hold Point',
 * `chaseCount || 1`, requestedBy -> 'Site Team') as the inline code.
 *
 * The route keeps ownership of the two projectUser.findMany queries (and their
 * laziness — project managers are only queried when there are no
 * superintendents), buildFrontendUrl, the en-AU date formatting, the
 * days-since-request calculation, the loop that calls sendHPChaseEmail, the
 * catch/log behaviour, audit logs, and the response shape. No DB, no request
 * here. Unit-tested DB-free in chaseNotifications.test.ts.
 */

// A candidate recipient (only the email and full name are read here).
export type HoldPointChaseRecipient = {
  user: {
    email: string;
    fullName: string | null;
  };
};

// Select chase recipients: the superintendents when any exist, otherwise the
// project managers. The route loads each list (lazily) and passes them in.
export function selectHoldPointChaseRecipients<T>(superintendents: T[], projectManagers: T[]): T[] {
  return superintendents.length > 0 ? superintendents : projectManagers;
}

// The chase context shared by every email. `originalRequestDate` is the
// already-formatted display string and the URLs are already built by the route,
// so this module stays DB- and config-free.
export type HoldPointChaseContext = {
  projectName: string;
  lotNumber: string;
  holdPointDescription: string | null;
  originalRequestDate: string;
  chaseCount: number;
  daysSinceRequest: number;
  evidencePackageUrl: string;
  releaseUrl: string;
  notificationSentTo: string | null;
};

// The payload accepted by sendHPChaseEmail.
export type HoldPointChaseEmail = {
  to: string;
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  originalRequestDate: string;
  chaseCount: number;
  daysSinceRequest: number;
  evidencePackageUrl: string;
  releaseUrl: string;
  requestedBy: string;
};

// Build the chase email payload for one recipient.
export function buildHoldPointChaseEmail(
  recipient: HoldPointChaseRecipient,
  context: HoldPointChaseContext,
): HoldPointChaseEmail {
  return {
    to: recipient.user.email,
    superintendentName: recipient.user.fullName || 'Superintendent',
    projectName: context.projectName,
    lotNumber: context.lotNumber,
    holdPointDescription: context.holdPointDescription || 'Hold Point',
    originalRequestDate: context.originalRequestDate,
    chaseCount: context.chaseCount || 1,
    daysSinceRequest: context.daysSinceRequest,
    evidencePackageUrl: context.evidencePackageUrl,
    releaseUrl: context.releaseUrl,
    requestedBy: context.notificationSentTo || 'Site Team',
  };
}
