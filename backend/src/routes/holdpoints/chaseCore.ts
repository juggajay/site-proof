/**
 * Wave E2 — the shared chase core: the pieces the manual chase route and the
 * hourly reminder job BOTH use, so neither can drift from the other.
 *
 * Spec: `docs/plans/wave-e-approvals-spec-2026-07-28.md` §4.2.2 (the atomic
 * reservation), §4.2.3 (the recipient resolver's expiry predicate and middle
 * tier) and §4.2.4 (the durable requester by audit lookup).
 * Threat model: `docs/plans/wave-e0-threat-model-2026-07-28.md` rows 3d, 11,
 * 13 and 14 — all `Mitigate before E2`.
 *
 * Three defects of the manual path are fixed HERE rather than in the job,
 * because a fix in the job would industrialise them while leaving the route
 * broken:
 *
 *  1. `chaseCount` was incremented by a read-then-write (`findUnique` at :721,
 *     status check at :745, bare `update({ where: { id } })` at :749), so two
 *     concurrent chases both passed and both sent. There was NO cap: a repo-wide
 *     grep found no comparison against `chaseCount` anywhere.
 *  2. The recipient resolver filtered tokens on `usedAt: null` only — never
 *     `expiresAt` — so an EXPIRED token kept seeding chases until the retention
 *     sweep removed it, and outside production that sweep is off by default
 *     (`dataRetentionWorker.ts`), i.e. forever.
 *  3. Once retention did remove it, the chase silently stopped emailing the
 *     external superintendent and started emailing internal staff, with no
 *     signal. The middle tier (`notificationSentTo`, the durable record of who
 *     was actually asked) closes that hole.
 */

import crypto from 'crypto';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { AWAITING_RELEASE_HOLD_POINT_STATUSES } from '../../lib/readiness/predicates.js';
import { SECURE_LINK_EXPIRY_HOURS, hashHoldPointReleaseToken } from './tokens.js';
import { parseNotificationEmailList } from './validation.js';

/**
 * Chases allowed per REQUEST GENERATION (E.0 item 13, ratified). Not per row
 * lifetime: a hold point is unique per `[lotId, itpChecklistItemId]` and is
 * never replaced, so a lifetime cap would give the third re-request of a
 * long-running hold point zero reminders.
 */
export const MAX_CHASES_PER_REQUEST = 3;

/**
 * Minimum gap between two chases of the same hold point. One day, which is also
 * what makes the per-recipient DAILY limit hold: a digest reserves every item it
 * covers, so a second pass the same day finds every item cooled down and sends
 * nothing (spec §4.2.6, AT-116).
 */
export const CHASE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type HoldPointChaseTarget = {
  email: string;
  fullName: string | null;
  secureToken?: string;
};

type HoldPointReleaseTokenRecipient = {
  recipientEmail: string;
  recipientName: string | null;
};

export type ChaseReservation = {
  /** True only when THIS caller won the reservation and may therefore send. */
  reserved: boolean;
  /** `chaseCount` after the increment. Only meaningful when `reserved`. */
  chaseCount: number;
  /** Why the reservation failed, for logging and audit. Never a send gate. */
  reason?: 'lost_race_or_cap' | 'not_awaiting' | 'cooldown' | 'stale_generation' | 'missing';
};

/**
 * ONE atomic reservation, shared by the route and the job (spec §4.2.2).
 *
 * Every clause is a correct reason not to send, and `count === 1` is the only
 * licence to send. `notificationSentAt: { gte: generationStart }` is the
 * generation bound: `notificationSentAt` is rewritten on every release request
 * (and E2 resets `chaseCount`/`lastChasedAt` in that same transaction), so an
 * in-flight reservation from a superseded generation fails CLOSED.
 *
 * `status: { in: AWAITING_RELEASE_HOLD_POINT_STATUSES }` also closes the
 * `completed` gap: the old route guard rejected only `'released'`, so a
 * `completed` hold point was chaseable. That is a deliberate behaviour change
 * (E.0 item 13 clause 3).
 *
 * This must be the ONLY writer of `chaseCount` and `lastChasedAt` — an atomic
 * reservation with a bare `update` surviving beside it is decorative.
 */
