import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import {
  QUARANTINE_REASON,
  claimNextVersion,
  completeVersion,
  failVersion,
} from './conversionLease.js';

const tag = `conversion-lease-${Date.now()}`;
let companyId: string;
let projectId: string;
let modelId: string;
let versionNumber = 0;

async function createVersion(
  data: Partial<{
    status: string;
    leaseOwner: string | null;
    leaseToken: string | null;
    leaseExpiresAt: Date | null;
    nextAttemptAt: Date | null;
    failureCount: number;
  }> = {},
) {
  versionNumber += 1;
  return prisma.designModelVersion.create({
    data: {
      modelId,
      versionNumber,
      status: data.status ?? 'queued',
      fileName: `fixture-${versionNumber}.ifc`,
      sourceSizeBytes: 10n,
      sourceSha256: versionNumber.toString(16).padStart(64, '0'),
      sourceStorageRef: `design-models/${projectId}/${modelId}/v${versionNumber}/source.ifc`,
      nextAttemptAt: data.nextAttemptAt === undefined ? new Date(0) : data.nextAttemptAt,
      leaseOwner: data.leaseOwner,
      leaseToken: data.leaseToken,
      leaseExpiresAt: data.leaseExpiresAt,
      failureCount: data.failureCount ?? 0,
    },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;
  const project = await prisma.project.create({
    data: {
      companyId,
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;
  const model = await prisma.designModel.create({ data: { projectId, name: 'Lease model' } });
  modelId = model.id;
});

afterEach(async () => {
  await prisma.designModelVersion.deleteMany({ where: { modelId } });
});

afterAll(async () => {
  await prisma.designModelVersion.deleteMany({ where: { modelId } });
  await prisma.designModel.delete({ where: { id: modelId } }).catch(() => undefined);
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
});

describe('model conversion lease', () => {
  it('skips a converting version with a fresh lease', async () => {
    await createVersion({
      status: 'converting',
      leaseOwner: 'live-worker',
      leaseToken: 'live-token',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimNextVersion({ leaseOwner: 'other-worker' })).toBeNull();
  });

  it('reclaims an expired converting lease with a new fencing token', async () => {
    const version = await createVersion({
      status: 'converting',
      leaseOwner: 'dead-worker',
      leaseToken: 'stale-token',
      leaseExpiresAt: new Date(Date.now() - 1),
    });
    const claim = await claimNextVersion({ leaseOwner: 'new-worker' });
    expect(claim?.kind).toBe('claimed');
    if (!claim || claim.kind !== 'claimed') throw new Error('Expected a claim');
    expect(claim.versionId).toBe(version.id);
    expect(claim.leaseToken).not.toBe('stale-token');
  });

  it('fences stale complete and fail writes', async () => {
    const version = await createVersion();
    const first = await claimNextVersion({ leaseOwner: 'worker-one' });
    if (!first || first.kind !== 'claimed') throw new Error('Expected first claim');
    await prisma.designModelVersion.update({
      where: { id: version.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1) },
    });
    const second = await claimNextVersion({ leaseOwner: 'worker-two' });
    if (!second || second.kind !== 'claimed') throw new Error('Expected second claim');

    expect(
      await completeVersion({
        versionId: version.id,
        leaseToken: first.leaseToken,
        fragStorageRef: 'design-models/stale/model/version/model.frag',
        fragSizeBytes: 1n,
        converterVersion: 'stale',
        diagnostics: {},
      }),
    ).toBe(false);
    expect(
      await failVersion({
        versionId: version.id,
        leaseToken: first.leaseToken,
        reason: 'stale failure',
        diagnostics: { error: 'stale failure' },
      }),
    ).toBe(false);
    expect(
      (await prisma.designModelVersion.findUnique({ where: { id: version.id } }))?.leaseToken,
    ).toBe(second.leaseToken);
  });

  it('quarantines a version that has already crashed twice', async () => {
    const version = await createVersion({ failureCount: 2 });
    expect(await claimNextVersion({ leaseOwner: 'worker' })).toEqual({
      kind: 'quarantined',
      versionId: version.id,
    });
    const updated = await prisma.designModelVersion.findUnique({ where: { id: version.id } });
    expect(updated?.status).toBe('failed');
    expect(updated?.lastFailureReason).toBe(QUARANTINE_REASON);
    expect(updated?.leaseToken).toBeNull();
  });
});
