import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
      groupBy={null}
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

function renderDesktopBar(overrides: { groupBy?: 'status' | null } = {}) {
  const onUpdateFilters = vi.fn();
  render(
    <MemoryRouter>
      <LotFiltersBar
        isMobile={false}
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
        groupBy={overrides.groupBy ?? null}
        activityTypes={[]}
        areaZones={[]}
        subcontractors={[]}
        totalLots={2}
        filteredLotsCount={2}
        viewMode="list"
        onToggleViewMode={vi.fn()}
        onUpdateFilters={onUpdateFilters}
        visibleColumns={[]}
        onSetVisibleColumns={vi.fn()}
        columnOrder={[]}
        onSetColumnOrder={vi.fn()}
      />
    </MemoryRouter>,
  );
  return { onUpdateFilters };
}

describe('LotFiltersBar (desktop) group by', () => {
  it('offers a curated field list rather than an arbitrary column drop target', () => {
    renderDesktopBar();

    const select = screen.getByLabelText('Group by:');
    expect(
      Array.from(select.querySelectorAll('option')).map((option) => option.textContent),
    ).toEqual(['None', 'Status', 'Activity Type', 'Subcontractor', 'Area']);
  });

  it('writes the chosen grouping into the register filters', () => {
    const { onUpdateFilters } = renderDesktopBar();

    fireEvent.change(screen.getByLabelText('Group by:'), { target: { value: 'subcontractor' } });
    expect(onUpdateFilters).toHaveBeenCalledWith({ group: 'subcontractor' });
  });

  it('reflects the active grouping so a preset that groups shows its state', () => {
    renderDesktopBar({ groupBy: 'status' });
    expect(screen.getByLabelText('Group by:')).toHaveValue('status');
  });

  it('lists the shipped lot presets in the Views menu', () => {
    renderDesktopBar();

    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    for (const id of ['all', 'open', 'needs-attention', 'recently-opened']) {
      expect(screen.getByTestId(`register-preset-${id}`)).toBeInTheDocument();
    }
  });
});
