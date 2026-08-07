import { Prisma, type PrismaClient } from '@prisma/client';

import {
  lotStatusEventsFromAudit,
  type LotStatusEvent as TimelineEvent,
} from '../routes/lots/statusTimeline.js';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_SAMPLE_SIZE = 10;

const auditRowSelect = {
  id: true,
  entityId: true,
  action: true,
  changes: true,
  createdAt: true,
  userId: true,
} satisfies Prisma.AuditLogSelect;

type BackfillAuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditRowSelect }>;

type DerivedEvent = {
  lotId: string;
  row: BackfillAuditRow;
  event: TimelineEvent;
};

export type LotStatusEventBackfillPlan = {
  auditRowsScanned: number;
  eventsDerivable: number;
  alreadyPresent: number;
  missingLotSkips: number;
  toCreate: number;
  sampleLotIds: string[];
};

export type LotStatusEventBackfillResult = {
  plan: LotStatusEventBackfillPlan;
  created: number;
  skippedDuringApply: number;
};

export type RunLotStatusEventBackfillOptions = {
  write?: boolean;
  batchSize?: number;
  sampleSize?: number;
  /** Restrict the scan to these projects (also keeps tests deterministic on a shared DB). */
  projectIds?: string[];
};

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  const integerSize = Math.max(1, Math.floor(size));
  for (let index = 0; index < values.length; index += integerSize) {
    chunks.push(values.slice(index, index + integerSize));
  }
  return chunks;
}

function pairKey(lotId: string, auditRowId: string): string {
  return `${lotId}\u0000${auditRowId}`;
}

function deriveEvents(rows: BackfillAuditRow[]): DerivedEvent[] {
  return rows.flatMap((row) =>
    Array.from(lotStatusEventsFromAudit([row]).entries()).flatMap(([lotId, events]) =>
      events.map((event) => ({ lotId, row, event })),
    ),
  );
}

async function loadAuditRows(
  prisma: PrismaClient,
  projectIds?: string[],
): Promise<BackfillAuditRow[]> {
  return prisma.auditLog.findMany({
    where: {
      ...(projectIds ? { projectId: { in: projectIds } } : {}),
      OR: [
        {
          entityType: 'lot',
          action: { in: ['lot_updated', 'lot_status_changed', 'lot_force_conformed'] },
        },
        { action: 'claim_created' },
      ],
    },
    select: auditRowSelect,
    orderBy: { createdAt: 'asc' },
  });
}

async function buildPlan(
  prisma: PrismaClient,
  auditRows: BackfillAuditRow[],
  batchSize: number,
  sampleSize: number,
): Promise<LotStatusEventBackfillPlan> {
  let eventsDerivable = 0;
  let alreadyPresent = 0;
  let missingLotSkips = 0;
  const toCreateLotIds: string[] = [];

  for (const batchRows of chunk(auditRows, batchSize)) {
    const derived = deriveEvents(batchRows);
    eventsDerivable += derived.length;
    if (derived.length === 0) continue;

    const lotIds = [...new Set(derived.map((candidate) => candidate.lotId))];
    const liveLots = await prisma.lot.findMany({
      where: { id: { in: lotIds } },
      select: { id: true },
    });
    const liveLotIds = new Set(liveLots.map((lot) => lot.id));
    const batchRowIds = batchRows.map((row) => row.id);
    const present = await prisma.lotStatusEvent.findMany({
      where: {
        source: 'backfill',
        sourceEntityType: 'audit_log',
        sourceEntityId: { in: batchRowIds },
      },
      select: { lotId: true, sourceEntityId: true },
    });
    const presentPairs = new Set(
      present.flatMap((event) =>
        event.sourceEntityId ? [pairKey(event.lotId, event.sourceEntityId)] : [],
      ),
    );

    for (const candidate of derived) {
      if (!liveLotIds.has(candidate.lotId)) {
        missingLotSkips += 1;
      } else if (presentPairs.has(pairKey(candidate.lotId, candidate.row.id))) {
        alreadyPresent += 1;
      } else {
        toCreateLotIds.push(candidate.lotId);
      }
    }
  }

  return {
    auditRowsScanned: auditRows.length,
    eventsDerivable,
    alreadyPresent,
    missingLotSkips,
    toCreate: toCreateLotIds.length,
    sampleLotIds: [...new Set(toCreateLotIds)].slice(0, sampleSize),
  };
}

export async function runLotStatusEventBackfill(
  prisma: PrismaClient,
  options: RunLotStatusEventBackfillOptions = {},
): Promise<LotStatusEventBackfillResult> {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE));
  const sampleSize = Math.max(0, Math.floor(options.sampleSize ?? DEFAULT_SAMPLE_SIZE));
  const auditRows = await loadAuditRows(prisma, options.projectIds);
  const plan = await buildPlan(prisma, auditRows, batchSize, sampleSize);
  if (!options.write || plan.toCreate === 0) {
    return { plan, created: 0, skippedDuringApply: 0 };
  }

  let created = 0;
  for (const batchRows of chunk(auditRows, batchSize)) {
    const derived = deriveEvents(batchRows);
    const batchCreated = await prisma.$transaction(
      async (tx) => {
        if (derived.length === 0) return 0;

        const lotIds = [...new Set(derived.map((candidate) => candidate.lotId))];
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM lots WHERE id IN (${Prisma.join(lotIds)}) FOR UPDATE`,
        );

        const liveLots = await tx.lot.findMany({
          where: { id: { in: lotIds } },
          select: { id: true },
        });
        const liveLotIds = new Set(liveLots.map((lot) => lot.id));
        const batchRowIds = batchRows.map((row) => row.id);
        const present = await tx.lotStatusEvent.findMany({
          where: {
            source: 'backfill',
            sourceEntityType: 'audit_log',
            sourceEntityId: { in: batchRowIds },
          },
          select: { lotId: true, sourceEntityId: true },
        });
        const presentPairs = new Set(
          present.flatMap((event) =>
            event.sourceEntityId ? [pairKey(event.lotId, event.sourceEntityId)] : [],
          ),
        );
        const missing = derived.filter(
          (candidate) =>
            liveLotIds.has(candidate.lotId) &&
            !presentPairs.has(pairKey(candidate.lotId, candidate.row.id)),
        );
        if (missing.length === 0) return 0;

        const result = await tx.lotStatusEvent.createMany({
          data: missing.map(({ lotId, row, event }) => ({
            lotId,
            fromStatus: event.from,
            toStatus: event.to,
            effectiveAt: new Date(event.at),
            recordedAt: new Date(event.at),
            actorId: row.userId ?? null,
            source: 'backfill',
            sourceEntityType: 'audit_log',
            sourceEntityId: row.id,
            reconstructionConfidence: 'exact',
            metadata: { auditAction: row.action },
          })),
        });
        return result.count;
      },
      // Remote databases pay a network round-trip per batch; Prisma's default
      // 5s interactive transaction timeout aborts real Railway-sized batches.
      { timeout: 120_000, maxWait: 15_000 },
    );
    created += batchCreated;
  }

  return {
    plan,
    created,
    skippedDuringApply: plan.toCreate - created,
  };
}
