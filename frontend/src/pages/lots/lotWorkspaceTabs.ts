/**
 * DG-4a — the lot workspace's five top-level tabs, and the URL contract that
 * maps them onto the seven content views the page already renders.
 *
 * Two pairs merge behind a subview control: Evidence holds Photos + Documents,
 * Activity holds Comments + Changes (the tab shipped as "History"). The
 * *content* id (`LotTab`) is deliberately unchanged, so every tab-keyed fetch
 * (`useLotTabData`, `useItpInstance`) and every readiness action
 * (`lib/readinessActions.ts`) keeps working untouched — and only the selected
 * subview is ever fetched, never both halves concatenated.
 *
 * URL shape: `?tab=<workspace>[&view=<subview>]`. Pre-DG-4a links are still
 * live in sent emails and in stored notification rows — mention notifications
 * emitted `?tab=comments&commentId=…` (`backend/src/routes/notifications/
 * mentions.ts`) and the hold-point dashboard alert emits `?tab=holdpoints`
 * (`backend/src/routes/dashboard/operationalRoutes.ts`) — so those values
 * resolve here and `useLotReadinessNavigation` rewrites the URL to canonical
 * form with replace:true, preserving every other param. Anything unrecognised
 * resolves to the ITP checklist rather than an empty panel.
 */

import type { LotTab, TabConfig } from './types';

export type LotWorkspaceTab = 'itp' | 'tests' | 'ncrs' | 'evidence' | 'activity';

export interface WorkspaceTabConfig {
  id: LotWorkspaceTab;
  label: string;
  /** Used on narrow screens, where all five share a 5-column grid. */
  shortLabel: string;
}

export const LOT_WORKSPACE_TABS: WorkspaceTabConfig[] = [
  { id: 'itp', label: 'ITP Checklist', shortLabel: 'ITP' },
  { id: 'tests', label: 'Test Results', shortLabel: 'Tests' },
  { id: 'ncrs', label: 'NCRs', shortLabel: 'NCRs' },
  { id: 'evidence', label: 'Evidence', shortLabel: 'Evidence' },
  { id: 'activity', label: 'Activity', shortLabel: 'Activity' },
];

// Foreman-first order, carried over from the seven-tab strip: the
// field-execution tabs come first. Evidence takes the slot Photos held.
export const FOREMAN_WORKSPACE_TAB_PRIORITY: LotWorkspaceTab[] = ['itp', 'evidence', 'ncrs'];

/** Workspace tabs ordered for a role. Pure and total: no tab is ever dropped. */
export function getLotWorkspaceTabsForRole(role: string | undefined | null): WorkspaceTabConfig[] {
  if (role !== 'foreman') return LOT_WORKSPACE_TABS;

  const prioritized = FOREMAN_WORKSPACE_TAB_PRIORITY.map((id) =>
    LOT_WORKSPACE_TABS.find((tab) => tab.id === id),
  ).filter((tab): tab is WorkspaceTabConfig => tab !== undefined);
  const rest = LOT_WORKSPACE_TABS.filter((tab) => !FOREMAN_WORKSPACE_TAB_PRIORITY.includes(tab.id));

  return [...prioritized, ...rest];
}

/** Subviews of a merged tab, in display order. Empty for the three single tabs. */
export const LOT_SUBVIEWS: Record<LotWorkspaceTab, TabConfig[]> = {
  itp: [],
  tests: [],
  ncrs: [],
  evidence: [
    { id: 'photos', label: 'Photos' },
    { id: 'documents', label: 'Documents' },
  ],
  activity: [
    { id: 'comments', label: 'Comments' },
    { id: 'history', label: 'Changes' },
  ],
};

