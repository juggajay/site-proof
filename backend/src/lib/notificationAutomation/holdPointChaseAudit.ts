/**
 * Wave E2 — the system-actor audit row for an automated chase (spec §4.2.7,
 * `[ER-A5]`, AT-117).
 *
 * Every automated send writes one — including the ones that did NOT send. A
 * reminder deliberately withheld is an operational fact, and nothing recorded
 * it before.
 *
 * `userId` is omitted: the actor is the automation worker. No change to the
 * audit helper is needed — `AuditLogParams.userId` is already optional, the
 * column is nullable with `onDelete: SetNull`, and non-user rows already ship
 * via the `external_token` actor path. This is the first production caller of
 * the system-actor shape.
 *
 * The recipient rides under `tokenRecipient` ON PURPOSE. That key matches the
 * `/token/i` pattern in `sanitizeAuditChanges`, so the address is stored
 * `[REDACTED]`. Renaming it to anything without "token" in it would silently
 * start persisting external recipients' email addresses into a store that has
 * no deletion path at all (E.0 item 9b/9c). AT-109 asserts this on the row read
 * back from the database, not on the argument passed in.
 */

import { AuditAction, createAuditLog } from '../auditLog.js';

export async function auditAutomatedSend(params: {
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
