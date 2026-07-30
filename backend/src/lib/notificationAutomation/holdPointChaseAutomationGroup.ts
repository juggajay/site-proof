/**
 * Wave E2 — one recipient group's half of the chase pass.
 *
 * Extracted from `processHoldPointChaseReminders` when E2's controls pushed
 * that function over the complexity threshold, exactly as E1 extracted
 * `createStaleHoldPointAlerts` from `processSystemAlerts` for the same reason.
 * Behaviour-identical, just its own scope.
 *
 * A "group" is one `(project, normalized recipient email)` pair — the unit the
 * digest and the daily limit are both keyed on.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import { renderHoldPointChaseDigestEmail } from '../email/holdPointChaseDigestTemplate.js';
import { isSuppressionFailure, normalizeRecipientEmail } from '../emailSuppression.js';
import { buildFrontendUrl } from '../runtimeConfig.js';
import { logError } from '../serverLogger.js';
import {
  type HoldPointChaseTarget,
  createChaseReleaseTokens,
  daysSinceRequest,
  loadLiveTokenChaseTargets,
  reserveHoldPointChase,
  resolveHoldPointRequester,
  revokeFreshChaseReleaseToken,
  revokeSupersededChaseReleaseTokens,
  rollbackHoldPointChase,
} from '../../routes/holdpoints/chaseCore.js';
import { auditAutomatedSend } from './holdPointChaseAudit.js';
import type { EligibleHoldPoint, RecipientGroup } from './holdPointChaseTypes.js';

export type ChaseSendResult = 'sent' | 'failed' | 'suppressed';

type ReservedItem = {
  holdPoint: EligibleHoldPoint;
  reservationId: string;
  chaseCount: number;
  previousLastChasedAt: Date | null;
  target: HoldPointChaseTarget;
  requester: Awaited<ReturnType<typeof resolveHoldPointRequester>>;
};

function formatRequestDate(value: Date): string {
  return value.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Reserve every due item in the group. Only a reservation whose `count === 1`
 * licenses a send, so this is also where the cap, the cooldown, the generation
 * bound and the awaiting-status guard are enforced — atomically, for the job and
 * the manual route alike.
 *
 * When the recipient is suppressed the reservation is still taken and audited
 * and NOTHING is minted: a suppressed send consumes the attempt (`[E-j]`).
 */
export async function reserveGroupItems(
  group: RecipientGroup,
  dueHoldPoints: EligibleHoldPoint[],
  now: Date,
  suppressed: boolean,
): Promise<ReservedItem[]> {
  const reserved: ReservedItem[] = [];

  for (const holdPoint of dueHoldPoints) {
    const previousLastChasedAt = holdPoint.lastChasedAt;
    const reservation = await reserveHoldPointChase(
      holdPoint.id,
      now,
      holdPoint.notificationSentAt,
    );
    if (!reservation.reserved) continue;

    const reservationId = randomUUID();
    const requester = await resolveHoldPointRequester(
      holdPoint.id,
      holdPoint.lot.projectId,
      holdPoint.notificationSentAt,
    );

    if (suppressed) {
      await auditAutomatedSend({
        projectId: holdPoint.lot.projectId,
        holdPointId: holdPoint.id,
        reservationId,
        generation: holdPoint.notificationSentAt,
        chaseCount: reservation.chaseCount,
        tokenRecipient: group.normalizedEmail,
        requesterResolution: requester.outcome,
        sendResult: 'suppressed',
        digestSize: 0,
      });
      continue;
    }

    // The display name comes from a LIVE token when one exists (tier 1);
    // otherwise this is a tier-2 link minted from `notificationSentTo`, which
    // stores emails without names — so the token carries no `recipientName`,
    // the identity override at `holdpoints.ts:176-177` does not apply, and the
    // signer types their own name. Weaker evidence, accepted and stated
    // (`[E-l]`, spec §7.6), not hidden.
    const liveTargets = await loadLiveTokenChaseTargets(holdPoint.id, now);
    const liveMatch = liveTargets.find(
      (target) => normalizeRecipientEmail(target.email) === group.normalizedEmail,
    );
    const target: HoldPointChaseTarget = {
      email: group.email,
      fullName: liveMatch?.fullName ?? null,
      secureToken: liveMatch?.secureToken ?? randomBytes(32).toString('hex'),
    };
    await createChaseReleaseTokens(holdPoint.id, [target]);

    reserved.push({
      holdPoint,
      reservationId,
      chaseCount: reservation.chaseCount,
      previousLastChasedAt,
      target,
      requester,
    });
  }

  return reserved;
}

