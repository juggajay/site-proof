// Clancy's tool surface. Every tool is READ-ONLY: three read the project state,
// two queue a client-side action (navigate / open_stage) that Clancy cannot
// execute himself. Access failures return an error string to the model rather
// than throwing, so one bad projectId doesn't abort the turn.

import { prisma } from '../../../lib/prisma.js';
import {
  CANONICAL_ACTIVITIES,
  foldActivityValue,
  formatActivityLabel,
} from '../../../lib/activityTaxonomy.js';
import { matchTemplatesForProject } from '../../../lib/itpMatcher.js';
import { getDashboardProjectAccess, type AuthUser } from '../../dashboard/access.js';
import { buildHoldPointListItems } from '../../holdpoints/listPresentation.js';
import { getProjectStageStatus, hasInternalProjectAccess } from './projectStatus.js';
import { HELP_TOPICS, HELP_TOPIC_SLUGS, getHelpTopic } from './productKnowledge.js';
import { isAllowedNavigateTarget, isChatStage, type ChatStage } from './prompt.js';

export type ChatAction =
  | { type: 'navigate'; to: string }
  | { type: 'open_stage'; stage: ChatStage; projectId: string };

export interface ToolOutcome {
  result: string;
  action?: ChatAction;
}

export type ToolExecutor = (name: string, input: unknown) => Promise<ToolOutcome>;

// The modules get_module_summary can report on. Each maps to a Prisma model and
// the status vocabulary of its own list route — see getModuleSummary. `tests`
// groups by passFail (pass/fail/pending) and `documents` by documentType, since
// those are the fields those pages count on; every other module groups by status.
export const MODULE_NAMES = [
  'diary',
  'dockets',
  'claims',
  'tests',
  'ncrs',
  'variations',
  'documents',
] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

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
      'Suggest which ITP template a lot should get for a construction activity on a project. Returns the match tier (A = one clear template, B = a shortlist the lot form will rank, C = no library match) and the matching templates. Call this when the user asks which ITP, template, or checklist a lot or activity needs. Map what the user described to the closest canonical activity slug yourself (e.g. "box culvert" → culverts, "asphalt wearing course" → asphalt_dga) — the matcher only understands the listed slugs.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project id' },
        activity: {
          type: 'string',
          // Live-probe regression: free text ("box culvert") folds to nothing
          // and reads as a false "no library match". Constrain to the canonical
          // slugs — derived from the taxonomy so the list can never drift — and
          // let the model do the natural-language → slug mapping.
          enum: CANONICAL_ACTIVITIES.map((a) => a.slug),
          description: 'The canonical activity slug closest to what the user described',
        },
      },
      required: ['projectId', 'activity'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_module_summary',
    description:
      'Summarise one module of a project: counts grouped by status and the five most recent items (identifier, short label, status, date). Call this when the user asks how many of something there are, what the latest entries are, or the general state of diaries, dockets, claims, tests, NCRs, variations, or documents. For a QA-specific hold-point/NCR rollup use get_project_qa_summary instead; for a single lot use get_lot_status.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project id' },
        module: {
          type: 'string',
          enum: MODULE_NAMES,
          description: 'Which module to summarise',
        },
      },
      required: ['projectId', 'module'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_lot_status',
    description:
      "Get one lot's detail by its lot number: status, chainage, activity, assigned ITP template, checklist progress, hold points (open/released), and open NCR count. Call this when the user names a specific lot. The lot number match is case-insensitive but must be exact — pass the number as the user said it.",
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The project id' },
        lotNumber: {
          type: 'string',
          description: 'The lot number exactly as the user refers to it',
        },
      },
      required: ['projectId', 'lotNumber'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_help_topics',
    description:
      'List the documentation topics you can explain, as slug + title pairs. Call this when you are unsure which get_help topic covers a question.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_help',
    description:
      'Explain how a part of CIVOS works from the in-app documentation. Call this when the user asks how to do something or how a feature works and the WORKFLOW OVERVIEW in your prompt is not enough. `topic` must be one of the documentation slugs — call list_help_topics if you are unsure which fits.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: HELP_TOPIC_SLUGS,
          description: 'The documentation topic slug',
        },
      },
      required: ['topic'],
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
 * lot forms use, no AI call inside chat. The tool schema constrains `activity`
 * to the canonical slugs (live-probe regression: free text like "box culvert"
 * folds to nothing and read as a false "no library match"); if a non-slug
 * still arrives, return an instructive retry error rather than a fake Tier C.
 */
async function getItpSuggestion(
  user: AuthUser,
  projectId: string,
  activity: string,
): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }
  if (foldActivityValue(activity).confidence === 'none') {
    return {
      result: `"${activity.slice(0, 80)}" is not a canonical activity slug. Retry with the closest slug from the tool's list (e.g. culverts, asphalt_dga, pipe_drainage).`,
    };
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

// Trim a free-text field to a compact label. Keeps the tool payload small —
// the model only needs enough to recognise the item, not the full text.
function trimLabel(value: string | null | undefined, max = 80): string {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  return text.length > max ? text.slice(0, max) : text;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type ModuleItem = { id: string; label: string; status: string; date: string | null };

// groupBy rows -> { statusValue: count }. Null/empty group keys fold to
// 'unknown' so a stray null never drops a row from the totals.
function countsFrom(rows: Array<{ _count: { _all: number } }>, key: (row: never) => unknown) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row as never);
    const label = typeof value === 'string' && value.length > 0 ? value : 'unknown';
    out[label] = (out[label] ?? 0) + row._count._all;
  }
  return out;
}

