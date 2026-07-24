// Privacy-conscious product/UX telemetry writer + registered event catalog.
//
// Deliberately SEPARATE from AuditLog (see the ProductEvent model doc comment):
// AuditLog is a compliance artifact and must stay pure. This uses the same
// best-effort writer *pattern* (createAuditLog) against its own table with its
// own short retention.
//
// Privacy is enforced here, not just documented:
//   - `event` names must be in PRODUCT_EVENT_CATALOG or they are rejected, so
//     the table can never fill with arbitrary strings.
//   - `metadata` is validated per-event against a whitelist Zod schema; unknown
//     keys are stripped and never stored. No free text, no IP, no user agent,
//     no page URLs — those are simply never accepted or written.
//   - userId / companyId are set by the caller from the authenticated session,
//     never from the client body.
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { logError } from './serverLogger.js';

// Whitelisted metadata for the lot-create funnel. Only these structured keys
// are ever persisted; unknown keys are stripped (Zod's default), so a client
// can never smuggle free text or PII into a stored event.
const lotCreateMetadata = z.object({
  activityType: z.string().trim().min(1).max(64).optional(),
  usedSuggestedTemplate: z.boolean().optional(),
});

/**
 * Registered event catalog: event name -> its metadata whitelist schema.
 * An event name absent from here is rejected at ingestion.
 */
export const PRODUCT_EVENT_CATALOG = {
  'lot_create.opened': lotCreateMetadata,
  'lot_create.submitted': lotCreateMetadata,
  'lot_create.succeeded': lotCreateMetadata,
  'lot_create.failed': lotCreateMetadata,
} as const;

export type ProductEventName = keyof typeof PRODUCT_EVENT_CATALOG;

export function isRegisteredProductEvent(name: string): name is ProductEventName {
  return Object.prototype.hasOwnProperty.call(PRODUCT_EVENT_CATALOG, name);
}

export interface ProductEventRow {
  userId?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  event: ProductEventName;
  step?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  clientTs?: Date | null;
}

type RawProductEventItem = {
  event: string;
  step?: string | null;
  metadata?: unknown;
  clientTs?: string | null;
};

/**
 * Validate one client-supplied event against the catalog + per-event metadata
 * whitelist. Returns a persistable row, or null if the event name is unknown or
 * its metadata fails the whitelist. Identity (userId/companyId/projectId) is
 * NOT taken from the client — the caller supplies it from the session.
 */
export function parseProductEventItem(
  item: RawProductEventItem,
  identity: { userId?: string | null; companyId?: string | null },
): ProductEventRow | null {
  if (!isRegisteredProductEvent(item.event)) {
    return null;
  }

  const metaResult = PRODUCT_EVENT_CATALOG[item.event].safeParse(item.metadata ?? {});
  if (!metaResult.success) {
    return null;
  }

  const clientTs = item.clientTs ? new Date(item.clientTs) : null;

  return {
    userId: identity.userId ?? null,
    companyId: identity.companyId ?? null,
    // projectId comes from whitelisted metadata only when a future event needs
    // it; the lot-create funnel is company-scoped, so it stays null here.
    projectId: null,
    event: item.event,
    step: item.step ?? null,
    metadata: metaResult.data as Prisma.InputJsonValue,
    clientTs: clientTs && !Number.isNaN(clientTs.getTime()) ? clientTs : null,
  };
}

/**
 * Write a batch of pre-validated product events (best-effort).
 *
 * Like createAuditLog, failures are logged and swallowed — telemetry must NEVER
 * break a user flow. Uses createMany so a batch is a single round-trip.
 */
export async function writeProductEvents(rows: ProductEventRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  try {
    await prisma.productEvent.createMany({
      data: rows.map((row) => ({
        userId: row.userId ?? null,
        projectId: row.projectId ?? null,
        companyId: row.companyId ?? null,
        event: row.event,
        step: row.step ?? null,
        metadata: row.metadata ?? undefined,
        clientTs: row.clientTs ?? null,
      })),
    });
  } catch (error) {
    logError('Failed to write product events:', error);
  }
}

/**
 * Convenience single-event writer for server-side instrumentation (best-effort).
 */
export async function writeProductEvent(row: ProductEventRow): Promise<void> {
  await writeProductEvents([row]);
}
