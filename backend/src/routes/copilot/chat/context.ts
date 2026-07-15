// Builds the compact CURRENT STATE block injected ahead of the client
// transcript. Deterministic, read-only, and kept small (well under ~1500
// tokens): the model narrates this rather than round-tripping a tool for the
// basics. Reuses the dashboard's project-access helper so Clancy sees exactly
// the projects the dashboard would.

import { prisma } from '../../../lib/prisma.js';
import { getDashboardProjectAccess, type AuthUser } from '../../dashboard/access.js';
import { getProjectStageStatus } from './projectStatus.js';

function firstName(fullName: string | null): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

async function companySetupLine(user: AuthUser): Promise<string> {
  const access = await getDashboardProjectAccess(user);
  const projectIds = access.map((a) => a.projectId);
  if (projectIds.length === 0) {
    return 'Company setup: no projects yet — creating the first project is the next step.';
  }

  const [lots, controlLines, planSheets, lotsWithItp, teammates] = await Promise.all([
    prisma.lot.count({ where: { projectId: { in: projectIds } } }),
    prisma.controlLine.count({ where: { projectId: { in: projectIds } } }),
    prisma.planSheet.count({ where: { projectId: { in: projectIds } } }),
    prisma.iTPInstance.count({ where: { lot: { projectId: { in: projectIds } } } }),
    prisma.projectUser.findMany({
      where: { projectId: { in: projectIds }, userId: { not: user.id } },
      distinct: ['userId'],
      select: { userId: true },
    }),
  ]);

  return [
    `Company setup: ${projectIds.length} project(s)`,
    `${controlLines} control line(s)`,
    `${planSheets} plan sheet(s)`,
    `${lots} lot(s)`,
    `${lotsWithItp} lot ITP(s)`,
    `${teammates.length} other teammate(s) on projects.`,
  ].join(', ');
}

async function projectBlock(projectId: string): Promise<string> {
  const status = await getProjectStageStatus(projectId);
  if (!status) {
    return `Active project ${projectId}: not found.`;
  }
  const stageLine = Object.entries(status.stages)
    .map(([stage, value]) => `${stage}=${value}`)
    .join(', ');
  return [
    `Active project: ${status.name} (${status.projectNumber}), state ${status.state ?? 'unknown'}, spec ${status.specificationSet ?? 'unknown'}.`,
    `Lots: ${status.lotCount}. Pending proposals awaiting review: ${status.pendingProposals}.`,
    `Setup stages — ${stageLine}.`,
  ].join('\n');
}

/**
 * Compose the CURRENT STATE block for one chat turn. `projectId` is assumed
 * already access-checked by the route; a missing project degrades to a note
 * rather than throwing.
 */
export async function buildChatContext(user: AuthUser, projectId?: string): Promise<string> {
  const parts = [
    `User: ${firstName(user.fullName)} (role: ${user.roleInCompany || 'member'}).`,
    await companySetupLine(user),
  ];
  if (projectId) {
    parts.push(await projectBlock(projectId));
  }
  return parts.join('\n');
}
