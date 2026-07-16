// Clancy's tool surface. Every tool is READ-ONLY: three read the project state,
// two queue a client-side action (navigate / open_stage) that Clancy cannot
// execute himself. Access failures return an error string to the model rather
// than throwing, so one bad projectId doesn't abort the turn.

import { prisma } from '../../../lib/prisma.js';
import { matchTemplatesForProject } from '../../../lib/itpMatcher.js';
import { getDashboardProjectAccess, type AuthUser } from '../../dashboard/access.js';
import { buildHoldPointListItems } from '../../holdpoints/listPresentation.js';
import { getProjectStageStatus, hasInternalProjectAccess } from './projectStatus.js';
import { isAllowedNavigateTarget, isChatStage, type ChatStage } from './prompt.js';

export type ChatAction =
  | { type: 'navigate'; to: string }
  | { type: 'open_stage'; stage: ChatStage; projectId: string };

export interface ToolOutcome {
  result: string;
  action?: ChatAction;
}

export type ToolExecutor = (name: string, input: unknown) => Promise<ToolOutcome>;

// Anthropic tool definitions. Kept small and prescriptive about WHEN to call —
// recent models reach for tools conservatively.
export const CHAT_TOOLS = [
  {
    name: 'list_projects',
    description:
      'List the projects this user can access, with lot counts. Call this when the user asks which projects they have or you need a project id.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_project_overview',
    description:
      'Get the setup-stage status (project_facts, control_line, plan_sheets, lot_breakdown), lot count, and pending-proposal count for a project OTHER than the one already in the current state. Call this to compare or check a different project.',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'The project id' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_pending_proposals',
    description:
      'List AI proposals waiting for the user to review on a project. Call this when the user asks what needs approval or what is waiting for review.',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'The project id' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_project_qa_summary',
    description:
      'Hold point and NCR summary for a project: total / released / awaiting-release / ready-to-request hold point counts (matching the hold point register, including hold points not yet actioned) and the open NCR count. Call this when the user asks about hold points, releases, or non-conformances.',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'The project id' } },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_itp_suggestion',
    description:
      'Suggest which ITP template a lot should get for a construction activity on a project. Returns the match tier (A = one clear template, B = a shortlist the lot form will rank, C = no library match) and the matching templates. Call this when the user asks which ITP, template, or checklist a lot or activity needs. `activity` may be a plain description like "box culvert" or "asphalt wearing course".',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project id' },
        activity: {
          type: 'string',
          description: 'The construction activity — a canonical slug or free text',
        },
      },
      required: ['projectId', 'activity'],
      additionalProperties: false,
    },
  },
  {
    name: 'navigate',
    description:
      'Take the user to a page in SiteProof. Call this to send them somewhere; `to` must be an in-app path like /dashboard, /projects, or /projects/<id>/lots.',
    input_schema: {
      type: 'object',
      properties: { to: { type: 'string', description: 'In-app path starting with /' } },
      required: ['to'],
      additionalProperties: false,
    },
  },
  {
    name: 'open_stage',
    description:
      'Offer to open a copilot setup stage so the user can read a drawing and review what it finds. Call this instead of claiming you read the file yourself.',
    input_schema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['project_facts', 'control_line', 'plan_sheets', 'lot_breakdown'],
        },
        projectId: { type: 'string', description: 'The project id' },
      },
      required: ['stage', 'projectId'],
      additionalProperties: false,
    },
  },
] as const;

function readString(input: unknown, key: string): string | null {
  if (input && typeof input === 'object' && key in input) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

const NO_ACCESS = "You don't have access to that project, or it doesn't exist.";

/**
 * Resolve the project segment of a whitelisted /projects/:id/... path to a
 * REAL, ACCESSIBLE project id. The model's most natural mistake is putting the
 * human-facing projectNumber in the path (live probe: /projects/100901/lots) —
 * accept either id or projectNumber and rewrite to the id. Returns the path
 * unchanged for non-project paths, or null when the segment matches nothing
 * this user can open (which also makes project navigation access-checked).
 */
async function resolveProjectPath(user: AuthUser, to: string): Promise<string | null> {
  const match = to.match(/^\/projects\/([A-Za-z0-9_-]+)(\/.*)?$/);
  if (!match) return to;
  const [, segment, rest = ''] = match;

  const access = await getDashboardProjectAccess(user);
  const byId = access.find((a) => a.projectId === segment);
  if (byId) return to;
  const byNumber = access.find((a) => a.project.projectNumber === segment);
  if (byNumber) return `/projects/${byNumber.projectId}${rest}`;
  return null;
}

async function listProjects(user: AuthUser): Promise<ToolOutcome> {
  const access = await getDashboardProjectAccess(user);
  const projectIds = access.map((a) => a.projectId);
  const lotCounts =
    projectIds.length > 0
      ? await prisma.lot.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds } },
          _count: { _all: true },
        })
      : [];
  const lotByProject = new Map(lotCounts.map((row) => [row.projectId, row._count._all]));
  const projects = access.map((a) => ({
    id: a.projectId,
    name: a.project.name,
    projectNumber: a.project.projectNumber,
    lotCount: lotByProject.get(a.projectId) ?? 0,
  }));
  return { result: JSON.stringify({ projects }) };
}

async function getProjectOverview(user: AuthUser, projectId: string): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }
  const status = await getProjectStageStatus(projectId);
  if (!status) {
    return { result: NO_ACCESS };
  }
  return { result: JSON.stringify(status) };
}

