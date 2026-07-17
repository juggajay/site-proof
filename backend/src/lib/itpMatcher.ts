/**
 * Deterministic lot → ITP template matcher (Wave 2, W2-PR2).
 *
 * Implements the matching algorithm from
 * `docs/research/wave2-itp-matching-taxonomy-spec-2026-07-15.md` §2 — hard
 * state/spec filter, canonical-slug activity filter (via the §1 fold), and
 * tier routing by candidate count. NO AI: Tier-B candidates are only ordered
 * deterministically here; AI ranking of the shortlist is W2-PR3.
 *
 * `routeTemplateMatch` is the single authority for the hard filter and tier
 * routing and is DB-free so the audit-critical state boundary is unit-tested
 * without a database. `matchTemplatesForProject` is the thin DB wrapper.
 */
import { CANONICAL_ACTIVITIES, foldActivityValue, type FoldResult } from './activityTaxonomy.js';
import { prisma } from './prisma.js';
import { AppError } from './AppError.js';

export type MatchTier = 'A' | 'B' | 'C';
export type ActivityMatchKind = 'exact' | 'family' | 'unclassified';

/** A template as the matcher needs to see it (DB-shape-independent). */
export interface TemplateForMatch {
  id: string;
  name: string;
  projectId: string | null;
  stateSpec: string | null;
  activityType: string | null;
  checklistItemCount: number;
  holdPointCount: number;
}

export interface MatchCandidate {
  id: string;
  name: string;
  scope: 'project' | 'global';
  stateSpec: string | null;
  matchKind: ActivityMatchKind;
  /** True for an Austroads national-baseline template offered as a gap-fill. */
  baseline?: boolean;
  checklistItemCount: number;
  holdPointCount: number;
}

export interface MatchResult {
  tier: MatchTier;
  /** Set only for Tier A (the single exact-slug match); null otherwise. */
  suggestedTemplateId: string | null;
  candidates: MatchCandidate[];
}

const SLUG_TO_FAMILY = new Map<string, string>(CANONICAL_ACTIVITIES.map((a) => [a.slug, a.family]));

// Spec-set vocabulary normalization. Prod (2026-07-16) holds project
// specificationSet values {TfNSW, MRTS, rms, AUS-SPEC} against template
// stateSpec values {TfNSW, MRTS, VicRoads, DIT, Austroads}: 'rms' is simply
// TfNSW's pre-2019 name (9 live projects carry it), so strict equality would
// silently match those projects to nothing — the original case-mismatch bug in
// a new coat. Normalize case/whitespace and fold known synonyms before
// comparing.
const SPEC_SET_SYNONYMS: Record<string, string> = {
  rms: 'tfnsw',
};

function normalizeSpecSet(value: string | null): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (!lower) return null;
  return SPEC_SET_SYNONYMS[lower] ?? lower;
}

// National baseline spec sets — not states, so a strict state filter would
// leave their templates permanently unreachable. Austroads is the national
// road-authority baseline (AGPT Part 8 anchors the taxonomy); AUS-SPEC/IPWEA
// carry the national concrete-flatwork family; WSA carries the national
// utilities family (water/sewer are never road-authority specs in any state).
// They participate as GAP-FILL only: offered when the project + state-matched
// pool has no exact-slug candidate, never displacing a state template and
// never auto-filling (a baseline suggestion is always Tier B — the reviewer
// affirms it knowingly). A project whose OWN specificationSet is one of these
// (e.g. the AUS-SPEC council projects) matches them as PRIMARY via the normal
// state filter, not this pool.
const NATIONAL_BASELINE_SPECS = new Set(['austroads', 'aus-spec', 'ipwea', 'wsa', 'national']);

/**
 * The family a fold result belongs to: an exact Level-2 slug maps to its
 * family; a family-level fold is already a family; an unmappable fold has none.
 */
function familyForFold(fold: FoldResult): string | null {
  if (fold.confidence === 'none') return null;
  if (fold.confidence === 'family') return fold.slug;
  return SLUG_TO_FAMILY.get(fold.slug) ?? null;
}

/**
 * Decide whether a template is an activity candidate for a lot, and of which
 * kind. `null` = not a candidate on activity grounds.
 */
function classifyActivityMatch(
  lotFold: FoldResult,
  tplFold: FoldResult,
  isProjectScoped: boolean,
): ActivityMatchKind | null {
  // Unmappable template value → "unclassified": only ever surfaces for its own
  // project's lots, and only as a Tier-B fallback (never global, never Tier A).
  if (tplFold.confidence === 'none') {
    return isProjectScoped ? 'unclassified' : null;
  }

  const lotFamily = familyForFold(lotFold);
  const tplFamily = familyForFold(tplFold);
  if (!lotFamily || !tplFamily || lotFamily !== tplFamily) return null;

  // Both sides fold to a precise Level-2 slug → exact only if the slugs agree.
  // Two *different* Level-2 slugs in the same family are deliberately NOT a
  // match; the taxonomy discriminates within a family.
  if (lotFold.confidence === 'exact' && tplFold.confidence === 'exact') {
    return lotFold.slug === tplFold.slug ? 'exact' : null;
  }

  // Same family, at least one side only folds to a family (e.g. a template not
  // yet re-tagged to a Level-2 slug) → Tier-B family candidate.
  return 'family';
}

