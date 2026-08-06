// The lot's test requirement summary, as the UI sees it.
//
// Every number here is computed SERVER-SIDE by the sufficiency engine
// (`backend/src/routes/testResults/lotRequirements.ts`). Nothing in this file
// recomputes a requirement — it formats what arrived and nothing more, so the
// register, the lot page and the readiness panel cannot disagree about how many
// tests a lot needs.
//
// The summary is LOT-SCOPED on purpose. There is deliberately no register-wide
// denominator: the test register spans lots, filters and pages, so any single
// ratio across it would have no defined scope and would read as a compliance
// claim about a set nobody chose.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Mirrors the backend `UnknownCause` vocabulary. */
export type RequirementUnknownCause =
  | 'no_ruleset_for_project'
  | 'no_rule_for_activity'
  | 'activity_not_canonical'
  | 'scale_not_selected'
  | 'scale_not_recognised'
  | 'quantity_missing';

export interface RequirementCitation {
  authority: string;
  document: string;
  clause: string;
  edition: string;
  /** False for a `draft` pack — disclosed, never hidden. */
  confirmed: boolean;
}

export interface LotTestRequirementRule {
  ruleId: string;
  testType: string;
  state: 'satisfied' | 'insufficient' | 'unknown';
  /** Null means the requirement is not checkable yet — render the reason. */
  requiredCount: number | null;
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  outstandingCount: number;
  unknownCauses: RequirementUnknownCause[];
  citation: RequirementCitation | null;
}

export interface LotTestRequirements {
  lotId: string;
  state: 'satisfied' | 'insufficient' | 'unknown';
  mode: 'off' | 'warn' | 'block';
  ruleset: {
    id: string;
    status: string;
    revalidationLapsed: boolean;
    scaleLabel: string | null;
  } | null;
  rules: LotTestRequirementRule[];
  unknownCauses: RequirementUnknownCause[];
}

export interface BatchRaiseResponse {
  lotId: string;
  created: { ruleId: string; testType: string; count: number; testResultIds: string[] }[];
  totalCreated: number;
}

/**
 * Why a requirement cannot be checked, phrased as HELP.
 *
 * "Test frequency cannot be checked" is an accusation; "record this lot's
 * quantity to check the frequency" is the same fact with the next action in it.
 * The user meets the engine as help before they ever meet it as a blocker.
 */
export function unknownCauseHelp(
  cause: RequirementUnknownCause,
  scaleLabel?: string | null,
): string {
  switch (cause) {
    case 'no_ruleset_for_project':
      return 'CIVOS has no published frequency rules for this project’s specification yet';
    case 'no_rule_for_activity':
      return 'no published rule covers this lot’s activity';
    case 'activity_not_canonical':
      return 'set this lot’s activity so CIVOS knows which rule applies';
    case 'scale_not_selected':
      return `record this lot’s ${scaleLabel || 'testing scale'}`;
    case 'scale_not_recognised':
      return `this lot’s ${scaleLabel || 'testing scale'} is not one the governing specification uses`;
    case 'quantity_missing':
      return 'record this lot’s quantity (or draw its geometry) to check the frequency';
  }
}

/** The help sentence for a rule (or the whole lot) that cannot be checked. */
export function unknownHelpText(
  causes: RequirementUnknownCause[],
  scaleLabel?: string | null,
): string {
  if (causes.length === 0) return 'requirement not yet checkable';
  const reasons = causes.map((cause) => unknownCauseHelp(cause, scaleLabel));
  return `requirement not yet checkable — ${reasons.join('; ')}`;
}

/**
 * The working, shown. "6 required — DTP (VicRoads) v8.0, November 2025 cl.
 * 204.13(a)". Returns null when there is nothing to cite, so the caller renders
 * no empty disclosure.
 */
export function citationText(rule: LotTestRequirementRule): string | null {
  if (rule.requiredCount === null || !rule.citation) return null;
  const { authority, edition, clause } = rule.citation;
  return `${rule.requiredCount} required — ${authority} ${edition} cl. ${clause}`;
}

/**
 * The state breakdown behind the headline fraction. Raised-but-resultless rows
 * must never read as progress: "6 of 6 raised" is not "6 of 6 passing", so the
 * awaiting and failed counts are named separately and never folded in.
 */
export function progressText(rule: LotTestRequirementRule): string | null {
  if (rule.requiredCount === null) return null;
  const parts: string[] = [];
  if (rule.pendingCount > 0) parts.push(`${rule.pendingCount} raised, awaiting results`);
  if (rule.failedCount > 0) parts.push(`${rule.failedCount} failed`);
  if (rule.outstandingCount > 0) parts.push(`${rule.outstandingCount} still to raise`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function fetchLotTestRequirements(lotId: string): Promise<LotTestRequirements> {
  return apiFetch<LotTestRequirements>(
    `/api/test-results/lots/${encodeURIComponent(lotId)}/requirements`,
  );
}

/**
 * The requirement summary for one lot.
 *
 * The endpoint is INTERNAL-ONLY (it mirrors the project test-coverage gate), so
 * a subcontractor-scoped session gets a 403 and this query simply has no data —
 * the panel renders nothing rather than an error, because a shortfall is CIVOS's
 * advisory judgement and not something a subcontractor portal states.
 */
export function useLotTestRequirements(lotId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.lotTestRequirements(lotId || ''),
    queryFn: () => fetchLotTestRequirements(lotId!),
    enabled: Boolean(lotId),
    retry: false,
    staleTime: 30 * 1000,
  });
}
