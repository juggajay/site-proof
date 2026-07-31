/**
 * Wave G G1 — revision governance
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §1).
 *
 * The vocabulary, the feature flag, and the one batched read the readiness
 * engine's three callers need. No route logic lives here.
 */

import { prisma } from './prisma.js';

/**
 * The five governed classes (spec §1.3(a)).
 *
 * `drawing` carries its own revision chain (`Drawing.supersededById`, shipped).
 * The three document-backed classes ride on `Document.supersededById` — DG-1,
 * confirmed by Jay 2026-07-31. `itp_template` gains `ITPTemplate.supersededById`
 * in G2 (§2.2(a)); until then G1 can record issues against a project-scoped
 * template but cannot observe one as superseded — see
 * {@link loadSupersededGoverningRevisions}.
 */
export const GOVERNED_ENTITY_TYPES = [
  'drawing',
  'specification',
  'itp_template',
  'approved_method',
  'client_direction',
] as const;

export type GovernedEntityType = (typeof GOVERNED_ENTITY_TYPES)[number];

/** The governed classes whose `entityId` is a `Document.id`. */
export const DOCUMENT_BACKED_ENTITY_TYPES: readonly GovernedEntityType[] = [
  'specification',
  'approved_method',
  'client_direction',
];

export function isGovernedEntityType(value: string): value is GovernedEntityType {
  return (GOVERNED_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Spec §1.9 [GR-A2]: opt-IN, default OFF everywhere INCLUDING production.
 *
 * Parse shape copied from `readiness/recordDecision.ts:236-239`. It is cited
 * alone and reproduced inline deliberately — `dataRetentionWorker.ts` parses the
 * same three tokens and inverts the default, so there is no house convention to
 * point at, and a reader who assumed the wrong one would ship this live to
 * production on an unset variable.
 */
export function revisionGovernanceEnabled(): boolean {
  const configured = process.env.REVISION_GOVERNANCE_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}

export interface SupersededGoverningRevision {
  entityType: string;
  entityId: string;
  revisionLabel: string;
}

/**
 * For each lot, the ACTIVE governing-revision links whose target record has
 * since been superseded. Keyed by lot id; a lot with none is absent from the
 * map rather than mapped to an empty array.
 *
 * Three queries regardless of how many lots are passed — the claim-readiness
 * page runs this over 500 lots at a time and P1 budgets the whole page against
 * a pre-G1 baseline, so a per-lot fan-out was never an option.
 *
 * Returns an empty map when the flag is off, which is what keeps the readiness
 * item unemittable in production until the rollout step.
 */
export async function loadSupersededGoverningRevisions(
  lotIds: string[],
): Promise<Map<string, SupersededGoverningRevision[]>> {
  const bySupersededLot = new Map<string, SupersededGoverningRevision[]>();
  if (!revisionGovernanceEnabled() || lotIds.length === 0) return bySupersededLot;

  const links = await prisma.lotGoverningRevision.findMany({
    where: { lotId: { in: lotIds }, unlinkedAt: null },
    select: { lotId: true, entityType: true, entityId: true, revisionLabel: true },
  });
  if (links.length === 0) return bySupersededLot;

  const drawingIds = links.filter((l) => l.entityType === 'drawing').map((l) => l.entityId);
  const documentIds = links
    .filter((l) => DOCUMENT_BACKED_ENTITY_TYPES.includes(l.entityType as GovernedEntityType))
    .map((l) => l.entityId);

  // `itp_template` is absent on purpose: `ITPTemplate` has no supersession
  // column until G2 §2.2(a), so a template link can never read as superseded
  // here. Silently, but not unknowably — this comment is the record.
  const [supersededDrawings, supersededDocuments] = await Promise.all([
    drawingIds.length > 0
      ? prisma.drawing.findMany({
          where: { id: { in: drawingIds }, supersededById: { not: null } },
          select: { id: true },
        })
      : [],
    documentIds.length > 0
      ? prisma.document.findMany({
          where: { id: { in: documentIds }, supersededById: { not: null } },
          select: { id: true },
        })
      : [],
  ]);

  const supersededIds = new Set([
    ...supersededDrawings.map((row) => row.id),
    ...supersededDocuments.map((row) => row.id),
  ]);

  for (const link of links) {
    if (!supersededIds.has(link.entityId)) continue;
    const existing = bySupersededLot.get(link.lotId);
    const entry = {
      entityType: link.entityType,
      entityId: link.entityId,
      revisionLabel: link.revisionLabel,
    };
    if (existing) existing.push(entry);
    else bySupersededLot.set(link.lotId, [entry]);
  }

  return bySupersededLot;
}
