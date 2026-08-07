import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './prisma.js';
import { transitionLotStatus, transitionLotStatusesWhere } from './lotStatusTransition.js';

const tag = `lot-status-transition-${Date.now()}`;

let companyId: string;
let projectId: string;
let userId: string;
let sequence = 0;

async function createLot(status = 'not_started') {
  sequence += 1;
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT-${sequence}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      status,
    },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: { email: `${tag}@example.com`, fullName: 'Ledger Tester', companyId },
  });
  userId = user.id;
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

beforeEach(async () => {
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.progressClaim.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.progressClaim.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('lot status transition ledger', () => {
  it('writes a single transition and its event atomically', async () => {
    const lot = await createLot();

    const updated = await prisma.$transaction((tx) =>
      transitionLotStatus(tx, {
        lotId: lot.id,
        to: 'in_progress',
        event: { actorId: userId, source: 'user' },
      }),
    );

    expect(updated.status).toBe('in_progress');
    expect(await prisma.lotStatusEvent.findMany({ where: { lotId: lot.id } })).toEqual([
      expect.objectContaining({
        lotId: lot.id,
        fromStatus: 'not_started',
        toStatus: 'in_progress',
        source: 'user',
        actorId: userId,
      }),
    ]);
  });

  it('rolls the lot and event back when the surrounding transaction fails', async () => {
    const lot = await createLot();

    await expect(
      prisma.$transaction(async (tx) => {
        await transitionLotStatus(tx, {
          lotId: lot.id,
          to: 'in_progress',
          event: { actorId: userId, source: 'user' },
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).toMatchObject({
      status: 'not_started',
    });
    expect(await prisma.lotStatusEvent.count({ where: { lotId: lot.id } })).toBe(0);
  });

  it('preserves P2025 on a guard miss and writes nothing', async () => {
    const lot = await createLot();

    await expect(
      prisma.$transaction((tx) =>
        transitionLotStatus(tx, {
          lotId: lot.id,
          to: 'completed',
          guard: { status: 'in_progress' },
          event: { actorId: userId, source: 'user' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect(await prisma.lotStatusEvent.count({ where: { lotId: lot.id } })).toBe(0);
  });

  it('performs a same-status update without appending an event', async () => {
    const lot = await createLot('in_progress');

    const updated = await prisma.$transaction((tx) =>
      transitionLotStatus(tx, {
        lotId: lot.id,
        to: 'in_progress',
        event: { actorId: userId, source: 'user' },
      }),
    );

    expect(updated.status).toBe('in_progress');
    expect(await prisma.lotStatusEvent.count({ where: { lotId: lot.id } })).toBe(0);
  });

  it('writes one event per matched lot with each original status', async () => {
    const first = await createLot('not_started');
    const second = await createLot('in_progress');
    const ignored = await createLot('conformed');

    const result = await prisma.$transaction((tx) =>
      transitionLotStatusesWhere(tx, {
        where: { id: { in: [first.id, second.id, ignored.id] }, status: { not: 'conformed' } },
        to: 'completed',
        event: { actorId: userId, source: 'system' },
      }),
    );

    expect(result.count).toBe(2);
    expect(result.lots).toEqual(
      expect.arrayContaining([
        { id: first.id, lotNumber: first.lotNumber, fromStatus: 'not_started' },
        { id: second.id, lotNumber: second.lotNumber, fromStatus: 'in_progress' },
      ]),
    );
    const events = await prisma.lotStatusEvent.findMany({
      where: { lotId: { in: [first.id, second.id, ignored.id] } },
      orderBy: { lotId: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lotId: first.id, fromStatus: 'not_started' }),
        expect.objectContaining({ lotId: second.id, fromStatus: 'in_progress' }),
      ]),
    );
  });

  it('skips an event for a matched multi-row no-op', async () => {
    const lot = await createLot('completed');

    const result = await prisma.$transaction((tx) =>
      transitionLotStatusesWhere(tx, {
        where: { id: lot.id },
        to: 'completed',
        event: { actorId: userId, source: 'system' },
      }),
    );

    expect(result.count).toBe(1);
    expect(await prisma.lotStatusEvent.count({ where: { lotId: lot.id } })).toBe(0);
  });

  it('writes extraData in the same transition update', async () => {
    const lot = await createLot('conformed');
    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: sequence + 100,
        claimPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
        claimPeriodEnd: new Date('2026-08-07T00:00:00.000Z'),
      },
    });

    const updated = await prisma.$transaction((tx) =>
      transitionLotStatus(tx, {
        lotId: lot.id,
        to: 'claimed',
        extraData: { claimedInId: claim.id },
        event: {
          actorId: userId,
          source: 'user',
          sourceEntityType: 'claim',
          sourceEntityId: claim.id,
        },
      }),
    );

    expect(updated).toMatchObject({ status: 'claimed', claimedInId: claim.id });
    expect(
      await prisma.lotStatusEvent.findFirstOrThrow({ where: { lotId: lot.id } }),
    ).toMatchObject({ sourceEntityType: 'claim', sourceEntityId: claim.id });
  });
});