export async function reserveHoldPointChase(
  holdPointId: string,
  now: Date,
  generationStart: Date | null,
): Promise<ChaseReservation> {
  if (!generationStart) {
    // No generation = no release request was ever sent for this hold point, so
    // there is nothing to chase about.
    return { reserved: false, chaseCount: 0, reason: 'stale_generation' };
  }

  const result = await prisma.holdPoint.updateMany({
    where: {
      id: holdPointId,
      status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] },
      chaseCount: { lt: MAX_CHASES_PER_REQUEST },
      OR: [
        { lastChasedAt: null },
        { lastChasedAt: { lt: new Date(now.getTime() - CHASE_COOLDOWN_MS) } },
      ],
      notificationSentAt: { gte: generationStart },
    },
    data: { chaseCount: { increment: 1 }, lastChasedAt: now },
  });

  if (result.count === 1) {
    const after = await prisma.holdPoint.findUnique({
      where: { id: holdPointId },
      select: { chaseCount: true },
    });
    return { reserved: true, chaseCount: after?.chaseCount ?? 1 };
  }

  return { reserved: false, chaseCount: 0, reason: await describeReservationFailure(holdPointId) };
}

// One follow-up read, for logging and audit only — never a send gate.
async function describeReservationFailure(
  holdPointId: string,
): Promise<NonNullable<ChaseReservation['reason']>> {
  const holdPoint = await prisma.holdPoint.findUnique({
    where: { id: holdPointId },
    select: { status: true, chaseCount: true, lastChasedAt: true },
  });

  if (!holdPoint) return 'missing';
  if (!(AWAITING_RELEASE_HOLD_POINT_STATUSES as readonly string[]).includes(holdPoint.status)) {
    return 'not_awaiting';
  }
  if (holdPoint.chaseCount >= MAX_CHASES_PER_REQUEST) return 'lost_race_or_cap';
  return 'cooldown';
}

/**
 * Give the attempt back after a FAILED send (E.0 item 13 clause 2, ratified:
 * failure is a transport problem and retrying is correct). A SUPPRESSED send
 * does NOT call this — suppression is a delivery decision, and retrying a
 * decision is not correct.
 *
 * `lastChasedAt` is restored to its pre-reservation value so the cooldown does
 * not silently absorb the retry either.
 */
export async function rollbackHoldPointChase(
  holdPointId: string,
  previousLastChasedAt: Date | null,
): Promise<void> {
  await prisma.holdPoint.updateMany({
    where: { id: holdPointId, chaseCount: { gt: 0 } },
    data: { chaseCount: { decrement: 1 }, lastChasedAt: previousLastChasedAt },
  });
}

export function buildTokenChaseTargets(
  existingReleaseTokens: HoldPointReleaseTokenRecipient[],
): HoldPointChaseTarget[] {
  const tokenTargetsByEmail = new Map<string, HoldPointChaseTarget>();

  for (const tokenRecipient of existingReleaseTokens) {
    const email = tokenRecipient.recipientEmail.trim();
    if (!email) continue;

    const key = email.toLowerCase();
    if (!tokenTargetsByEmail.has(key)) {
      tokenTargetsByEmail.set(key, {
        email,
        fullName: tokenRecipient.recipientName,
        secureToken: crypto.randomBytes(32).toString('hex'),
      });
    }
  }

  return Array.from(tokenTargetsByEmail.values());
}

export async function createChaseReleaseTokens(
  holdPointId: string,
  tokenTargets: HoldPointChaseTarget[],
): Promise<void> {
  if (tokenTargets.length === 0) {
    return;
  }

  const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

  // Reissuance never WIDENS the capability (E.0 item 11 clause 4): one token,
  // one `holdPointId`, exactly as the shipped chase does. Anything
  // project-scoped here would be `[E-B8]`'s forbidden dynamic union arriving
  // through the back door.
  await prisma.holdPointReleaseToken.createMany({
    data: tokenTargets.map((recipient) => ({
      holdPointId,
      recipientEmail: recipient.email,
      recipientName: recipient.fullName,
      token: hashHoldPointReleaseToken(recipient.secureToken!),
      expiresAt: tokenExpiry,
    })),
  });
}

