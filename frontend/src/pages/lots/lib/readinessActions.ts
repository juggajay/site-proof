import { INTERNAL_ROLES } from '@/appRouteRoles';
import type { EvidenceReadinessItem, LotEvidenceReadiness } from '@/types/evidenceReadiness';
import { isKnownLotTabParam, resolveLotTab } from '../lotWorkspaceTabs';
import type { LotTab } from '../types';

function tabFromHref(href?: string): LotTab | null {
  if (!href) return null;
  if (!href.startsWith('?')) return null;
  const params = new URLSearchParams(href.slice(1));
  const tab = params.get('tab');
  if (!tab) return null;
  // Accepts both the canonical DG-4a pair (?tab=evidence&view=documents) and the
  // pre-DG-4a single value (?tab=documents) the readiness engine emits today.
  return isKnownLotTabParam(tab) ? resolveLotTab(tab, params.get('view')) : null;
}

function tabFromArea(area: EvidenceReadinessItem['area']): LotTab | null {
  if (area === 'itp' || area === 'hold_point') return 'itp';
  if (area === 'test') return 'tests';
  if (area === 'ncr') return 'ncrs';
  if (area === 'document') return 'documents';
  return null;
}

/** In-app tab this item's action lands on, or null when it has no tab destination. */
export function actionTab(item: EvidenceReadinessItem): LotTab | null {
  const tab = tabFromHref(item.actionHref);
  if (item.actionHref && !tab) return null;
  return tab ?? tabFromArea(item.area);
}

/** Absolute href this item's action lands on, or null when it is a tab action. */
export function externalActionHref(item: EvidenceReadinessItem): string | null {
  if (!item.actionHref || tabFromHref(item.actionHref)) return null;
  if (item.actionHref.startsWith('/') || item.actionHref.startsWith('http')) {
    return item.actionHref;
  }
  return null;
}

const SEVERITY_RANK: Record<EvidenceReadinessItem['severity'], number> = {
  blocker: 0,
  warning: 1,
  support: 2,
};

export interface ReadinessPrimaryAction {
  code: string;
  label: string;
  /** Set when the action navigates away; mutually exclusive with `tab`. */
  href: string | null;
  /** Set when the action switches a lot tab; mutually exclusive with `href`. */
  tab: LotTab | null;
}

/**
 * The single readiness item that earns the lot header's solid primary button
 * (A4 spec §7). Ranking is severity first, then the item's stable `code` —
 * these items carry no due date or age, so the two-key sort is the whole rule
 * and the order never flickers between fetches.
 *
 * Only items the engine authored an action for are eligible: a label plus a
 * destination we can actually reach. An item with no action is never given one
 * — a fabricated urgency signal on a quality record is worse than no signal.
 *
 * "Reach" is per-viewer, which is why `viewerRole` is required. Every navigating
 * readiness action the engine emits today lands on `/projects/:id/hold-points`
 * (`qualityRoutes.ts:217`), which `App.tsx` guards with `INTERNAL_ROLES` — so
 * offering it to a viewer was a solid primary button onto an access-denied
 * screen, against this docstring. Tab actions stay: they switch a tab on a page
 * the viewer is already reading, so no guard is involved.
 *
 * Pass the RoleSwitcher-aware `actualRole`, never `user.role`. An absent role
 * fails closed.
 */
export function pickPrimaryReadinessAction(
  readiness: LotEvidenceReadiness | null | undefined,
  viewerRole: string | null | undefined,
): ReadinessPrimaryAction | null {
  if (!readiness) return null;
  const canNavigate = INTERNAL_ROLES.includes(viewerRole ?? '');

  const buckets = [readiness.conformance, readiness.claim, readiness.managementPrep];
  const items = buckets.flatMap((bucket) =>
    bucket ? [...bucket.blockers, ...bucket.warnings, ...bucket.support] : [],
  );

  const seen = new Set<string>();
  const candidates: { item: EvidenceReadinessItem; action: ReadinessPrimaryAction }[] = [];

  for (const item of items) {
    if (!item.actionLabel || seen.has(item.code)) continue;
    const href = externalActionHref(item);
    if (href && !canNavigate) continue;
    const tab = href ? null : actionTab(item);
    if (!href && !tab) continue;
    seen.add(item.code);
    candidates.push({ item, action: { code: item.code, label: item.actionLabel, href, tab } });
  }

  candidates.sort(
    (a, b) =>
      SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] ||
      a.item.code.localeCompare(b.item.code),
  );

  return candidates[0]?.action ?? null;
}
