/**
 * Wave G G2 §2.2(e) — compare two ITP template versions.
 *
 * **No new diff engine and no new UI vocabulary.** `diffChecklistItems` already
 * pairs items by normalised description and returns `{added, removed, changed}`
 * for Wave B's corporate-master dry run, and `ImportReviewPanes` already renders
 * that exact shape. This route reuses both.
 *
 * The one limitation it inherits is documented at the diff's own definition: a
 * REWORDED item reads as one removed plus one added, because a description is
 * the only stable identity a checklist row has across two independently-edited
 * copies. It is carried forward and STATED to the reader (`descriptionPairing`
 * below), not fixed here — fuzzy pairing would guess identity from text, which
 * G2 refuses everywhere else too.
 *
 * `projectId` is required rather than inferred. Both templates must be visible
 * from that project — its own, or the shared library — which is what makes
 * §2.3's per-role gate answerable and turns cross-tenant into a 404 without an
 * existence-disclosing branch (spec §7 row 4, AT-G15).
 */

import { Router, type Request, type Response } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { itpProvenanceEnabled } from '../../lib/itpProvenance.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { diffChecklistItems } from '../copilot/import/itpImportDryRun.js';
import { TEMPLATE_COMPARE_ROLES, requireProjectTemplateAccess } from './templateAccess.js';
import { parseRequiredTemplateQueryString, parseTemplateRouteId } from './templateValidation.js';

export const templateCompareRouter = Router();

/** The template fields a version compare reports on, in reading order. */
const COMPARED_FIELDS = [
  'name',
  'description',
  'activityType',
  'specificationReference',
  'stateSpec',
  'authority',
  'specEdition',
  'specIssuedOn',
  'effectiveFrom',
  'reviewDueOn',
  'changeSummary',
  'annexureWarning',
] as const;

type ComparedField = (typeof COMPARED_FIELDS)[number];

const templateSelect = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  activityType: true,
  specificationReference: true,
  stateSpec: true,
  authority: true,
  specEdition: true,
  specIssuedOn: true,
  effectiveFrom: true,
  reviewDueOn: true,
  changeSummary: true,
  annexureWarning: true,
  supersededById: true,
  supersededAt: true,
  sourceTemplateId: true,
  checklistItems: {
    orderBy: { sequenceNumber: 'asc' },
    select: {
      description: true,
      acceptanceCriteria: true,
      pointType: true,
    },
  },
} as const;

type ComparableTemplate = {
  id: string;
  projectId: string | null;
  checklistItems: { description: string; acceptanceCriteria: string | null; pointType: string }[];
} & Record<ComparedField, unknown> &
  Record<string, unknown>;

function serialize(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function summarize(template: ComparableTemplate) {
  const summary: Record<string, unknown> = { id: template.id };
  for (const field of COMPARED_FIELDS) {
    summary[field] = serialize(template[field]);
  }
  summary.checklistItemCount = template.checklistItems.length;
  summary.supersededById = template.supersededById ?? null;
  summary.supersededAt = serialize(template.supersededAt);
  return summary;
}

templateCompareRouter.get(
  '/templates/:id/compare',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // Flag off ⇒ the endpoint does not exist. Checked after `requireAuth` so an
    // unauthenticated probe still gets 401, matching every other ITP route.
    if (!itpProvenanceEnabled()) {
      throw AppError.notFound('Route');
    }

    const user = req.user!;
    const baseId = parseTemplateRouteId(req.params.id, 'id');
    const againstId = parseRequiredTemplateQueryString(req.query.against, 'against');
    const projectId = parseRequiredTemplateQueryString(req.query.projectId, 'projectId');

    const { projectUser } = await requireProjectTemplateAccess(projectId, user);
    const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
    if (!isCompanyAdmin && !TEMPLATE_COMPARE_ROLES.includes(projectUser?.role || '')) {
      throw AppError.forbidden('You do not have permission to compare ITP template versions');
    }

    const templates = (await prisma.iTPTemplate.findMany({
      where: {
        id: { in: [baseId, againstId] },
        // The shared library, or this project's own copies. Anything else is
        // reported as absent — never as forbidden (AT-G15).
        OR: [{ projectId: null }, { projectId }],
      },
      select: templateSelect,
    })) as unknown as ComparableTemplate[];

    const base = templates.find((template) => template.id === baseId);
    const against = templates.find((template) => template.id === againstId);
    if (!base || !against) {
      throw AppError.notFound('Template');
    }

    const metadata = COMPARED_FIELDS.map((field) => ({
      field,
      base: serialize(base[field]),
      against: serialize(against[field]),
    })).filter((row) => row.base !== row.against);

    res.json({
      base: summarize(base),
      against: summarize(against),
      metadata,
      checklist: diffChecklistItems(base.checklistItems, against.checklistItems),
      descriptionPairing:
        'Checklist rows are paired by description. A reworded row reads as one removed and one added.',
    });
  }),
);
