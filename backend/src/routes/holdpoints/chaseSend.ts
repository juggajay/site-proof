/**
 * Wave E2 (spec §8.1) — the manual chase's send sequence, as one exported
 * function, so the route handler stays a guard-and-respond shell and the send
 * itself is testable on its own.
 *
 * The hourly job does NOT call this: it sends a consolidated DIGEST (one email
 * per project per recipient covering N hold points), while the manual chase
 * sends one email per recipient about the ONE hold point a human just pressed
 * Chase on. What the two genuinely share — the atomic reservation, the recipient
 * resolver, the requester lookup, the token mint/revoke helpers — lives in
 * `chaseCore.ts` and is called by both.
 */

import { sendHPChaseEmail } from '../../lib/email.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import { buildHoldPointChaseEmail, selectHoldPointChaseRecipients } from './chaseNotifications.js';
import {
  buildChaseRecipientUrls,
  type ResolvedChaseRequester,
  daysSinceRequest,
  loadHoldPointChaseTargets,
  revokeFreshChaseReleaseToken,
  revokeSupersededChaseReleaseTokens,
} from './chaseCore.js';

type ChaseHoldPoint = {
  id: string;
  description: string | null;
  createdAt: Date;
  notificationSentAt: Date | null;
  notificationSentTo: string | null;
  lot: {
    id: string;
    lotNumber: string;
    project: { id: string; name: string };
  };
};

/**
 * Send the chase to every resolved recipient. Returns true when at least one
 * message was accepted for delivery — the caller refunds the reservation when it
 * is false, because a failed send must not consume an attempt (`[E-j]`).
 *
 * Never throws: a chase that cannot be mailed still succeeded as a request, and
 * that has always been this route's contract.
 */
export async function sendHoldPointChase(
  holdPoint: ChaseHoldPoint,
  chaseCount: number,
  requester: ResolvedChaseRequester,
  now: Date,
): Promise<boolean> {
  let anySendSucceeded = false;

  try {
    const recipientsToNotify = await loadHoldPointChaseTargets(
      holdPoint.id,
      holdPoint.lot.project.id,
      now,
      holdPoint.notificationSentTo,
      { allowProjectUserFallback: true, selectRecipients: selectHoldPointChaseRecipients },
    );

    const loggedInReleaseUrl = buildFrontendUrl(
      `/projects/${holdPoint.lot.project.id}/lots/${holdPoint.lot.id}?tab=itp`,
    );
    const loggedInEvidencePackageUrl = buildFrontendUrl(
      `/projects/${holdPoint.lot.project.id}/lots/${holdPoint.lot.id}/evidence-preview?holdPointId=${holdPoint.id}`,
    );

    const originalRequestDate = holdPoint.notificationSentAt || holdPoint.createdAt;
    const chaseContext = {
      projectName: holdPoint.lot.project.name,
      lotNumber: holdPoint.lot.lotNumber,
      holdPointDescription: holdPoint.description,
      originalRequestDate: originalRequestDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      chaseCount,
      daysSinceRequest: daysSinceRequest(originalRequestDate, now),
      requestedBy: requester.name,
    };

    for (const recipient of recipientsToNotify) {
      const urls = buildChaseRecipientUrls(
        recipient,
        loggedInEvidencePackageUrl,
        loggedInReleaseUrl,
      );

      try {
        const emailResult = await sendHPChaseEmail({
          ...buildHoldPointChaseEmail(
            { user: { email: recipient.email, fullName: recipient.fullName } },
            {
              ...chaseContext,
              evidencePackageUrl: urls.evidencePackageUrl,
              releaseUrl: urls.releaseUrl,
            },
          ),
          replyTo: requester.replyTo ?? undefined,
        });

        if (emailResult.success) {
          anySendSucceeded = true;
          await revokeSupersededChaseReleaseTokens(holdPoint.id, recipient);
        } else {
          await revokeFreshChaseReleaseToken(holdPoint.id, recipient);
        }
      } catch (emailError) {
        await revokeFreshChaseReleaseToken(holdPoint.id, recipient);
        logError('[HP Chase] Failed to send chase email:', emailError);
      }
    }
  } catch (emailError) {
    logError('[HP Chase] Failed to prepare chase email:', emailError);
    // Don't fail the main request.
  }

  return anySendSucceeded;
}
