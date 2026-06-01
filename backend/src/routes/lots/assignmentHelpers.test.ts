import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

import { syncPrimaryLotSubcontractorAssignment } from './assignmentHelpers.js';

// DB-free characterization of syncPrimaryLotSubcontractorAssignment. The helper
// operates entirely on the injected transaction client, so a minimal mock `tx`
// exercises its full branching without a database. The other two helpers in
// this module (requireSubcontractorInProject, requireItpTemplateForProject)
// query the real Prisma client and are covered by the DB-backed lots route
// tests in CI.

function makeTx() {
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const upsert = vi.fn().mockResolvedValue({});
  const tx = {
    lotSubcontractorAssignment: { updateMany, upsert },
  } as unknown as Prisma.TransactionClient;
  return { tx, updateMany, upsert };
}

describe('syncPrimaryLotSubcontractorAssignment', () => {
  it('demotes other active assignments and upserts the target when a subcontractor is provided', async () => {
    const { tx, updateMany, upsert } = makeTx();

    await syncPrimaryLotSubcontractorAssignment(tx, {
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorId: 'sub-1',
      assignedById: 'user-1',
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        lotId: 'lot-1',
        status: 'active',
        subcontractorCompanyId: { not: 'sub-1' },
      },
      data: { status: 'removed' },
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertArg = upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({
      lotId_subcontractorCompanyId: {
        lotId: 'lot-1',
        subcontractorCompanyId: 'sub-1',
      },
    });
    expect(upsertArg.update.projectId).toBe('project-1');
    expect(upsertArg.update.status).toBe('active');
    expect(upsertArg.update.assignedById).toBe('user-1');
    expect(upsertArg.update.assignedAt).toBeInstanceOf(Date);
    expect(upsertArg.create).toEqual({
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorCompanyId: 'sub-1',
      canCompleteITP: false,
      itpRequiresVerification: true,
      assignedById: 'user-1',
      status: 'active',
    });
  });

  it('clears all active assignments and skips the upsert when subcontractorId is null', async () => {
    const { tx, updateMany, upsert } = makeTx();

    await syncPrimaryLotSubcontractorAssignment(tx, {
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorId: null,
      assignedById: 'user-1',
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        lotId: 'lot-1',
        status: 'active',
      },
      data: { status: 'removed' },
    });
    // No subcontractorCompanyId guard when clearing every active assignment.
    expect(updateMany.mock.calls[0][0].where).not.toHaveProperty('subcontractorCompanyId');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('also skips the upsert when subcontractorId is undefined', async () => {
    const { tx, updateMany, upsert } = makeTx();

    await syncPrimaryLotSubcontractorAssignment(tx, {
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorId: undefined,
      assignedById: 'user-1',
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('omits the ITP flags from update and falls back to defaults in create when they are undefined', async () => {
    const { tx, upsert } = makeTx();

    await syncPrimaryLotSubcontractorAssignment(tx, {
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorId: 'sub-1',
      assignedById: 'user-1',
    });

    const upsertArg = upsert.mock.calls[0][0];
    expect(upsertArg.update).not.toHaveProperty('canCompleteITP');
    expect(upsertArg.update).not.toHaveProperty('itpRequiresVerification');
    expect(upsertArg.create.canCompleteITP).toBe(false);
    expect(upsertArg.create.itpRequiresVerification).toBe(true);
  });

  it('passes the ITP flags through to both update and create when provided', async () => {
    const { tx, upsert } = makeTx();

    await syncPrimaryLotSubcontractorAssignment(tx, {
      lotId: 'lot-1',
      projectId: 'project-1',
      subcontractorId: 'sub-1',
      assignedById: 'user-1',
      canCompleteITP: true,
      itpRequiresVerification: false,
    });

    const upsertArg = upsert.mock.calls[0][0];
    expect(upsertArg.update.canCompleteITP).toBe(true);
    expect(upsertArg.update.itpRequiresVerification).toBe(false);
    expect(upsertArg.create.canCompleteITP).toBe(true);
    expect(upsertArg.create.itpRequiresVerification).toBe(false);
  });
});