/**
 * Compact per-module rollup: counts grouped by the module's own status field
 * plus the five most recent items. Each branch mirrors the model + status
 * vocabulary of that module's list route (do not invent status names). `tests`
 * groups by passFail and `documents` by documentType; the rest by status.
 * Cheap by construction: one groupBy + one take:5 findMany per call.
 */
async function getModuleSummary(
  user: AuthUser,
  projectId: string,
  module: ModuleName,
): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }

  let counts: Record<string, number>;
  let recent: ModuleItem[];

  switch (module) {
    case 'diary': {
      const [rows, items] = await Promise.all([
        prisma.dailyDiary.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
        prisma.dailyDiary.findMany({
          where: { projectId },
          orderBy: { date: 'desc' },
          take: 5,
          select: { id: true, date: true, status: true, generalNotes: true },
        }),
      ]);
      counts = countsFrom(rows, (r: { status: string }) => r.status);
      recent = items.map((d) => ({
        id: d.id,
        label: trimLabel(`${isoDay(d.date)} ${d.generalNotes ?? ''}`),
        status: d.status,
        date: d.date.toISOString(),
      }));
      break;
    }
    case 'dockets': {
      const [rows, items] = await Promise.all([
        prisma.dailyDocket.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { _all: true },
        }),
        prisma.dailyDocket.findMany({
          where: { projectId },
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            id: true,
            date: true,
            status: true,
            subcontractorCompany: { select: { companyName: true } },
          },
        }),
      ]);
      counts = countsFrom(rows, (r: { status: string }) => r.status);
      recent = items.map((d) => ({
        id: d.id,
        label: trimLabel(`${isoDay(d.date)} ${d.subcontractorCompany?.companyName ?? ''}`),
        status: d.status,
        date: d.date.toISOString(),
      }));
      break;
    }
    case 'claims': {
      const [rows, items] = await Promise.all([
        prisma.progressClaim.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { _all: true },
        }),
        prisma.progressClaim.findMany({
          where: { projectId },
          orderBy: { claimNumber: 'desc' },
          take: 5,
          select: { id: true, claimNumber: true, status: true, createdAt: true },
        }),
      ]);
      counts = countsFrom(rows, (r: { status: string }) => r.status);
      recent = items.map((c) => ({
        id: c.id,
        label: `Claim #${c.claimNumber}`,
        status: c.status,
        date: c.createdAt.toISOString(),
      }));
      break;
    }
    case 'tests': {
      const [rows, items] = await Promise.all([
        prisma.testResult.groupBy({
          by: ['passFail'],
          where: { projectId },
          _count: { _all: true },
        }),
        prisma.testResult.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            testType: true,
            testRequestNumber: true,
            passFail: true,
            createdAt: true,
          },
        }),
      ]);
      counts = countsFrom(rows, (r: { passFail: string }) => r.passFail);
      recent = items.map((t) => ({
        id: t.id,
        label: trimLabel(`${t.testType}${t.testRequestNumber ? ` ${t.testRequestNumber}` : ''}`),
        status: t.passFail,
        date: t.createdAt.toISOString(),
      }));
      break;
    }
    case 'ncrs': {
      const [rows, items] = await Promise.all([
        prisma.nCR.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
        prisma.nCR.findMany({
          where: { projectId },
          orderBy: { raisedAt: 'desc' },
          take: 5,
          select: { id: true, ncrNumber: true, description: true, status: true, raisedAt: true },
        }),
      ]);
      counts = countsFrom(rows, (r: { status: string }) => r.status);
      recent = items.map((n) => ({
        id: n.id,
        label: trimLabel(`${n.ncrNumber} ${n.description}`),
        status: n.status,
        date: n.raisedAt.toISOString(),
      }));
      break;
    }
    case 'variations': {
      const [rows, items] = await Promise.all([
        prisma.variation.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
        prisma.variation.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, variationNumber: true, title: true, status: true, createdAt: true },
        }),
      ]);
      counts = countsFrom(rows, (r: { status: string }) => r.status);
      recent = items.map((v) => ({
        id: v.id,
        label: trimLabel(`${v.variationNumber} ${v.title}`),
        status: v.status,
        date: v.createdAt.toISOString(),
      }));
      break;
    }
    case 'documents': {
      // Documents have no status column; documentType is what the page filters
      // and counts on, so that is the grouping key here.
      const [rows, items] = await Promise.all([
        prisma.document.groupBy({
          by: ['documentType'],
          where: { projectId },
          _count: { _all: true },
        }),
        prisma.document.findMany({
          where: { projectId },
          orderBy: { uploadedAt: 'desc' },
          take: 5,
          select: { id: true, filename: true, documentType: true, uploadedAt: true },
        }),
      ]);
      counts = countsFrom(rows, (r: { documentType: string }) => r.documentType);
      recent = items.map((d) => ({
        id: d.id,
        label: trimLabel(d.filename),
        status: d.documentType,
        date: d.uploadedAt.toISOString(),
      }));
      break;
    }
    default:
      return { result: `Unknown module: ${module}` };
  }

  return { result: JSON.stringify({ module, counts, recent }) };
}

