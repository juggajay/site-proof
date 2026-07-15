import multer from 'multer';
import { z } from 'zod';
import type { AiProposal, Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  AI_EXTRACTION_TIMEOUT_MS,
  extractJsonObject,
  getCertificateContentBlock,
  isAnthropicConfigured,
} from '../testResults/certificateExtraction.js';
import { getDefaultProjectSpecificationSet } from '../projects/writeRoutes.js';
import { applyHandlers, rollbackHandlers, type AppliedRecordGroup } from './proposalService.js';

// Project field caps mirrored from the project write routes (projects.ts). The AI
// candidate is cleaned to these so an accepted proposal is always a legal project
// update — the apply handler re-checks them (never trust the wire).
const PROJECT_NAME_MAX_LENGTH = 120;
const PROJECT_NUMBER_MAX_LENGTH = 64;
const PROJECT_CLIENT_MAX_LENGTH = 160;

// The 8 AU states/territories. A model value outside this set is dropped to null
// with a warning rather than written to the project.
const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;
type AuState = (typeof AU_STATES)[number];
const AU_STATE_SET = new Set<string>(AU_STATES);

// Mirror the setout/certificate uploader: keep the file in memory (never
// persisted — only streamed to the AI), same 10 MB cap and PDF/image gate.
export const projectFactsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Prefix matches errorHandler's INVALID_FILE_TYPE branch → 400 (not 500).
      cb(new Error('Invalid file type: only PDF and image files are allowed'));
    }
  },
});

// The reviewed candidate: the four printed facts plus the server-derived ITP
// specification set. Every fact is nullable — the model returns null for
// anything not legibly printed on the title block.
export interface ProjectFactsCandidate {
  projectName: string | null;
  projectNumber: string | null;
  clientName: string | null;
  state: AuState | null;
  specificationSet: string;
}

export interface ProjectFactsExtraction {
  candidate: ProjectFactsCandidate;
  warnings: string[];
  /** Title-block page the facts were read from, if the model could tell. */
  page: number | null;
}

function cleanString(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(null|unknown|n\/?a)$/i.test(trimmed)) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeState(raw: unknown, warnings: string[]): AuState | null {
  const cleaned = cleanString(raw, 16);
  if (cleaned === null) return null;
  const upper = cleaned.toUpperCase();
  if (AU_STATE_SET.has(upper)) return upper as AuState;
  warnings.push(
    `Could not read "${cleaned}" as an Australian state/territory; set it manually if needed.`,
  );
  return null;
}

function normalizePage(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

// Pure server-side validation/cleaning of the model's JSON — the trust boundary
// that turns untrusted model output into a safe project-facts candidate. Derives
// the ITP specification set from the (validated) state so an accept always lands
// a consistent project.
export function cleanProjectFactsCandidate(raw: unknown): ProjectFactsExtraction {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings: string[] = [];

  if (Array.isArray(root.warnings)) {
    for (const w of root.warnings) {
      if (typeof w === 'string' && w.trim()) warnings.push(w.trim());
    }
  }

  const state = normalizeState(root.state, warnings);
  const candidate: ProjectFactsCandidate = {
    projectName: cleanString(root.projectName, PROJECT_NAME_MAX_LENGTH),
    projectNumber: cleanString(root.projectNumber, PROJECT_NUMBER_MAX_LENGTH),
    clientName: cleanString(root.clientName, PROJECT_CLIENT_MAX_LENGTH),
    state,
    specificationSet: getDefaultProjectSpecificationSet(state),
  };

  if (
    candidate.projectName === null &&
    candidate.projectNumber === null &&
    candidate.clientName === null &&
    candidate.state === null
  ) {
    warnings.push('No project facts could be read from this drawing. Enter them manually.');
  }

  return { candidate, warnings, page: normalizePage(root.page) };
}

function buildProjectFactsPrompt(): string {
  return `You are reading the title block / cover sheet of a civil engineering drawing set.

Extract the project's administrative facts into JSON. Return ONLY valid JSON with these exact keys:
- projectName: string or null. The project or contract name as printed.
- projectNumber: string or null. The project/contract/job number as printed.
- clientName: string or null. The client / principal / superintendent organisation.
- state: string or null. The Australian state or territory, as an abbreviation: one of NSW, VIC, QLD, SA, WA, TAS, NT, ACT. Infer from the address/location if a state is not printed directly; return null if you cannot tell.
- page: number or null. The 1-based page number of the sheet the title block was read from, if determinable.
- warnings: array of strings for anything ambiguous or unreadable.

Rules:
- Return null for any fact not legibly printed — do NOT guess names or numbers.
- Do not invent a client or project number that is not on the sheet.`;
}

// Calls Anthropic exactly as the setout/certificate extractors do (same client,
// auth, content-block builder, model selection, long AI-extraction timeout) and
// returns the raw parsed JSON for cleanProjectFactsCandidate to validate.
export async function extractProjectFactsRawCandidate(file: Express.Multer.File): Promise<unknown> {
  if (!isAnthropicConfigured()) {
    throw new AppError(
      503,
      'AI reading is not configured on this server. Enter the project facts manually.',
      'AI_UNAVAILABLE',
    );
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                getCertificateContentBlock(file),
                { type: 'text', text: buildProjectFactsPrompt() },
              ],
            },
          ],
        }),
      },
      AI_EXTRACTION_TIMEOUT_MS,
    );
  } catch (error) {
    logWarn('AI project-facts extraction request failed:', error);
    throw new AppError(
      502,
      'AI reading failed. Try again or enter the project facts manually.',
      'AI_REQUEST_FAILED',
    );
  }

  if (!response.ok) {
    logWarn(`AI project-facts extraction returned status ${response.status}`);
    throw new AppError(
      502,
      'AI reading failed. Try again or enter the project facts manually.',
      'AI_REQUEST_FAILED',
    );
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const responseText = result.content?.find((block) => block.type === 'text')?.text || '';

  try {
    return extractJsonObject(responseText);
  } catch (error) {
    logWarn('AI project-facts extraction returned unparseable output:', error);
    throw new AppError(
      502,
      'AI reading returned an unreadable result. Try again or enter the project facts manually.',
      'AI_REQUEST_FAILED',
    );
  }
}