async function listPendingProposals(user: AuthUser, projectId: string): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }
  const proposals = await prisma.aiProposal.findMany({
    where: { projectId, status: 'proposed' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, stage: true, createdAt: true, warnings: true },
  });
  const items = proposals.map((p) => ({
    id: p.id,
    stage: p.stage,
    createdAt: p.createdAt.toISOString(),
    warningsCount: Array.isArray(p.warnings) ? p.warnings.length : 0,
  }));
  return { result: JSON.stringify({ pending: items }) };
}

/**
 * Count hold points the way the register page presents them. Pure so it can be
 * unit-tested DB-free; items come from buildHoldPointListItems, which includes
 * virtual entries for hold-point checklist items with no persisted row yet —
 * a bare prisma.holdPoint.count would report 0 on an unactioned project.
 */
export function summariseHoldPoints(items: Array<{ status: string; canRequestRelease: boolean }>): {
  total: number;
  released: number;
  awaitingRelease: number;
  readyToRequest: number;
} {
  const released = items.filter((item) => item.status === 'released').length;
  const readyToRequest = items.filter(
    (item) => item.status !== 'released' && item.canRequestRelease,
  ).length;
  return {
    total: items.length,
    released,
    awaitingRelease: items.length - released,
    readyToRequest,
  };
}

async function getProjectQaSummary(user: AuthUser, projectId: string): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }
  // Same load shape as the hold-point register route (GET /project/:projectId
  // in holdpoints/readRoutes.ts), so Clancy's counts always equal the page.
  const [lots, openNcrs] = await Promise.all([
    prisma.lot.findMany({
      where: { projectId },
      include: {
        itpInstance: {
          include: {
            template: { include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } } },
            completions: true,
          },
        },
        holdPoints: true,
      },
    }),
    prisma.nCR.count({
      where: { projectId, status: { notIn: ['closed', 'closed_concession'] } },
    }),
  ]);
  const holdPoints = summariseHoldPoints(buildHoldPointListItems(lots));
  return { result: JSON.stringify({ holdPoints, openNcrs }) };
}

/**
 * Deterministic ITP-template shortlist for an activity — the same matcher the
 * lot forms use, no AI call inside chat. `matchTemplatesForProject` folds a
 * free-text or slug activity through the §1 taxonomy and applies the hard
 * state/spec filter. Tier B returns the shortlist; the prompt tells Clancy the
 * lot form ranks it. `activity` free text is unbounded from the model, so cap it
 * before the DB round-trip.
 */
async function getItpSuggestion(
  user: AuthUser,
  projectId: string,
  activity: string,
): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }
  const match = await matchTemplatesForProject({ projectId, activity: activity.slice(0, 200) });
  const candidates = match.candidates.map((c) => ({
    id: c.id,
    name: c.name,
    scope: c.scope,
    stateSpec: c.stateSpec,
    matchKind: c.matchKind,
    baseline: c.baseline ?? false,
    checklistItemCount: c.checklistItemCount,
    holdPointCount: c.holdPointCount,
  }));
  return {
    result: JSON.stringify({
      tier: match.tier,
      suggestedTemplateId: match.suggestedTemplateId,
      candidates,
    }),
  };
}

/**
 * Bind an executor to the requesting user. The returned function is what the
 * model loop calls per tool_use block.
 */
export function createChatToolExecutor(user: AuthUser): ToolExecutor {
  return async (name, input) => {
    switch (name) {
      case 'list_projects':
        return listProjects(user);

      case 'get_project_overview': {
        const projectId = readString(input, 'projectId');
        if (!projectId) return { result: 'A projectId is required.' };
        return getProjectOverview(user, projectId);
      }

      case 'list_pending_proposals': {
        const projectId = readString(input, 'projectId');
        if (!projectId) return { result: 'A projectId is required.' };
        return listPendingProposals(user, projectId);
      }

      case 'get_project_qa_summary': {
        const projectId = readString(input, 'projectId');
        if (!projectId) return { result: 'A projectId is required.' };
        return getProjectQaSummary(user, projectId);
      }

      case 'get_itp_suggestion': {
        const projectId = readString(input, 'projectId');
        const activity = readString(input, 'activity');
        if (!projectId || !activity) {
          return { result: 'A projectId and activity are required.' };
        }
        return getItpSuggestion(user, projectId, activity);
      }

      case 'navigate': {
        const to = readString(input, 'to');
        if (!isAllowedNavigateTarget(to)) {
          return { result: 'That destination is not allowed. Offer a valid in-app page instead.' };
        }
        const resolved = await resolveProjectPath(user, to);
        if (!resolved) {
          return {
            result:
              'That project is not one you can open — call list_projects and use the project id in the path.',
          };
        }
        return { result: 'Navigation queued.', action: { type: 'navigate', to: resolved } };
      }

      case 'open_stage': {
        const projectId = readString(input, 'projectId');
        const rawStage = readString(input, 'stage');
        if (!projectId || !isChatStage(rawStage)) {
          return { result: 'A valid stage and projectId are required.' };
        }
        if (!(await hasInternalProjectAccess(user, projectId))) {
          return { result: NO_ACCESS };
        }
        return {
          result: 'Stage open queued.',
          action: { type: 'open_stage', stage: rawStage, projectId },
        };
      }

      default:
        return { result: `Unknown tool: ${name}` };
    }
  };
}
