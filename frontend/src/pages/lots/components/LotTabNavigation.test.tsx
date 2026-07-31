import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { LotTabNavigation } from './LotTabNavigation';
import { LOT_WORKSPACE_TABS, type LotWorkspaceTab } from '../lotWorkspaceTabs';

afterEach(() => {
  cleanup();
});

function renderStrip({
  currentTab = 'itp' as LotWorkspaceTab,
  isMobile = false,
  onValueChange = vi.fn(),
} = {}) {
  render(
    <Tabs value={currentTab} onValueChange={onValueChange}>
      <LotTabNavigation
        tabs={LOT_WORKSPACE_TABS}
        currentTab={currentTab}
        isMobile={isMobile}
        counts={{ tests: 6, ncrs: 2 }}
      />
    </Tabs>,
  );
  return { onValueChange };
}

describe('LotTabNavigation', () => {
  it('renders all five workspace tabs inside a tablist', () => {
    renderStrip();

    expect(screen.getByRole('tablist', { name: 'Lot detail tabs' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'ITP Checklist',
      'Test Results6',
      'NCRs2',
      'Evidence',
      'Activity',
    ]);
  });

  it('pairs the selected tab with its panel and is the strip’s single tab stop', async () => {
    const user = userEvent.setup();
    renderStrip({ currentTab: 'evidence' });

    const selected = screen.getByRole('tab', { name: 'Evidence' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('aria-controls');
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'false');

    // Roving tabIndex: one Tab press enters the strip at the selected tab, and
    // the other four are not separate tab stops.
    await user.tab();
    expect(selected).toHaveFocus();
    await user.tab();
    expect(document.activeElement).not.toHaveAttribute('role', 'tab');
  });

  it('moves between tabs with the arrow keys and Home/End', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderStrip({ currentTab: 'evidence' });

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('activity');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'ITP Checklist' })).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('itp');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveFocus();
  });

  it('activates a tab on click', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderStrip();

    await user.click(screen.getByRole('tab', { name: 'Activity' }));

    expect(onValueChange).toHaveBeenCalledWith('activity');
  });

  it('shows all five tabs in a 5-column grid at 390px, with 48px targets', () => {
    renderStrip({ isMobile: true });

    const list = screen.getByRole('tablist', { name: 'Lot detail tabs' });
    // No tab can hide off-canvas: every one gets a column.
    expect(list).toHaveClass('grid', 'grid-cols-5');
    expect(screen.getAllByRole('tab')).toHaveLength(5);

    // The whole label is the target, and it clears the 48px minimum.
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('min-h-[48px]');
    }
  });

  it('uses short labels on mobile so nothing is clipped', () => {
    renderStrip({ isMobile: true });

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'ITP',
      'Tests6',
      'NCRs2',
      'Evidence',
      'Activity',
    ]);
  });

  it('keeps the scrollable, non-shrinking strip on wider screens', () => {
    renderStrip();

    const list = screen.getByRole('tablist', { name: 'Lot detail tabs' });
    expect(list.parentElement).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('tab', { name: 'ITP Checklist' })).toHaveClass('flex-shrink-0');
  });
});
