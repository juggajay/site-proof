/**
 * Wave 6 — pure review→decision mapping for the model_lot_linking stage.
 *
 * The candidate's `links` are the deterministic auto matches (plus carried-
 * forward manual links); `ambiguous` is the human-decision bucket. The reviewer
 * resolves each ambiguous element to one candidate lot (or leaves it unlinked),
 * and the accept always goes through `editedPayload` so the applied links are
 * exactly what was on screen.
 */
import type { ModelLinkCandidateLink, ModelLotLinkingCandidate } from './copilotData';

/** elementId → chosen lotId ('' = leave unlinked). */
export type AmbiguousDecisions = Record<string, string>;

export interface LinkingEditedPayload {
  versionId: string;
  links: ModelLinkCandidateLink[];
}

/**
 * Build the accept-with-edits payload: every proposed link passes through
 * unchanged (source/carriedForward preserved), and each resolved ambiguous
 * element is appended as a MANUAL link — a human made the call, and manual
 * links carry forward to the next model version by IFC GUID.
 */
export function buildLinkingEditedPayload(
  candidate: ModelLotLinkingCandidate,
  decisions: AmbiguousDecisions,
): LinkingEditedPayload {
  const resolved: ModelLinkCandidateLink[] = candidate.ambiguous
    .filter((element) => (decisions[element.elementId] ?? '') !== '')
    .map((element) => ({
      elementId: element.elementId,
      ifcGuid: element.ifcGuid,
      lotNumberValue: element.lotNumberValue,
      lotId: decisions[element.elementId],
      source: 'manual' as const,
    }));
  return { versionId: candidate.versionId, links: [...candidate.links, ...resolved] };
}

/** How many links an accept would apply given the current decisions. */
export function linkedCountWithDecisions(
  candidate: ModelLotLinkingCandidate,
  decisions: AmbiguousDecisions,
): number {
  const resolvedCount = candidate.ambiguous.filter(
    (element) => (decisions[element.elementId] ?? '') !== '',
  ).length;
  return candidate.links.length + resolvedCount;
}

/** Distinct unlinked lot-number samples worth showing (nulls dropped). */
export function unlinkedSampleValues(candidate: ModelLotLinkingCandidate, max: number): string[] {
  const values = new Set<string>();
  for (const element of candidate.unlinked) {
    if (element.lotNumberValue) values.add(element.lotNumberValue);
    if (values.size >= max) break;
  }
  return [...values];
}
