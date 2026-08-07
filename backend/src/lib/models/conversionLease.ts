import crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';

export const LEASE_TTL_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = LEASE_TTL_MS / 3;
export const QUARANTINE_FAILURE_COUNT = 2;
export const QUARANTINE_REASON = 'conversion aborted the worker twice — file quarantined';

type PrismaClientLike = typeof prisma;

export interface VersionLease {
  readonly kind: 'claimed';
  readonly versionId: string;
  readonly leaseOwner: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: Date;
}

export interface QuarantinedVersion {
  readonly kind: 'quarantined';
  readonly versionId: string;
}

export type ClaimNextVersionResult = VersionLease | QuarantinedVersion | null;

export async function claimNextVersion(params: {
  leaseOwner: string;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<ClaimNextVersionResult> {
  const client = params.client ?? prisma;
  const now = params.now ?? new Date();
  const candidate = await client.designModelVersion.findFirst({
    where: {
      nextAttemptAt: { lte: now },
      OR: [{ status: 'queued' }, { status: 'converting', leaseExpiresAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, leaseToken: true, failureCount: true },
  });
  if (!candidate) return null;

  if (candidate.failureCount >= QUARANTINE_FAILURE_COUNT) {
    const { count } = await client.designModelVersion.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        leaseToken: candidate.leaseToken,
        failureCount: { gte: QUARANTINE_FAILURE_COUNT },
      },
      data: {
        status: 'failed',
        lastFailureReason: QUARANTINE_REASON,
        diagnostics: { error: QUARANTINE_REASON },
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      },
    });
    return count === 1 ? { kind: 'quarantined', versionId: candidate.id } : null;
  }

  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + (params.ttlMs ?? LEASE_TTL_MS));
  const { count } = await client.designModelVersion.updateMany({
    where: {
      id: candidate.id,
      failureCount: { lt: QUARANTINE_FAILURE_COUNT },
      nextAttemptAt: { lte: now },
      OR: [{ status: 'queued' }, { status: 'converting', leaseExpiresAt: { lte: now } }],
    },
    data: {
      status: 'converting',
      failureCount: { increment: 1 },
      leaseOwner: params.leaseOwner,
      leaseToken,
      leaseExpiresAt,
      heartbeatAt: now,
    },
  });

  return count === 1
    ? {
        kind: 'claimed',
        versionId: candidate.id,
        leaseOwner: params.leaseOwner,
        leaseToken,
        leaseExpiresAt,
      }
    : null;
}

async function fencedUpdate(
  client: PrismaClientLike,
  versionId: string,
  leaseToken: string,
  data: Prisma.DesignModelVersionUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await client.designModelVersion.updateMany({
    where: { id: versionId, leaseToken },
    data,
  });
  return count === 1;
}

const RELEASE_LEASE = {
  leaseOwner: null,
  leaseToken: null,
  leaseExpiresAt: null,
} as const;

export function heartbeatVersion(params: {
  versionId: string;
  leaseToken: string;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  return fencedUpdate(params.client ?? prisma, params.versionId, params.leaseToken, {
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + (params.ttlMs ?? LEASE_TTL_MS)),
  });
}

export function completeVersion(params: {
  versionId: string;
  leaseToken: string;
  fragStorageRef: string;
  fragSizeBytes: bigint;
  converterVersion: string;
  diagnostics: Prisma.InputJsonValue;
  convertedAt?: Date;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.versionId, params.leaseToken, {
    status: 'ready',
    fragStorageRef: params.fragStorageRef,
    fragSizeBytes: params.fragSizeBytes,
    converterVersion: params.converterVersion,
    diagnostics: params.diagnostics,
    convertedAt: params.convertedAt ?? new Date(),
    nextAttemptAt: null,
    lastFailureReason: null,
    ...RELEASE_LEASE,
  });
}

export function failVersion(params: {
  versionId: string;
  leaseToken: string;
  reason: string;
  diagnostics: Prisma.InputJsonValue;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.versionId, params.leaseToken, {
    status: 'failed',
    lastFailureReason: params.reason,
    diagnostics: params.diagnostics,
    nextAttemptAt: null,
    ...RELEASE_LEASE,
  });
}
