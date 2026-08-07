import crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';

export const ORTHO_LEASE_TTL_MS = 60_000;
export const ORTHO_HEARTBEAT_INTERVAL_MS = ORTHO_LEASE_TTL_MS / 3;
export const ORTHO_QUARANTINE_FAILURE_COUNT = 2;
export const ORTHO_QUARANTINE_REASON = 'tiling aborted the worker twice — file quarantined';

type PrismaClientLike = typeof prisma;

export type ClaimNextOrthoResult =
  | { kind: 'claimed'; orthoId: string; leaseToken: string }
  | { kind: 'quarantined'; orthoId: string }
  | null;

export async function claimNextOrtho(params: {
  leaseOwner: string;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<ClaimNextOrthoResult> {
  const client = params.client ?? prisma;
  const now = params.now ?? new Date();
  const candidate = await client.orthoLayer.findFirst({
    where: {
      nextAttemptAt: { lte: now },
      OR: [{ status: 'queued' }, { status: 'tiling', leaseExpiresAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, leaseToken: true, failureCount: true },
  });
  if (!candidate) return null;

  if (candidate.failureCount >= ORTHO_QUARANTINE_FAILURE_COUNT) {
    const { count } = await client.orthoLayer.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        leaseToken: candidate.leaseToken,
        failureCount: { gte: ORTHO_QUARANTINE_FAILURE_COUNT },
      },
      data: {
        status: 'failed',
        lastFailureReason: ORTHO_QUARANTINE_REASON,
        diagnostics: { error: ORTHO_QUARANTINE_REASON },
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      },
    });
    return count === 1 ? { kind: 'quarantined', orthoId: candidate.id } : null;
  }

  const leaseToken = crypto.randomUUID();
  const { count } = await client.orthoLayer.updateMany({
    where: {
      id: candidate.id,
      failureCount: { lt: ORTHO_QUARANTINE_FAILURE_COUNT },
      nextAttemptAt: { lte: now },
      OR: [{ status: 'queued' }, { status: 'tiling', leaseExpiresAt: { lte: now } }],
    },
    data: {
      status: 'tiling',
      failureCount: { increment: 1 },
      leaseOwner: params.leaseOwner,
      leaseToken,
      leaseExpiresAt: new Date(now.getTime() + (params.ttlMs ?? ORTHO_LEASE_TTL_MS)),
      heartbeatAt: now,
    },
  });
  return count === 1 ? { kind: 'claimed', orthoId: candidate.id, leaseToken } : null;
}

async function fencedUpdate(
  client: PrismaClientLike,
  orthoId: string,
  leaseToken: string,
  data: Prisma.OrthoLayerUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await client.orthoLayer.updateMany({
    where: { id: orthoId, leaseToken },
    data,
  });
  return count === 1;
}

const RELEASE_LEASE = { leaseOwner: null, leaseToken: null, leaseExpiresAt: null } as const;

export function heartbeatOrtho(params: {
  orthoId: string;
  leaseToken: string;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  return fencedUpdate(params.client ?? prisma, params.orthoId, params.leaseToken, {
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + (params.ttlMs ?? ORTHO_LEASE_TTL_MS)),
  });
}

export function completeOrtho(params: {
  orthoId: string;
  leaseToken: string;
  tileStorageRoot: string;
  boundsWgs84: Prisma.InputJsonValue;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  diagnostics: Prisma.InputJsonValue;
  tiledAt?: Date;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.orthoId, params.leaseToken, {
    status: 'ready',
    tileStorageRoot: params.tileStorageRoot,
    boundsWgs84: params.boundsWgs84,
    minZoom: params.minZoom,
    maxZoom: params.maxZoom,
    tileCount: params.tileCount,
    diagnostics: params.diagnostics,
    tiledAt: params.tiledAt ?? new Date(),
    nextAttemptAt: null,
    lastFailureReason: null,
    ...RELEASE_LEASE,
  });
}

export function failOrtho(params: {
  orthoId: string;
  leaseToken: string;
  reason: string;
  diagnostics: Prisma.InputJsonValue;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.orthoId, params.leaseToken, {
    status: 'failed',
    lastFailureReason: params.reason,
    diagnostics: params.diagnostics,
    nextAttemptAt: null,
    ...RELEASE_LEASE,
  });
}