export const PROJECT_FACTS_STAGE = 'project_facts';

// The payload the apply handler trusts, re-validated from the wire. `state` must
// be a real AU code or null; `specificationSet` is optional here so an edited
// payload can omit it and let the server re-derive from the edited state.
const applyPayloadSchema = z.object({
  projectName: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH).nullable().optional(),
  projectNumber: z.string().trim().min(1).max(PROJECT_NUMBER_MAX_LENGTH).nullable().optional(),
  clientName: z.string().trim().min(1).max(PROJECT_CLIENT_MAX_LENGTH).nullable().optional(),
  state: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => AU_STATE_SET.has(s), 'Unsupported Australian state/territory')
    .nullable()
    .optional(),
  specificationSet: z.string().trim().min(1).max(64).nullable().optional(),
});

// Project columns this stage can write, with their prior values captured for
// rollback. clientName is nullable in the schema; the others are non-null.
interface ProjectFactsPrior {
  name?: string;
  projectNumber?: string;
  clientName?: string | null;
  state?: string;
  specificationSet?: string;
}

// apply: validate the effective payload again, then update ONLY the provided
// non-null facts. specificationSet follows the state derivation unless it was
// explicitly sent. Returns the prior values so rollback can restore them.
applyHandlers[PROJECT_FACTS_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
): Promise<AppliedRecordGroup[]> => {
  const parsed = applyPayloadSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }
  const payload = parsed.data;
  const projectId = proposal.projectId;

  const current = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      projectNumber: true,
      clientName: true,
      state: true,
      specificationSet: true,
    },
  });
  if (!current) {
    throw AppError.notFound('Project');
  }

  const update: Prisma.ProjectUpdateInput = {};
  const prior: ProjectFactsPrior = {};

  if (payload.projectName != null) {
    update.name = payload.projectName;
    prior.name = current.name;
  }
  if (payload.projectNumber != null) {
    update.projectNumber = payload.projectNumber;
    prior.projectNumber = current.projectNumber;
  }
  if (payload.clientName != null) {
    update.clientName = payload.clientName;
    prior.clientName = current.clientName;
  }
  if (payload.state != null) {
    update.state = payload.state;
    prior.state = current.state;
    // Explicit spec set wins (an accept-verbatim carries the derived one);
    // otherwise derive from the state being applied (an edited state that
    // dropped specificationSet).
    const specificationSet =
      payload.specificationSet != null
        ? payload.specificationSet
        : getDefaultProjectSpecificationSet(payload.state);
    update.specificationSet = specificationSet;
    prior.specificationSet = current.specificationSet;
  }

  if (Object.keys(update).length > 0) {
    await tx.project.update({ where: { id: projectId }, data: update });
  }

  return [{ model: 'Project', ids: [projectId], meta: { prior } }];
};

// rollback: restore the prior field values captured at apply time.
rollbackHandlers[PROJECT_FACTS_STAGE] = async (
  tx: Prisma.TransactionClient,
  _proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  for (const group of groups) {
    if (group.model !== 'Project') continue;
    const meta = (group.meta ?? {}) as { prior?: ProjectFactsPrior };
    const prior = meta.prior ?? {};
    const restore: Prisma.ProjectUpdateInput = {};
    if ('name' in prior) restore.name = prior.name;
    if ('projectNumber' in prior) restore.projectNumber = prior.projectNumber;
    if ('clientName' in prior) restore.clientName = prior.clientName ?? null;
    if ('state' in prior) restore.state = prior.state;
    if ('specificationSet' in prior) restore.specificationSet = prior.specificationSet;
    if (Object.keys(restore).length > 0) {
      await tx.project.update({ where: { id: group.ids[0] }, data: restore });
    }
  }
};