/** The canonical `?tab=`/`?view=` pair for a content tab. `view` is null on single tabs. */
const CONTENT_TO_PARAMS: Record<LotTab, { tab: LotWorkspaceTab; view: string | null }> = {
  itp: { tab: 'itp', view: null },
  tests: { tab: 'tests', view: null },
  ncrs: { tab: 'ncrs', view: null },
  photos: { tab: 'evidence', view: 'photos' },
  documents: { tab: 'evidence', view: 'documents' },
  comments: { tab: 'activity', view: 'comments' },
  history: { tab: 'activity', view: 'changes' },
};

const VIEW_TO_CONTENT: Record<LotWorkspaceTab, Record<string, LotTab>> = {
  itp: {},
  tests: {},
  ncrs: {},
  evidence: { photos: 'photos', documents: 'documents' },
  activity: { comments: 'comments', changes: 'history' },
};

/** The subview a merged tab opens on when the URL names no (or an unknown) view. */
const DEFAULT_CONTENT: Record<LotWorkspaceTab, LotTab> = {
  itp: 'itp',
  tests: 'tests',
  ncrs: 'ncrs',
  // Gate: Evidence opens on the full shipped Photos experience, Activity on the
  // full shipped Comments experience — never on an aggregate.
  evidence: 'photos',
  activity: 'comments',
};

/** Pre-DG-4a `?tab=` values still live in stored notifications and sent emails. */
const LEGACY_TAB_PARAM: Record<string, LotTab> = {
  photos: 'photos',
  documents: 'documents',
  comments: 'comments',
  history: 'history',
  // Hold points are ITP checklist items; the dashboard alert's ?tab=holdpoints
  // rendered an empty panel before DG-4a.
  holdpoints: 'itp',
};

export function lotTabParams(tab: LotTab): { tab: LotWorkspaceTab; view: string | null } {
  return CONTENT_TO_PARAMS[tab];
}

export function workspaceTabFor(tab: LotTab): LotWorkspaceTab {
  return CONTENT_TO_PARAMS[tab].tab;
}

/** The content view a workspace tab opens on. */
export function defaultContentTab(tab: LotWorkspaceTab): LotTab {
  return DEFAULT_CONTENT[tab];
}

/**
 * Resolve the `?tab=`/`?view=` pair to the content view to render. Total: every
 * input — absent, legacy, or nonsense — yields a tab with a real panel behind it.
 */
export function resolveLotTab(
  tabParam: string | null | undefined,
  viewParam: string | null | undefined,
): LotTab {
  const workspace = LOT_WORKSPACE_TABS.find((tab) => tab.id === tabParam)?.id;
  if (!workspace) return LEGACY_TAB_PARAM[tabParam ?? ''] ?? 'itp';
  return VIEW_TO_CONTENT[workspace][viewParam ?? ''] ?? DEFAULT_CONTENT[workspace];
}

/**
 * True when `?tab=<value>` names a tab this page knows — canonical or legacy.
 * `resolveLotTab` is total, so callers that must distinguish "not a lot-tab
 * link at all" from "a tab link" need this first.
 */
export function isKnownLotTabParam(tabParam: string | null | undefined): boolean {
  if (!tabParam) return false;
  return (
    LOT_WORKSPACE_TABS.some((tab) => tab.id === tabParam) ||
    Object.prototype.hasOwnProperty.call(LEGACY_TAB_PARAM, tabParam)
  );
}

/** True when the URL already names this content tab canonically. */
export function isCanonicalLotTabUrl(
  tabParam: string | null | undefined,
  viewParam: string | null | undefined,
  tab: LotTab,
): boolean {
  const canonical = CONTENT_TO_PARAMS[tab];
  return tabParam === canonical.tab && (viewParam ?? null) === canonical.view;
}

const CONTENT_LABEL: Record<LotTab, string> = {
  itp: 'ITP Checklist',
  tests: 'Test Results',
  ncrs: 'NCRs',
  photos: 'Photos',
  documents: 'Documents',
  comments: 'Comments',
  history: 'Changes',
};

/** Panel heading / aria label for a content view. */
export function lotTabLabel(tab: LotTab): string {
  return CONTENT_LABEL[tab];
}
