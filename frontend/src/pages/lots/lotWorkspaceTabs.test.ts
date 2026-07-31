import { describe, expect, it } from 'vitest';
import {
  LOT_SUBVIEWS,
  LOT_WORKSPACE_TABS,
  defaultContentTab,
  getLotWorkspaceTabsForRole,
  isCanonicalLotTabUrl,
  lotTabLabel,
  lotTabParams,
  resolveLotTab,
  workspaceTabFor,
} from './lotWorkspaceTabs';
import type { LotTab } from './types';

const ALL_CONTENT_TABS: LotTab[] = [
  'itp',
  'tests',
  'ncrs',
  'photos',
  'documents',
  'comments',
  'history',
];

const defaultOrder = LOT_WORKSPACE_TABS.map((tab) => tab.id);

describe('the five workspace tabs', () => {
  it('exposes exactly five tabs, each with a short label for the 390px grid', () => {
    expect(defaultOrder).toEqual(['itp', 'tests', 'ncrs', 'evidence', 'activity']);
    for (const tab of LOT_WORKSPACE_TABS) {
      expect(tab.shortLabel.length).toBeGreaterThan(0);
      expect(tab.shortLabel.length).toBeLessThanOrEqual(tab.label.length);
    }
  });

  it('keeps the default order for non-foreman roles', () => {
    for (const role of ['owner', 'admin', 'project_manager', 'site_manager', undefined, null]) {
      expect(getLotWorkspaceTabsForRole(role).map((tab) => tab.id)).toEqual(defaultOrder);
    }
  });

  it('puts the field-execution tabs first for a foreman without dropping any', () => {
    const ids = getLotWorkspaceTabsForRole('foreman').map((tab) => tab.id);

    expect(ids.slice(0, 3)).toEqual(['itp', 'evidence', 'ncrs']);
    expect([...ids].sort()).toEqual([...defaultOrder].sort());
  });

  it('routes every content view to exactly one workspace tab', () => {
    const covered = ALL_CONTENT_TABS.flatMap((tab) => {
      const workspace = workspaceTabFor(tab);
      const subviews = LOT_SUBVIEWS[workspace];
      return subviews.length === 0 ? [] : [tab];
    });

    // Photos + Documents behind Evidence, Comments + Changes behind Activity.
    expect(covered.sort()).toEqual(['comments', 'documents', 'history', 'photos']);
    expect(LOT_SUBVIEWS.evidence.map((v) => v.id)).toEqual(['photos', 'documents']);
    expect(LOT_SUBVIEWS.activity.map((v) => v.id)).toEqual(['comments', 'history']);
  });

  it('opens Evidence on Photos and Activity on Comments, never on an aggregate', () => {
    expect(defaultContentTab('evidence')).toBe('photos');
    expect(defaultContentTab('activity')).toBe('comments');
  });

  it('labels the former History view "Changes"', () => {
    expect(lotTabLabel('history')).toBe('Changes');
    expect(LOT_SUBVIEWS.activity.find((v) => v.id === 'history')?.label).toBe('Changes');
  });
});

describe('resolveLotTab', () => {
  it.each([
    ['itp', null, 'itp'],
    ['tests', null, 'tests'],
    ['ncrs', null, 'ncrs'],
    ['evidence', 'photos', 'photos'],
    ['evidence', 'documents', 'documents'],
    ['activity', 'comments', 'comments'],
    ['activity', 'changes', 'history'],
  ])('resolves ?tab=%s&view=%s to the %s view', (tab, view, expected) => {
    expect(resolveLotTab(tab, view)).toBe(expected);
  });

  it.each([
    // Legacy links still live in sent emails and stored notification rows.
    ['photos', 'photos'],
    ['documents', 'documents'],
    ['comments', 'comments'],
    ['history', 'history'],
    // The dashboard hold-point alert's deep link; hold points are ITP items.
    ['holdpoints', 'itp'],
  ])('resolves the legacy ?tab=%s to the %s view', (legacy, expected) => {
    expect(resolveLotTab(legacy, null)).toBe(expected);
  });

  it('falls back to the ITP checklist rather than an empty panel', () => {
    for (const nonsense of [null, undefined, '', 'not-a-tab', 'evidence-photos']) {
      expect(resolveLotTab(nonsense, null)).toBe('itp');
    }
  });

  it('falls back to a merged tab default when the view is missing or unknown', () => {
    expect(resolveLotTab('evidence', null)).toBe('photos');
    expect(resolveLotTab('evidence', 'all')).toBe('photos');
    expect(resolveLotTab('activity', 'feed')).toBe('comments');
  });

  it('ignores a view param on a tab that has no subviews', () => {
    expect(resolveLotTab('tests', 'photos')).toBe('tests');
  });
});

describe('canonical params', () => {
  it('round-trips every content view through the URL', () => {
    for (const tab of ALL_CONTENT_TABS) {
      const { tab: tabParam, view } = lotTabParams(tab);
      expect(resolveLotTab(tabParam, view)).toBe(tab);
      expect(isCanonicalLotTabUrl(tabParam, view, tab)).toBe(true);
    }
  });

  it('maps the four legacy tab values onto their canonical pair', () => {
    expect(lotTabParams('photos')).toEqual({ tab: 'evidence', view: 'photos' });
    expect(lotTabParams('documents')).toEqual({ tab: 'evidence', view: 'documents' });
    expect(lotTabParams('comments')).toEqual({ tab: 'activity', view: 'comments' });
    expect(lotTabParams('history')).toEqual({ tab: 'activity', view: 'changes' });
  });

  it('reports legacy and stale URLs as non-canonical so the page rewrites them', () => {
    expect(isCanonicalLotTabUrl('photos', null, 'photos')).toBe(false);
    expect(isCanonicalLotTabUrl('comments', null, 'comments')).toBe(false);
    expect(isCanonicalLotTabUrl('holdpoints', null, 'itp')).toBe(false);
    // A stale view left over from the previous tab.
    expect(isCanonicalLotTabUrl('tests', 'photos', 'tests')).toBe(false);
  });
});
