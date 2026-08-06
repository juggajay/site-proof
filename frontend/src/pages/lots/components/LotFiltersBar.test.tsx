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
  it('spends one row on search and the filter trigger', () => {
    renderMobileBar();

    expect(screen.getByPlaceholderText('Search lots...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument();
  });

  it('leaves the view switcher to the page header, which hosts it on the title row', () => {
    // Moved in the lot-register layout fix: the switcher used to own a whole
    // row here, pushing the first lot card off a phone screen. Its behaviour is
    // covered by LotsPageHeader.test.tsx.
    renderMobileBar();

    expect(screen.queryByTestId('view-toggle-map')).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-toggle-linear')).not.toBeInTheDocument();
  });

  it('opens the filter bottom sheet from the trigger', () => {
    renderMobileBar();

    fireEvent.click(screen.getByRole('button', { name: /Filters/i }));
    expect(screen.getByText('Filter Lots')).toBeInTheDocument();
  });
});