/**
 * Control 1 — ONE email for the whole group. Per-item tokens, per-item
 * reservations and per-item audit rows are unchanged; only the envelope is
 * consolidated.
 */
export async function sendGroupDigest(
  group: RecipientGroup,
  reserved: ReservedItem[],
  now: Date,
  unsubscribeUrl: string,
  sendEmailFn: (options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }) => Promise<{ success: boolean; error?: string; errorCode?: string }>,
): Promise<ChaseSendResult> {
  const envelope = reserved[0]!;
  const rendered = renderHoldPointChaseDigestEmail({
    superintendentName: envelope.target.fullName || 'Superintendent',
    projectName: group.projectName,
    requestedBy: envelope.requester.name,
    requesterIsFallback: envelope.requester.isFallback,
    // Wave E2.1 — never absent on an automated reminder.
    unsubscribeUrl,
    holdPoints: reserved.map((item) => {
      const secureReleaseUrl = buildFrontendUrl(`/hp-release/${item.target.secureToken}`);
      const requestedAt = item.holdPoint.notificationSentAt ?? item.holdPoint.createdAt;
      return {
        lotNumber: item.holdPoint.lot.lotNumber,
        holdPointDescription: item.holdPoint.description || 'Hold Point',
        originalRequestDate: formatRequestDate(requestedAt),
        daysSinceRequest: daysSinceRequest(requestedAt, now),
        chaseCount: item.chaseCount,
        releaseUrl: secureReleaseUrl,
        evidencePackageUrl: `${secureReleaseUrl}#evidence-package`,
      };
    }),
  });

  try {
    const emailResult = await sendEmailFn({
      to: group.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: envelope.requester.replyTo ?? undefined,
    });
    if (emailResult.success) return 'sent';

    // The RECORD now happens once, inside the shared `sendEmail` (L12), so every
    // caller gets it and not just this job. Classifying here is still this
    // module's own job: 'suppressed' consumes the attempt, 'failed' refunds it.
    if (isSuppressionFailure(emailResult.error, emailResult.errorCode)) {
      return 'suppressed';
    }
    return 'failed';
  } catch (error) {
    logError('[HP Chase Automation] Digest send threw:', error);
    return 'failed';
  }
}

/**
 * Settle every reserved item against the group's one send outcome: revoke the
 * superseded tokens on success, revoke the UNDELIVERED fresh token otherwise,
 * refund the attempt on transport failure (`[E-j]`), and audit all three
 * outcomes — a reminder deliberately not sent is an operational fact, and
 * nothing recorded it before (§4.2.7, AT-117).
 *
 * The fresh token is minted BEFORE the send (`reserveGroupItems`), so on a
 * failed or suppressed digest its secret was never transmitted to anyone and
 * the row is a live capability nobody holds. Nothing revoked it, so orphans
 * accumulated across all three chase attempts — exactly the drift `chaseCore`
 * exists to prevent, and the manual path already calls
 * `revokeFreshChaseReleaseToken` on both of its failure arms.
 */
export async function finaliseGroupItems(
  group: RecipientGroup,
  reserved: ReservedItem[],
  sendResult: ChaseSendResult,
): Promise<void> {
  for (const item of reserved) {
    if (sendResult === 'sent') {
      await revokeSupersededChaseReleaseTokens(item.holdPoint.id, item.target);
    } else {
      await revokeFreshChaseReleaseToken(item.holdPoint.id, item.target);
      if (sendResult === 'failed') {
        await rollbackHoldPointChase(item.holdPoint.id, item.previousLastChasedAt);
      }
    }

    await auditAutomatedSend({
      projectId: item.holdPoint.lot.projectId,
      holdPointId: item.holdPoint.id,
      reservationId: item.reservationId,
      generation: item.holdPoint.notificationSentAt,
      chaseCount: item.chaseCount,
      tokenRecipient: group.normalizedEmail,
      requesterResolution: item.requester.outcome,
      sendResult,
      digestSize: reserved.length,
    });
  }
}