const KIND_ORDER: Record<ActivityMatchKind, number> = {
  exact: 0,
  family: 2,
  unclassified: 4,
};

/**
 * Deterministic candidate order (spec §2): project-scoped before global, then
 * exact before family before unclassified (a baseline template sorts just
 * after its state-matched peers of the same kind), then name ascending.
 */
function compareCandidates(a: MatchCandidate, b: MatchCandidate): number {
  if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1;
  const aKind = KIND_ORDER[a.matchKind] + (a.baseline ? 1 : 0);
  const bKind = KIND_ORDER[b.matchKind] + (b.baseline ? 1 : 0);
  if (aKind !== bKind) return aKind - bKind;
  return a.name.localeCompare(b.name);
}

/**
 * Core deterministic matcher. Applies the hard state/spec filter, the activity
 * filter, and tier routing. Pure — no I/O — so the state boundary is testable.
 */
export function routeTemplateMatch(
  templates: TemplateForMatch[],
  opts: {
    projectId: string;
    specificationSet: string | null;
    activityValue: string | null | undefined;
  },
): MatchResult {
  const { projectId, specificationSet, activityValue } = opts;
  const lotFold = foldActivityValue(activityValue);
  const projectSpec = normalizeSpecSet(specificationSet);

  const candidates: MatchCandidate[] = [];
  const baselinePool: MatchCandidate[] = [];
  for (const t of templates) {
    // HARD FILTER: project-scoped template, OR a global whose (normalized)
    // state spec matches this project. A wrong-state global must NEVER pass,
    // even with a matching activity slug — this boundary is an audit rule, not
    // AI-negotiable. Austroads globals are held aside as the gap-fill pool.
    const isProjectScoped = t.projectId === projectId;
    const templateSpec = t.projectId === null ? normalizeSpecSet(t.stateSpec) : null;
    const isMatchingGlobal = t.projectId === null && templateSpec === projectSpec;
    const isBaselineGlobal =
      t.projectId === null &&
      !isMatchingGlobal &&
      templateSpec !== null &&
      NATIONAL_BASELINE_SPECS.has(templateSpec);
    if (!isProjectScoped && !isMatchingGlobal && !isBaselineGlobal) continue;

    const kind = classifyActivityMatch(lotFold, foldActivityValue(t.activityType), isProjectScoped);
    if (!kind) continue;

    const candidate: MatchCandidate = {
      id: t.id,
      name: t.name,
      scope: isProjectScoped ? 'project' : 'global',
      stateSpec: t.stateSpec,
      matchKind: kind,
      ...(isBaselineGlobal ? { baseline: true } : {}),
      checklistItemCount: t.checklistItemCount,
      holdPointCount: t.holdPointCount,
    };
    (isBaselineGlobal ? baselinePool : candidates).push(candidate);
  }

  // Baseline gap-fill: Austroads templates join only when nothing project- or
  // state-matched folds to the exact slug — they fill gaps, never compete.
  const primaryExact = candidates.filter((c) => c.matchKind === 'exact');
  if (primaryExact.length === 0) {
    candidates.push(...baselinePool);
  }

  candidates.sort(compareCandidates);

  if (candidates.length === 0) {
    return { tier: 'C', suggestedTemplateId: null, candidates: [] };
  }
  // Tier A demands exactly one exact-slug candidate from the project/state
  // pool; a baseline (Austroads) suggestion is always Tier B — the reviewer
  // affirms a national-baseline fallback knowingly, it is never auto-filled.
  if (primaryExact.length === 1) {
    return { tier: 'A', suggestedTemplateId: primaryExact[0].id, candidates };
  }
  return { tier: 'B', suggestedTemplateId: null, candidates };
}

/**
 * DB wrapper: load the project's spec set + all active project/global templates,
 * then route. The wide-ish query (all active globals) is fine — globals are a
 * small set — and lets `routeTemplateMatch` own the entire hard filter.
 */
export async function matchTemplatesForProject(input: {
  projectId: string;
  activity: string | null | undefined;
}): Promise<MatchResult> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, specificationSet: true },
  });
  if (!project) {
    throw AppError.notFound('Project');
  }

  const templates = await prisma.iTPTemplate.findMany({
    where: { isActive: true, OR: [{ projectId: input.projectId }, { projectId: null }] },
    select: {
      id: true,
      name: true,
      projectId: true,
      stateSpec: true,
      activityType: true,
      checklistItems: { select: { pointType: true } },
    },
  });

  const forMatch: TemplateForMatch[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    projectId: t.projectId,
    stateSpec: t.stateSpec,
    activityType: t.activityType,
    checklistItemCount: t.checklistItems.length,
    holdPointCount: t.checklistItems.filter((i) => i.pointType === 'hold_point').length,
  }));

  return routeTemplateMatch(forMatch, {
    projectId: project.id,
    specificationSet: project.specificationSet,
    activityValue: input.activity,
  });
}