export async function revokeSupersededChaseReleaseTokens(
  holdPointId: string,
  tokenTarget: HoldPointChaseTarget,
): Promise<void> {
  if (!tokenTarget.secureToken) {
    return;
  }

  await prisma.holdPointReleaseToken.deleteMany({
    where: {
      holdPointId,
      recipientEmail: tokenTarget.email,
      usedAt: null,
      token: { not: hashHoldPointReleaseToken(tokenTarget.secureToken) },
    },
  });
}

export async function revokeFreshChaseReleaseToken(
  holdPointId: string,
  tokenTarget: HoldPointChaseTarget,
): Promise<void> {
  if (!tokenTarget.secureToken) {
    return;
  }

  await prisma.holdPointReleaseToken.deleteMany({
    where: {
      holdPointId,
      recipientEmail: tokenTarget.email,
      usedAt: null,
      token: hashHoldPointReleaseToken(tokenTarget.secureToken),
    },
  });
}

/**
 * Tier 1 — recipients holding a LIVE token. `expiresAt: { gt: now }` is the
 * `[ER-B6]` / E.0 row 3d fix: without it an expired capability was treated as a
 * live one and reissued indefinitely.
 */
export async function loadLiveTokenChaseTargets(
  holdPointId: string,
  now: Date,
): Promise<HoldPointChaseTarget[]> {
  const liveTokens = await prisma.holdPointReleaseToken.findMany({
    where: {
      holdPointId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    select: { recipientEmail: true, recipientName: true },
    orderBy: { createdAt: 'desc' },
  });

  return buildTokenChaseTargets(liveTokens);
}

/**
 * Tier 2 — the addresses the request was actually sent to. `notificationSentTo`
 * is rewritten on every release request and is never purged, so it outlives the
 * 48-hour tokens and is what the reminder must fall back to. Emails only, no
 * names, so these recipients get the `'Superintendent'` fallback and their token
 * carries no `recipientName` — a materially weaker evidence artifact than a
 * tier-1 link (`[E-l]`, spec §7.6). That is accepted and stated, not hidden.
 */
export function buildNotificationSentToChaseTargets(
  notificationSentTo: string | null,
): HoldPointChaseTarget[] {
  return parseNotificationEmailList(notificationSentTo).map((email) => ({
    email,
    fullName: null,
    secureToken: crypto.randomBytes(32).toString('hex'),
  }));
}

async function loadProjectChaseTargets(
  projectId: string,
  selectRecipients: <T>(superintendents: T[], projectManagers: T[]) => T[],
): Promise<HoldPointChaseTarget[]> {
  const superintendents = await prisma.projectUser.findMany({
    where: { projectId, role: 'superintendent', status: 'active' },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });

  // Keep the lookup lazy: project managers are only queried when there are no
  // superintendents.
  const projectManagers: typeof superintendents =
    superintendents.length > 0
      ? []
      : await prisma.projectUser.findMany({
          where: { projectId, role: 'project_manager', status: 'active' },
          include: { user: { select: { id: true, email: true, fullName: true } } },
        });

  return selectRecipients(superintendents, projectManagers).map((recipient) => ({
    email: recipient.user.email,
    fullName: recipient.user.fullName,
  }));
}

/**
 * The shared three-tier resolver: live token -> `notificationSentTo` -> project
 * users. Fresh tokens are minted for whichever tier answers, so the recipient
 * always gets a working link.
 *
 * `allowProjectUserFallback` is FALSE for the automation job: tier 3 mails
 * internal staff, and "no reminder to internal staff — that is E1's alert" is an
 * explicit E2 non-goal (spec §4.2.8). The manual route keeps it, because a human
 * pressing Chase with no external recipient on record still wants someone told.
 */
export async function loadHoldPointChaseTargets(
  holdPointId: string,
  projectId: string,
  now: Date,
  notificationSentTo: string | null,
  options: {
    allowProjectUserFallback: boolean;
    selectRecipients: <T>(superintendents: T[], projectManagers: T[]) => T[];
  },
): Promise<HoldPointChaseTarget[]> {
  const tokenTargets = await loadLiveTokenChaseTargets(holdPointId, now);
  if (tokenTargets.length > 0) {
    await createChaseReleaseTokens(holdPointId, tokenTargets);
    return tokenTargets;
  }

  const notifiedTargets = buildNotificationSentToChaseTargets(notificationSentTo);
  if (notifiedTargets.length > 0) {
    await createChaseReleaseTokens(holdPointId, notifiedTargets);
    return notifiedTargets;
  }

  if (!options.allowProjectUserFallback) {
    return [];
  }

  return loadProjectChaseTargets(projectId, options.selectRecipients);
}

/**
 * A tokenized recipient gets the passwordless link; anyone else (the project-user
 * fallback, who is an internal CIVOS user) gets the authenticated in-app URLs.
 */
export function buildChaseRecipientUrls(
  recipient: HoldPointChaseTarget,
  loggedInEvidencePackageUrl: string,
  loggedInReleaseUrl: string,
) {
  if (recipient.secureToken) {
    const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);
    return {
      evidencePackageUrl: `${secureReleaseUrl}#evidence-package`,
      releaseUrl: secureReleaseUrl,
    };
  }

  return {
    evidencePackageUrl: loggedInEvidencePackageUrl,
    releaseUrl: loggedInReleaseUrl,
  };
}

