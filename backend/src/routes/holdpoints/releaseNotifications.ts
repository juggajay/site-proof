/**
 * Hold-point release notification payload builders, extracted verbatim from
 * backend/src/routes/holdpoints.ts (the authenticated POST /:id/release handler)
 * as a slice of the holdpoints route split (engineering-health Workstream 1).
 *
 * After a hold point is released, the route notifies the project team two ways:
 * one in-app notification record per project user (written via
 * prisma.notification.createMany), and an immediate email payload passed to
 * sendNotificationIfEnabled for each user. Both messages share the same headline
 * ("Hold point ... has been released by ..."); the email payload appends the
 * project / release method / notes block. These are the pure pieces: given the
 * recipients and the release context they return the same records and the same
 * email payload, with the same strings, types, and fallbacks
 * (`releasedByName || 'Unknown'`, `releaseMethod || 'Digital'`,
 * `releaseNotes || 'None'`) as the inline code.
 *
 * The route keeps ownership of all DB reads/writes, the transaction, the
 * createMany call, the sendNotificationIfEnabled loop, the confirmation emails,
 * and the logging/catch behaviour. No DB, no request here. Unit-tested DB-free in
 * releaseNotifications.test.ts.
 *
 * Note: this covers only the authenticated release path. The secure-link/public
 * release and the escalation path build different notifications inline and are
 * intentionally left untouched.
 */

import { Prisma } from '@prisma/client';

// One project user to notify (only the id is read here).
export type HoldPointReleaseNotificationRecipient = {
  userId: string;
};

// The shared context for the in-app notification headline.
export type HoldPointReleaseNotificationContext = {
  projectId: string;
  holdPointDescription: string | null;
  lotNumber: string;
  releasedByName: string | null | undefined;
};

// The email payload needs the project name and the release method/notes block.
export type HoldPointReleaseEmailContext = HoldPointReleaseNotificationContext & {
  projectName: string;
  releaseMethod: string | null | undefined;
  releaseNotes: string | null | undefined;
};

// The object passed to sendNotificationIfEnabled (immediate email).
export type HoldPointReleaseEmailNotification = {
  title: string;
  message: string;
  projectName: string;
  linkUrl: string;
};

// The headline shared by the in-app record and the email body.
function buildHoldPointReleaseHeadline(context: HoldPointReleaseNotificationContext): string {
  return `Hold point "${context.holdPointDescription}" on lot ${context.lotNumber} has been released by ${context.releasedByName || 'Unknown'}.`;
}

// Build one in-app notification record per project team member.
export function buildHoldPointReleaseNotifications(
  recipients: HoldPointReleaseNotificationRecipient[],
  context: HoldPointReleaseNotificationContext,
): Prisma.NotificationCreateManyInput[] {
  return recipients.map((recipient) => ({
    userId: recipient.userId,
    projectId: context.projectId,
    type: 'hold_point_release',
    title: 'Hold Point Released',
    message: buildHoldPointReleaseHeadline(context),
    linkUrl: `/projects/${context.projectId}/hold-points`,
  }));
}

// Build the immediate email payload passed to sendNotificationIfEnabled. The
// payload is the same for every recipient, so the route builds it once.
export function buildHoldPointReleaseEmailNotification(
  context: HoldPointReleaseEmailContext,
): HoldPointReleaseEmailNotification {
  return {
    title: 'Hold Point Released',
    message: `${buildHoldPointReleaseHeadline(context)}\n\nProject: ${context.projectName}\nRelease Method: ${context.releaseMethod || 'Digital'}\nNotes: ${context.releaseNotes || 'None'}`,
    projectName: context.projectName,
    linkUrl: `/projects/${context.projectId}/hold-points`,
  };
}
