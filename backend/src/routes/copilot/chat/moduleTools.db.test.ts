import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../../lib/prisma.js';
import type { AuthUser } from '../../dashboard/access.js';
import { createChatToolExecutor } from './tools.js';

// DB-backed happy paths for get_module_summary and get_lot_status. Runs only
// against the local disposable test DB (src/test/databaseSafety.ts refuses
// anything else). The pure validation/access branches live in tools.test.ts.

const tag = `clancy-${Date.now()}`;
let user: AuthUser;
let companyId: string;
let projectId: string;
let lotId: string;

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const admin = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Clancy Tester',
      roleInCompany: 'admin',
      companyId,
      emailVerified: true,
    },
  });
  user = admin as unknown as AuthUser;

  const project = await prisma.project.create({
    data: {
      name: `Proj ${tag}`,
      projectNumber: `PN-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: 'LOT-042',
      lotType: 'roadworks',
      status: 'in_progress',
      activityType: 'earthworks_general',
      chainageStart: 100,
      chainageEnd: 200,
    },
  });
  lotId = lot.id;

  const template = await prisma.iTPTemplate.create({
    data: {
      projectId,
      name: 'Earthworks ITP',
      checklistItems: {
        create: [
          { sequenceNumber: 1, description: 'Standard check', pointType: 'standard' },
          { sequenceNumber: 2, description: 'Hold point check', pointType: 'hold_point' },
        ],
      },
    },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });
  const standardItem = template.checklistItems[0];

  await prisma.iTPInstance.create({
    data: {
      lotId,
      templateId: template.id,
      status: 'in_progress',
      completions: {
        create: [
          { checklistItemId: standardItem.id, status: 'completed', verificationStatus: 'none' },
        ],
      },
    },
  });

  const ncr = await prisma.nCR.create({
    data: {
      projectId,
      ncrNumber: 'NCR-001',
      description: 'Compaction below spec on the eastern batter',
      category: 'workmanship',
      status: 'open',
    },
  });
  await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId } });
});

afterAll(async () => {
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('get_module_summary (DB-backed)', () => {
  it('summarises NCRs with status counts and the most recent item', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_module_summary', { projectId, module: 'ncrs' });
    const parsed = JSON.parse(outcome.result);
    expect(parsed.module).toBe('ncrs');
    expect(parsed.counts.open).toBe(1);
    expect(parsed.recent[0]).toMatchObject({ status: 'open' });
    expect(parsed.recent[0].label).toContain('NCR-001');
  });

  it('groups documents by document type (documents have no status column)', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_module_summary', { projectId, module: 'documents' });
    const parsed = JSON.parse(outcome.result);
    expect(parsed.module).toBe('documents');
    expect(parsed.recent).toEqual([]);
  });
});

describe('get_lot_status (DB-backed)', () => {
  it('reports the lot detail, checklist progress, hold points, and open NCRs', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_lot_status', { projectId, lotNumber: 'lot-042' });
    const parsed = JSON.parse(outcome.result);
    expect(parsed.lotNumber).toBe('LOT-042');
    expect(parsed.status).toBe('in_progress');
    expect(parsed.chainage).toBe('100–200');
    expect(parsed.itpTemplate).toBe('Earthworks ITP');
    expect(parsed.checklist).toEqual({ completed: 1, total: 2 });
    expect(parsed.holdPoints).toEqual({ open: 1, released: 0 });
    expect(parsed.openNcrs).toBe(1);
  });

  it('returns an instructive error naming a real lot number when not found', async () => {
    const execute = createChatToolExecutor(user);
    const outcome = await execute('get_lot_status', { projectId, lotNumber: 'LOT-999' });
    expect(outcome.result).toContain('No lot');
    expect(outcome.result).toContain('LOT-042');
  });
});