export type ResolvedChaseRequester = {
  /** Display name for the email's "Requested By" line. */
  name: string;
  /** Address the reminder's `replyTo` points at. */
  replyTo: string | null;
  /** True when the original requester could not be reached and support stands in. */
  isFallback: boolean;
  /** Recorded in the audit row so the resolution is inspectable after the fact. */
  outcome: 'requester' | 'fallback_no_audit_row' | 'fallback_user_gone' | 'fallback_inactive';
};

function supportFallbackAddress(): string {
  return process.env.SUPPORT_EMAIL || 'support@civos.com.au';
}

/**
 * The durable requester, by audit lookup rather than a new column (spec §4.2.5,
 * E.0 item 14 ratified). `HP_RELEASE_REQUESTED` is written on BOTH request paths
 * with the requesting `userId`, audit rows are retention-exempt, and the
 * `createdAt >= generationStart` bound ties the answer to the CURRENT generation
 * — none of which a single overwritten column can do.
 *
 * Fallback is the company support address for a missing audit row, a deleted
 * user (`AuditLog.user` is `onDelete: SetNull`) and an INACTIVE one alike. The
 * caller must NAME the fallback in the body: telling a superintendent that
 * "CIVOS Support" asked for a hold point a named engineer asked for is
 * `[E-B8b]`'s forbidden false attribution.
 */
export async function resolveHoldPointRequester(
  holdPointId: string,
  projectId: string,
  generationStart: Date | null,
): Promise<ResolvedChaseRequester> {
  const fallback = supportFallbackAddress();

  const auditRow = await prisma.auditLog.findFirst({
    where: {
      entityType: 'hold_point',
      entityId: holdPointId,
      action: AuditAction.HP_RELEASE_REQUESTED,
      ...(generationStart ? { createdAt: { gte: generationStart } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { userId: true },
  });

  if (!auditRow?.userId) {
    return {
      name: 'CIVOS Support (original requester unavailable)',
      replyTo: fallback,
      isFallback: true,
      outcome: auditRow ? 'fallback_user_gone' : 'fallback_no_audit_row',
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: auditRow.userId },
    select: { email: true, fullName: true },
  });

  if (!user) {
    return {
      name: 'CIVOS Support (original requester unavailable)',
      replyTo: fallback,
      isFallback: true,
      outcome: 'fallback_user_gone',
    };
  }

  // "Inactive" has no User-level flag in this schema; project membership is
  // where activity lives, so an inactive membership is an inactive requester.
  // CIVOS should not invite a reply to a mailbox nobody reads (E.0 item 14
  // clause 2).
  const membership = await prisma.projectUser.findFirst({
    where: { projectId, userId: auditRow.userId, status: 'active' },
    select: { id: true },
  });

  if (!membership) {
    return {
      name: 'CIVOS Support (original requester unavailable)',
      replyTo: fallback,
      isFallback: true,
      outcome: 'fallback_inactive',
    };
  }

  return {
    name: user.fullName || user.email,
    replyTo: user.email,
    isFallback: false,
    outcome: 'requester',
  };
}
