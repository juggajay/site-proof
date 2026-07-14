import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import {
  projectTimeZoneFromState,
  zonedStartOfDayToUtc,
  zonedEndOfDayToUtc,
} from '../../lib/projectTimeZone.js';

/**
 * Auto-compile the day's QA activity into the daily diary as `source: 'qa'`
 * DiaryEvent rows, so the diary fills itself during the day and the foreman
 * reviews at knock-off instead of re-typing.
 *
 * Trigger: this runs on diary READ (see diaryCore / diaryReporting), not on each
 * QA write. The docket->diary sync pushes an immutable snapshot on the one-time
 * docket approval; QA rollups (ITP pass/fail counts) instead need continuous
 * recomputation as items complete through the day, so recompute-on-read is the
 * correct analog — idempotent by construction, no per-write-site plumbing.
 *
 * Idempotent + reconciling: every run recomputes the desired set keyed by a
 * stable `sourceRef`, upserts each, and deletes stale `source: 'qa'` rows whose
 * source record vanished (NCR voided, item un-failed). Rows with
 * `source: 'manual'` are never touched (H11).
 *
 * Legal-record safety: only draft, unlocked diaries are synced. A submitted or
 * locked diary is a legal record — skip silently, never mutate or error. The
 * entry guard checks a snapshot the read handler fetched; because a concurrent
 * submit can land between that snapshot and these writes, the write block re-
 * reads the live diary row `SELECT ... FOR UPDATE` inside a transaction (same
 * idiom as diarySubmission's reopen) and aborts if it is now submitted/locked.
 * That serialises against the submit path's own row-updating transaction, so a
 * submit committed before the writes makes this sync a no-op.
 */

const MAX_DESCRIPTION_SNIPPET = 80;

type SyncableDiary = {
  id: string;
  projectId: string;
  date: Date;
  status: string;
  lockedAt: Date | null;
};

type DesiredEvent = {
  sourceRef: string;
  eventType: string;
  description: string;
  notes: string | null;
  lotId: string | null;
  createdAt: Date;
};

function snippet(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_DESCRIPTION_SNIPPET
    ? `${trimmed.slice(0, MAX_DESCRIPTION_SNIPPET - 1)}…`
    : trimmed;
}

// 1. ITP checklist activity -> ONE rollup event per lot: "N passed, M failed".
async function itpRollupEvents(projectId: string, start: Date, end: Date): Promise<DesiredEvent[]> {
  const completions = await prisma.iTPCompletion.findMany({
    where: {
      completedAt: { gte: start, lte: end },
      status: { in: ['completed', 'failed'] },
      itpInstance: { lot: { projectId } },
    },
    select: {
      status: true,
      completedAt: true,
      itpInstance: { select: { lotId: true, template: { select: { name: true } } } },
    },
  });

  const byLot = new Map<
    string,
    { passed: number; failed: number; templateName: string; latest: Date }
  >();
  for (const c of completions) {
    const lotId = c.itpInstance.lotId;
    const entry = byLot.get(lotId) ?? {
      passed: 0,
      failed: 0,
      templateName: c.itpInstance.template.name,
      latest: c.completedAt ?? start,
    };
    if (c.status === 'failed') entry.failed += 1;
    else entry.passed += 1;
    if (c.completedAt && c.completedAt > entry.latest) entry.latest = c.completedAt;
    byLot.set(lotId, entry);
  }

  return [...byLot].map(([lotId, r]) => ({
    sourceRef: `itp:${lotId}`,
    eventType: 'itp_progress',
    description: `ITP: ${r.passed} passed${r.failed > 0 ? `, ${r.failed} failed` : ''} — ${r.templateName}`,
    notes: null,
    lotId,
    createdAt: r.latest,
  }));
}

// 2. Hold points released today (legally significant) -> one event each.
async function holdPointEvents(projectId: string, start: Date, end: Date): Promise<DesiredEvent[]> {
  const releases = await prisma.holdPoint.findMany({
    where: { status: 'released', releasedAt: { gte: start, lte: end }, lot: { projectId } },
    select: {
      id: true,
      lotId: true,
      description: true,
      releasedAt: true,
      releasedByName: true,
      itpChecklistItem: { select: { description: true } },
    },
  });
  return releases.map((hp) => ({
    sourceRef: `hp:${hp.id}`,
    eventType: 'hold_point_released',
    description: `Hold point released — ${snippet(hp.description?.trim() || hp.itpChecklistItem.description)}`,
    notes: hp.releasedByName ? `Released by ${hp.releasedByName}` : null,
    lotId: hp.lotId,
    createdAt: hp.releasedAt ?? start,
  }));
}

