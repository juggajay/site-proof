/**
 * Wave E2 — the automated chase, digest-shaped and canary-bound.
 *
 * Spec: `docs/plans/wave-e-approvals-spec-2026-07-28.md` §4.2.
 * Threat model: `docs/plans/wave-e0-threat-model-2026-07-28.md` rows 3d, 7a,
 * 7c, 7d, 9b, 11, 12a, 13, 14, 16 — every one `Mitigate before E2`.
 *
 * A FIFTH job in the existing hourly pass, inside the same advisory lock. Not a
 * new worker, not a new interval, not a new lock. It reuses E1's canary
 * allowlist and its fail-closed parser, so an unset env var means this job
 * touches nobody.
 *
 * The three controls that make it safe to point at an external mailbox, and why
 * they are controls rather than settings (`[ER-A3]`): a per-ITEM chase counter
 * cannot see that three chases across a hundred hold points is three hundred
 * messages to one address. So:
 *
 *  1. **A consolidated digest** — one email per (project, normalized recipient)
 *     per pass, listing every due item with its own link and its own token.
 *  2. **A daily limit** — keyed on `recipientEmail.toLowerCase()` (E.0 item
 *     12a: the stored casing is first-seen, so `Sam@x.com` and `sam@x.com` are
 *     two stored values and one person). Enforced from `lastChasedAt` across
 *     ALL of that recipient's awaiting hold points on the project, so a second
 *     pass the same day — and a newly-due item the same day — both send nothing.
 *  3. **Suppression** — a check at send time and an audited skip, with no
 *     CIVOS table (E.0 item 16).
 *
 * What it deliberately does NOT do: reach internal staff. Tier 3 of the shared
 * resolver is off here, because "no reminder to internal staff — that is E1's
 * alert" is an explicit non-goal (spec §4.2.8).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import { AuditAction, createAuditLog } from '../auditLog.js';
import { sendEmail } from '../email.js';
import { renderHoldPointChaseDigestEmail } from '../email/holdPointChaseDigestTemplate.js';
import {
  isEmailSuppressed,
  isSuppressionFailure,
  normalizeRecipientEmail,
  recordEmailSuppression,
} from '../emailSuppression.js';
import { AWAITING_RELEASE_HOLD_POINT_STATUSES } from '../readiness/predicates.js';
import { buildFrontendUrl } from '../runtimeConfig.js';
import { logError, logInfo } from '../serverLogger.js';
import {
  type HoldPointChaseTarget,
  MAX_CHASES_PER_REQUEST,
  createChaseReleaseTokens,
  loadLiveTokenChaseTargets,
  reserveHoldPointChase,
  resolveHoldPointRequester,
  revokeSupersededChaseReleaseTokens,
  rollbackHoldPointChase,
} from '../../routes/holdpoints/chaseCore.js';
import { parseNotificationEmailList } from '../../routes/holdpoints/validation.js';
import { parseProjectIdAllowlist, resolveAppTimeZone } from './helpers.js';

/**
 * The SAME allowlist E1 ships, read the same fail-closed way. Unset, blank or
 * separator-only parses to `[]`, and `[]` means no projects — so an E2 deploy
 * is inert until Jay names projects (E.0 item 8c).
 */
const WAVE_E_CANARY_ENV = 'WAVE_E_STALE_ALERT_PROJECT_IDS';

/** First reminder fires when `scheduledDate` is this many working days away. */
const REMINDER_DUE_LEAD_WORKING_DAYS = 1;

/** Working days between reminders once `scheduledDate` is past. */
const REMINDER_OVERDUE_INTERVAL_WORKING_DAYS = 2;

/** Per-project-and-normalized-recipient daily limit (spec §4.2.6). */
const MAX_REMINDER_EMAILS_PER_RECIPIENT_PER_PROJECT_PER_DAY = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Page size for the eligibility scan, per pass. */
const REMINDER_SCAN_TAKE = 500;

/** Global cap on digest emails one pass may send, decremented across projects. */
const REMINDER_EMAILS_PER_PASS = 50;

const DEFAULT_WORKING_DAYS = '1,2,3,4,5';

type ChasePrisma = Pick<PrismaClient, 'holdPoint'>;

export type HoldPointChaseJobOptions = {
  now?: Date;
  projectIds?: string[];
};

export type HoldPointChaseAutomationResult = {
  canaryProjects: number;
  eligibleHoldPoints: number;
  recipientGroups: number;
  digestsSent: number;
  holdPointsReminded: number;
  dailyLimitSkipped: number;
  suppressedRecipients: number;
  sendFailures: number;
  deferred: number;
};

export type HoldPointChaseAutomationDependencies = {
  prisma: ChasePrisma;
  sendEmail: typeof sendEmail;
  isSuppressed: (email: string) => boolean;
};

