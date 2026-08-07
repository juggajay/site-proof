import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import { claimNextOrtho, ORTHO_QUARANTINE_REASON } from './orthoLease.js';

const tag = `ortho-lease-${Date.now()}`;
let companyId: string;
let projectId: string;

async function createOrtho(
  data: Partial<{ status: string; failureCount: number; leaseExpiresAt: Date }> = {},
) {
  return prisma.orthoLayer.create({
    data: {
      projectId,
      name: 'Lease fixture',
      fileName: 'fixture.tif',
      sourceSizeBytes: 10n,
      sourceSha256: 'a'.repeat(64),
      status: data.status ?? 'queued',
      failureCount: data.failureCount ?? 0,
      leaseExpiresAt: data.leaseExpiresAt,
      nextAttemptAt: new Date(0),
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
});

afterEach(async () => prisma.orthoLayer.deleteMany({ where: { projectId } }));
afterAll(async () => {
  await prisma.orthoLayer.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
});

describe('ortho tiling lease', () => {
  it('reclaims an expired tiling lease with a new fencing token', async () => {
    const ortho = await createOrtho({ status: 'tiling', leaseExpiresAt: new Date(Date.now() - 1) });
    await prisma.orthoLayer.update({
      where: { id: ortho.id },
      data: { leaseOwner: 'dead', leaseToken: 'stale' },
    });
    const claim = await claimNextOrtho({ leaseOwner: 'replacement' });
    expect(claim?.kind).toBe('claimed');
    if (!claim || claim.kind !== 'claimed') throw new Error('Expected claim');
    expect(claim.leaseToken).not.toBe('stale');
  });

  it('quarantines a file after two aborted worker claims', async () => {
    const ortho = await createOrtho({ failureCount: 2 });
    expect(await claimNextOrtho({ leaseOwner: 'worker' })).toEqual({
      kind: 'quarantined',
      orthoId: ortho.id,
    });
    const updated = await prisma.orthoLayer.findUnique({ where: { id: ortho.id } });
    expect(updated?.status).toBe('failed');
    expect(updated?.lastFailureReason).toBe(ORTHO_QUARANTINE_REASON);
  });
});