// 3. NCRs raised today -> one event each.
async function ncrRaisedEvents(projectId: string, start: Date, end: Date): Promise<DesiredEvent[]> {
  const raised = await prisma.nCR.findMany({
    where: { projectId, raisedAt: { gte: start, lte: end } },
    select: {
      id: true,
      ncrNumber: true,
      description: true,
      severity: true,
      raisedAt: true,
      ncrLots: { select: { lotId: true }, take: 1 },
    },
  });
  return raised.map((ncr) => ({
    sourceRef: `ncr_raised:${ncr.id}`,
    eventType: 'ncr_raised',
    description: `NCR ${ncr.ncrNumber} raised${ncr.severity === 'major' ? ' (major)' : ''}`,
    notes: ncr.description ? snippet(ncr.description) : null,
    lotId: ncr.ncrLots[0]?.lotId ?? null,
    createdAt: ncr.raisedAt,
  }));
}

// 4. NCRs closed today -> one event each.
async function ncrClosedEvents(projectId: string, start: Date, end: Date): Promise<DesiredEvent[]> {
  const closed = await prisma.nCR.findMany({
    where: { projectId, closedAt: { gte: start, lte: end } },
    select: {
      id: true,
      ncrNumber: true,
      closedAt: true,
      ncrLots: { select: { lotId: true }, take: 1 },
    },
  });
  return closed.map((ncr) => ({
    sourceRef: `ncr_closed:${ncr.id}`,
    eventType: 'ncr_closed',
    description: `NCR ${ncr.ncrNumber} closed`,
    notes: null,
    lotId: ncr.ncrLots[0]?.lotId ?? null,
    createdAt: ncr.closedAt ?? start,
  }));
}

async function computeDesiredEvents(
  projectId: string,
  start: Date,
  end: Date,
): Promise<DesiredEvent[]> {
  const groups = await Promise.all([
    itpRollupEvents(projectId, start, end),
    holdPointEvents(projectId, start, end),
    ncrRaisedEvents(projectId, start, end),
    ncrClosedEvents(projectId, start, end),
  ]);
  return groups.flat();
}

/**
 * Recompute and reconcile the QA-sourced events for a diary. Best-effort: any
 * unexpected failure is logged and swallowed so it never breaks the diary read.
 */
export async function syncDiaryQaEvents(diary: SyncableDiary): Promise<void> {
  // Only draft, unlocked diaries. Submitted/locked = legal record, never mutate.
  if (diary.status === 'submitted' || diary.lockedAt) return;

  try {
    const timeZone = await prisma.project
      .findUnique({ where: { id: diary.projectId }, select: { state: true } })
      .then((p) => projectTimeZoneFromState(p?.state));

    const y = diary.date.getUTCFullYear();
    const m = diary.date.getUTCMonth() + 1;
    const d = diary.date.getUTCDate();
    const start = zonedStartOfDayToUtc(y, m, d, timeZone);
    const end = zonedEndOfDayToUtc(y, m, d, timeZone);

    const desired = await computeDesiredEvents(diary.projectId, start, end);
    const desiredRefs = desired.map((e) => e.sourceRef);

    // Re-check the LIVE diary row before writing: the entry guard above only saw
    // the read handler's snapshot, so a concurrent submit could have locked this
    // record since. `SELECT ... FOR UPDATE` (mirrors diarySubmission's reopen)
    // serialises against the submit path's row-updating transaction — either we
    // hold the lock and write while it is still draft, or the submit committed
    // first and we abort. The child-table writes stay inside the same tx so the
    // lock is held across them.
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string; lockedAt: Date | null }>>`
        SELECT status, locked_at AS "lockedAt"
        FROM daily_diaries
        WHERE id = ${diary.id}
        FOR UPDATE
      `;
      const live = rows[0];
      // Vanished, submitted, or locked concurrently -> legal record, no-op.
      if (!live || live.status === 'submitted' || live.lockedAt) return;

      // Drop QA rows whose source record no longer qualifies (voided / un-failed).
      // Never touches source='manual'.
      await tx.diaryEvent.deleteMany({
        where: {
          diaryId: diary.id,
          source: 'qa',
          sourceRef: desiredRefs.length > 0 ? { notIn: desiredRefs } : undefined,
        },
      });

      // Upsert each desired row by its stable (diaryId, sourceRef) identity.
      // ponytail: an upsert may still P2002 under a concurrent read of the same
      // draft diary; it self-heals on the next read (errors are swallowed below).
      for (const e of desired) {
        await tx.diaryEvent.upsert({
          where: { diaryId_sourceRef: { diaryId: diary.id, sourceRef: e.sourceRef } },
          create: {
            diaryId: diary.id,
            eventType: e.eventType,
            description: e.description,
            notes: e.notes,
            lotId: e.lotId,
            source: 'qa',
            sourceRef: e.sourceRef,
            createdAt: e.createdAt,
          },
          update: {
            // Refresh mutable fields (rollup counts, labels); identity is fixed.
            eventType: e.eventType,
            description: e.description,
            notes: e.notes,
            lotId: e.lotId,
          },
        });
      }
    });
  } catch (error) {
    logError('Failed to sync QA events into diary', { diaryId: diary.id, error });
  }
}
