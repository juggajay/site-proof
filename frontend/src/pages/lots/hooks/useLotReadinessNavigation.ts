/**
 * Readiness-driven tab navigation for LotDetailPage, extracted from the page.
 *
 * DG-4a: the URL now names one of five workspace tabs plus an optional subview
 * (`?tab=evidence&view=photos`), resolved through `../lotWorkspaceTabs`. Legacy
 * and unknown values resolve to a real panel and are rewritten in place with
 * replace:true, preserving every other param. Everything below is otherwise
 * unchanged.
 *
 * Owns the URL-derived tab state (`tab`/`view` query params, `action=assign-itp`), the
 * readiness focus target + highlighted-tab state, and the effect that runs
 * after a readiness action navigates to a tab: one animation frame to
 * scrollIntoView/focus the tab panel (honouring prefers-reduced-motion) and a
 * 3s highlight pulse.
 *
 * The page passes in the router's searchParams/setSearchParams pair and the
 * tab-panel ref it renders; the hook returns the exact values/handlers the
 * page previously owned inline. Behavior is intentionally unchanged: same
 * query-param semantics (`tab` always set; `action=assign-itp` only when the
 * ITP tab is targeted with a no_itp/no_itp_assigned action code), same
 * replace:true cleanup of a consumed assign-itp action, same reduced-motion
 * mapping, and the same 3s highlight timeout whose functional clear only
 * resets its own tab. The only difference from the inline code is that
 * `tabSectionRef` appears in the effect deps — required by exhaustive-deps now
 * that the ref arrives as a param, and a no-op because useRef identities are
 * stable across renders.
 */
import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import {
  defaultContentTab,
  isCanonicalLotTabUrl,
  lotTabParams,
  resolveLotTab,
  workspaceTabFor,
  type LotWorkspaceTab,
} from '../lotWorkspaceTabs';
import type { LotTab } from '../types';

export interface ReadinessFocusTarget {
  tab: LotTab;
  requestedAt: number;
}

interface UseLotReadinessNavigationParams {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  /** The page's tab-panel element; scrolled/focused after readiness navigation. */
  tabSectionRef: RefObject<HTMLDivElement>;
}

export function useLotReadinessNavigation({
  searchParams,
  setSearchParams,
  tabSectionRef,
}: UseLotReadinessNavigationParams) {
  // DG-4a: the URL names a workspace tab plus an optional subview; both resolve
  // to the content view the panel renders. resolveLotTab is total, so a legacy
  // (?tab=photos) or unknown (?tab=nonsense) value lands on a real panel.
  const tabParam = searchParams.get('tab');
  const viewParam = searchParams.get('view');
  const currentTab = resolveLotTab(tabParam, viewParam);
  const currentWorkspaceTab = workspaceTabFor(currentTab);
  const shouldOpenAssignItp = searchParams.get('action') === 'assign-itp';
  const [readinessFocusTarget, setReadinessFocusTarget] = useState<ReadinessFocusTarget | null>(
    null,
  );
  const [highlightedReadinessTab, setHighlightedReadinessTab] = useState<LotTab | null>(null);

  // Canonicalize a legacy/unknown tab param in place, preserving every other
  // param (commentId on a mention deep link, highlight on an ITP one) so a
  // stored notification link still lands where it always did. Skipped when the
  // URL carries no tab at all: a bare lot URL already means the ITP checklist,
  // and rewriting it would push history churn onto every lot page load.
  const applyCanonicalParams = useCallback((params: URLSearchParams, tabId: LotTab) => {
    const canonical = lotTabParams(tabId);
    params.set('tab', canonical.tab);
    if (canonical.view) params.set('view', canonical.view);
    else params.delete('view');
    return params;
  }, []);

  useEffect(() => {
    if (tabParam === null && viewParam === null) return;
    if (isCanonicalLotTabUrl(tabParam, viewParam, currentTab)) return;
    setSearchParams(applyCanonicalParams(new URLSearchParams(searchParams), currentTab), {
      replace: true,
    });
  }, [applyCanonicalParams, currentTab, searchParams, setSearchParams, tabParam, viewParam]);

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setReadinessFocusTarget(null);
    setHighlightedReadinessTab(null);
    const params = applyCanonicalParams(new URLSearchParams(searchParams), tabId);
    params.delete('action');
    setSearchParams(params);
  };

  /** Top-level tab click: open the workspace tab on its default subview. */
  const handleWorkspaceTabChange = (workspaceTab: LotWorkspaceTab) => {
    handleTabChange(defaultContentTab(workspaceTab));
  };

  const handleReadinessTabChange = (tabId: LotTab, actionCode?: string) => {
    const params = applyCanonicalParams(new URLSearchParams(searchParams), tabId);
    if (tabId === 'itp' && (actionCode === 'no_itp_assigned' || actionCode === 'no_itp')) {
      params.set('action', 'assign-itp');
    } else {
      params.delete('action');
    }
    setReadinessFocusTarget({ tab: tabId, requestedAt: Date.now() });
    setHighlightedReadinessTab(tabId);
    setSearchParams(params);
  };

  const handleAssignItpActionHandled = useCallback(() => {
    if (searchParams.get('action') !== 'assign-itp') return;
    const params = new URLSearchParams(searchParams);
    params.delete('action');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!readinessFocusTarget || readinessFocusTarget.tab !== currentTab) return;

    const frame = window.requestAnimationFrame(() => {
      const target = tabSectionRef.current;
      if (!target) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      target.focus({ preventScroll: true });
    });
    const highlightTimeout = window.setTimeout(() => {
      setHighlightedReadinessTab((tab) => (tab === readinessFocusTarget.tab ? null : tab));
    }, 3000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(highlightTimeout);
    };
  }, [currentTab, readinessFocusTarget, tabSectionRef]);

  return {
    currentTab,
    currentWorkspaceTab,
    shouldOpenAssignItp,
    readinessFocusTarget,
    highlightedReadinessTab,
    handleTabChange,
    handleWorkspaceTabChange,
    handleReadinessTabChange,
    handleAssignItpActionHandled,
  };
}
