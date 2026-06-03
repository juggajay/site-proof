import { describe, expect, it } from 'vitest';
import { LOT_TABS, getLotTabsForRole } from './constants';

const defaultOrder = LOT_TABS.map((tab) => tab.id);

describe('getLotTabsForRole', () => {
  it('keeps the default tab order for non-foreman roles', () => {
    for (const role of ['owner', 'admin', 'project_manager', 'site_manager', undefined, null]) {
      expect(getLotTabsForRole(role).map((tab) => tab.id)).toEqual(defaultOrder);
    }
  });

  it('prioritizes ITP, Photos, then NCRs first for a foreman', () => {
    const ids = getLotTabsForRole('foreman').map((tab) => tab.id);

    expect(ids.slice(0, 3)).toEqual(['itp', 'photos', 'ncrs']);
    // Every default tab is still present/reachable — nothing is dropped.
    expect([...ids].sort()).toEqual([...defaultOrder].sort());
  });
});