export function buildHoldPointChaseAutomationDependencies(
  prisma: ChasePrisma,
): HoldPointChaseAutomationDependencies {
  return { prisma, sendEmail, isSuppressed: isEmailSuppressed };
}

// ---------------------------------------------------------------------------
// Working-day arithmetic on WHOLE DAYS in APP_TIMEZONE (spec §4.2.1).
//
// Deliberately not `calculateWorkingDays` verbatim: that helper walks the
// calendar with `setHours(0,0,0,0)` and `getDay()`, i.e. in the SERVER's local
// zone. This job's clock has to be the project's calendar day, so a near-
// midnight UTC `scheduledDate` cannot land on the wrong day depending on where
// the container runs. Same semantics otherwise — working days in [from, to),
// same `workingDays` string, `1,2,3,4,5` default.
// ---------------------------------------------------------------------------

function zonedUtcMidnight(value: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

export function workingDaysBetween(
  from: Date,
  to: Date,
  workingDays: string | null,
  timeZone: string = resolveAppTimeZone(),
): number {
  const days = new Set(
    (workingDays || DEFAULT_WORKING_DAYS)
      .split(',')
      .map((day) => Number(day.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );
  if (days.size === 0) [1, 2, 3, 4, 5].forEach((day) => days.add(day));

  let current = zonedUtcMidnight(from, timeZone);
  const target = zonedUtcMidnight(to, timeZone);
  let count = 0;
  // Bounded: a decade of daily steps is far past anything the horizon admits,
  // and an unbounded while over user data inside an hourly job is how a worker
  // wedges.
  for (let step = 0; current < target && step < 4000; step += 1) {
    if (days.has(current.getUTCDay())) count += 1;
    current = new Date(current.getTime() + DAY_MS);
  }
  return count;
}

/**
 * The reminder clock, anchored to `scheduledDate` (`[ER-B4]`).
 *
 * `minimumNoticeDays` is NOT consulted: it is a forward, request-time lead-time
 * gate, and using it as a backward reminder age produced the reviewer's failure
 * case — a hold point requested 14 days ahead with `minimumNoticeDays = 1`
 * being chased 13 days before it was due.
 */
export function isReminderDue(
  holdPoint: { scheduledDate: Date | null; chaseCount: number; lastChasedAt: Date | null },
  now: Date,
  workingDays: string | null,
  timeZone: string = resolveAppTimeZone(),
): boolean {
  // No reminder is EVER generated where `scheduledDate` is null. That is not a
  // gap — it is the same nullability the Prisma `lt` filter already enforces,
  // stated so nobody "fixes" it later.
  if (!holdPoint.scheduledDate) return false;

  const dueDay = zonedUtcMidnight(holdPoint.scheduledDate, timeZone);
  const today = zonedUtcMidnight(now, timeZone);

  if (today < dueDay) {
    // Not yet due: only remind once it is within the lead time.
    return (
      workingDaysBetween(now, holdPoint.scheduledDate, workingDays, timeZone) <=
      REMINDER_DUE_LEAD_WORKING_DAYS
    );
  }

  // Due or overdue. The first reminder may go immediately; later ones wait out
  // the overdue interval.
  if (!holdPoint.lastChasedAt) return true;
  return (
    workingDaysBetween(holdPoint.lastChasedAt, now, workingDays, timeZone) >=
    REMINDER_OVERDUE_INTERVAL_WORKING_DAYS
  );
}

type EligibleHoldPoint = {
  id: string;
  description: string | null;
  status: string;
  scheduledDate: Date | null;
  notificationSentAt: Date | null;
  notificationSentTo: string | null;
  chaseCount: number;
  lastChasedAt: Date | null;
  createdAt: Date;
  lot: {
    id: string;
    lotNumber: string;
    projectId: string;
    project: { id: string; name: string; workingDays: string | null };
  };
};

type RecipientGroup = {
  projectId: string;
  projectName: string;
  workingDays: string | null;
  normalizedEmail: string;
  /** First-seen stored casing — what the address is actually mailed at. */
  email: string;
  holdPoints: EligibleHoldPoint[];
};

function groupByProjectAndRecipient(holdPoints: EligibleHoldPoint[]): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();

  for (const holdPoint of holdPoints) {
    for (const email of parseNotificationEmailList(holdPoint.notificationSentTo)) {
      const normalizedEmail = normalizeRecipientEmail(email);
      if (!normalizedEmail) continue;
      const key = `${holdPoint.lot.projectId}::${normalizedEmail}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          projectId: holdPoint.lot.projectId,
          projectName: holdPoint.lot.project.name,
          workingDays: holdPoint.lot.project.workingDays,
          normalizedEmail,
          email: email.trim(),
          holdPoints: [],
        };
        groups.set(key, group);
      }
      group.holdPoints.push(holdPoint);
    }
  }

  return Array.from(groups.values());
}

function formatRequestDate(value: Date): string {
  return value.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Every automated send writes an audit row — including the ones that did NOT
 * send. A reminder deliberately withheld is an operational fact, and nothing
 * recorded it before (§4.2.7, AT-117).
 *
 * `userId` is omitted: the actor is the automation worker, and the audit helper
 * already accepts an absent actor with a nullable, `SetNull` column. The
 * recipient goes under `tokenRecipient` on purpose — that key matches the
 * `/token/i` trap in `sanitizeAuditChanges`, so the address is REDACTED at rest.
 * Renaming it to anything without "token" in it would silently start persisting
 * external recipient emails to a store with no deletion path (E.0 item 9b).
 */
async function auditAutomatedSend(params: {
  projectId: string;
  holdPointId: string;
  reservationId: string;
  generation: Date | null;
  chaseCount: number;
  tokenRecipient: string;
  requesterResolution: string;
  sendResult: 'sent' | 'failed' | 'suppressed';
  digestSize: number;
}): Promise<void> {
  await createAuditLog({
    projectId: params.projectId,
    entityType: 'hold_point',
    entityId: params.holdPointId,
    action: AuditAction.HP_CHASED,
    changes: {
      source: 'automation',
      reservationId: params.reservationId,
      generation: params.generation?.toISOString() ?? null,
      chaseCount: params.chaseCount,
      tokenRecipient: params.tokenRecipient,
      requesterResolution: params.requesterResolution,
      sendResult: params.sendResult,
      digestSize: params.digestSize,
    },
  });
}

export async function processHoldPointChaseReminders(
  options: HoldPointChaseJobOptions,
  deps: HoldPointChaseAutomationDependencies,
): Promise<HoldPointChaseAutomationResult> {
  const now = options.now ?? new Date();
  const timeZone = resolveAppTimeZone();
  const result: HoldPointChaseAutomationResult = {
    canaryProjects: 0,
    eligibleHoldPoints: 0,
    recipientGroups: 0,
    digestsSent: 0,
    holdPointsReminded: 0,
    dailyLimitSkipped: 0,
    suppressedRecipients: 0,
    sendFailures: 0,
    deferred: 0,
  };

  const canary = parseProjectIdAllowlist(process.env[WAVE_E_CANARY_ENV]);
  const scopedIds = options.projectIds
    ? canary.filter((id) => options.projectIds!.includes(id))
    : canary;

  // FAIL CLOSED. This is the whole deploy story: E2 is inert until the env var
  // names projects.
  if (scopedIds.length === 0) return result;
  result.canaryProjects = scopedIds.length;

  const eligible = (await deps.prisma.holdPoint.findMany({
    where: {
      status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] },
      scheduledDate: { not: null },
      notificationSentAt: { not: null },
      notificationSentTo: { not: null },
      lot: {
        projectId: { in: scopedIds },
        // Project closure terminates reissuance (E.0 item 11 clause 3). The
        // whole automation family scopes to `status: 'active'`; this matches it
        // and is strictly tighter than the shipped archived-only write gate.
        project: { status: 'active' },
      },
    },
    select: {
      id: true,
      description: true,
      status: true,
      scheduledDate: true,
      notificationSentAt: true,
      notificationSentTo: true,
      chaseCount: true,
      lastChasedAt: true,
      createdAt: true,
      lot: {
        select: {
          id: true,
          lotNumber: true,
          projectId: true,
          project: { select: { id: true, name: true, workingDays: true } },
        },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
    take: REMINDER_SCAN_TAKE,
  })) as EligibleHoldPoint[];

  result.eligibleHoldPoints = eligible.length;

  const groups = groupByProjectAndRecipient(eligible);
  result.recipientGroups = groups.length;

  let budget = REMINDER_EMAILS_PER_PASS;

  for (const group of groups) {
    if (budget <= 0) {
      result.deferred += 1;
      continue;
    }

    // Control 2 — the daily limit. `lastChasedAt` across EVERY awaiting hold
    // point this recipient holds on this project is the durable record of when
    // CIVOS last mailed them about it, so a second digest the same day (whether
    // from a second pass or from an item that only just became due) is
    // impossible. No new column, no new table.
    const lastRemindedAt = group.holdPoints.reduce<Date | null>(
      (latest, holdPoint) =>
        holdPoint.lastChasedAt && (!latest || holdPoint.lastChasedAt > latest)
          ? holdPoint.lastChasedAt
          : latest,
      null,
    );
    if (
      lastRemindedAt &&
      now.getTime() - lastRemindedAt.getTime() <
        DAY_MS / MAX_REMINDER_EMAILS_PER_RECIPIENT_PER_PROJECT_PER_DAY
    ) {
      result.dailyLimitSkipped += 1;
      continue;
    }

    const dueHoldPoints = group.holdPoints.filter(
      (holdPoint) =>
        holdPoint.chaseCount < MAX_CHASES_PER_REQUEST &&
        isReminderDue(holdPoint, now, group.workingDays, timeZone),
    );
    if (dueHoldPoints.length === 0) continue;

    const suppressed = deps.isSuppressed(group.email);

    type ReservedItem = {
      holdPoint: EligibleHoldPoint;
      reservationId: string;
      chaseCount: number;
      previousLastChasedAt: Date | null;
      target: HoldPointChaseTarget;
      requester: Awaited<ReturnType<typeof resolveHoldPointRequester>>;
    };
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
        // A suppressed send CONSUMES the attempt (`[E-j]`): suppression is a
        // delivery decision, and retrying a decision is not correct.
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

      // The recipient's display name comes from a LIVE token when one exists
      // (tier 1); otherwise this is a tier-2 link minted from
      // `notificationSentTo`, which stores emails without names — so the token
      // carries no `recipientName`, the identity override does not apply, and
      // the signer types their own name. Weaker evidence, accepted and stated
      // (`[E-l]`, spec §7.6).
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

    if (suppressed) {
      if (reserved.length === 0 && dueHoldPoints.length > 0) result.suppressedRecipients += 1;
      continue;
    }
    if (reserved.length === 0) continue;

    // Control 1 — ONE email for the whole group. Per-item tokens, per-item
    // reservations and per-item audit rows are unchanged; only the envelope is
    // consolidated.
    const envelope = reserved[0]!;
    const rendered = renderHoldPointChaseDigestEmail({
      superintendentName: envelope.target.fullName || 'Superintendent',
      projectName: group.projectName,
      requestedBy: envelope.requester.name,
      requesterIsFallback: envelope.requester.isFallback,
      holdPoints: reserved.map((item) => {
        const secureReleaseUrl = buildFrontendUrl(`/hp-release/${item.target.secureToken}`);
        const requestedAt = item.holdPoint.notificationSentAt ?? item.holdPoint.createdAt;
        return {
          lotNumber: item.holdPoint.lot.lotNumber,
          holdPointDescription: item.holdPoint.description || 'Hold Point',
          originalRequestDate: formatRequestDate(requestedAt),
          daysSinceRequest: Math.max(
            0,
            Math.floor((now.getTime() - requestedAt.getTime()) / DAY_MS),
          ),
          chaseCount: item.chaseCount,
          releaseUrl: secureReleaseUrl,
          evidencePackageUrl: `${secureReleaseUrl}#evidence-package`,
        };
      }),
    });

    let sendResult: 'sent' | 'failed' | 'suppressed' = 'failed';
    let failureDetail: { error?: string; errorCode?: string } = {};
    try {
      const emailResult = await deps.sendEmail({
        to: group.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: envelope.requester.replyTo ?? undefined,
      });
      if (emailResult.success) {
        sendResult = 'sent';
      } else {
        failureDetail = { error: emailResult.error, errorCode: emailResult.errorCode };
        sendResult = isSuppressionFailure(emailResult.error, emailResult.errorCode)
          ? 'suppressed'
          : 'failed';
      }
    } catch (error) {
      logError('[HP Chase Automation] Digest send threw:', error);
      sendResult = 'failed';
    }

    if (sendResult === 'suppressed') {
      recordEmailSuppression(group.email, failureDetail.errorCode || 'provider_rejected');
      result.suppressedRecipients += 1;
    } else if (sendResult === 'sent') {
      budget -= 1;
      result.digestsSent += 1;
      result.holdPointsReminded += reserved.length;
    } else {
      result.sendFailures += 1;
    }

    for (const item of reserved) {
      if (sendResult === 'sent') {
        await revokeSupersededChaseReleaseTokens(item.holdPoint.id, item.target);
      } else if (sendResult === 'failed') {
        // A failed send does NOT consume an attempt (`[E-j]`, E.0 item 13
        // clause 2): failure is a transport problem and retrying is correct.
        await rollbackHoldPointChase(item.holdPoint.id, item.previousLastChasedAt);
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

  if (result.digestsSent > 0 || result.deferred > 0) {
    // Never the recipient addresses — spec §7.5, `[E-B7]`.
    logInfo('[HP Chase Automation] Pass complete', {
      canaryProjects: result.canaryProjects,
      digestsSent: result.digestsSent,
      holdPointsReminded: result.holdPointsReminded,
      dailyLimitSkipped: result.dailyLimitSkipped,
      deferred: result.deferred,
    });
  }

  return result;
}
