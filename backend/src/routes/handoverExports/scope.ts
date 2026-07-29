// Wave D `D1c.1` — scope → lots, and the cheap member-count upper bound
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.4, §4.7.6,
// §10.1). **AT-132**.
//
// Split out of `snapshot.ts` for size: the freeze is enumeration and one
// transaction, and "which lots did the requester actually ask for" is a
// separate question with a separate failure mode.

import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { overlapsArea, resolveAreaWindow } from '../projectCloseoutReadiness.js';
import type { HandoverExportScope } from './validation.js';

type PrismaClientLike = typeof prisma;

export interface ScopeLot {
  readonly id: string;
  readonly lotNumber: string;
  readonly chainageStart: number | null;
  readonly chainageEnd: number | null;
}

/**
 * §7.4's `{kind:'project'|'area'|'lots'}`.
 *
 * The area arm REUSES `resolveAreaWindow` and `overlapsArea` from the closeout
 * readiness route rather than re-deriving chainage overlap. Two definitions of
 * "which lots are in this area" that disagree would show up as an archive that
 * omits a lot the readiness panel says is in scope — a silent omission, which
 * `[DH-B1]` forbids outright.
 *
 * Ordering is `lotNumber` ascending, the comparator the reports already use,
 * and the RETURNED ORDER is what `orderKey` freezes (§4.7.3).
 */
export async function resolveScopeLots(
  projectId: string,
  scope: HandoverExportScope,
  client: PrismaClientLike = prisma,
): Promise<ScopeLot[]> {
  const where: Prisma.LotWhereInput = { projectId };
  if (scope.kind === 'lots') {
    where.id = { in: scope.lotIds };
  }

  const lots = await client.lot.findMany({
    where,
    select: { id: true, lotNumber: true, chainageStart: true, chainageEnd: true },
    orderBy: { lotNumber: 'asc' },
  });

  const areaWindow =
    scope.kind === 'area' ? await resolveAreaWindow(projectId, scope.areaId, client) : null;

  const selected = areaWindow ? lots.filter((lot) => overlapsArea(lot, areaWindow)) : lots;

  if (scope.kind === 'lots' && selected.length !== scope.lotIds.length) {
    // A lot id from another project, or a deleted one. Refusing beats quietly
    // exporting a smaller set than the requester asked for (§10.1, **AT-132**).
    throw AppError.notFound('Lot');
  }

  return selected.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber,
    chainageStart: lot.chainageStart === null ? null : Number(lot.chainageStart),
    chainageEnd: lot.chainageEnd === null ? null : Number(lot.chainageEnd),
  }));
}

/**
 * A cheap UPPER BOUND on the member count, for the guard that runs before
 * anything is read into memory.
 *
 * An over-count, deliberately: `folioIssue` counts every version and only the
 * latest is frozen, and a document attached to both an ITP and an NCR is
 * counted twice but frozen once. Its only job is to stop a scope orders of
 * magnitude over the limit before it is materialised; the EXACT count comes
 * from the enumeration and is what the admission check actually uses.
 */
export async function countScopeMembers(
  lotIds: readonly string[],
  client: PrismaClientLike = prisma,
): Promise<number> {
  if (lotIds.length === 0) return 0;
  const ids = [...lotIds];

  const counts = await Promise.all([
    client.folioIssue.count({ where: { lotId: { in: ids } } }),
    client.document.count({ where: { lotId: { in: ids }, isLatestVersion: true } }),
    client.iTPCompletionAttachment.count({
      where: { completion: { itpInstance: { lotId: { in: ids } } } },
    }),
    client.nCREvidence.count({ where: { ncr: { ncrLots: { some: { lotId: { in: ids } } } } } }),
    client.holdPoint.count({ where: { lotId: { in: ids }, releaseSignatureUrl: { not: null } } }),
    client.holdPoint.count({ where: { lotId: { in: ids }, evidencePackageUrl: { not: null } } }),
  ]);

  return counts.reduce((total, count) => total + count, 0);
}
