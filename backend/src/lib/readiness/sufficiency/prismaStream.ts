// Wave C1.1 — the Prisma binding for the frequency-stream read (spec §3.4.3).
//
// The ONLY new cross-lot query C1 adds. Kept in its own module so `regime.ts`
// stays pure and the fetcher can be swapped for a fake in unit tests.
//
// SECURITY (§10.1, §14 AT-18): `projectId` is in the `where` of every query
// `buildRegimeStreamQuery` produces, so a lot in project B can never enter
// project A's stream. This module never widens that filter.
//
// It is issued OUTSIDE any transaction [C1R-B7]: it is a predicate read over
// exactly the range concurrent conforms write, so inside the serializable
// decision transaction it would guarantee 40001/P2034 retries. In C1.1 the
// conform decision path resolves sufficiency with a `null` fetcher, so this runs
// on the readiness path only.

import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../prisma.js';
import type { RegimeStreamEntry, RegimeStreamFetcher, RegimeStreamQuery } from './regime.js';

/** The client surface the stream read needs — one delegate, mirroring the conformance client. */
export type RegimeStreamPrismaClient = Pick<PrismaClient, 'lot'>;

/**
 * `take: N` (N = the rule's consecutive-lot trigger, 3 today), index-covered by
 * `lots_project_activity_slug_conformed_idx` (§12). One query per stream, and
 * ZERO queries when no rule in the resolved set is regime-bearing — `resolve.ts`
 * never calls the fetcher in that case.
 */
export function prismaRegimeStreamFetcher(
  client: RegimeStreamPrismaClient = prisma,
): RegimeStreamFetcher {
  return async (query: RegimeStreamQuery): Promise<readonly RegimeStreamEntry[]> =>
    client.lot.findMany({
      where: query.where,
      orderBy: [...query.orderBy],
      take: query.take,
      ...(query.cursor ? { cursor: query.cursor, skip: query.skip } : {}),
      select: {
        id: true,
        activitySlug: true,
        conformedAt: true,
        conformanceOverriddenAt: true,
        testResults: {
          select: {
            testType: true,
            passFail: true,
            status: true,
            // Nested, so rule attribution needs no second query.
            itpChecklistItem: { select: { testType: true } },
          },
        },
      },
    });
}
