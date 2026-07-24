import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';

// DB-backed proof of the partial unique index
// notification_alerts_active_type_entity_key (migration
// 20260724070000_active_alert_unique_index): at most one ACTIVE alert per
// (type, entity_id); resolved alerts do not participate. Runs only against
// the local disposable test DB (src/test/databaseSafety.ts refuses anything
// else). The code-level P2002 handling lives in systemAutomation.test.ts and
// alertPersistence's conflict mapping.

const tag = `alert-uniq-${Date.now()}`;
let userId: string;
let companyId: string;

function alertData(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'overdue_ncr',
    severity: 'high',
    title: 'Test alert',
    message: 'Test alert message',
    entityId: `entity-${tag}`,
    entityType: 'ncr',
    assignedToId: userId,
    escalationLevel: 0,
    ...overrides,
  };
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Alert Uniq Tester',
      roleInCompany: 'admin',
      companyId,
      emailVerified: true,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.notificationAlert.deleteMany({ where: { assignedToId: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.company.delete({ where: { id: companyId } });
});

describe('notification_alerts active-alert partial unique index', () => {
  it('rejects a second active alert for the same (type, entityId) with P2002', async () => {
    await prisma.notificationAlert.create({ data: alertData(`${tag}-first`) });

    await expect(
      prisma.notificationAlert.create({ data: alertData(`${tag}-dup`) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows a new active alert once the previous one is resolved, and a different type in parallel', async () => {
    await prisma.notificationAlert.update({
      where: { id: `${tag}-first` },
      data: { resolvedAt: new Date() },
    });

    await expect(
      prisma.notificationAlert.create({ data: alertData(`${tag}-second`) }),
    ).resolves.toMatchObject({ id: `${tag}-second` });

    // Same entity, different alert type — not blocked.
    await expect(
      prisma.notificationAlert.create({
        data: alertData(`${tag}-other-type`, { type: 'stale_hold_point' }),
      }),
    ).resolves.toMatchObject({ id: `${tag}-other-type` });
  });
});
