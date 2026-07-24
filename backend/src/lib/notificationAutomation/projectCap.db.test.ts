import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { processSystemAlerts } from '../notificationAutomation.js';
import { prisma } from '../prisma.js';

// Regression for the silent 100-project cap (external dev review 2026-07-24):
// findActiveProjects defaulted to take:100 oldest-first, so scheduled runs
// permanently skipped project 101+ and explicitly scoped admin checks were
// truncated the same way. This creates 101 active projects and proves a scoped
// run checks every one of them.
//
// The fixture company has no users, so every project resolves no alert owner
// and each check is counted as skipped without writing alerts or
// notifications — the test observes coverage, not side effects.

const tag = `projcap-${Date.now()}`;
let companyId: string;
let projectIds: string[] = [];

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  await prisma.project.createMany({
    data: Array.from({ length: 101 }, (_, index) => ({
      name: `Proj ${tag} ${index}`,
      projectNumber: `PN-${tag}-${index}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    })),
  });
  projectIds = (await prisma.project.findMany({ where: { companyId }, select: { id: true } })).map(
    (project) => project.id,
  );
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
});

describe('system-alert automation project coverage', () => {
  it('checks all 101 explicitly scoped projects — no silent 100 cap', async () => {
    expect(projectIds).toHaveLength(101);

    const result = await processSystemAlerts({ projectIds, now: new Date() });

    expect(result.projectsChecked).toBe(101);
    // No owner resolvable => every missing-diary candidate skipped, nothing written.
    expect(result.alertsCreated).toBe(0);
  });

  it('still honours an explicit limit for ops tuning', async () => {
    const result = await processSystemAlerts({ projectIds, limit: 5, now: new Date() });

    expect(result.projectsChecked).toBe(5);
  });
});
