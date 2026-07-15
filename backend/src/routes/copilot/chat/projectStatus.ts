// Deterministic project-state Jack narrates. Mirrors the frontend
// copilotStageStatus semantics (deriveStageStatus + the per-stage dataExists
// checks in CopilotPage) so the chat copilot and the copilot page agree on
// what "done" / "review ready" / "not started" means.

import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';
import { getEffectiveProjectRole, isSubcontractorPortalRole } from '../../../lib/projectAccess.js';
import { CHAT_STAGES, type ChatStage } from './prompt.js';

export type StageStatus = 'not_started' | 'review_ready' | 'done';

export interface ProjectStageStatus {
  projectId: string;
  name: string;
  projectNumber: string;
  state: string | null;
  specificationSet: string | null;
  lotCount: number;
  pendingProposals: number;
  stages: Record<ChatStage, StageStatus>;
}

type AccessUser = {
  id: string;
  companyId?: string | null;
  roleInCompany?: string | null;
};

/**
 * Boolean form of requireInternalProjectAccess: true when the user is an
 * internal (non-subcontractor) member of the project. No throw and no
 * project-existence probe — callers decide whether a false means 404
 * (route) or a returned error string (tool).
 */
export async function hasInternalProjectAccess(
  user: AccessUser,
  projectId: string,
): Promise<boolean> {
  if (isSubcontractorPortalRole(user.roleInCompany)) {
    return false;
  }
  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
  });
  return Boolean(role) && !isSubcontractorPortalRole(role);
}

// deriveStageStatus, ported verbatim from
// frontend/src/pages/projects/copilot/copilotStageStatus.ts.
function deriveStageStatus(proposalStatus: string | undefined, dataExists: boolean): StageStatus {
  if (proposalStatus === 'proposed') return 'review_ready';
  if (dataExists) return 'done';
  if (proposalStatus === 'accepted' || proposalStatus === 'edited') return 'done';
  return 'not_started';
}

/**
 * The per-stage status block for one project, plus its facts and pending count.
 * Returns null when the project does not exist. Does NOT check access — the
 * caller must gate on hasInternalProjectAccess first.
 */
export async function getProjectStageStatus(projectId: string): Promise<ProjectStageStatus | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, projectNumber: true, state: true, specificationSet: true },
  });
  if (!project) {
    return null;
  }

  const [controlLineCount, registeredSheetCount, lotCount, proposals] = await Promise.all([
    prisma.controlLine.count({ where: { projectId } }),
    // hasRegistration === registration != null (planSheets list route).
    prisma.planSheet.count({ where: { projectId, registration: { not: Prisma.DbNull } } }),
    prisma.lot.count({ where: { projectId } }),
    prisma.aiProposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { stage: true, status: true },
    }),
  ]);

  // Newest proposal per stage wins (matches newestProposalForStage).
  const newestByStage = new Map<string, string>();
  for (const proposal of proposals) {
    if (!newestByStage.has(proposal.stage)) {
      newestByStage.set(proposal.stage, proposal.status);
    }
  }

  const dataExists: Record<ChatStage, boolean> = {
    project_facts: Boolean(project.name && project.state),
    control_line: controlLineCount > 0,
    plan_sheets: registeredSheetCount > 0,
    lot_breakdown: lotCount > 0,
  };

  const stages = Object.fromEntries(
    CHAT_STAGES.map((stage) => [
      stage,
      deriveStageStatus(newestByStage.get(stage), dataExists[stage]),
    ]),
  ) as Record<ChatStage, StageStatus>;

  return {
    projectId,
    name: project.name,
    projectNumber: project.projectNumber,
    state: project.state,
    specificationSet: project.specificationSet,
    lotCount,
    pendingProposals: proposals.filter((p) => p.status === 'proposed').length,
    stages,
  };
}
