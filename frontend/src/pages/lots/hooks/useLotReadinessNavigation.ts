/**
 * Readiness-driven tab navigation for LotDetailPage, extracted from the page.
 *
 * Owns the URL-derived tab state (`tab` query param, `action=assign-itp`), the
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
import { LOT_TABS } from '../constants';
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
  // Get current tab from URL or default to 'itp'
  const currentTab = (searchParams.get('tab') as LotTab) || 'itp';
  const shouldOpenAssignItp = searchParams.get('action') === 'assign-itp';
  const currentTabLabel = LOT_TABS.find((tab) => tab.id === currentTab)?.label ?? 'Lot detail';
  const [readinessFocusTarget, setReadinessFocusTarget] = useState<ReadinessFocusTarget | null>(
    null,
  );
  const [highlightedReadinessTab, setHighlightedReadinessTab] = useState<LotTab | null>(null);

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setReadinessFocusTarget(null);
    setHighlightedReadinessTab(null);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    params.delete('action');
    setSearchParams(params);
  };

  const handleReadinessTabChange = (tabId: LotTab, actionCode?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
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
    shouldOpenAssignItp,
    currentTabLabel,
    readinessFocusTarget,
    highlightedReadinessTab,
    handleTabChange,
    handleReadinessTabChange,
    handleAssignItpActionHandled,
  };
}