// Completion counts as done the same way the lot register does
// (isAcceptedListCompletion in routes/lots/listPresentation.ts): a done status
// that has not been kicked back to pending_verification or rejected.
const DONE_COMPLETION_STATUSES = new Set(['completed', 'not_applicable']);
const UNACCEPTED_VERIFICATION_STATUSES = new Set(['pending_verification', 'rejected']);

/**
 * One lot's QA state, matched by lot number case-insensitively (exact). Reuses
 * the hold-point register presentation so open/released counts equal the page,
 * and mirrors the lot register's checklist-progress semantics. Not found ->
 * an instructive error naming a real lot number from the project.
 */
async function getLotStatus(
  user: AuthUser,
  projectId: string,
  lotNumber: string,
): Promise<ToolOutcome> {
  if (!(await hasInternalProjectAccess(user, projectId))) {
    return { result: NO_ACCESS };
  }

  // Same load shape as getProjectQaSummary so buildHoldPointListItems (which
  // needs the full checklist items to spot hold-point rows) works unchanged and
  // the lot object satisfies HoldPointListLot without a cast.
  const lot = await prisma.lot.findFirst({
    where: { projectId, lotNumber: { equals: lotNumber, mode: 'insensitive' } },
    include: {
      itpInstance: {
        include: {
          template: { include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } } },
          completions: true,
        },
      },
      holdPoints: true,
    },
  });

  if (!lot) {
    const example = await prisma.lot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { lotNumber: true },
    });
    return {
      result: example
        ? `No lot "${trimLabel(lotNumber)}" on this project. Lot numbers are exact — try one like "${example.lotNumber}", or open the lot register to see them all.`
        : 'This project has no lots yet.',
    };
  }

  const instance = lot.itpInstance;
  const totalChecklist = instance?.template?.checklistItems.length ?? 0;
  const completedChecklist = (instance?.completions ?? []).filter(
    (c) =>
      DONE_COMPLETION_STATUSES.has(c.status ?? '') &&
      !UNACCEPTED_VERIFICATION_STATUSES.has(c.verificationStatus ?? ''),
  ).length;

  const holdPoints = summariseHoldPoints(buildHoldPointListItems([lot]));

  const openNcrs = await prisma.nCR.count({
    where: {
      projectId,
      status: { notIn: ['closed', 'closed_concession'] },
      ncrLots: { some: { lotId: lot.id } },
    },
  });

  const chainage =
    lot.chainageStart != null && lot.chainageEnd != null
      ? `${lot.chainageStart}–${lot.chainageEnd}`
      : null;

  return {
    result: JSON.stringify({
      lotNumber: lot.lotNumber,
      status: lot.status,
      chainage,
      activityType: formatActivityLabel(lot.activityType),
      itpTemplate: instance?.template?.name ?? null,
      checklist: { completed: completedChecklist, total: totalChecklist },
      holdPoints: { open: holdPoints.awaitingRelease, released: holdPoints.released },
      openNcrs,
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

      case 'get_module_summary': {
        const projectId = readString(input, 'projectId');
        const module = readString(input, 'module');
        if (!projectId || !module) {
          return { result: 'A projectId and module are required.' };
        }
        if (!(MODULE_NAMES as readonly string[]).includes(module)) {
          return {
            result: `"${module.slice(0, 40)}" is not a known module. Use one of: ${MODULE_NAMES.join(', ')}.`,
          };
        }
        return getModuleSummary(user, projectId, module as ModuleName);
      }

      case 'get_lot_status': {
        const projectId = readString(input, 'projectId');
        const lotNumber = readString(input, 'lotNumber');
        if (!projectId || !lotNumber) {
          return { result: 'A projectId and lotNumber are required.' };
        }
        return getLotStatus(user, projectId, lotNumber);
      }

      case 'list_help_topics':
        return {
          result: JSON.stringify({
            topics: HELP_TOPICS.map((t) => ({ slug: t.slug, title: t.title })),
          }),
        };

      case 'get_help': {
        const topic = readString(input, 'topic');
        const found = topic ? getHelpTopic(topic) : undefined;
        if (!found) {
          return {
            result: `Unknown help topic. Call list_help_topics for the valid slugs (e.g. ${HELP_TOPIC_SLUGS.slice(0, 3).join(', ')}).`,
          };
        }
        return {
          result: JSON.stringify({ slug: found.slug, title: found.title, body: found.body }),
        };
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
