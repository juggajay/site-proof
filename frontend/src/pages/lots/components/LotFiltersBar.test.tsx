import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { LotFiltersBar } from './LotFiltersBar';

function renderMobileBar(overrides: { viewMode?: 'list' | 'card' | 'linear' | 'map' } = {}) {
  const onToggleViewMode = vi.fn();
  render(
    <LotFiltersBar
      isMobile
      isSubcontractor={false}
      canViewBudgets={false}
      statusFilters={[]}
      activityFilter=""
      searchQuery=""
      chainageMinFilter=""
      chainageMaxFilter=""
      subcontractorFilter=""
      areaZoneFilter=""
      sortField="lotNumber"
      sortDirection="asc"
      activityTypes={[]}
      areaZones={[]}
      subcontractors={[]}
      totalLots={2}
      filteredLotsCount={2}
      viewMode={overrides.viewMode ?? 'list'}
      onToggleViewMode={onToggleViewMode}
      onUpdateFilters={vi.fn()}
      visibleColumns={[]}
      onSetVisibleColumns={vi.fn()}
      columnOrder={[]}
      onSetColumnOrder={vi.fn()}
    />,
  );
  return { onToggleViewMode };
}

describe('LotFiltersBar (mobile)', () => {
  it('offers the map views on mobile with 44px touch targets', () => {
    const { onToggleViewMode } = renderMobileBar();

    const mapButton = screen.getByTestId('view-toggle-map');
    expect(mapButton).toHaveAttribute('aria-label', 'Satellite map view');
    expect(mapButton.className).toMatch(/\bh-11\b/);
    expect(mapButton.className).toMatch(/\bw-11\b/);
    expect(screen.getByTestId('view-toggle-linear')).toBeInTheDocument();

    fireEvent.click(mapButton);
    expect(onToggleViewMode).toHaveBeenCalledWith('map');
  });

  it("marks the card toggle active for 'list' (mobile renders list as cards)", () => {
    renderMobileBar({ viewMode: 'list' });
    expect(screen.getByTestId('view-toggle-card').className).toMatch(/bg-background/);
  });
});
